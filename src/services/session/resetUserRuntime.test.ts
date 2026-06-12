import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  __resetUserRuntimeDedupeForTests,
  resetUserRuntime,
} from "@/services/session/resetUserRuntime";

const mockGetAllKeys = jest.fn<() => Promise<string[]>>();
const mockMultiRemove = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockStopSyncLoop = jest.fn<() => void>();
const mockCancelAllReminderScheduling = jest.fn<
  (uid: string) => Promise<void>
>();
const mockResetOfflineStorage = jest.fn<() => void>();
const mockCleanupUserOfflineAssets = jest.fn<
  (uid: string | null) => Promise<void>
>();
const mockResetTelemetryClientRuntime = jest.fn<() => Promise<void>>();
const mockEmit = jest.fn<(...args: unknown[]) => void>();
const mockLogWarning = jest.fn<(...args: unknown[]) => void>();
const mockClearCachedUserProfile = jest.fn<(uid: string) => void>();
const mockClearLocalMealsRuntime = jest.fn<
  (uid: string | null | undefined) => void
>();
const mockClearStreakRuntime = jest.fn<
  (uid: string | null | undefined) => void
>();
const mockClearBadgeRuntime = jest.fn<
  (uid: string | null | undefined) => void
>();
const mockInvalidateCoachCache = jest.fn<
  (uid: string | null | undefined) => Promise<void>
>();
const mockInvalidateNutritionStateCache = jest.fn<
  (uid: string | null | undefined) => Promise<void>
>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getAllKeys: () => mockGetAllKeys(),
    multiRemove: (...args: unknown[]) => mockMultiRemove(...args),
  },
}));

jest.mock("@/services/offline/sync.engine", () => ({
  stopSyncLoop: () => mockStopSyncLoop(),
}));

jest.mock("@/services/reminders/reminderScheduling", () => ({
  cancelAllReminderScheduling: (uid: string) =>
    mockCancelAllReminderScheduling(uid),
}));

jest.mock("@/services/offline/db", () => ({
  resetOfflineStorage: () => mockResetOfflineStorage(),
}));

jest.mock("@/services/offline/fileCleanup", () => ({
  cleanupUserOfflineAssets: (uid: string | null) =>
    mockCleanupUserOfflineAssets(uid),
}));

jest.mock("@/services/user/userProfileRepository", () => ({
  clearCachedUserProfile: (uid: string) => mockClearCachedUserProfile(uid),
}));

jest.mock("@/services/meals/localMealsStore", () => ({
  clearLocalMealsRuntime: (uid: string | null | undefined) =>
    mockClearLocalMealsRuntime(uid),
}));

jest.mock("@/services/gamification/streakService", () => ({
  clearStreakRuntime: (uid: string | null | undefined) =>
    mockClearStreakRuntime(uid),
}));

jest.mock("@/services/gamification/badgeService", () => ({
  clearBadgeRuntime: (uid: string | null | undefined) =>
    mockClearBadgeRuntime(uid),
}));

jest.mock("@/services/coach/coachService", () => ({
  invalidateCoachCache: (uid: string | null | undefined) =>
    mockInvalidateCoachCache(uid),
}));

jest.mock("@/services/nutritionState/nutritionStateService", () => ({
  invalidateNutritionStateCache: (uid: string | null | undefined) =>
    mockInvalidateNutritionStateCache(uid),
}));

jest.mock("@/services/telemetry/telemetryClient", () => ({
  resetTelemetryClientRuntime: () => mockResetTelemetryClientRuntime(),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}));

