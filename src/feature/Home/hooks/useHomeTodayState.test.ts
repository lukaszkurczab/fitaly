import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Meal, UserNutritionProfile } from "@/types";
import { useHomeTodayState } from "@/feature/Home/hooks/useHomeTodayState";
import { __resetLocalMealsStoreForTests } from "@/services/meals/localMealsStore";

const mockGetAllMealsLocal = jest.fn<(uid: string) => Promise<Meal[]>>();
const mockGetMealByCloudIdLocal = jest.fn<
  (uid: string, cloudId: string) => Promise<Meal | null>
>();
const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockPushQueue = jest.fn<(uid: string) => Promise<void>>();
const mockPullChanges = jest.fn<(uid: string) => Promise<void>>();
const mockRefreshStreakFromBackend = jest.fn<
  (uid: string, options?: { refreshBadges?: boolean }) => Promise<void>
>();
const mockReconcileAll = jest.fn<(uid: string) => Promise<void>>();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
const mockEventHandlers = new Map<
  string,
  Set<(payload?: Record<string, unknown>) => void>
>();

jest.mock("@/services/offline/meals.repo", () => ({
  getAllMealsLocal: (uid: string) => mockGetAllMealsLocal(uid),
  getMealByCloudIdLocal: (uid: string, cloudId: string) =>
    mockGetMealByCloudIdLocal(uid, cloudId),
  getPendingMealsLocal: () => Promise.resolve([]),
  markDeletedLocal: jest.fn(),
  upsertMealLocal: jest.fn(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: () => mockNetInfoFetch() },
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (params: { uid: string }) => mockPushQueue(params.uid),
  pushQueue: (uid: string) => mockPushQueue(uid),
  pullChanges: (uid: string) => mockPullChanges(uid),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueUpsert: jest.fn(),
  enqueueDelete: jest.fn(),
}));

jest.mock("@/services/offline/images.repo", () => ({
  insertOrUpdateImage: jest.fn(),
}));

jest.mock("@/services/gamification/streakService", () => ({
  refreshStreakFromBackend: (
    uid: string,
    options?: { refreshBadges?: boolean },
  ) => mockRefreshStreakFromBackend(uid, options),
}));

jest.mock("@/services/notifications/engine", () => ({
  reconcileAll: (uid: string) => mockReconcileAll(uid),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealWithPhoto: jest.fn(),
}));

jest.mock("@/services/meals/mealSaveTransaction", () => ({
  saveMealTransaction: jest.fn(),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: Record<string, unknown>) => {
    const handlers = mockEventHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  },
  on: (event: string, handler: (payload?: Record<string, unknown>) => void) => {
    const handlers = mockEventHandlers.get(event) ?? new Set();
    handlers.add(handler);
    mockEventHandlers.set(event, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        mockEventHandlers.delete(event);
      }
    };
  },
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: (...args: unknown[]) => mockDebugLog(...args),
    warn: (...args: unknown[]) => mockDebugWarn(...args),
    error: () => undefined,
    time: () => undefined,
    timeEnd: () => undefined,
    child: () => ({
      log: (...args: unknown[]) => mockDebugLog(...args),
      warn: (...args: unknown[]) => mockDebugWarn(...args),
      error: () => undefined,
      time: () => undefined,
      timeEnd: () => undefined,
      child: () => {
        throw new Error("child() depth exceeded in test mock");
      },
    }),
  }),
}));

const userData = {
  calorieTarget: 1000,
  preferences: ["balanced"],
  goal: "maintain",
} as UserNutritionProfile;

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "meal-1",
  timestamp: "2026-03-18T10:00:00.000Z",
  dayKey: "2026-03-18",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:00:00.000Z",
  syncState: "pending",
  source: "manual",
  totals: { kcal: 100, protein: 10, fat: 2, carbs: 12 },
  ...overrides,
});

function emitLocal(event: string, payload: Record<string, unknown>) {
  const handlers = mockEventHandlers.get(event);
  handlers?.forEach((handler) => handler(payload));
}

