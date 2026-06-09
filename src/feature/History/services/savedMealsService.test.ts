import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal, MealSyncState } from "@/types/meal";
import {
  deleteSavedMeal,
  fetchSavedMealsPage,
  subscribeSavedMealsFirstPage,
  updateSavedMeal,
} from "@/feature/History/services/savedMealsService";

const mockGetInfoAsync = jest.fn<(path: string) => Promise<{ exists: boolean }>>();
const mockSubscribeToMyMealsFirstPage = jest.fn();
const mockFetchMyMealsPage = jest.fn<
  (params: unknown) => Promise<{ items: Meal[]; lastDoc: string | null; hasMore: boolean }>
>();
const mockUpsertMyMealLocal = jest.fn<(meal: Meal) => Promise<void>>();
const mockMarkDeletedMyMealLocal = jest.fn<
  (cloudId: string, updatedAt: string) => Promise<void>
>();
const mockEnqueueMyMealDelete = jest.fn<
  (uid: string, cloudId: string, updatedAt: string) => Promise<void>
>();
const mockEnqueueMyMealUpsert = jest.fn<
  (uid: string, meal: Meal) => Promise<void>
>();
const mockSyncMyMeals = jest.fn<(uid?: string | null) => Promise<void>>();
const mockEmit = jest.fn<(event: string, payload: unknown) => void>();
const mockUnsubscribe = jest.fn();

let emitFirstPage:
  | ((page: {
      items: Meal[];
      lastDoc: string | null;
      hasMore: boolean;
    }) => void)
  | null = null;

jest.mock("@/services/core/fileSystem", () => ({
  getInfoAsync: (path: string) => mockGetInfoAsync(path),
}));

jest.mock("@/services/meals/myMealsRepository", () => ({
  subscribeToMyMealsFirstPage: (params: {
    onData: (page: { items: Meal[]; lastDoc: string | null; hasMore: boolean }) => void;
  }) => {
    mockSubscribeToMyMealsFirstPage(params);
    emitFirstPage = params.onData;
    return mockUnsubscribe;
  },
  fetchMyMealsPage: (params: unknown) => mockFetchMyMealsPage(params),
}));

jest.mock("@/services/offline/myMeals.repo", () => ({
  upsertMyMealLocal: (meal: Meal) => mockUpsertMyMealLocal(meal),
  markDeletedMyMealLocal: (cloudId: string, updatedAt: string) =>
    mockMarkDeletedMyMealLocal(cloudId, updatedAt),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueMyMealDelete: (uid: string, cloudId: string, updatedAt: string) =>
    mockEnqueueMyMealDelete(uid, cloudId, updatedAt),
  enqueueMyMealUpsert: (uid: string, meal: Meal) =>
    mockEnqueueMyMealUpsert(uid, meal),
}));

jest.mock("@/services/meals/myMealService", () => ({
  syncMyMeals: (uid?: string | null) => mockSyncMyMeals(uid),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload: unknown) => mockEmit(event, payload),
}));

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "cloud-1",
  timestamp: "2026-02-01T10:00:00.000Z",
  type: "lunch",
  name: "Chicken pasta",
  ingredients: [],
  createdAt: "2026-02-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
  syncState: "synced",
  source: "saved",
  ...overrides,
});

