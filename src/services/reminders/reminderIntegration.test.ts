import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { ReminderDecisionResult } from "@/services/reminders/reminderTypes";
import { createServiceError } from "@/services/contracts/serviceError";
import * as reminderRuntime from "@/services/reminders/reminderRuntime";

const asyncStorageState = new Map<string, string>();

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();
const mockGetAllKeys = jest.fn<() => Promise<string[]>>();

const mockGetReminderDecision =
  jest.fn<
    (
      uid: string,
      options?: { dayKey?: string | null },
    ) => Promise<ReminderDecisionResult>
  >();

const mockScheduleOneShotAt =
  jest.fn<(when: Date, content: unknown, localKey: string) => Promise<void>>();
const mockCancelAllForNotif = jest.fn<(localKey: string) => Promise<void>>();
const mockListStoredNotificationIdsByPrefix = jest.fn<
  (
    localKeyPrefix: string,
  ) => Promise<Array<{ localKey: string; ids: string[] }>>
>();
const mockNotificationScheduleKey =
  jest.fn<(uid: string, id: string) => string>();
const mockEnsureAndroidChannel = jest.fn<
  () => Promise<{
    platform: "android" | "non-android";
    channelId: string;
    ensured: boolean;
    exists: boolean | null;
    errorMessage: string | null;
  }>
>();
const mockGetPermissionsAsync = jest.fn<() => Promise<{ granted: boolean }>>();
const mockGetNotificationText = jest.fn();

const mockTrackSmartReminderScheduled = jest.fn<() => Promise<void>>();
const mockTrackSmartReminderSuppressed = jest.fn<() => Promise<void>>();
const mockTrackSmartReminderNoop = jest.fn<() => Promise<void>>();
const mockTrackSmartReminderScheduleFailed = jest.fn<() => Promise<void>>();
const mockTrackSmartReminderDecisionFailed = jest.fn<() => Promise<void>>();

let mockAppStateChangeListener:
  | ((state: "active" | "background" | "inactive") => void)
  | null = null;
const mockAppStateSubscription = { remove: jest.fn() };

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: {
    currentState: "active",
    addEventListener: (
      _event: "change",
      listener: (state: "active" | "background" | "inactive") => void,
    ) => {
      mockAppStateChangeListener = listener;
      return mockAppStateSubscription;
    },
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  SchedulableTriggerInputTypes: { DATE: "date" },
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
  getReminderDecision: (uid: string, options?: { dayKey?: string | null }) =>
    mockGetReminderDecision(uid, options),
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
  trackSmartReminderScheduled: (...args: unknown[]) =>
    mockTrackSmartReminderScheduled(...(args as [])),
  trackSmartReminderSuppressed: (...args: unknown[]) =>
    mockTrackSmartReminderSuppressed(...(args as [])),
  trackSmartReminderNoop: (...args: unknown[]) =>
    mockTrackSmartReminderNoop(...(args as [])),
  trackSmartReminderScheduleFailed: (...args: unknown[]) =>
    mockTrackSmartReminderScheduleFailed(...(args as [])),
  trackSmartReminderDecisionFailed: (...args: unknown[]) =>
    mockTrackSmartReminderDecisionFailed(...(args as [])),
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    child: () => ({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      time: jest.fn(),
      timeEnd: jest.fn(),
      child: jest.fn(),
    }),
  }),
}));

function sendDecision(): ReminderDecisionResult {
  return {
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
  };
}

function suppressDecision(): ReminderDecisionResult {
  return {
    decision: {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      decision: "suppress",
      kind: null,
      reasonCodes: ["quiet_hours"],
      scheduledAtUtc: null,
      confidence: 1.0,
      validUntil: "2026-03-18T22:00:00Z",
    },
    source: "remote",
    status: "live_success",
    enabled: true,
    error: null,
  };
}

function noopDecision(): ReminderDecisionResult {
  return {
    decision: {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      decision: "noop",
      kind: null,
      reasonCodes: ["day_already_complete"],
      scheduledAtUtc: null,
      confidence: 0.98,
      validUntil: "2026-03-18T23:59:59Z",
    },
    source: "remote",
    status: "live_success",
    enabled: true,
    error: null,
  };
}