describe("useHomeTodayState", () => {
  beforeEach(() => {
    __resetLocalMealsStoreForTests();
    mockEventHandlers.clear();
    jest.clearAllMocks();
    mockGetAllMealsLocal.mockResolvedValue([]);
    mockGetMealByCloudIdLocal.mockResolvedValue(null);
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    mockPushQueue.mockResolvedValue();
    mockPullChanges.mockResolvedValue();
    mockRefreshStreakFromBackend.mockResolvedValue();
    mockReconcileAll.mockResolvedValue();
  });

  afterEach(() => {
    __resetLocalMealsStoreForTests();
    mockEventHandlers.clear();
  });

  it("updates add, edit and delete from the local read model using the canonical dayKey contract", async () => {
    const { result } = renderHook(() =>
      useHomeTodayState({
        uid: "user-1",
        selectedDayKey: "2026-03-18",
        nutritionProfile: userData,
        today: new Date("2026-03-18T08:00:00.000Z"),
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.mealCount).toBe(0);

    mockGetAllMealsLocal.mockClear();
    mockPullChanges.mockClear();

    const addedMeal = makeMeal({
      cloudId: "local-1",
      mealId: "local-1",
      name: "Late local meal",
      timestamp: "2026-03-19T00:30:00.000Z",
      dayKey: "2026-03-18",
      syncState: "pending",
      totals: { kcal: 100, protein: 10, fat: 2, carbs: 12 },
    });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce(addedMeal);

    await act(async () => {
      emitLocal("meal:local:upserted", {
        uid: "user-1",
        cloudId: "local-1",
        dayKey: "2026-03-18",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.dayMeals.map((meal) => meal.cloudId)).toEqual([
        "local-1",
      ]);
    });
    expect(result.current.dayKey).toBe("2026-03-18");
    expect(result.current.mealCount).toBe(1);
    expect(result.current.dayMeals[0]).toEqual(
      expect.objectContaining({ syncState: "pending" }),
    );
    expect(result.current.consumed).toEqual({
      kcal: 100,
      protein: 10,
      fat: 2,
      carbs: 12,
    });
    expect(result.current.kcalProgress).toBe(0.1);
    expect(result.current.macroTargets).toEqual(
      expect.objectContaining({
        proteinGrams: 65,
        fatGrams: 35,
        carbsGrams: 115,
      }),
    );
    expect(mockGetAllMealsLocal).not.toHaveBeenCalled();
    expect(mockPullChanges).not.toHaveBeenCalled();

    mockGetMealByCloudIdLocal.mockResolvedValueOnce(
      makeMeal({
        ...addedMeal,
        name: "Edited local meal",
        updatedAt: "2026-03-18T12:00:00.000Z",
        totals: { kcal: 250, protein: 25, fat: 8, carbs: 30 },
      }),
    );

    await act(async () => {
      emitLocal("meal:local:upserted", {
        uid: "user-1",
        cloudId: "local-1",
        dayKey: "2026-03-18",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.dayMeals[0]?.name).toBe("Edited local meal");
    });
    expect(result.current.mealCount).toBe(1);
    expect(result.current.consumed).toEqual({
      kcal: 250,
      protein: 25,
      fat: 8,
      carbs: 30,
    });
    expect(result.current.kcalProgress).toBe(0.25);
    expect(mockGetAllMealsLocal).not.toHaveBeenCalled();
    expect(mockPullChanges).not.toHaveBeenCalled();

    mockGetMealByCloudIdLocal.mockResolvedValueOnce(null);

    await act(async () => {
      emitLocal("meal:local:deleted", {
        uid: "user-1",
        cloudId: "local-1",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.dayMeals).toEqual([]);
    });
    expect(result.current.mealCount).toBe(0);
    expect(result.current.consumed).toEqual({
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    });
    expect(result.current.status).toBe("today_empty");
    expect(mockGetAllMealsLocal).not.toHaveBeenCalled();
    expect(mockPullChanges).not.toHaveBeenCalled();
  });
});