describe("savedMealsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitFirstPage = null;
    mockGetInfoAsync.mockResolvedValue({ exists: true });
    mockFetchMyMealsPage.mockResolvedValue({
      items: [],
      lastDoc: null,
      hasMore: false,
    });
    mockUpsertMyMealLocal.mockResolvedValue();
    mockMarkDeletedMyMealLocal.mockResolvedValue();
    mockEnqueueMyMealDelete.mockResolvedValue();
    mockEnqueueMyMealUpsert.mockResolvedValue();
    mockSyncMyMeals.mockResolvedValue();
  });

  it("subscribes through repository and clears stale local photos", async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    const onData = jest.fn<
      (page: { items: Meal[]; lastDoc: string | null; hasMore: boolean }) => Promise<void>
    >(async () => undefined);

    subscribeSavedMealsFirstPage({
      uid: "user-1",
      pageSize: 20,
      onData,
      onError: jest.fn(),
    });

    await emitFirstPage?.({
      items: [
        meal({
          photoLocalPath: "file:///missing.jpg",
          photoUrl: "file:///missing.jpg",
        }),
        meal({ mealId: "meal-2", cloudId: "cloud-2", name: "Ok", photoUrl: null }),
        meal({ mealId: "meal-3", cloudId: "cloud-3", deleted: true }),
      ],
      lastDoc: "20",
      hasMore: true,
    });

    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "cloud-1",
        photoUrl: null,
        photoLocalPath: null,
      }),
    );
    expect(onData).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({ cloudId: "cloud-1", photoUrl: null, photoLocalPath: null }),
        expect.objectContaining({ cloudId: "cloud-2" }),
      ],
      lastDoc: "20",
      hasMore: true,
    });
  });

  it("fetches paged data through repository and normalizes stale photo paths", async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    mockFetchMyMealsPage.mockResolvedValueOnce({
      items: [meal({ photoLocalPath: "file:///stale.jpg" })],
      lastDoc: "20",
      hasMore: true,
    });

    const page = await fetchSavedMealsPage({
      uid: "user-1",
      pageSize: 20,
      lastDoc: "0",
    });

    expect(mockFetchMyMealsPage).toHaveBeenCalledWith({
      uid: "user-1",
      pageSize: 20,
      lastDoc: "0",
    });
    expect(page).toEqual({
      items: [expect.objectContaining({ photoUrl: null, photoLocalPath: null })],
      lastDoc: "20",
      hasMore: true,
    });
  });

  it("queues offline delete and emits toast", async () => {
    const result = await deleteSavedMeal({
      uid: "user-1",
      cloudId: "cloud-1",
      isOnline: false,
      nowISO: "2026-03-03T10:00:00.000Z",
    });

    expect(result).toBe("queued");
    expect(mockMarkDeletedMyMealLocal).toHaveBeenCalledWith(
      "cloud-1",
      "2026-03-03T10:00:00.000Z",
    );
    expect(mockEnqueueMyMealDelete).toHaveBeenCalledWith(
      "user-1",
      "cloud-1",
      "2026-03-03T10:00:00.000Z",
    );
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "toast.savedMealDeleteQueued",
      ns: "common",
    });
  });

  it("falls back to queued semantics when sync fails and persists local updates first", async () => {
    mockSyncMyMeals.mockRejectedValueOnce(new Error("remote failed"));

    const deleteResult = await deleteSavedMeal({
      uid: "user-1",
      cloudId: "cloud-1",
      isOnline: true,
      nowISO: "2026-03-03T11:00:00.000Z",
    });

    expect(deleteResult).toBe("queued");
    expect(mockEnqueueMyMealDelete).toHaveBeenCalledWith(
      "user-1",
      "cloud-1",
      "2026-03-03T11:00:00.000Z",
    );

    await updateSavedMeal({
      uid: "user-1",
      cloudId: "cloud-1",
      meal: meal(),
      name: "Updated",
      type: "dinner",
      timestampISO: "2026-03-03T12:00:00.000Z",
      createdAtISO: "2026-03-03T09:00:00.000Z",
      nowISO: "2026-03-03T12:30:00.000Z",
    });

    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated",
        type: "dinner",
        source: "saved",
        updatedAt: "2026-03-03T12:30:00.000Z",
      }),
    );
    expect(mockEnqueueMyMealUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "Updated",
        type: "dinner",
        source: "saved",
        updatedAt: "2026-03-03T12:30:00.000Z",
      }),
    );
    expect(mockSyncMyMeals).toHaveBeenCalledWith("user-1");
  });

  it.each(["conflict", "failed"] satisfies MealSyncState[])(
    "persists reviewed %s saved meals as pending queued edits",
    async (initialSyncState) => {
      await updateSavedMeal({
        uid: "user-2",
        cloudId: "cloud-2",
        meal: meal({
          userUid: "stale-user",
          mealId: "stale-meal-id",
          cloudId: "stale-cloud-id",
          name: "Remote conflict",
          type: "lunch",
          timestamp: "2026-03-01T08:00:00.000Z",
          createdAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T09:00:00.000Z",
          syncState: initialSyncState,
        }),
        name: "Reviewed saved meal",
        type: "snack",
        timestampISO: "2026-03-03T12:00:00.000Z",
        createdAtISO: "2026-03-01T08:00:00.000Z",
        nowISO: "2026-03-03T12:30:00.000Z",
      });

      const expectedPayload = expect.objectContaining({
        userUid: "user-2",
        cloudId: "cloud-2",
        mealId: "cloud-2",
        source: "saved",
        name: "Reviewed saved meal",
        type: "snack",
        timestamp: "2026-03-03T12:00:00.000Z",
        createdAt: "2026-03-01T08:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        syncState: "pending",
      });

      expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(expectedPayload);
      expect(mockEnqueueMyMealUpsert).toHaveBeenCalledWith(
        "user-2",
        expectedPayload,
      );
      expect(mockSyncMyMeals).toHaveBeenCalledWith("user-2");
    },
  );
});