function failedDecision(
  status: "invalid_payload" | "service_unavailable",
): ReminderDecisionResult {
  return {
    decision: null,
    source: "error",
    status,
    enabled: true,
    error: createServiceError({
      code: `reminder/${status}`,
      source: "ReminderService",
      retryable: status === "service_unavailable",
      message: `decision ${status}`,
    }),
  };
}

describe("Smart Reminders v1 — runtime integration", () => {
  beforeEach(() => {
    reminderRuntime.__resetReminderRuntimeForTests();

    jest.clearAllMocks();
    mockGetReminderDecision.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T18:00:00.000Z"));
    mockAppStateChangeListener = null;
    asyncStorageState.clear();

    mockGetItem.mockImplementation(
      async (key) => asyncStorageState.get(key) ?? null,
    );
    mockSetItem.mockImplementation(async (key, value) => {
      asyncStorageState.set(key, value);
    });
    mockRemoveItem.mockImplementation(async (key) => {
      asyncStorageState.delete(key);
    });
    mockGetAllKeys.mockImplementation(async () => [
      ...asyncStorageState.keys(),
    ]);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockEnsureAndroidChannel.mockResolvedValue({
      platform: "non-android",
      channelId: "default",
      ensured: false,
      exists: null,
      errorMessage: null,
    });
    mockScheduleOneShotAt.mockResolvedValue(undefined);
    mockCancelAllForNotif.mockResolvedValue(undefined);
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
      title: "Log your meal",
      body: "Time to track!",
    });
    mockTrackSmartReminderScheduled.mockResolvedValue(undefined);
    mockTrackSmartReminderSuppressed.mockResolvedValue(undefined);
    mockTrackSmartReminderNoop.mockResolvedValue(undefined);
    mockTrackSmartReminderScheduleFailed.mockResolvedValue(undefined);
    mockTrackSmartReminderDecisionFailed.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("schedules a notification when runtime initializes and backend returns send", async () => {
    mockGetReminderDecision.mockResolvedValue(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);
    expect(mockGetReminderDecision).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
    });

    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );

    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);
    expect(mockScheduleOneShotAt).toHaveBeenCalledWith(
      new Date("2026-03-18T18:30:00.000Z"),
      expect.objectContaining({
        title: "Log your meal",
        body: "Time to track!",
        data: expect.objectContaining({
          type: "meal_reminder",
          smartReminder: true,
          reminderKind: "log_next_meal",
          dayKey: "2026-03-18",
        }),
      }),
      "user-1:smart-reminder:2026-03-18",
    );

    expect(mockTrackSmartReminderScheduled).toHaveBeenCalledTimes(1);
    expect(mockTrackSmartReminderScheduleFailed).not.toHaveBeenCalled();
  });

  it("cancels the scheduled reminder when a subsequent reconcile returns suppress", async () => {
    mockGetReminderDecision.mockResolvedValueOnce(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);

    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-id-1"]),
    );

    mockGetReminderDecision.mockResolvedValueOnce(suppressDecision());
    jest.setSystemTime(new Date("2026-03-18T19:31:00.000Z"));
    jest.advanceTimersByTime(61_000);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);
    expect(mockTrackSmartReminderSuppressed).toHaveBeenCalledTimes(1);
  });

  it("cancels the scheduled reminder when a subsequent reconcile returns noop", async () => {
    mockGetReminderDecision.mockResolvedValueOnce(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);

    mockGetReminderDecision.mockResolvedValueOnce(noopDecision());
    jest.setSystemTime(new Date("2026-03-18T19:31:00.000Z"));
    jest.advanceTimersByTime(61_000);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);
    expect(mockTrackSmartReminderNoop).toHaveBeenCalledTimes(1);
  });

  it("cleans old user schedules and reconciles new user on uid switch", async () => {
    mockGetReminderDecision.mockResolvedValueOnce(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);

    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-id-1"]),
    );
    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-17",
      JSON.stringify(["notif-id-0"]),
    );

    const user2Decision = sendDecision();
    if (user2Decision.decision) {
      user2Decision.decision.kind = "log_first_meal";
      user2Decision.decision.reasonCodes = [
        "preferred_window_open",
        "day_empty",
      ];
    }
    mockGetReminderDecision.mockResolvedValueOnce(user2Decision);

    await reminderRuntime.setReminderRuntimeUid("user-2");

    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-17",
    );

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
    expect(mockGetReminderDecision).toHaveBeenNthCalledWith(2, "user-2", {
      dayKey: "2026-03-18",
    });
    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(2);
  });

  it("cleans old user schedules on logout without reconciling", async () => {
    mockGetReminderDecision.mockResolvedValueOnce(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-id-1"]),
    );

    await reminderRuntime.setReminderRuntimeUid(null);

    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);
  });

  it("does not schedule and cancels existing on invalid_payload", async () => {
    mockGetReminderDecision.mockResolvedValue(
      failedDecision("invalid_payload"),
    );

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockTrackSmartReminderScheduled).not.toHaveBeenCalled();
  });

  it("does not schedule and cancels existing on service_unavailable", async () => {
    mockGetReminderDecision.mockResolvedValue(
      failedDecision("service_unavailable"),
    );

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
  });

  it("cleans previous schedule when decision degrades from send to failure", async () => {
    mockGetReminderDecision.mockResolvedValueOnce(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);

    mockGetReminderDecision.mockResolvedValueOnce(
      failedDecision("service_unavailable"),
    );
    jest.advanceTimersByTime(61_000);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);

    const cancelCalls = mockCancelAllForNotif.mock.calls.map((c) => c[0]);
    const dayCancelCalls = cancelCalls.filter(
      (k) => k === "user-1:smart-reminder:2026-03-18",
    );
    expect(dayCancelCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not skip the initial auth_ready reconcile due to cooldown", async () => {
    mockGetReminderDecision.mockResolvedValue(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);
    expect(mockScheduleOneShotAt).toHaveBeenCalledTimes(1);
  });

  it("skips foreground reconcile inside cooldown but runs again after", async () => {
    mockGetReminderDecision.mockResolvedValue(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await Promise.resolve();

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(61_000);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
  });

  it("cleans stale user schedules when uid changes during in-flight reconcile", async () => {
    let resolveFirstReconcile: (() => void) | null = null;

    mockGetReminderDecision.mockImplementation(
      (uid: string) =>
        new Promise<ReminderDecisionResult>((resolve) => {
          if (uid === "user-1" && !resolveFirstReconcile) {
            resolveFirstReconcile = () => resolve(sendDecision());
            return;
          }
          resolve(sendDecision());
        }),
    );

    await reminderRuntime.initReminderRuntime();
    const firstRun = reminderRuntime.setReminderRuntimeUid("user-1");
    await Promise.resolve();

    asyncStorageState.set(
      "notif:ids:user-1:smart-reminder:2026-03-18",
      JSON.stringify(["notif-id-1"]),
    );

    const secondRun = reminderRuntime.setReminderRuntimeUid("user-2");
    await Promise.resolve();
    const cancelCountBeforeFinish = mockCancelAllForNotif.mock.calls.length;

    const finish = resolveFirstReconcile as unknown;
    if (typeof finish === "function") {
      (finish as () => void)();
    }
    await firstRun;
    await secondRun;

    const cancelCountAfterFinish = mockCancelAllForNotif.mock.calls.length;
    expect(cancelCountAfterFinish).toBeGreaterThanOrEqual(
      cancelCountBeforeFinish,
    );
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );

    expect(mockGetReminderDecision).toHaveBeenCalledWith(
      "user-2",
      expect.anything(),
    );
  });

  it("does not create ghost reminders when notification permission is denied", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockGetReminderDecision.mockResolvedValue(sendDecision());

    await reminderRuntime.initReminderRuntime();
    await reminderRuntime.setReminderRuntimeUid("user-1");

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(1);
    expect(mockScheduleOneShotAt).not.toHaveBeenCalled();
    expect(mockCancelAllForNotif).toHaveBeenCalledWith(
      "user-1:smart-reminder:2026-03-18",
    );
    expect(mockTrackSmartReminderScheduleFailed).toHaveBeenCalledTimes(1);
    expect(mockTrackSmartReminderScheduled).not.toHaveBeenCalled();
  });
});
