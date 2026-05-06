import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Meal } from "@/types/meal";
import { useMeals } from "@/hooks/useMeals";
import { buildHomeDayState } from "@/feature/Home/services/homeDaySelectors";
import { buildStatisticsRangeState } from "@/feature/Statistics/services/statisticsRangeSelectors";
import {
  __resetLocalMealsStoreForTests,
  getLocalMealsSnapshot,
  selectLocalMealByCloudId,
} from "@/services/meals/localMealsStore";

const mockUuid = jest.fn<() => string>();
const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockGetMealsPageLocal = jest.fn<
  (uid: string, limit: number, before?: string) => Promise<Meal[]>
>();
const mockGetMealByCloudIdLocal = jest.fn<
  (uid: string, cloudId: string) => Promise<Meal | null>
>();
const mockUpsertMealLocal = jest.fn<(meal: Meal) => Promise<void>>();
const mockUpsertMyMealLocal = jest.fn<(meal: Meal) => Promise<void>>();
const mockMarkDeletedLocal = jest.fn<
  (uid: string, cloudId: string, now: string) => Promise<void>
>();
const mockEnqueueUpsert = jest.fn<(uid: string, meal: Meal) => Promise<void>>();
const mockEnqueueDelete = jest.fn<
  (uid: string, cloudId: string, now: string) => Promise<void>
>();
const mockEnqueueMyMealUpsert = jest.fn<(uid: string, meal: Meal) => Promise<void>>();
const mockInsertOrUpdateImage = jest.fn<
  (uid: string, cloudId: string, path: string, status: "pending") => Promise<void>
>();
const mockReconcileAll = jest.fn<(uid: string) => Promise<void>>();
const mockRefreshStreakFromBackend = jest.fn<
  (uid: string, options?: { refreshBadges?: boolean }) => Promise<void>
>();
const mockEmit = jest.fn<(event: string, payload: Record<string, unknown>) => void>();
const mockOn = jest.fn();
const mockRequestSync = jest.fn<
  (params: {
    uid: string;
    domain: string;
    reason: string;
    pullAfterPush?: boolean;
  }) => Promise<void>
>();
const mockPushQueue = jest.fn<(uid: string) => Promise<void>>();
const mockPullChanges = jest.fn<(uid: string) => Promise<void>>();
const mockUpsertMyMealWithPhoto = jest.fn<
  (uid: string, meal: Meal, localPhoto: string | null) => Promise<void>
>();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
const mockTrackMealLogged = jest.fn<(meal: Meal) => Promise<void>>();
const mockEventHandlers = new Map<
  string,
  Set<(payload?: Record<string, unknown>) => void>
>();

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: (...args: []) => mockNetInfoFetch(...args) },
}));

jest.mock("@/services/offline/meals.repo", () => ({
  getAllMealsLocal: (uid: string) =>
    mockGetMealsPageLocal(uid, 50, undefined),
  getMealsPageLocal: (uid: string, limit: number, before?: string) =>
    mockGetMealsPageLocal(uid, limit, before),
  getMealByCloudIdLocal: (uid: string, cloudId: string) =>
    mockGetMealByCloudIdLocal(uid, cloudId),
  upsertMealLocal: (meal: Meal) => mockUpsertMealLocal(meal),
  markDeletedLocal: (uid: string, cloudId: string, now: string) =>
    mockMarkDeletedLocal(uid, cloudId, now),
  getPendingMealsLocal: () => Promise.resolve([]),
}));

jest.mock("@/services/offline/myMeals.repo", () => ({
  upsertMyMealLocal: (meal: Meal) => mockUpsertMyMealLocal(meal),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueUpsert: (uid: string, meal: Meal) => mockEnqueueUpsert(uid, meal),
  enqueueDelete: (uid: string, cloudId: string, now: string) =>
    mockEnqueueDelete(uid, cloudId, now),
  enqueueMyMealUpsert: (uid: string, meal: Meal) =>
    mockEnqueueMyMealUpsert(uid, meal),
}));

jest.mock("@/services/offline/images.repo", () => ({
  insertOrUpdateImage: (
    uid: string,
    cloudId: string,
    path: string,
    status: "pending",
  ) => mockInsertOrUpdateImage(uid, cloudId, path, status),
}));

jest.mock("@/services/notifications/engine", () => ({
  reconcileAll: (uid: string) => mockReconcileAll(uid),
}));

jest.mock("@/services/gamification/streakService", () => ({
  refreshStreakFromBackend: (
    uid: string,
    options?: { refreshBadges?: boolean },
  ) => mockRefreshStreakFromBackend(uid, options),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload: Record<string, unknown>) => {
    mockEmit(event, payload);
    const handlers = mockEventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  },
  on: (event: string, handler: (payload?: Record<string, unknown>) => void) => {
    mockOn(event, handler);
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

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (params: {
    uid: string;
    domain: string;
    reason: string;
    pullAfterPush?: boolean;
  }) => mockRequestSync(params),
  pushQueue: (uid: string) => mockPushQueue(uid),
  pullChanges: (uid: string) => mockPullChanges(uid),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealWithPhoto: (uid: string, meal: Meal, localPhoto: string | null) =>
    mockUpsertMyMealWithPhoto(uid, meal, localPhoto),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackMealLogged: (meal: Meal) => mockTrackMealLogged(meal),
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
      child: () => ({
        log: (...nestedArgs: unknown[]) => mockDebugLog(...nestedArgs),
        warn: (...nestedArgs: unknown[]) => mockDebugWarn(...nestedArgs),
        error: () => undefined,
        time: () => undefined,
        timeEnd: () => undefined,
        child: () => {
          throw new Error("child() depth exceeded in test mock");
        },
      }),
    }),
  }),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-02-25T10:00:00.000Z",
  type: "lunch",
  name: "Chicken",
  ingredients: [
    { id: "i1", name: "A", amount: 100, kcal: 100, protein: 10, fat: 2, carbs: 5 },
    { id: "i2", name: "B", amount: 50, kcal: 50, protein: 5, fat: 1, carbs: 3 },
  ],
  createdAt: "2026-02-25T10:00:00.000Z",
  updatedAt: "2026-02-25T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  cloudId: "cloud-1",
  totals: { kcal: 150, protein: 15, fat: 3, carbs: 8 },
  ...overrides,
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const baseAddMealInput: Omit<Meal, "updatedAt" | "deleted"> = {
  userUid: "user-1",
  mealId: "meal-add",
  timestamp: "2026-01-01T00:00:00.000Z",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  syncState: "synced",
  source: "manual",
};

