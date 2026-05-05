import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReminderDecisionResult } from "@/services/reminders/reminderTypes";

const asyncStorageState = new Map<string, string>();
const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();
const mockGetAllKeys = jest.fn<() => Promise<string[]>>();
const mockGetReminderDecision = jest.fn<
  (
    uid: string,
    options?: { dayKey?: string | null },
  ) => Promise<ReminderDecisionResult>
>();
const mockScheduleOneShotAt = jest.fn<(when: Date, content: unknown, localKey: string) => Promise<void>>();
const mockCancelAllForNotif = jest.fn<(localKey: string) => Promise<void>>();
const mockListStoredNotificationIdsByPrefix = jest.fn<
  (
    localKeyPrefix: string,
  ) => Promise<Array<{ localKey: string; ids: string[] }>>
>();
const mockNotificationScheduleKey = jest.fn<(uid: string, id: string) => string>();
const mockEnsureAndroidChannel = jest.fn<
  () => Promise<{
    platform: "android" | "non-android";
    channelId: string;
    ensured: boolean;
    exists: boolean | null;
    errorMessage: string | null;
  }>
>();
const mockGetNotificationText = jest.fn();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
const mockRunSystemNotifications = jest.fn<(uid: string) => Promise<void>>();
const mockTrackSmartReminderNoop = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackSmartReminderDecisionFailed = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackSmartReminderScheduleFailed = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackSmartReminderScheduled = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackSmartReminderSuppressed = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockGetPermissionsAsync = jest.fn<() => Promise<{ granted: boolean }>>();
const mockPlatform = { OS: "ios" as "ios" | "android" };

jest.mock("react-native", () => ({
  Platform: mockPlatform,
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
    getAllKeys: () => mockGetAllKeys(),
  },
}));

jest.mock("@/services/reminders/reminderService", () => ({
  getReminderDecision: (
    uid: string,
    options?: { dayKey?: string | null },
  ) => mockGetReminderDecision(uid, options),
  getCurrentReminderDecisionDayKey: (now?: Date) => {
    const date = now ?? new Date("2026-03-18T12:00:00.000Z");
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  isSmartRemindersEnabled: () => true,
}));

jest.mock("@/services/notifications/localScheduler", () => ({
  scheduleOneShotAt: (when: Date, content: unknown, localKey: string) =>
    mockScheduleOneShotAt(when, content, localKey),
  cancelAllForNotif: (localKey: string) => mockCancelAllForNotif(localKey),
  listStoredNotificationIdsByPrefix: (localKeyPrefix: string) =>
    mockListStoredNotificationIdsByPrefix(localKeyPrefix),
  notificationScheduleKey: (uid: string, id: string) =>
    mockNotificationScheduleKey(uid, id),
  ensureAndroidChannel: () => mockEnsureAndroidChannel(),
}));

jest.mock("@/services/notifications/texts", () => ({
  getNotificationText: (...args: unknown[]) => mockGetNotificationText(...args),
}));

jest.mock("@/services/notifications/system", () => ({
  runSystemNotifications: (uid: string) => mockRunSystemNotifications(uid),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  toSmartReminderConfidenceBucket: (confidence: number) => {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  },
  toSmartReminderScheduledWindow: (localMinuteOfDay: number) => {
    if (localMinuteOfDay < 360) return "overnight";
    if (localMinuteOfDay < 720) return "morning";
    if (localMinuteOfDay < 1020) return "afternoon";
    if (localMinuteOfDay < 1260) return "evening";
    return "late_evening";
  },
  trackSmartReminderNoop: (input: Record<string, unknown>) =>
    mockTrackSmartReminderNoop(input),
  trackSmartReminderDecisionFailed: (input: Record<string, unknown>) =>
    mockTrackSmartReminderDecisionFailed(input),
  trackSmartReminderScheduleFailed: (input: Record<string, unknown>) =>
    mockTrackSmartReminderScheduleFailed(input),
  trackSmartReminderScheduled: (input: Record<string, unknown>) =>
    mockTrackSmartReminderScheduled(input),
  trackSmartReminderSuppressed: (input: Record<string, unknown>) =>
    mockTrackSmartReminderSuppressed(input),
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: (...args: unknown[]) => mockDebugLog(...args),
    warn: (...args: unknown[]) => mockDebugWarn(...args),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    child: () => ({
      log: (...args: unknown[]) => mockDebugLog(...args),
      warn: (...args: unknown[]) => mockDebugWarn(...args),
      error: jest.fn(),
      time: jest.fn(),
      timeEnd: jest.fn(),
      child: jest.fn(),
    }),
  }),
}));

