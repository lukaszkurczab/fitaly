import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { emit } from "@/services/core/events";

const mockRefreshStreakFromBackend = jest.fn<
  (uid: string, options?: { refreshBadges?: boolean }) => Promise<void>
>();
const mockReconcileAll = jest.fn<(uid: string) => Promise<void>>();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();

jest.mock("@/services/gamification/streakService", () => ({
  refreshStreakFromBackend: (
    uid: string,
    options?: { refreshBadges?: boolean },
  ) => mockRefreshStreakFromBackend(uid, options),
}));

jest.mock("@/services/notifications/engine", () => ({
  reconcileAll: (uid: string) => mockReconcileAll(uid),
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: (...args: unknown[]) => mockDebugLog(...args),
    warn: (...args: unknown[]) => mockDebugWarn(...args),
    error: () => undefined,
    time: () => undefined,
    timeEnd: () => undefined,
    child: () => {
      throw new Error("child() is not used in this test");
    },
  }),
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("mealSideEffectsRuntime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRefreshStreakFromBackend.mockResolvedValue(undefined);
    mockReconcileAll.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");
    runtime.__resetMealSideEffectsRuntimeForTests();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");
    runtime.__resetMealSideEffectsRuntimeForTests();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("debounces pushed and synced meal events into one user-scoped side effect run", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");

    runtime.initMealSideEffectsRuntime();
    runtime.setMealSideEffectsRuntimeUid("user-1");

    emit("meal:pushed", { uid: "user-1", cloudId: "meal-1" });
    emit("meal:synced", { uid: "user-1", cloudId: "meal-2" });
    emit("meal:pushed", { uid: "user-1", cloudId: "meal-3" });

    jest.advanceTimersByTime(1_499);
    await flushPromises();
    expect(mockRefreshStreakFromBackend).not.toHaveBeenCalled();
    expect(mockReconcileAll).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(mockRefreshStreakFromBackend).toHaveBeenCalledTimes(1);
    expect(mockRefreshStreakFromBackend).toHaveBeenCalledWith("user-1", {
      refreshBadges: true,
    });
    expect(mockReconcileAll).toHaveBeenCalledTimes(1);
    expect(mockReconcileAll).toHaveBeenCalledWith("user-1");
  });

  it("ignores meal events for other users, missing users, and local-only mutations", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");

    runtime.initMealSideEffectsRuntime();
    runtime.setMealSideEffectsRuntimeUid("user-1");

    emit("meal:pushed", { uid: "user-2", cloudId: "meal-1" });
    emit("meal:synced", { cloudId: "meal-2" });
    emit("meal:local:upserted", { uid: "user-1", cloudId: "meal-3" });
    emit("meal:local:deleted", { uid: "user-1", cloudId: "meal-4" });

    jest.advanceTimersByTime(1_500);
    await flushPromises();

    expect(mockRefreshStreakFromBackend).not.toHaveBeenCalled();
    expect(mockReconcileAll).not.toHaveBeenCalled();
  });

  it("clears pending work when uid changes before debounce fires", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");

    runtime.initMealSideEffectsRuntime();
    runtime.setMealSideEffectsRuntimeUid("user-1");
    emit("meal:pushed", { uid: "user-1", cloudId: "meal-1" });
    runtime.setMealSideEffectsRuntimeUid("user-2");

    jest.advanceTimersByTime(1_500);
    await flushPromises();
    expect(mockRefreshStreakFromBackend).not.toHaveBeenCalled();

    emit("meal:pushed", { uid: "user-2", cloudId: "meal-2" });
    jest.advanceTimersByTime(1_500);
    await flushPromises();
    expect(mockRefreshStreakFromBackend).toHaveBeenCalledWith("user-2", {
      refreshBadges: true,
    });
  });

  it("isolates streak and notification failures from the event publisher", async () => {
    const streakError = new Error("streak failed");
    const reconcileError = new Error("reconcile failed");
    mockRefreshStreakFromBackend.mockRejectedValueOnce(streakError);
    mockReconcileAll.mockRejectedValueOnce(reconcileError);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");

    runtime.initMealSideEffectsRuntime();
    runtime.setMealSideEffectsRuntimeUid("user-1");

    expect(() => {
      emit("meal:pushed", { uid: "user-1", cloudId: "meal-1" });
    }).not.toThrow();

    jest.advanceTimersByTime(1_500);
    await flushPromises();

    expect(mockDebugWarn).toHaveBeenCalledWith(
      "meal side effect streak refresh failed",
      { uid: "user-1", reason: "meal_pushed", error: streakError },
    );
    expect(mockDebugWarn).toHaveBeenCalledWith(
      "meal side effect notification reconcile failed",
      { uid: "user-1", reason: "meal_pushed", error: reconcileError },
    );
  });

  it("removes event listeners on stop", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require("@/services/meals/mealSideEffectsRuntime") as typeof import("@/services/meals/mealSideEffectsRuntime");

    runtime.initMealSideEffectsRuntime();
    runtime.setMealSideEffectsRuntimeUid("user-1");
    runtime.stopMealSideEffectsRuntime();

    emit("meal:pushed", { uid: "user-1", cloudId: "meal-1" });
    jest.advanceTimersByTime(1_500);
    await flushPromises();

    expect(mockRefreshStreakFromBackend).not.toHaveBeenCalled();
    expect(mockReconcileAll).not.toHaveBeenCalled();
  });
});
