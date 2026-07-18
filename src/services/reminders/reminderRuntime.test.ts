import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReminderSchedulingResult } from "@/services/reminders/reminderScheduling";
import { createServiceError } from "@/services/contracts/serviceError";

const mockReconcileReminderScheduling = jest.fn<
  (uid: string) => Promise<ReminderSchedulingResult>
>();
const mockCancelAllReminderScheduling = jest.fn<
  (uid: string) => Promise<void>
>();
const mockHasStoredReminderScheduleForDay = jest.fn<
  (uid: string, dayKey: string) => Promise<boolean>
>();
const mockGetCurrentReminderDecisionDayKey = jest.fn<
  (now?: Date) => string
>();

let mockAppStateChangeListener:
  | ((state: "active" | "background" | "inactive") => void)
  | null = null;

const mockAppStateSubscription = { remove: jest.fn() };

async function flushRuntimeReconcile(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function defaultSchedulingResult(): ReminderSchedulingResult {
  return {
    outcome: "scheduled" as const,
    reason: "scheduled" as const,
    localKey: "user-1:smart-reminder:2026-03-18",
    result: {
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send" as const,
        kind: "log_next_meal" as const,
        reasonCodes: [
          "preferred_window_open",
          "day_partially_logged",
          "logging_usually_happens_now",
        ] as const,
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.9,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote" as const,
      status: "live_success" as const,
      enabled: true,
      error: null,
    },
  };
}

jest.mock("@/services/reminders/reminderScheduling", () => ({
  reconcileReminderScheduling: (uid: string) =>
    mockReconcileReminderScheduling(uid),
  cancelAllReminderScheduling: (uid: string) =>
    mockCancelAllReminderScheduling(uid),
  hasStoredReminderScheduleForDay: (uid: string, dayKey: string) =>
    mockHasStoredReminderScheduleForDay(uid, dayKey),
  getLastReminderReconcileSnapshot: jest.fn(() => ({
    uid: "user-1",
    dayKey: "2026-03-18",
  })),
}));

jest.mock("@/services/reminders/reminderService", () => ({
  getCurrentReminderDecisionDayKey: (now?: Date) =>
    mockGetCurrentReminderDecisionDayKey(now),
}));

jest.mock("react-native", () => ({
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

describe("reminderRuntime", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");
    runtime.__resetReminderRuntimeForTests();
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAppStateChangeListener = null;
    mockReconcileReminderScheduling.mockResolvedValue(defaultSchedulingResult());
    mockCancelAllReminderScheduling.mockResolvedValue(undefined);
    mockHasStoredReminderScheduleForDay.mockResolvedValue(false);
    mockGetCurrentReminderDecisionDayKey.mockReturnValue("2026-03-18");
    jest.setSystemTime(new Date("2026-03-18T18:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("runs smart reminder reconcile when authenticated user becomes available", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(1);
    expect(mockReconcileReminderScheduling).toHaveBeenCalledWith("user-1");
  });

  it("runs smart reminder reconcile when app returns to foreground", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    jest.advanceTimersByTime(60_001);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(2);
    expect(mockReconcileReminderScheduling).toHaveBeenNthCalledWith(2, "user-1");
  });

  it("skips foreground reconcile when a fresh scheduled decision is still valid locally", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    mockHasStoredReminderScheduleForDay.mockResolvedValue(true);

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    jest.advanceTimersByTime(60_001);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockHasStoredReminderScheduleForDay).toHaveBeenCalledWith(
      "user-1",
      "2026-03-18",
    );
    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(1);
  });

  it("does not skip foreground reconcile after service_unavailable", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    mockReconcileReminderScheduling.mockResolvedValueOnce({
      outcome: "cancelled" as const,
      reason: "decision_service_unavailable" as const,
      localKey: "user-1:smart-reminder:2026-03-18",
      result: {
        decision: null,
        source: "error" as const,
        status: "service_unavailable" as const,
        enabled: true,
        error: createServiceError({
          code: "reminder/service-unavailable",
          source: "ReminderService",
          retryable: true,
          message: "temporary outage",
        }),
      },
    });
    mockHasStoredReminderScheduleForDay.mockResolvedValue(true);

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    jest.advanceTimersByTime(60_001);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(2);
  });

  it("does not skip auth_ready reconcile after uid change", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    mockHasStoredReminderScheduleForDay.mockResolvedValue(true);

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    await runtime.setReminderRuntimeUid("user-2");

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(2);
    expect(mockReconcileReminderScheduling).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("skips foreground churn inside cooldown window", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();
    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_001);
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(2);

    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(2);
  });

  it("does not reconcile without authenticated user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    mockAppStateChangeListener?.("background");
    mockAppStateChangeListener?.("active");
    await flushRuntimeReconcile();

    expect(mockReconcileReminderScheduling).not.toHaveBeenCalled();
  });

  it("cleans scheduled smart reminders on logout", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    await runtime.setReminderRuntimeUid(null);

    expect(mockCancelAllReminderScheduling).toHaveBeenCalledWith("user-1");
    expect(mockReconcileReminderScheduling).toHaveBeenCalledTimes(1);
  });

  it("cleans the previous user before reconciling the next one on account switch", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    await runtime.setReminderRuntimeUid("user-1");
    await runtime.setReminderRuntimeUid("user-2");

    expect(mockCancelAllReminderScheduling).toHaveBeenCalledWith("user-1");
    expect(mockReconcileReminderScheduling).toHaveBeenNthCalledWith(1, "user-1");
    expect(mockReconcileReminderScheduling).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("cleans stale user schedules again after an in-flight reconcile finishes", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    let resolveFirstRun: (() => void) | null = null;
    mockReconcileReminderScheduling.mockImplementation(
      (uid: string) =>
        new Promise<ReturnType<typeof defaultSchedulingResult>>((resolve) => {
          if (uid === "user-1" && !resolveFirstRun) {
            resolveFirstRun = () => resolve(defaultSchedulingResult());
            return;
          }
          resolve(defaultSchedulingResult());
        }),
    );

    await runtime.initReminderRuntime();
    const firstRun = runtime.setReminderRuntimeUid("user-1");
    await Promise.resolve();
    const secondRun = runtime.setReminderRuntimeUid("user-2");
    await Promise.resolve();

    expect(mockCancelAllReminderScheduling).toHaveBeenCalledWith("user-1");

    const finishFirstRun = resolveFirstRun as unknown;
    if (typeof finishFirstRun === "function") {
      (finishFirstRun as () => void)();
    }
    await firstRun;
    await secondRun;

    expect(mockCancelAllReminderScheduling).toHaveBeenCalledTimes(2);
    expect(mockCancelAllReminderScheduling).toHaveBeenNthCalledWith(1, "user-1");
    expect(mockCancelAllReminderScheduling).toHaveBeenNthCalledWith(2, "user-1");
    expect(mockReconcileReminderScheduling).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("removes the AppState listener on stop", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/reminders/reminderRuntime") as typeof import("@/services/reminders/reminderRuntime");

    await runtime.initReminderRuntime();
    runtime.stopReminderRuntime();

    expect(mockAppStateSubscription.remove).toHaveBeenCalledTimes(1);
  });
});