describe("reminderScheduling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = "ios";
    asyncStorageState.clear();
    mockGetItem.mockImplementation(async (key) => asyncStorageState.get(key) ?? null);
    mockSetItem.mockImplementation(async (key, value) => {
      asyncStorageState.set(key, value);
    });
    mockRemoveItem.mockImplementation(async (key) => {
      asyncStorageState.delete(key);
    });
    mockGetAllKeys.mockResolvedValue([]);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockEnsureAndroidChannel.mockResolvedValue({
      platform: "non-android",
      channelId: "default",
      ensured: false,
      exists: null,
      errorMessage: null,
    });
    mockScheduleOneShotAt.mockResolvedValue(undefined);
    mockCancelAllForNotif.mockImplementation(async (localKey) => {
      asyncStorageState.delete(`notif:ids:${localKey}`);
    });
    mockListStoredNotificationIdsByPrefix.mockImplementation(
      async (localKeyPrefix) => {
        const storagePrefix = `notif:ids:${localKeyPrefix}`;
        return [...asyncStorageState.entries()]
          .filter(([storageKey]) => storageKey.startsWith(storagePrefix))
          .map(([storageKey, raw]) => {
            let ids: string[] = [];
            try {
              const parsed = JSON.parse(raw);
              ids = Array.isArray(parsed)
                ? parsed.filter((value): value is string => typeof value === "string")
                : [];
            } catch {
              ids = [];
            }

            return {
              localKey: storageKey.slice("notif:ids:".length),
              ids,
            };
          });
      },
    );
    mockNotificationScheduleKey.mockImplementation((uid, id) => `${uid}:${id}`);
    mockGetNotificationText.mockReturnValue({
      title: "Title",
      body: "Body",
    });
    mockTrackSmartReminderNoop.mockResolvedValue(undefined);
    mockTrackSmartReminderDecisionFailed.mockResolvedValue(undefined);
    mockTrackSmartReminderScheduleFailed.mockResolvedValue(undefined);
    mockTrackSmartReminderScheduled.mockResolvedValue(undefined);
    mockTrackSmartReminderSuppressed.mockResolvedValue(undefined);
  });

  it("schedules a smart reminder when decision=send", async () => {
    const now = new Date("2026-03-18T18:00:00.000Z");
    const expectedWhen = new Date("2026-03-18T18:30:00.000Z");

    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "preferred_window_open",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
      now,
    });

    expect(result.outcome).toBe("scheduled");
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).toHaveBeenCalledWith(
      expectedWhen,
      {
        title: "Title",
        body: "Body",
        data: {
          type: "meal_reminder",
          origin: "system_notifications",
          smartReminder: true,
          reminderKind: "log_next_meal",
          dayKey: "2026-03-18",
          scheduledWindow: "evening",
        },
      },
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockTrackSmartReminderScheduled).toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduled).toHaveBeenCalledWith({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      scheduledWindow: "evening",
    });
  });

  it("cancels any already-scheduled reminder when decision=suppress", async () => {
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "suppress",
        kind: null,
        reasonCodes: ["quiet_hours"],
        scheduledAtUtc: null,
        confidence: 1,
        validUntil: "2026-03-18T22:00:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderSuppressed).toHaveBeenCalled();
    expect(mockTrackSmartReminderSuppressed).toHaveBeenCalledWith({
      decision: "suppress",
      suppressionReason: "quiet_hours",
      confidenceBucket: "high",
    });
  });

  it("cancels any already-scheduled reminder when decision=noop", async () => {
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "noop",
        kind: null,
        reasonCodes: ["insufficient_signal"],
        scheduledAtUtc: null,
        confidence: 0.7,
        validUntil: "2026-03-18T23:59:59Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderNoop).toHaveBeenCalled();
    expect(mockTrackSmartReminderNoop).toHaveBeenCalledWith({
      decision: "noop",
      noopReason: "insufficient_signal",
      confidenceBucket: "medium",
    });
  });

  it("does not schedule on failure or invalid payload semantics", async () => {
    mockGetReminderDecision.mockResolvedValue({
      decision: null,
      source: "fallback",
      status: "invalid_payload",
      enabled: true,
      error: new Error("contract drift"),
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderDecisionFailed).toHaveBeenCalledWith({
      failureReason: "invalid_payload",
    });
  });

  it("cancels scheduled reminder when backend is temporarily unavailable", async () => {
    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-user-1-18"]),
    );
    mockGetReminderDecision.mockResolvedValue({
      decision: null,
      source: "fallback",
      status: "service_unavailable",
      enabled: true,
      error: new Error("temporary backend outage"),
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
      now: new Date("2026-03-18T18:15:00.000Z"),
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    await expect(
      service.getReminderStoredScheduleDiagnostics("user-1"),
    ).resolves.toMatchObject({
      totalIds: 0,
      entries: [],
    });
    expect(mockTrackSmartReminderDecisionFailed).toHaveBeenCalledWith({
      failureReason: "service_unavailable",
    });
  });

  it("does not schedule when device notification permission is unavailable", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "habit_window_match",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduled).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalledWith({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "permission_unavailable",
    });
  });

  it("does not schedule on Android when notification channel cannot be ensured", async () => {
    mockPlatform.OS = "android";
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockEnsureAndroidChannel.mockResolvedValue({
      platform: "android",
      channelId: "default",
      ensured: false,
      exists: false,
      errorMessage: "channel setup failed",
    });
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "habit_window_match",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.outcome).toBe("cancelled");
    expect(result.reason).toBe("channel_unavailable");
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalledWith({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "channel_unavailable",
    });
  });

  it("maps complete_day reminders onto the existing day_fill notification type", async () => {
    const now = new Date("2026-03-18T18:00:00.000Z");

    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "complete_day",
        reasonCodes: [
          "preferred_window_open",
          "habit_window_match",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-18T20:00:00Z",
        confidence: 0.8,
        validUntil: "2026-03-18T21:00:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
      now,
    });

    expect(mockGetNotificationText).toHaveBeenCalledWith("day_fill", "friendly");
    expect(mockScheduleOneShotAt).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({
        data: expect.objectContaining({
          type: "day_fill",
          origin: "system_notifications",
          reminderKind: "complete_day",
        }),
      }),
      "user-1:smart-reminder:2026-03-18",
    );
  });

  it("schedules from canonical UTC even when dayKey and UTC date differ", async () => {
    const expectedWhen = new Date("2026-03-19T00:30:00.000Z");

    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T23:50:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "preferred_window_open",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-19T00:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-19T01:00:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
      now: new Date("2026-03-18T23:55:00.000Z"),
    });

    expect(mockScheduleOneShotAt).toHaveBeenCalledWith(
      expectedWhen,
      expect.any(Object),
      "user-1:smart-reminder:2026-03-18",
    );
  });

  it("cancels all stored smart reminder keys for the previous user", async () => {
    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-user-1-18"]),
    );
    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-19",
      JSON.stringify(["notif-user-1-19"]),
    );
    asyncStorageState.set("notif:ids:user-1:goal", JSON.stringify(["goal-id"]));
    asyncStorageState.set(
      "notif:ids:user-2:smart-reminder:2026-03-18",
      JSON.stringify(["notif-user-2-18"]),
    );

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    await service.cancelAllReminderScheduling("user-1");

    expect(mockCancelAllForNotif).toHaveBeenCalledTimes(2);
    expect(mockCancelAllForNotif).toHaveBeenNthCalledWith(
      1,
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockCancelAllForNotif).toHaveBeenNthCalledWith(
      2,
      "user-1:smart-reminder:2026-03-19",
    );
  });

  it("tracks scheduling failure when local scheduler throws", async () => {
    mockScheduleOneShotAt.mockRejectedValueOnce(new Error("schedule broke"));
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "preferred_window_open",
          "day_partially_logged",
          "logging_usually_happens_now",
        ],
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
      now: new Date("2026-03-18T18:00:00.000Z"),
    });

    expect(result.outcome).toBe("cancelled");
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduled).not.toHaveBeenCalled();
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalledWith({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "schedule_error",
    });
  });

  it("cleans up stale local schedules when payload is invalid", async () => {
    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-user-1-18"]),
    );
    mockGetReminderDecision.mockResolvedValue({
      decision: null,
      source: "fallback",
      status: "invalid_payload",
      enabled: true,
      error: new Error("contract drift"),
    });

    const service =
      jest.requireActual("@/services/reminders/reminderScheduling") as typeof import("@/services/reminders/reminderScheduling");

    const result = await service.reconcileReminderScheduling("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.reason).toBe("decision_invalid_payload");
    await expect(
      service.getReminderStoredScheduleDiagnostics("user-1"),
    ).resolves.toMatchObject({
      totalIds: 0,
      entries: [],
    });
  });
});