describe("useMeals", () => {
  beforeEach(() => {
    __resetLocalMealsStoreForTests();
    jest.clearAllMocks();
    jest.useRealTimers();
    mockEventHandlers.clear();

    mockUuid.mockImplementation(() => `uuid-${mockUuid.mock.calls.length}`);
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockGetMealsPageLocal.mockResolvedValue([]);
    mockGetMealByCloudIdLocal.mockResolvedValue(null);
    mockUpsertMealLocal.mockResolvedValue();
    mockUpsertMyMealLocal.mockResolvedValue();
    mockMarkDeletedLocal.mockImplementation(async (uid, cloudId, now) => {
      const handlers = mockEventHandlers.get("meal:local:deleted");
      handlers?.forEach((handler) =>
        handler({ uid, cloudId, ts: now }),
      );
    });
    mockEnqueueUpsert.mockResolvedValue();
    mockEnqueueDelete.mockResolvedValue();
    mockEnqueueMyMealUpsert.mockResolvedValue();
    mockInsertOrUpdateImage.mockResolvedValue();
    mockReconcileAll.mockResolvedValue();
    mockRefreshStreakFromBackend.mockResolvedValue();
    mockRequestSync.mockImplementation(async (params) => {
      await mockPushQueue(params.uid);
      if (params.pullAfterPush !== false) {
        await mockPullChanges(params.uid);
      }
    });
    mockPushQueue.mockResolvedValue();
    mockPullChanges.mockResolvedValue();
    mockUpsertMyMealWithPhoto.mockResolvedValue();
    mockTrackMealLogged.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("loads first page for a signed-in user", async () => {
    const firstPage = [
      baseMeal({ cloudId: "cloud-2", timestamp: "2026-02-25T12:00:00.000Z" }),
      baseMeal({ cloudId: "cloud-1", timestamp: "2026-02-25T10:00:00.000Z" }),
    ];
    mockGetMealsPageLocal.mockResolvedValueOnce(firstPage);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.meals).toEqual(firstPage);
    expect(mockGetMealsPageLocal).toHaveBeenCalledWith("user-1", 50, undefined);
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("does not start remote pulls when multiple useMeals instances mount", async () => {
    mockGetMealsPageLocal.mockResolvedValue([
      baseMeal({ cloudId: "local-cloud", name: "Local meal" }),
    ]);

    const first = renderHook(() => useMeals("user-1"));
    const second = renderHook(() => useMeals("user-1"));
    const third = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
      expect(third.result.current.loading).toBe(false);
      expect(first.result.current.meals[0]?.cloudId).toBe("local-cloud");
    });

    expect(first.result.current.meals).toEqual([
      expect.objectContaining({ cloudId: "local-cloud" }),
    ]);
    expect(second.result.current.meals).toEqual(first.result.current.meals);
    expect(third.result.current.meals).toEqual(first.result.current.meals);
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("reads the canonical local meal model while offline", async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({
        cloudId: "offline-local",
        name: "Offline visible meal",
        syncState: "pending",
      }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.meals).toEqual([
      expect.objectContaining({
        cloudId: "offline-local",
        name: "Offline visible meal",
        syncState: "pending",
      }),
    ]);
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("creates an offline meal in the local read model immediately and queues one upsert", async () => {
    jest.useFakeTimers();
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addMeal({
        ...baseAddMealInput,
        mealId: "offline-create",
        name: "Offline create",
        ingredients: [
          {
            id: "i1",
            name: "Rice",
            amount: 100,
            kcal: 120,
            protein: 3,
            carbs: 25,
            fat: 1,
          },
        ],
      });
    });

    const localMeal = selectLocalMealByCloudId("user-1", "offline-create");
    expect(localMeal).toEqual(
      expect.objectContaining({
        userUid: "user-1",
        cloudId: "offline-create",
        mealId: "offline-create",
        name: "Offline create",
        syncState: "pending",
        deleted: false,
        totals: { kcal: 120, protein: 3, carbs: 25, fat: 1 },
      }),
    );
    expect(result.current.meals).toEqual([
      expect.objectContaining({
        cloudId: "offline-create",
        syncState: "pending",
      }),
    ]);
    expect(mockUpsertMealLocal).toHaveBeenCalledTimes(1);
    expect(mockEnqueueUpsert).toHaveBeenCalledTimes(1);
    expect(mockEnqueueUpsert).toHaveBeenCalledWith("user-1", localMeal);
    expect(mockPushQueue).not.toHaveBeenCalled();
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("reloads visible meals when a synced meal event arrives", async () => {
    mockGetMealsPageLocal
      .mockResolvedValueOnce([baseMeal({ cloudId: "c1", name: "Old meal" })])
      .mockResolvedValueOnce([baseMeal({ cloudId: "c2", name: "Fresh meal" })]);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      const handlers = mockEventHandlers.get("meal:synced");
      handlers?.forEach((handler) => handler({ uid: "user-1" }));
    });

    await waitFor(() => {
      expect(result.current.meals[0]?.cloudId).toBe("c2");
    });
  });

  it("updates synced meals point-wise when the sync event includes an id", async () => {
    const syncedMeal = baseMeal({
      cloudId: "c1",
      name: "Synced meal",
      syncState: "synced",
      updatedAt: "2026-02-25T13:00:00.000Z",
    });

    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({ cloudId: "c1", name: "Pending meal", syncState: "pending" }),
    ]);
    mockGetMealByCloudIdLocal.mockResolvedValueOnce(syncedMeal);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockGetMealsPageLocal.mockClear();

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:synced");
      handlers?.forEach((handler) => handler({ uid: "user-1", cloudId: "c1" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.meals[0]).toEqual(
        expect.objectContaining({
          cloudId: "c1",
          name: "Synced meal",
          syncState: "synced",
        }),
      );
    });
    expect(mockGetMealByCloudIdLocal).toHaveBeenCalledWith("user-1", "c1");
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("updates pushed meals point-wise when the sync event includes an id", async () => {
    const syncedMeal = baseMeal({
      cloudId: "c1",
      name: "Pushed meal",
      syncState: "synced",
      updatedAt: "2026-02-25T13:00:00.000Z",
    });

    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({ cloudId: "c1", name: "Pending meal", syncState: "pending" }),
    ]);
    mockGetMealByCloudIdLocal.mockResolvedValueOnce(syncedMeal);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockGetMealsPageLocal.mockClear();

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:pushed");
      handlers?.forEach((handler) => handler({ uid: "user-1", cloudId: "c1" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.meals[0]).toEqual(
        expect.objectContaining({
          cloudId: "c1",
          name: "Pushed meal",
          syncState: "synced",
        }),
      );
    });
    expect(mockGetMealByCloudIdLocal).toHaveBeenCalledWith("user-1", "c1");
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("removes locally deleted meals point-wise without reloading the local feed", async () => {
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({ cloudId: "c1", name: "Deleted meal" }),
      baseMeal({ cloudId: "c2", name: "Kept meal" }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.meals.map((meal) => meal.cloudId)).toEqual([
        "c1",
        "c2",
      ]);
    });
    mockGetMealsPageLocal.mockClear();
    mockGetMealByCloudIdLocal.mockClear();

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:local:deleted");
      handlers?.forEach((handler) => handler({ uid: "user-1", cloudId: "c1" }));
      await Promise.resolve();
    });

    expect(result.current.meals.map((meal) => meal.cloudId)).toEqual(["c2"]);
    expect(mockGetMealByCloudIdLocal).not.toHaveBeenCalled();
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("does not use non-local delete transaction events as a local read-model event", async () => {
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({ cloudId: "c1", name: "Old meal" }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.meals.map((meal) => meal.cloudId)).toEqual(["c1"]);
    });
    mockGetMealsPageLocal.mockClear();

    act(() => {
      const handlers = mockEventHandlers.get("meal:delete:committed");
      handlers?.forEach((handler) =>
        handler({ uid: "user-1", cloudId: "c1", sourceHookId: "other-instance" }),
      );
    });

    expect(mockOn).not.toHaveBeenCalledWith(
      "meal:delete:committed",
      expect.any(Function),
    );
    expect(result.current.meals.map((meal) => meal.cloudId)).toEqual(["c1"]);
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("merges local upserts from another useMeals instance without backend reload", async () => {
    const pendingMeal = baseMeal({
      cloudId: "pending-cloud",
      mealId: "pending-meal",
      name: "Pending meal",
      syncState: "pending",
      timestamp: "2026-02-25T13:00:00.000Z",
      updatedAt: "2026-02-25T13:00:00.000Z",
      dayKey: "2026-02-25",
    });

    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({ cloudId: "existing-cloud", timestamp: "2026-02-25T10:00:00.000Z" }),
    ]);
    mockGetMealByCloudIdLocal.mockResolvedValueOnce(pendingMeal);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockGetMealsPageLocal.mockClear();
    mockPullChanges.mockClear();

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:local:upserted");
      handlers?.forEach((handler) =>
        handler({
          uid: "user-1",
          cloudId: "pending-cloud",
          dayKey: "2026-02-25",
          ts: "2026-02-25T13:00:00.000Z",
        }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.meals[0]).toEqual(
        expect.objectContaining({
          cloudId: "pending-cloud",
          syncState: "pending",
        }),
      );
    });
    expect(mockGetMealByCloudIdLocal).toHaveBeenCalledWith(
      "user-1",
      "pending-cloud",
    );
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("keeps the same meals array for equivalent duplicate local upsert events", async () => {
    const meal = baseMeal({
      userUid: "user-dup",
      cloudId: "same-cloud",
      syncState: "pending",
      lastSyncedAt: undefined,
    });

    mockGetMealsPageLocal.mockReset();
    mockGetMealByCloudIdLocal.mockReset();
    mockGetMealsPageLocal.mockResolvedValue([meal]);
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      ...meal,
      lastSyncedAt: 0,
    });

    const { result } = renderHook(() => useMeals("user-dup"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const currentMeals = result.current.meals;
    mockGetMealsPageLocal.mockClear();

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:local:upserted");
      handlers?.forEach((handler) =>
        handler({ uid: "user-dup", cloudId: "same-cloud" }),
      );
      await Promise.resolve();
    });

    expect(result.current.meals).toBe(currentMeals);
    expect(mockGetMealByCloudIdLocal).toHaveBeenCalledWith(
      "user-dup",
      "same-cloud",
    );
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("ignores local mutation events for a different or missing user without changing the snapshot", async () => {
    const initialMeal = baseMeal({
      userUid: "regression-user",
      cloudId: "current-user-meal",
    });
    const otherUserMeal = baseMeal({
      userUid: "user-2",
      cloudId: "other-user-meal",
      name: "Other user meal",
    });

    mockGetMealsPageLocal.mockResolvedValueOnce([initialMeal]);
    mockGetMealByCloudIdLocal.mockResolvedValueOnce(otherUserMeal);

    const { result } = renderHook(() => useMeals("regression-user"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const baseline = result.current.meals;
    mockGetMealByCloudIdLocal.mockClear();

    await act(async () => {
      const upsertHandlers = mockEventHandlers.get("meal:local:upserted");
      upsertHandlers?.forEach((handler) =>
        handler({ uid: "user-2", cloudId: "other-user-meal" }),
      );
      upsertHandlers?.forEach((handler) =>
        handler({ cloudId: "other-user-meal" }),
      );
      const deleteHandlers = mockEventHandlers.get("meal:local:deleted");
      deleteHandlers?.forEach((handler) =>
        handler({ uid: "user-2", cloudId: "current-user-meal" }),
      );
      deleteHandlers?.forEach((handler) =>
        handler({ cloudId: "current-user-meal" }),
      );
      await Promise.resolve();
    });

    expect(mockGetMealByCloudIdLocal).not.toHaveBeenCalled();
    expect(result.current.meals).toBe(baseline);
  });

  it("clears data when user is missing and keeps pagination inactive", async () => {
    const { result } = renderHook(() => useMeals(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.meals).toEqual([]);
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadNextPage();
      await result.current.getMeals();
    });
    expect(mockGetMealsPageLocal).not.toHaveBeenCalled();
  });

  it("keeps loadNextPage backed by the canonical local store refresh", async () => {
    const firstPage = [
      baseMeal({ cloudId: "c3", timestamp: "2026-02-25T12:00:00.000Z" }),
      baseMeal({ cloudId: "c2", timestamp: "2026-02-25T10:00:00.000Z" }),
    ];
    const refreshed = [
      ...firstPage,
      baseMeal({ cloudId: "c1", timestamp: "2026-02-25T08:00:00.000Z" }),
    ];

    mockGetMealsPageLocal.mockResolvedValueOnce(firstPage);

    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockGetMealsPageLocal.mockResolvedValue(refreshed);

    await act(async () => {
      await result.current.loadNextPage();
    });
    expect(result.current.meals.map((m) => m.cloudId)).toEqual([
      "c3",
      "c2",
      "c1",
    ]);
    expect(mockGetMealsPageLocal).toHaveBeenLastCalledWith("user-1", 50, undefined);
  });

  it("adds a meal, computes totals, updates local feed and queues sync", async () => {
    jest.useFakeTimers();
    mockGetMealsPageLocal.mockResolvedValue([]);
    mockUuid.mockReturnValueOnce("cloud-new");

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockPullChanges.mockClear();

    await act(async () => {
      await result.current.addMeal(
        {
          userUid: "ignored",
          mealId: undefined as unknown as string,
          timestamp: undefined as unknown as string,
          type: "dinner",
          name: "New meal",
          ingredients: [
            { id: "1", name: "A", amount: 1, kcal: 20, protein: 2, fat: 1, carbs: 3 },
            { id: "2", name: "B", amount: 1, kcal: 30, protein: 4, fat: 2, carbs: 5 },
          ],
          createdAt: undefined as unknown as string,
          syncState: "synced",
          source: null,
          cloudId: undefined,
          photoUrl: "file://local-photo.jpg",
          aiMeta: {
            model: "gpt-5.4-mini",
            runId: "run-1",
            confidence: 0.9,
            warnings: ["partial_totals"],
          },
        },
      );
    });

    expect(mockInsertOrUpdateImage).toHaveBeenCalledWith(
      "user-1",
      "cloud-new",
      "file://local-photo.jpg",
      "pending",
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledTimes(1);
    const savedPayload = mockUpsertMealLocal.mock.calls[0][0];
    expect(savedPayload.cloudId).toBe("cloud-new");
    expect(savedPayload.mealId).toBe("cloud-new");
    expect(savedPayload.source).toBe("manual");
    expect(savedPayload.inputMethod).toBe("manual");
    expect(savedPayload.dayKey).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(savedPayload.aiMeta).toEqual({
      model: "gpt-5.4-mini",
      runId: "run-1",
      confidence: 0.9,
      warnings: ["partial_totals"],
    });
    expect(savedPayload.totals).toEqual({ kcal: 50, protein: 6, fat: 3, carbs: 8 });
    expect(mockEnqueueUpsert).toHaveBeenCalledWith("user-1", savedPayload);
    expect(mockTrackMealLogged).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud-new",
        mealId: "cloud-new",
        source: "manual",
      }),
    );
    expect(result.current.meals[0]).toEqual(
      expect.objectContaining({
        cloudId: "cloud-new",
        mealId: "cloud-new",
        name: "New meal",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("meal:added", expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "toast.mealAdded",
      ns: "common",
    });

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    await flush();

    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
      pullAfterPush: false,
    });
    expect(mockPushQueue).toHaveBeenCalledWith("user-1");
    expect(mockPullChanges).not.toHaveBeenCalled();
    expect(mockRefreshStreakFromBackend).toHaveBeenCalledWith("user-1", {
      refreshBadges: true,
    });
    expect(mockReconcileAll).toHaveBeenCalledWith("user-1");
  });

  it("does nothing on add when user is missing", async () => {
    const { result } = renderHook(() => useMeals(null));

    await act(async () => {
      await result.current.addMeal({
        userUid: "",
        mealId: "m",
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "lunch",
        name: "Meal",
        ingredients: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        syncState: "synced",
        source: "manual",
      });
    });

    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("logs from saved template without updating my meals template by default", async () => {
    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addMeal({
        userUid: "user-1",
        mealId: "draft-meal-id",
        savedMealRefId: "saved-template-1",
        timestamp: "2026-03-15T12:00:00.000Z",
        type: "lunch",
        name: "Saved draft",
        ingredients: [],
        createdAt: "2026-03-15T12:00:00.000Z",
        syncState: "synced",
        source: "saved",
      });
    });

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        mealId: "draft-meal-id",
        cloudId: expect.any(String),
        source: "saved",
      }),
    );
    expect(mockUpsertMyMealWithPhoto).not.toHaveBeenCalled();
    expect(result.current.meals[0]).toEqual(
      expect.objectContaining({
        mealId: "draft-meal-id",
        source: "saved",
      }),
    );
  });

  it("saveMeal retries a saved-template draft against the same canonical meal id", async () => {
    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const draft = baseMeal({
      mealId: "draft-meal-id",
      cloudId: undefined,
      savedMealRefId: "saved-template-1",
      source: "saved",
      inputMethod: "saved",
    });

    await act(async () => {
      await result.current.saveMeal({
        meal: draft,
        savedTemplate: { mode: "none" },
      });
      await result.current.saveMeal({
        meal: draft,
        savedTemplate: { mode: "none" },
      });
    });

    const cloudIds = mockUpsertMealLocal.mock.calls.map(
      ([meal]) => meal.cloudId,
    );
    expect(new Set(cloudIds)).toEqual(new Set(["draft-meal-id"]));
    expect(mockUpsertMyMealWithPhoto).not.toHaveBeenCalled();
    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0]).toEqual(
      expect.objectContaining({
        cloudId: "draft-meal-id",
        mealId: "draft-meal-id",
        source: "saved",
      }),
    );
  });

  it("saveMeal updates the selected saved template without using it as the logged meal id", async () => {
    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveMeal({
        meal: baseMeal({
          mealId: "draft-logged-meal",
          cloudId: undefined,
          source: "saved",
          savedMealRefId: "saved-template-42",
          photoUrl: "file://template-update.jpg",
        }),
        savedTemplate: { mode: "update", templateId: "saved-template-42" },
      });
    });

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "draft-logged-meal",
        mealId: "draft-logged-meal",
        source: "saved",
      }),
    );
    expect(mockUpsertMyMealWithPhoto).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        mealId: "saved-template-42",
        cloudId: "saved-template-42",
        source: "saved",
      }),
      "file://template-update.jpg",
    );
  });

  it("updates an existing saved template by id without creating a duplicate", async () => {
    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSavedMealTemplate(
        "saved-template-42",
        baseMeal({
          mealId: "logged-meal-1",
          cloudId: "logged-meal-1",
          source: "saved",
          savedMealRefId: "saved-template-42",
          photoUrl: "file://template-update.jpg",
        }),
      );
    });

    expect(mockUpsertMyMealWithPhoto).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        mealId: "saved-template-42",
        cloudId: "saved-template-42",
        source: "saved",
      }),
      "file://template-update.jpg",
    );
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();
  });

  it("shows offline queued toast once while timer is already scheduled", async () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(9_000);
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const addInput = {
      userUid: "user-1",
      mealId: "m1",
      timestamp: "2026-01-01T00:00:00.000Z",
      type: "lunch" as const,
      name: "Meal",
      ingredients: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      syncState: "synced" as const,
      source: "manual" as const,
    };

    await act(async () => {
      await result.current.addMeal(addInput);
      await result.current.addMeal(addInput);
    });
    await flush();

    const offlineToasts = mockEmit.mock.calls.filter(
      ([event, payload]) =>
        event === "ui:toast" &&
        (payload as { key?: string }).key === "toast.savedLocallySyncLater",
    );
    expect(offlineToasts).toHaveLength(1);
    expect(mockDebugLog).toHaveBeenCalledWith("sync already scheduled", {
      uid: "user-1",
      reason: "add",
    });

    nowSpy.mockRestore();
  });

  it("updates saved-source history meals through the canonical meal transaction", async () => {
    jest.useFakeTimers();
    mockUuid.mockReturnValueOnce("history-cloud-id");
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({
          mealId: "saved-template-id",
          savedMealRefId: "saved-template-id",
          cloudId: undefined,
          source: "saved",
          photoUrl: "file://saved-photo.jpg",
        }),
      );
    });

    expect(mockInsertOrUpdateImage).toHaveBeenCalledWith(
      "user-1",
      "history-cloud-id",
      "file://saved-photo.jpg",
      "pending",
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.not.objectContaining({ savedMealRefId: expect.anything() }),
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        mealId: "history-cloud-id",
        cloudId: "history-cloud-id",
        source: "saved",
        photoLocalPath: "file://saved-photo.jpg",
      }),
    );
    expect(mockEnqueueUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ cloudId: "history-cloud-id" }),
    );
    expect(mockEmit).toHaveBeenCalledWith("meal:updated", expect.any(Object));
    expect(mockEmit).not.toHaveBeenCalledWith("meal:added", expect.any(Object));
    expect(mockUpsertMyMealWithPhoto).not.toHaveBeenCalled();
    expect(mockTrackMealLogged).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
  });

  it("updates regular meals and handles local image upload metadata", async () => {
    jest.useFakeTimers();
    mockUuid.mockReturnValueOnce("updated-cloud");

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({
          mealId: undefined as unknown as string,
          cloudId: undefined,
          timestamp: undefined as unknown as string,
          source: "manual",
          photoUrl: "content://updated-photo.jpg",
        }),
      );
    });

    expect(mockInsertOrUpdateImage).toHaveBeenCalledWith(
      "user-1",
      "updated-cloud",
      "content://updated-photo.jpg",
      "pending",
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "updated-cloud",
        photoLocalPath: "content://updated-photo.jpg",
      }),
    );
    expect(mockEnqueueUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        cloudId: "updated-cloud",
      }),
    );
    expect(mockTrackMealLogged).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    await flush();

    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
      pullAfterPush: false,
    });
    expect(mockPushQueue).toHaveBeenCalledWith("user-1");
    expect(mockPullChanges).not.toHaveBeenCalled();
    expect(mockRefreshStreakFromBackend).toHaveBeenCalledWith("user-1", {
      refreshBadges: true,
    });
    expect(mockReconcileAll).toHaveBeenCalledWith("user-1");
  });

  it("updates history meals offline as a local pending upsert", async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({
        cloudId: "history-cloud",
        mealId: "history-meal",
        dayKey: "2026-02-20",
        timestamp: "2026-02-20T09:15:00.000Z",
        name: "Stale history meal",
        ingredients: [],
        totals: { kcal: 150, protein: 15, carbs: 8, fat: 3 },
      }),
      baseMeal({
        cloudId: "other-day-cloud",
        mealId: "other-day-meal",
        dayKey: "2026-02-21",
        timestamp: "2026-02-21T08:00:00.000Z",
        name: "Other day meal",
        ingredients: [],
        totals: { kcal: 90, protein: 8, carbs: 7, fat: 2 },
      }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const originalTimestamp = "2026-02-20T09:15:00.000Z";
    const originalDayKey = "2026-02-20";

    mockEnqueueUpsert.mockImplementationOnce(async (uid, queuedMeal) => {
      expect(uid).toBe("user-1");
      expect(mockUpsertMealLocal.mock.invocationCallOrder.at(-1) ?? 0).toBeLessThan(
        mockEnqueueUpsert.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER,
      );

      const canonicalLocalMeal = selectLocalMealByCloudId("user-1", "history-cloud");
      expect(canonicalLocalMeal).toEqual(
        expect.objectContaining({
          cloudId: "history-cloud",
          name: "Offline edit",
          syncState: "pending",
          dayKey: originalDayKey,
          totals: { kcal: 260, protein: 27, carbs: 25, fat: 5 },
        }),
      );

      const snapshotMeals = getLocalMealsSnapshot("user-1").meals;
      const homeState = buildHomeDayState({
        meals: snapshotMeals,
        selectedDayKey: originalDayKey,
        todayDayKey: originalDayKey,
        nutritionProfile: {
          calorieTarget: 1000,
          preferences: ["balanced"],
          goal: "maintain",
        } as never,
      });
      const stats = buildStatisticsRangeState({
        meals: snapshotMeals,
        activeRange: "custom",
        todayDayKey: "2026-02-21",
        customRange: {
          startDayKey: "2026-02-20",
          endDayKey: "2026-02-21",
        },
      });

      expect(homeState.dayMeals).toEqual([
        expect.objectContaining({
          cloudId: "history-cloud",
          name: "Offline edit",
          syncState: "pending",
        }),
      ]);
      expect(homeState.consumed).toEqual({
        kcal: 260,
        protein: 27,
        carbs: 25,
        fat: 5,
      });
      expect(stats.totals).toEqual({
        kcal: 350,
        protein: 35,
        carbs: 32,
        fat: 7,
      });
      expect(queuedMeal).toEqual(canonicalLocalMeal);
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({
          userUid: "stale-user",
          mealId: "history-meal",
          cloudId: "history-cloud",
          timestamp: originalTimestamp,
          dayKey: originalDayKey,
          name: "Offline edit",
          deleted: true,
          syncState: "synced",
          totals: { kcal: 999, protein: 999, carbs: 999, fat: 999 },
          ingredients: [
            {
              id: "i1",
              name: "Rice",
              amount: 100,
              kcal: 120,
              protein: 3,
              carbs: 25,
              fat: 1,
            },
            {
              id: "i2",
              name: "Chicken",
              amount: 80,
              kcal: 140,
              protein: 24,
              carbs: 0,
              fat: 4,
            },
          ],
        }),
      );
    });

    const saved = mockUpsertMealLocal.mock.calls.at(-1)?.[0];
    expect(saved).toEqual(
      expect.objectContaining({
        userUid: "user-1",
        mealId: "history-meal",
        cloudId: "history-cloud",
        timestamp: originalTimestamp,
        dayKey: originalDayKey,
        deleted: false,
        syncState: "pending",
        totals: { kcal: 260, protein: 27, carbs: 25, fat: 5 },
      }),
    );
    expect(mockEnqueueUpsert).toHaveBeenCalledWith("user-1", saved);

    await waitFor(() => {
      expect(result.current.meals).toEqual([
        expect.objectContaining({
          cloudId: "other-day-cloud",
          name: "Other day meal",
        }),
        expect.objectContaining({
          cloudId: "history-cloud",
          name: "Offline edit",
          syncState: "pending",
        }),
      ]);
    });
  });

  it("updates the read model before queueing and leaves one queued upsert after repeated updates", async () => {
    jest.useFakeTimers();
    const queuedUpserts = new Map<string, Meal>();
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockEnqueueUpsert.mockImplementation(async (uid, queuedMeal) => {
      queuedUpserts.set(`${uid}:${queuedMeal.cloudId}`, queuedMeal);
      expect(selectLocalMealByCloudId(uid, queuedMeal.cloudId)).toEqual(
        expect.objectContaining({
          cloudId: queuedMeal.cloudId,
          name: queuedMeal.name,
          syncState: "pending",
        }),
      );
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({ cloudId: "repeat-cloud", mealId: "repeat-meal", name: "First edit" }),
      );
      await result.current.updateMeal(
        baseMeal({ cloudId: "repeat-cloud", mealId: "repeat-meal", name: "Second edit" }),
      );
      await result.current.updateMeal(
        baseMeal({ cloudId: "repeat-cloud", mealId: "repeat-meal", name: "Final edit" }),
      );
    });

    expect(mockUpsertMealLocal).toHaveBeenCalledTimes(3);
    expect(mockEnqueueUpsert).toHaveBeenCalledTimes(3);
    expect(queuedUpserts.size).toBe(1);
    expect([...queuedUpserts.values()][0]).toEqual(
      expect.objectContaining({
        cloudId: "repeat-cloud",
        mealId: "repeat-meal",
        name: "Final edit",
        syncState: "pending",
      }),
    );
    expect(selectLocalMealByCloudId("user-1", "repeat-cloud")).toEqual(
      expect.objectContaining({ name: "Final edit", syncState: "pending" }),
    );
  });

  it("deletes after a pending edit, removes the meal locally and leaves one queued delete", async () => {
    jest.useFakeTimers();
    const queuedOps = new Map<
      string,
      { kind: "upsert"; meal: Meal } | { kind: "delete"; cloudId: string; updatedAt: string }
    >();

    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({
        cloudId: "edit-delete",
        mealId: "edit-delete",
        name: "Before edit",
      }),
    ]);
    mockEnqueueUpsert.mockImplementation(async (uid, meal) => {
      queuedOps.set(`${uid}:${meal.cloudId}`, { kind: "upsert", meal });
    });
    mockEnqueueDelete.mockImplementation(async (uid, cloudId, updatedAt) => {
      queuedOps.delete(`${uid}:${cloudId}`);
      queuedOps.set(`${uid}:${cloudId}`, { kind: "delete", cloudId, updatedAt });
    });

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({
          cloudId: "edit-delete",
          mealId: "edit-delete",
          name: "Pending edit",
        }),
      );
    });

    expect(selectLocalMealByCloudId("user-1", "edit-delete")).toEqual(
      expect.objectContaining({
        name: "Pending edit",
        syncState: "pending",
      }),
    );
    expect([...queuedOps.values()]).toEqual([
      expect.objectContaining({
        kind: "upsert",
        meal: expect.objectContaining({ name: "Pending edit" }),
      }),
    ]);

    await act(async () => {
      await result.current.deleteMeal("edit-delete");
    });

    expect(selectLocalMealByCloudId("user-1", "edit-delete")).toBeNull();
    expect(result.current.meals).toEqual([]);
    expect(mockEnqueueUpsert).toHaveBeenCalledTimes(1);
    expect(mockEnqueueDelete).toHaveBeenCalledTimes(1);
    expect([...queuedOps.values()]).toEqual([
      expect.objectContaining({
        kind: "delete",
        cloudId: "edit-delete",
        updatedAt: expect.any(String),
      }),
    ]);
  });

  it("deletes meals, prunes local list and queues delete sync", async () => {
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({
        cloudId: "delete-me",
        mealId: "delete-me",
        dayKey: "2026-02-20",
        timestamp: "2026-02-20T12:00:00.000Z",
        ingredients: [],
        totals: { kcal: 220, protein: 18, carbs: 17, fat: 8 },
      }),
      baseMeal({
        cloudId: "keep-me",
        mealId: "keep-me",
        dayKey: "2026-02-20",
        timestamp: "2026-02-20T08:00:00.000Z",
        ingredients: [],
        totals: { kcal: 80, protein: 6, carbs: 4, fat: 2 },
      }),
      baseMeal({
        cloudId: "other-day",
        mealId: "other-day",
        dayKey: "2026-02-21",
        timestamp: "2026-02-21T07:00:00.000Z",
        ingredients: [],
        totals: { kcal: 120, protein: 10, carbs: 9, fat: 3 },
      }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.meals).toHaveLength(3);
    });

    await act(async () => {
      await result.current.deleteMeal("");
    });
    expect(mockMarkDeletedLocal).not.toHaveBeenCalled();

    mockEnqueueDelete.mockImplementationOnce(async (uid, cloudId) => {
      expect(uid).toBe("user-1");
      expect(cloudId).toBe("delete-me");
      expect(mockMarkDeletedLocal.mock.invocationCallOrder.at(-1) ?? 0).toBeLessThan(
        mockEnqueueDelete.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER,
      );
      expect(selectLocalMealByCloudId("user-1", "delete-me")).toBeNull();

      const snapshotMeals = getLocalMealsSnapshot("user-1").meals;
      const homeState = buildHomeDayState({
        meals: snapshotMeals,
        selectedDayKey: "2026-02-20",
        todayDayKey: "2026-02-20",
        nutritionProfile: {
          calorieTarget: 1000,
          preferences: ["balanced"],
          goal: "maintain",
        } as never,
      });
      const stats = buildStatisticsRangeState({
        meals: snapshotMeals,
        activeRange: "custom",
        todayDayKey: "2026-02-21",
        customRange: {
          startDayKey: "2026-02-20",
          endDayKey: "2026-02-21",
        },
      });

      expect(snapshotMeals.map((meal) => meal.cloudId)).toEqual([
        "other-day",
        "keep-me",
      ]);
      expect(homeState.dayMeals.map((meal) => meal.cloudId)).toEqual(["keep-me"]);
      expect(homeState.consumed).toEqual({
        kcal: 80,
        protein: 6,
        carbs: 4,
        fat: 2,
      });
      expect(stats.totals).toEqual({
        kcal: 200,
        protein: 16,
        carbs: 13,
        fat: 5,
      });
    });

    await act(async () => {
      await result.current.deleteMeal("delete-me");
    });

    expect(mockMarkDeletedLocal).toHaveBeenCalledTimes(1);
    expect(mockMarkDeletedLocal).toHaveBeenCalledWith(
      "user-1",
      "delete-me",
      expect.any(String),
    );
    expect(mockEnqueueDelete).toHaveBeenCalledWith(
      "user-1",
      "delete-me",
      expect.any(String),
    );
    expect(result.current.meals.map((m) => m.cloudId)).toEqual(["other-day", "keep-me"]);
    expect(mockEmit).toHaveBeenCalledWith(
      "meal:delete:committed",
      expect.objectContaining({
        uid: "user-1",
        cloudId: "delete-me",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith("meal:deleted", expect.anything());
    expect(mockTrackMealLogged).not.toHaveBeenCalled();

    mockGetMealByCloudIdLocal.mockResolvedValueOnce(
      baseMeal({
        userUid: "user-1",
        cloudId: "delete-me",
        mealId: "delete-me",
        dayKey: "2026-02-20",
        timestamp: "2026-02-20T12:00:00.000Z",
        updatedAt: "2026-02-20T12:30:00.000Z",
        deleted: true,
        syncState: "failed",
      }),
    );

    await act(async () => {
      const handlers = mockEventHandlers.get("meal:local:upserted");
      handlers?.forEach((handler) => handler({ uid: "user-1", cloudId: "delete-me" }));
      await Promise.resolve();
    });

    expect(result.current.meals.map((meal) => meal.cloudId)).toEqual([
      "other-day",
      "keep-me",
    ]);
    expect(selectLocalMealByCloudId("user-1", "delete-me")).toBeNull();
    expect(mockEnqueueDelete).toHaveBeenCalledTimes(1);
  });

  it("pushes delete sync after debounce without pulling meals again", async () => {
    jest.useFakeTimers();
    mockGetMealsPageLocal.mockResolvedValueOnce([
      baseMeal({
        cloudId: "delete-sync",
        mealId: "delete-sync",
        name: "Delete sync target",
      }),
    ]);

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockRequestSync.mockClear();
    mockPushQueue.mockClear();
    mockPullChanges.mockClear();

    await act(async () => {
      await result.current.deleteMeal("delete-sync");
    });

    expect(selectLocalMealByCloudId("user-1", "delete-sync")).toBeNull();
    expect(result.current.meals).toEqual([]);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    await flush();

    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "local-change",
      pullAfterPush: false,
    });
    expect(mockPushQueue).toHaveBeenCalledWith("user-1");
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("duplicates meals and allows overriding target date", async () => {
    jest.useFakeTimers();
    mockUuid.mockReturnValueOnce("copy-cloud").mockReturnValueOnce("copy-meal");

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.duplicateMeal(
        baseMeal({ cloudId: "origin-cloud", mealId: "origin-meal" }),
        "2026-03-01T12:00:00.000Z",
      );
    });

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "copy-cloud",
        mealId: "copy-meal",
        timestamp: "2026-03-01T12:00:00.000Z",
        dayKey: "2026-03-01",
        deleted: false,
      }),
    );
    expect(mockEnqueueUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ cloudId: "copy-cloud" }),
    );
    expect(mockTrackMealLogged).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "copy-cloud",
        mealId: "copy-meal",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "toast.mealAdded",
      ns: "common",
    });
  });

  it("duplicates meals without date override and uses current timestamp", async () => {
    jest.useFakeTimers();
    mockUuid.mockReturnValueOnce("copy-no-date-cloud").mockReturnValueOnce("copy-no-date-meal");

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.duplicateMeal(
        baseMeal({ cloudId: "origin-cloud-2", mealId: "origin-meal-2" }),
      );
    });

    const duplicated = mockUpsertMealLocal.mock.calls[mockUpsertMealLocal.mock.calls.length - 1][0];
    expect(duplicated.timestamp).toBe(duplicated.createdAt);
  });

  it("runs explicit sync, handles sync failures and returns empty unsynced meals list", async () => {
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockPushQueue.mockRejectedValueOnce(new Error("push failed"));
    await act(async () => {
      await result.current.syncMeals();
    });
    expect(mockDebugWarn).toHaveBeenCalledWith(
      "sync flush failed",
      expect.any(Error),
    );

    await act(async () => {
      await result.current.syncMeals();
    });
    expect(mockPushQueue).toHaveBeenCalledWith("user-1");
    expect(mockPullChanges).not.toHaveBeenCalled();

    const unsynced = await result.current.getUnsyncedMeals();
    expect(unsynced).toEqual([]);
  });

  it("logs reconcile failures from sync-triggered reconcile", async () => {
    mockReconcileAll.mockRejectedValueOnce(new Error("reconcile failed"));
    const { result } = renderHook(() => useMeals("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.syncMeals();
    });
    await flush();

    expect(mockDebugWarn).toHaveBeenCalledWith(
      "reconcile failed",
      expect.any(Error),
    );
  });

  it("queues a follow-up sync when requested during in-flight sync", async () => {
    jest.useFakeTimers();
    let releaseFirstPush: () => void = () => {};
    const firstPushPromise = new Promise<void>((resolve) => {
      releaseFirstPush = resolve;
    });
    mockPushQueue
      .mockImplementationOnce(() => firstPushPromise)
      .mockResolvedValueOnce();

    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    mockPullChanges.mockClear();

    let firstSyncPromise: Promise<void> | null = null;
    await act(async () => {
      firstSyncPromise = result.current.syncMeals();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.syncMeals();
    });

    releaseFirstPush();
    await act(async () => {
      await firstSyncPromise;
    });

    expect(mockPushQueue).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    await flush();

    expect(mockPushQueue).toHaveBeenCalledTimes(2);
    expect(mockPullChanges).not.toHaveBeenCalled();
  });

  it("clears pending sync timer when user changes", async () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useMeals(uid),
      { initialProps: { uid: "user-1" } },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addMeal(baseAddMealInput);
    });

    await act(async () => {
      rerender({ uid: "user-2" });
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it("handles add totals when ingredient nutrients are missing", async () => {
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addMeal({
        ...baseAddMealInput,
        mealId: "missing-nutrients",
        ingredients: [
          {
            id: "broken",
            name: "Broken Ingredient",
            amount: 1,
          } as unknown as Meal["ingredients"][number],
        ],
      });
    });

    const saved = mockUpsertMealLocal.mock.calls[mockUpsertMealLocal.mock.calls.length - 1][0];
    expect(saved.totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("handles add totals when ingredients are missing entirely", async () => {
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addMeal({
        ...baseAddMealInput,
        mealId: "missing-ingredients",
        ingredients: undefined as unknown as Meal["ingredients"],
      });
    });

    const saved = mockUpsertMealLocal.mock.calls[mockUpsertMealLocal.mock.calls.length - 1][0];
    expect(saved.totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("updates meal without local image registration for remote urls", async () => {
    const { result } = renderHook(() => useMeals("user-1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMeal(
        baseMeal({
          cloudId: "remote-cloud",
          source: "manual",
          photoUrl: "https://example.com/photo.jpg",
        }),
      );
    });

    expect(mockInsertOrUpdateImage).not.toHaveBeenCalledWith(
      "user-1",
      "remote-cloud",
      expect.anything(),
      "pending",
    );
  });

  it("returns early for operations requiring user when user is missing", async () => {
    const { result } = renderHook(() => useMeals(null));

    await act(async () => {
      await result.current.updateMeal(baseMeal());
      await result.current.duplicateMeal(baseMeal());
      await result.current.syncMeals();
    });

    expect(mockUpsertMyMealWithPhoto).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockPushQueue).not.toHaveBeenCalled();
  });
});
