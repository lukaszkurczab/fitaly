import { AppState, type AppStateStatus } from "react-native";
import {
  cancelAllReminderScheduling,
  getLastReminderReconcileSnapshot,
  hasStoredReminderScheduleForDay,
  reconcileReminderScheduling,
  type ReminderSchedulingResult,
} from "@/services/reminders/reminderScheduling";
import { getCurrentReminderDecisionDayKey } from "@/services/reminders/reminderService";
import { debugScope } from "@/utils/debug";

type RemovableSubscription = {
  remove: () => void;
};

type ReminderRuntimeReason = "auth_ready" | "app_foreground";

const FOREGROUND_RECONCILE_COOLDOWN_MS = 60_000;

const log = debugScope("ReminderRuntime");

let initialized = false;
let currentAppState: AppStateStatus = AppState.currentState;
let currentUid: string | null = null;
let appStateSubscription: RemovableSubscription | null = null;
let reconcileInFlight = false;
let pendingRun: { reason: ReminderRuntimeReason; force: boolean } | null = null;
let lastReconcileStartedAt = 0;
let lastReconcileResult: ReminderSchedulingResult | null = null;

function isForeground(state: AppStateStatus): boolean {
  return state === "active";
}

async function cleanupReminderStateForUid(
  uid: string,
  reason: "auth_change" | "stale_reconcile",
): Promise<void> {
  try {
    await cancelAllReminderScheduling(uid);
    log.log("cleaned smart reminder state for uid", { uid, reason });
  } catch (error) {
    log.warn("failed to clean smart reminder state for uid", {
      uid,
      reason,
      error,
    });
  }
}

async function runReconcile(
  reason: ReminderRuntimeReason,
  options?: { force?: boolean },
): Promise<void> {
  const uid = currentUid;
  if (!uid) {
    return;
  }

  const force = options?.force === true;
  const now = Date.now();
  if (
    !force &&
    now - lastReconcileStartedAt < FOREGROUND_RECONCILE_COOLDOWN_MS
  ) {
    log.log("skip smart reminder reconcile because cooldown is active", {
      uid,
      reason,
      sinceMs: now - lastReconcileStartedAt,
    });
    return;
  }

  if (reconcileInFlight) {
    pendingRun = { reason, force };
    return;
  }

  if (
    !force &&
    reason === "app_foreground" &&
    (await shouldSkipForegroundReconcile(uid))
  ) {
    return;
  }

  reconcileInFlight = true;
  lastReconcileStartedAt = now;

  try {
    log.log("run smart reminder reconcile", { uid, reason });
    const reconcileResult = await reconcileReminderScheduling(uid);
    lastReconcileResult = reconcileResult;
    log.log("smart reminder reconcile result", {
      uid,
      reason,
      outcome: reconcileResult.outcome,
      schedulingReason: reconcileResult.reason,
      decisionStatus: reconcileResult.result.status,
      decisionSource: reconcileResult.result.source,
      decisionType: reconcileResult.result.decision?.decision ?? null,
    });
  } catch (error) {
    log.warn("smart reminder reconcile failed", { uid, reason, error });
  } finally {
    if (uid !== currentUid) {
      await cleanupReminderStateForUid(uid, "stale_reconcile");
    }

    reconcileInFlight = false;

    if (pendingRun) {
      const next = pendingRun;
      pendingRun = null;
      void runReconcile(next.reason, { force: next.force });
    }
  }
}

async function shouldSkipForegroundReconcile(uid: string): Promise<boolean> {
  const lastSnapshot = getLastReminderReconcileSnapshot();
  const lastDecision = lastReconcileResult?.result.decision;
  const dayKey = getCurrentReminderDecisionDayKey();

  if (
    !lastReconcileResult ||
    lastReconcileResult.outcome !== "scheduled" ||
    lastReconcileResult.reason !== "scheduled" ||
    lastReconcileResult.result.status !== "live_success" ||
    !lastDecision ||
    lastDecision.decision !== "send" ||
    !lastSnapshot ||
    lastSnapshot.uid !== uid ||
    lastSnapshot.dayKey !== dayKey
  ) {
    return false;
  }

  const validUntilMs = new Date(lastDecision.validUntil).getTime();
  if (!Number.isFinite(validUntilMs) || validUntilMs <= Date.now()) {
    return false;
  }

  const hasLocalSchedule = await hasStoredReminderScheduleForDay(uid, dayKey);
  if (!hasLocalSchedule) {
    return false;
  }

  log.log("skip smart reminder foreground reconcile because decision is still valid", {
    uid,
    dayKey,
    validUntil: lastDecision.validUntil,
  });
  return true;
}

function handleAppStateChange(nextState: AppStateStatus): void {
  const previousState = currentAppState;
  currentAppState = nextState;

  if (!isForeground(previousState) && isForeground(nextState)) {
    void runReconcile("app_foreground");
  }
}

export async function initReminderRuntime(): Promise<void> {
  if (initialized) {
    return;
  }

  initialized = true;
  currentAppState = AppState.currentState;
  appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
  log.log("reminder runtime initialized", { appState: currentAppState });

  if (currentUid && isForeground(currentAppState)) {
    await runReconcile("auth_ready", { force: true });
  }
}

export async function setReminderRuntimeUid(uid: string | null): Promise<void> {
  const normalizedUid = uid?.trim() || null;
  const previousUid = currentUid;
  const changed = normalizedUid !== previousUid;
  currentUid = normalizedUid;
  lastReconcileStartedAt = 0;

  if (!changed) {
    return;
  }

  if (previousUid) {
    await cleanupReminderStateForUid(previousUid, "auth_change");
  }

  if (!currentUid) {
    pendingRun = null;
    return;
  }

  if (!initialized) {
    return;
  }

  await runReconcile("auth_ready", { force: true });
}

export function stopReminderRuntime(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
  currentAppState = AppState.currentState;
  currentUid = null;
  reconcileInFlight = false;
  pendingRun = null;
  lastReconcileStartedAt = 0;
  lastReconcileResult = null;
}

export function getReminderRuntimeDiagnostics(): {
  currentUid: string | null;
  initialized: boolean;
  currentAppState: AppStateStatus;
  inFlight: boolean;
  lastResult: ReminderSchedulingResult | null;
  lastSnapshot: ReturnType<typeof getLastReminderReconcileSnapshot>;
} {
  return {
    currentUid,
    initialized,
    currentAppState,
    inFlight: reconcileInFlight,
    lastResult: lastReconcileResult,
    lastSnapshot: getLastReminderReconcileSnapshot(),
  };
}

export function __resetReminderRuntimeForTests(): void {
  stopReminderRuntime();
}
