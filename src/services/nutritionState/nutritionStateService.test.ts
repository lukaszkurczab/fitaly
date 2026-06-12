import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockGet = jest.fn<(path: string, options?: unknown) => Promise<unknown>>();
const mockReadPublicEnv = jest.fn<(name: string) => string | undefined>();
const mockWarn = jest.fn<(...args: unknown[]) => void>();

jest.mock("@/services/core/apiClient", () => ({
  get: (path: string, options?: unknown) => mockGet(path, options),
}));

jest.mock("@/services/core/publicEnv", () => ({
  readPublicEnv: (name: string) => mockReadPublicEnv(name),
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    child: () => ({
      log: jest.fn(),
      warn: (...args: unknown[]) => mockWarn(...args),
      error: jest.fn(),
      time: jest.fn(),
      timeEnd: jest.fn(),
      child: jest.fn(),
    }),
  }),
}));

describe("nutritionStateService", () => {
  function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    return { promise, resolve, reject };
  }

  function createNutritionPayload(overrides?: {
    computedAt?: string;
    consumedKcal?: number;
  }): unknown {
    return {
      computedAt: overrides?.computedAt ?? "2026-03-18T10:00:00Z",
      dayKey: "2026-03-18",
      targets: { kcal: 2000 },
      consumed: {
        kcal: overrides?.consumedKcal ?? 1000,
        protein: 60,
        carbs: 90,
        fat: 20,
      },
      remaining: { kcal: 1000, protein: null, carbs: null, fat: null },
      quality: {
        mealsLogged: 1,
        missingNutritionMeals: 0,
        dataCompletenessScore: 1,
      },
      habits: { available: false },
      streak: { available: false, current: 0, lastDate: null },
      ai: { available: false, costs: { chat: 0, textMeal: 0, photo: 0 } },
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_V2_STATE") {
        return "true";
      }
      return undefined;
    });
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");
    service.__resetNutritionStateServiceForTests();
    await AsyncStorage.clear();
  });

  it("fetches the current day state from the v2 endpoint and persists the last good response", async () => {
    mockGet.mockResolvedValue({
      computedAt: "2026-03-18T10:00:00Z",
      dayKey: "2026-03-18",
      targets: { kcal: 2000, protein: 120, carbs: null, fat: null },
      consumed: { kcal: 1200, protein: 80, carbs: 100, fat: 40 },
      remaining: { kcal: 800, protein: 40, carbs: null, fat: null },
      quality: { mealsLogged: 2, missingNutritionMeals: 0, dataCompletenessScore: 1 },
      habits: { available: false },
      streak: { available: true, current: 4, lastDate: "2026-03-18" },
      ai: {
        available: true,
        tier: "free",
        balance: 90,
        allocation: 100,
        usedThisPeriod: 10,
        periodStartAt: "2026-03-01T00:00:00Z",
        periodEndAt: "2026-04-01T00:00:00Z",
        costs: { chat: 1, textMeal: 1, photo: 5 },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const result = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    expect(mockGet).toHaveBeenCalledWith("/api/v2/users/me/state?day=2026-03-18", {
      timeout: 15_000,
    });
    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.isStale).toBe(false);
    expect(result.state.dayKey).toBe("2026-03-18");
    expect(result.state.ai.usedThisPeriod).toBe(10);
    expect(await AsyncStorage.getItem("nutrition-state:last:v1:user-1:2026-03-18")).toEqual(
      expect.any(String),
    );
  });

  it("does not gate nutrition state fetch behind mobile feature flags", async () => {
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_V2_STATE") {
        return "false";
      }
      return undefined;
    });
    mockGet.mockResolvedValue({
      computedAt: "2026-03-18T10:00:00Z",
      dayKey: "2026-03-18",
      targets: { kcal: 2000, protein: 120, carbs: null, fat: null },
      consumed: { kcal: 1200, protein: 80, carbs: 100, fat: 40 },
      remaining: { kcal: 800, protein: 40, carbs: null, fat: null },
      quality: { mealsLogged: 2, missingNutritionMeals: 0, dataCompletenessScore: 1 },
      habits: { available: false },
      streak: { available: true, current: 4, lastDate: "2026-03-18" },
      ai: {
        available: true,
        tier: "free",
        balance: 90,
        allocation: 100,
        usedThisPeriod: 10,
        periodStartAt: "2026-03-01T00:00:00Z",
        periodEndAt: "2026-04-01T00:00:00Z",
        costs: { chat: 1, textMeal: 1, photo: 5 },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const result = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.state.dayKey).toBe("2026-03-18");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("uses the in-memory cache for repeated reads of the same user and day", async () => {
    mockGet.mockResolvedValue({
      computedAt: "2026-03-18T10:00:00Z",
      dayKey: "2026-03-18",
      targets: { kcal: 2000 },
      consumed: { kcal: 1000, protein: 60, carbs: 90, fat: 20 },
      remaining: { kcal: 1000, protein: null, carbs: null, fat: null },
      quality: { mealsLogged: 1, missingNutritionMeals: 0, dataCompletenessScore: 1 },
      habits: { available: false },
      streak: { available: false, current: 0, lastDate: null },
      ai: { available: false, costs: { chat: 0, textMeal: 0, photo: 0 } },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const first = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });
    const second = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    expect(first.source).toBe("remote");
    expect(second.source).toBe("memory");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("falls back to the persisted last good response when refresh fails", async () => {
    await AsyncStorage.setItem(
      "nutrition-state:last:v1:user-1:2026-03-18",
      JSON.stringify({
        computedAt: "2026-03-18T09:00:00Z",
        dayKey: "2026-03-18",
        targets: { kcal: 2200, protein: 130, carbs: null, fat: null },
        consumed: { kcal: 900, protein: 55, carbs: 70, fat: 18 },
        remaining: { kcal: 1300, protein: 75, carbs: null, fat: null },
        quality: { mealsLogged: 1, missingNutritionMeals: 0, dataCompletenessScore: 1 },
        habits: { available: false },
        streak: { available: true, current: 2, lastDate: "2026-03-17" },
        ai: { available: false, costs: { chat: 0, textMeal: 0, photo: 0 } },
      }),
    );
    mockGet.mockRejectedValue(new Error("backend down"));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const result = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    expect(result.source).toBe("storage");
    expect(result.isStale).toBe(true);
    expect(result.state.targets.kcal).toBe(2200);
    expect(mockWarn).toHaveBeenCalled();
  });

  it("invalidates cached state so the next read refetches from remote", async () => {
    mockGet
      .mockResolvedValueOnce({
        computedAt: "2026-03-18T10:00:00Z",
        dayKey: "2026-03-18",
        targets: { kcal: 2000 },
        consumed: { kcal: 1000, protein: 60, carbs: 90, fat: 20 },
        remaining: { kcal: 1000, protein: null, carbs: null, fat: null },
        quality: { mealsLogged: 1, missingNutritionMeals: 0, dataCompletenessScore: 1 },
        habits: { available: false },
        streak: { available: false, current: 0, lastDate: null },
        ai: { available: false, costs: { chat: 0, textMeal: 0, photo: 0 } },
      })
      .mockResolvedValueOnce({
        computedAt: "2026-03-18T11:00:00Z",
        dayKey: "2026-03-18",
        targets: { kcal: 2000 },
        consumed: { kcal: 1400, protein: 80, carbs: 120, fat: 30 },
        remaining: { kcal: 600, protein: null, carbs: null, fat: null },
        quality: { mealsLogged: 2, missingNutritionMeals: 0, dataCompletenessScore: 1 },
        habits: { available: false },
        streak: { available: false, current: 0, lastDate: null },
        ai: { available: false, costs: { chat: 0, textMeal: 0, photo: 0 } },
      });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const first = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });
    await service.invalidateNutritionStateCache("user-1", {
      dayKey: "2026-03-18",
    });
    const second = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    expect(first.state.consumed.kcal).toBe(1000);
    expect(second.state.consumed.kcal).toBe(1400);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(await AsyncStorage.getItem("nutrition-state:last:v1:user-1:2026-03-18")).toEqual(
      expect.any(String),
    );
  });

  it("fences stale in-flight writes after full user cache invalidation", async () => {
    const staleRequest = createDeferred<unknown>();
    mockGet
      .mockReturnValueOnce(staleRequest.promise)
      .mockResolvedValueOnce(
        createNutritionPayload({
          computedAt: "2026-03-18T11:00:00Z",
          consumedKcal: 1400,
        }),
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require("@/services/nutritionState/nutritionStateService") as typeof import("@/services/nutritionState/nutritionStateService");

    const stalePromise = service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });
    expect(mockGet).toHaveBeenCalledTimes(1);

    await service.invalidateNutritionStateCache("user-1");
    const freshResult = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });

    staleRequest.resolve(
      createNutritionPayload({
        computedAt: "2026-03-18T10:00:00Z",
        consumedKcal: 1000,
      }),
    );
    const staleResult = await stalePromise;
    const cachedResult = await service.getNutritionState("user-1", {
      dayKey: "2026-03-18",
    });
    const persisted = await AsyncStorage.getItem(
      "nutrition-state:last:v1:user-1:2026-03-18",
    );

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(staleResult.state.computedAt).toBe("2026-03-18T10:00:00Z");
    expect(freshResult.state.computedAt).toBe("2026-03-18T11:00:00Z");
    expect(cachedResult.source).toBe("memory");
    expect(cachedResult.state.computedAt).toBe("2026-03-18T11:00:00Z");
    expect(JSON.parse(persisted ?? "{}")).toEqual(
      expect.objectContaining({ computedAt: "2026-03-18T11:00:00Z" }),
    );
  });
});
