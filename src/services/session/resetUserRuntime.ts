import AsyncStorage from "@react-native-async-storage/async-storage";
import { emit } from "@/services/core/events";
import { logWarning } from "@/services/core/errorLogger";
import { resetOfflineStorage } from "@/services/offline/db";
import { cleanupUserOfflineAssets } from "@/services/offline/fileCleanup";
import { stopSyncLoop } from "@/services/offline/sync.engine";
import { cancelAllReminderScheduling } from "@/services/reminders/reminderScheduling";
import { resetTelemetryClientRuntime } from "@/services/telemetry/telemetryClient";
import { clearCachedUserProfile } from "@/services/user/userProfileRepository";

export type ResetUserRuntimeReason =
  | "logout"
  | "account_switch"
  | "delete_account"
  | "session_lost";

type ResetUserRuntimeStage =
  | "stop_sync_loop"
  | "cancel_reminders"
  | "clear_profile_cache"
  | "reset_offline_storage"
  | "clear_async_storage"
  | "reset_telemetry_runtime"
  | "cleanup_offline_assets";

type ResetUserRuntimeFailure = {
  uid: string | null;
  reason: ResetUserRuntimeReason;
  stage: ResetUserRuntimeStage;
};

type ResetUserRuntimeOptions = {
  reason: ResetUserRuntimeReason;
};

const RESET_DEDUPE_WINDOW_MS = 2_000;
const RESET_STAGE_TIMEOUT_MS = 5_000;
const resetInFlight = new Map<string, Promise<void>>();
const recentlyResetAt = new Map<string, number>();

export function __resetUserRuntimeDedupeForTests(): void {
  resetInFlight.clear();
  recentlyResetAt.clear();
}

function resetKey(uid: string | null): string {
  return uid ?? "anon";
}

function shouldClearUserScopedKey(key: string, uid: string): boolean {
  return (
    key === `user:profile:${uid}` ||
    key === `ai_credits:${uid}` ||
    key.includes(`:${uid}:`) ||
    key.endsWith(`:${uid}`) ||
    key.endsWith(`_${uid}`)
  );
}

async function clearScopedAsyncStorage(uid: string | null): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const keysToRemove = uid
    ? keys.filter((key) => shouldClearUserScopedKey(key, uid))
    : [];
  if (!keysToRemove.length) return;
  await AsyncStorage.multiRemove(Array.from(new Set(keysToRemove)));
}

async function runCleanupStage(
  stage: ResetUserRuntimeStage,
  uid: string | null,
  reason: ResetUserRuntimeReason,
  cleanup: () => void | Promise<void>,
): Promise<void> {
  try {
    await withStageTimeout(stage, cleanup);
  } catch (error) {
    const payload: ResetUserRuntimeFailure = { uid, reason, stage };
    emit("session:runtime-reset:failed", payload);
    logWarning("user runtime reset stage failed", payload, error);
  }
}

async function withStageTimeout(
  stage: ResetUserRuntimeStage,
  cleanup: () => void | Promise<void>,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const cleanupTask = Promise.resolve()
    .then(cleanup)
    .catch((error) => {
      throw error;
    });

  try {
    await Promise.race([
      cleanupTask,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `User runtime reset stage "${stage}" timed out after ${RESET_STAGE_TIMEOUT_MS}ms`,
            ),
          );
        }, RESET_STAGE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    cleanupTask.catch(() => undefined);
  }
}

export async function resetUserRuntime(
  uid: string | null,
  options: ResetUserRuntimeOptions,
): Promise<void> {
  const key = resetKey(uid);
  const inFlight = resetInFlight.get(key);
  if (inFlight) return inFlight;

  const lastResetAt = recentlyResetAt.get(key) ?? 0;
  if (Date.now() - lastResetAt < RESET_DEDUPE_WINDOW_MS) {
    return;
  }

  const resetTask = runUserRuntimeReset(uid, options).finally(() => {
    resetInFlight.delete(key);
    recentlyResetAt.set(key, Date.now());
  });
  resetInFlight.set(key, resetTask);
  return resetTask;
}

async function runUserRuntimeReset(
  uid: string | null,
  options: ResetUserRuntimeOptions,
): Promise<void> {
  await runCleanupStage("stop_sync_loop", uid, options.reason, () => {
    stopSyncLoop();
  });

  if (uid) {
    await runCleanupStage("cancel_reminders", uid, options.reason, () =>
      cancelAllReminderScheduling(uid),
    );

    await runCleanupStage("clear_profile_cache", uid, options.reason, () => {
      clearCachedUserProfile(uid);
    });
  }

  await runCleanupStage("reset_offline_storage", uid, options.reason, () => {
    resetOfflineStorage();
  });

  await runCleanupStage("clear_async_storage", uid, options.reason, () =>
    clearScopedAsyncStorage(uid),
  );

  await runCleanupStage("reset_telemetry_runtime", uid, options.reason, () =>
    resetTelemetryClientRuntime(),
  );

  if (uid) {
    await runCleanupStage("cleanup_offline_assets", uid, options.reason, () =>
      cleanupUserOfflineAssets(uid),
    );
  }
}