describe("resetUserRuntime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetUserRuntimeDedupeForTests();
    mockGetAllKeys.mockResolvedValue([
      "user:profile:user-1",
      "ai_credits:user-1",
      "sync:last_pull_ts:user-1",
      "sync:last_pull_check:meals:user-1",
      "notif:sys:ids:user-1:stats",
      "notif:ids:user-1:smart-reminders:2026-04-24",
      "current_meal_draft_user-1",
      "chat-active-thread-user-1",
      "chat-active-thread-alt-user-1",
      "theme:mode",
      "chat-active-thread-user-10",
    ]);
    mockMultiRemove.mockResolvedValue(undefined);
    mockCancelAllReminderScheduling.mockResolvedValue(undefined);
    mockCleanupUserOfflineAssets.mockResolvedValue(undefined);
    mockResetTelemetryClientRuntime.mockResolvedValue(undefined);
    mockInvalidateCoachCache.mockResolvedValue(undefined);
    mockInvalidateNutritionStateCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("cleans user-scoped runtime state for a uid", async () => {
    await resetUserRuntime("user-1", { reason: "logout" });

    expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);
    expect(mockCancelAllReminderScheduling).toHaveBeenCalledWith("user-1");
    expect(mockClearCachedUserProfile).toHaveBeenCalledWith("user-1");
    expect(mockClearLocalMealsRuntime).toHaveBeenCalledWith("user-1");
    expect(mockClearStreakRuntime).toHaveBeenCalledWith("user-1");
    expect(mockClearBadgeRuntime).toHaveBeenCalledWith("user-1");
    expect(mockInvalidateCoachCache).toHaveBeenCalledWith("user-1");
    expect(mockInvalidateNutritionStateCache).toHaveBeenCalledWith("user-1");
    expect(mockResetOfflineStorage).toHaveBeenCalledTimes(1);
    expect(mockResetTelemetryClientRuntime).toHaveBeenCalledTimes(1);
    expect(mockCleanupUserOfflineAssets).toHaveBeenCalledWith("user-1");
    expect(mockMultiRemove).toHaveBeenCalledWith([
      "user:profile:user-1",
      "ai_credits:user-1",
      "sync:last_pull_ts:user-1",
      "sync:last_pull_check:meals:user-1",
      "notif:sys:ids:user-1:stats",
      "notif:ids:user-1:smart-reminders:2026-04-24",
      "current_meal_draft_user-1",
      "chat-active-thread-user-1",
    ]);
    expect(mockMultiRemove.mock.calls[0]?.[0]).toEqual(
      expect.not.arrayContaining([
        "theme:mode",
        "chat-active-thread-alt-user-1",
        "chat-active-thread-user-10",
      ]),
    );
  });

  it("preserves chat active thread keys whose uid only suffix-collides", async () => {
    mockGetAllKeys.mockResolvedValueOnce([
      "chat-active-thread-user-1",
      "chat-active-thread-alt-user-1",
    ]);

    await resetUserRuntime("user-1", { reason: "logout" });

    expect(mockMultiRemove).toHaveBeenCalledWith([
      "chat-active-thread-user-1",
    ]);
    expect(mockMultiRemove).not.toHaveBeenCalledWith(
      expect.arrayContaining(["chat-active-thread-alt-user-1"]),
    );
  });

  it("logs and emits non-fatal cleanup failures per stage", async () => {
    const failure = new Error("offline-reset-failed");
    mockResetOfflineStorage.mockImplementationOnce(() => {
      throw failure;
    });

    await expect(
      resetUserRuntime("user-1", { reason: "account_switch" }),
    ).resolves.toBeUndefined();

    expect(mockEmit).toHaveBeenCalledWith("session:runtime-reset:failed", {
      uid: "user-1",
      reason: "account_switch",
      stage: "reset_offline_storage",
    });
    expect(mockLogWarning).toHaveBeenCalledWith(
      "user runtime reset stage failed",
      {
        uid: "user-1",
        reason: "account_switch",
        stage: "reset_offline_storage",
      },
      failure,
    );
    expect(mockMultiRemove).toHaveBeenCalled();
    expect(mockCleanupUserOfflineAssets).toHaveBeenCalledWith("user-1");
  });

  it("dedupes overlapping and immediately repeated resets for the same uid", async () => {
    let resolveReminders!: () => void;
    mockCancelAllReminderScheduling.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveReminders = resolve;
      }),
    );

    const first = resetUserRuntime("user-1", { reason: "session_lost" });
    const second = resetUserRuntime("user-1", { reason: "logout" });

    await Promise.resolve();
    expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);

    resolveReminders();
    await Promise.all([first, second]);

    await resetUserRuntime("user-1", { reason: "logout" });
    expect(mockStopSyncLoop).toHaveBeenCalledTimes(1);
  });

  it("does not block auth flow forever when an async cleanup stage hangs", async () => {
    jest.useFakeTimers();
    mockCancelAllReminderScheduling.mockReturnValueOnce(new Promise(() => {}));

    const pending = resetUserRuntime("user-1", { reason: "session_lost" });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toBeUndefined();

    expect(mockEmit).toHaveBeenCalledWith("session:runtime-reset:failed", {
      uid: "user-1",
      reason: "session_lost",
      stage: "cancel_reminders",
    });
    expect(mockResetOfflineStorage).toHaveBeenCalledTimes(1);
    expect(mockMultiRemove).toHaveBeenCalled();
    expect(mockResetTelemetryClientRuntime).toHaveBeenCalledTimes(1);
  });
});
