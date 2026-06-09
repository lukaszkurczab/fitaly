import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockGetItem = jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockSetItem = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFetchMealChangesRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSaveMealRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockMarkMealDeletedRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpsertMealLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetMealByCloudIdLocal = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSetMealSyncStateLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockCleanupConfirmedLoggedMealPhoto = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockEmit = jest.fn();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: (...args: []) => mockNetInfoFetch(...args) },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

jest.mock("@/services/meals/mealsRepository", () => ({
  buildMealUpdatedCursor: (meal: { updatedAt: string; cloudId?: string }) =>
    `${meal.updatedAt}|${meal.cloudId || meal.updatedAt}`,
  fetchMealChangesRemote: (...args: unknown[]) => mockFetchMealChangesRemote(...args),
  markMealDeletedRemote: (...args: unknown[]) => mockMarkMealDeletedRemote(...args),
  saveMealRemote: (...args: unknown[]) => mockSaveMealRemote(...args),
}));

jest.mock("@/services/offline/meals.repo", () => ({
  upsertMealLocal: (...args: unknown[]) => mockUpsertMealLocal(...args),
  getMealByCloudIdLocal: (...args: unknown[]) => mockGetMealByCloudIdLocal(...args),
  setMealSyncStateLocal: (...args: unknown[]) => mockSetMealSyncStateLocal(...args),
}));

jest.mock("@/services/offline/images.repo", () => ({
  cleanupConfirmedLoggedMealPhoto: (...args: unknown[]) =>
    mockCleanupConfirmedLoggedMealPhoto(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

describe("meals strategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
    mockFetchMealChangesRemote
      .mockReset()
      .mockResolvedValue({ items: [], nextCursor: null });
    mockSaveMealRemote.mockResolvedValue();
    mockMarkMealDeletedRemote.mockResolvedValue();
    mockUpsertMealLocal.mockResolvedValue();
    mockGetMealByCloudIdLocal.mockResolvedValue(null);
    mockSetMealSyncStateLocal.mockResolvedValue();
    mockCleanupConfirmedLoggedMealPhoto.mockResolvedValue({
      cleaned: false,
      cloudId: "meal-1",
      reason: "local-path-missing",
    });
  });

  it("handles meal upsert push ops, runs confirmed photo cleanup, and marks local record synced", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const handled = await mealsStrategy.handlePushOp("user-1", {
      id: 2,
      client_mutation_id: "mutation-upsert-1",
      cloud_id: "meal-1",
      user_uid: "user-1",
      kind: "upsert",
      payload: {
        cloudId: "meal-1",
        mealId: "meal-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:00:00.000Z",
        imageId: "remote-image-1",
        photoUrl: "https://cdn.example/meal-photo.jpg",
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      updated_at: "2026-03-03T12:00:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockSaveMealRemote).toHaveBeenCalledWith({
      uid: "user-1",
      clientMutationId: "mutation-upsert-1",
      meal: expect.objectContaining({
        cloudId: "meal-1",
        mealId: "meal-1",
        userUid: "user-1",
        type: "lunch",
        imageId: "remote-image-1",
        photoUrl: "https://cdn.example/meal-photo.jpg",
      }),
    });
    expect(mockCleanupConfirmedLoggedMealPhoto).toHaveBeenCalledWith({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
      confirmedPhotoUrl: "https://cdn.example/meal-photo.jpg",
    });
    expect(
      mockSaveMealRemote.mock.invocationCallOrder[0],
    ).toBeLessThan(mockCleanupConfirmedLoggedMealPhoto.mock.invocationCallOrder[0]);
    expect(mockSetMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "meal-1",
        syncState: "synced",
      }),
    );
  });

  it("does not run confirmed photo cleanup after a successful stale image-less meal upsert", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const handled = await mealsStrategy.handlePushOp("user-1", {
      id: 2,
      client_mutation_id: "mutation-upsert-stale-no-image",
      cloud_id: "meal-1",
      user_uid: "user-1",
      kind: "upsert",
      payload: {
        cloudId: "meal-1",
        mealId: "meal-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:00:00.000Z",
        imageId: null,
        photoUrl: null,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      updated_at: "2026-03-03T12:00:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockSaveMealRemote).toHaveBeenCalledWith({
      uid: "user-1",
      clientMutationId: "mutation-upsert-stale-no-image",
      meal: expect.objectContaining({
        cloudId: "meal-1",
        imageId: null,
        photoUrl: null,
      }),
    });
    expect(mockCleanupConfirmedLoggedMealPhoto).not.toHaveBeenCalled();
    expect(mockSetMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "meal-1",
        syncState: "synced",
      }),
    );
  });

  it("does not run confirmed photo cleanup when remote meal upsert fails", async () => {
    mockSaveMealRemote.mockRejectedValueOnce(new Error("remote unavailable"));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await expect(
      mealsStrategy.handlePushOp("user-1", {
        id: 2,
        client_mutation_id: "mutation-upsert-1",
        cloud_id: "meal-1",
        user_uid: "user-1",
        kind: "upsert",
        payload: {
          cloudId: "meal-1",
          mealId: "meal-1",
          userUid: "user-1",
          timestamp: "2026-03-03T12:00:00.000Z",
          type: "lunch",
          ingredients: [],
          createdAt: "2026-03-03T12:00:00.000Z",
          updatedAt: "2026-03-03T12:00:00.000Z",
          totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
        },
        updated_at: "2026-03-03T12:00:00.000Z",
        attempts: 0,
      }),
    ).rejects.toThrow("remote unavailable");

    expect(mockCleanupConfirmedLoggedMealPhoto).not.toHaveBeenCalled();
    expect(mockSetMealSyncStateLocal).not.toHaveBeenCalled();
  });

  it("keeps meal upsert successful when confirmed photo cleanup reports deletion failure", async () => {
    mockCleanupConfirmedLoggedMealPhoto.mockResolvedValueOnce({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "delete-failed",
      message: "permission denied",
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const handled = await mealsStrategy.handlePushOp("user-1", {
      id: 2,
      client_mutation_id: "mutation-upsert-1",
      cloud_id: "meal-1",
      user_uid: "user-1",
      kind: "upsert",
      payload: {
        cloudId: "meal-1",
        mealId: "meal-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:00:00.000Z",
        imageId: "remote-image-1",
        photoUrl: "https://cdn.example/meal-photo.jpg",
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      updated_at: "2026-03-03T12:00:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockSetMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "meal-1",
        syncState: "synced",
      }),
    );
  });

  it("handles meal delete push ops with the queued clientMutationId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const handled = await mealsStrategy.handlePushOp("user-1", {
      id: 3,
      client_mutation_id: "mutation-delete-1",
      cloud_id: "meal-1",
      user_uid: "user-1",
      kind: "delete",
      payload: { cloudId: "meal-1", deleted: true },
      updated_at: "2026-03-03T12:30:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockMarkMealDeletedRemote).toHaveBeenCalledWith(
      "user-1",
      "meal-1",
      "2026-03-03T12:30:00.000Z",
      { clientMutationId: "mutation-delete-1" },
    );
  });

  it("pulls meal changes and advances cursor", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Chicken",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:30:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const synced = await mealsStrategy.pull("user-1");

    expect(synced).toBe(1);
    expect(mockFetchMealChangesRemote).toHaveBeenCalledWith({
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "meal-1",
        updatedAt: "2026-03-03T12:30:00.000Z",
        syncState: "synced",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:conflict:ambiguous",
      expect.anything(),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_ts:user-1",
      "2026-03-03T12:30:00.000Z|meal-1",
    );
  });

  it("pulls meal changes from stored cursor and follows page cursors only while pages contain items", async () => {
    mockGetItem.mockResolvedValueOnce("2026-03-03T12:00:00.000Z|meal-0");
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Page one",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:30:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: "2026-03-03T12:30:00.000Z|meal-1",
      })
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-2",
            cloudId: "meal-2",
            timestamp: "2026-03-03T13:00:00.000Z",
            type: "dinner",
            name: "Page two",
            ingredients: [],
            createdAt: "2026-03-03T13:00:00.000Z",
            updatedAt: "2026-03-03T13:30:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 300, protein: 20, carbs: 30, fat: 10 },
          },
        ],
        nextCursor: null,
      });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    const synced = await mealsStrategy.pull("user-1");

    expect(synced).toBe(2);
    expect(mockFetchMealChangesRemote).toHaveBeenNthCalledWith(1, {
      uid: "user-1",
      pageSize: 100,
      cursor: "2026-03-03T12:00:00.000Z|meal-0",
    });
    expect(mockFetchMealChangesRemote).toHaveBeenNthCalledWith(2, {
      uid: "user-1",
      pageSize: 100,
      cursor: "2026-03-03T12:30:00.000Z|meal-1",
    });
    expect(mockFetchMealChangesRemote).toHaveBeenCalledTimes(2);
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_ts:user-1",
      "2026-03-03T13:30:00.000Z|meal-2",
    );
  });

  it("ignores legacy timestamp-only pull cursor for meal changes", async () => {
    mockGetItem.mockResolvedValueOnce("1970-01-01T00:00:00.000Z");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockFetchMealChangesRemote).toHaveBeenCalledWith({
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
  });

  it("keeps pending local edit when pulled remote meal is older", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Remote",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:10:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      type: "lunch",
      name: "Local",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:40:00.000Z",
      syncState: "pending",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: null,
      tags: [],
      deleted: false,
      totals: { kcal: 180, protein: 25, carbs: 5, fat: 4 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:synced",
      expect.anything(),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:conflict:ambiguous",
      expect.anything(),
    );
  });

  it("does not overwrite a newer local offline edit with an older server snapshot after reconnect", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            dayKey: "2026-03-03",
            type: "lunch",
            name: "Remote older copy",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:20:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      dayKey: "2026-03-04",
      type: "lunch",
      name: "Local offline edit",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:45:00.000Z",
      syncState: "pending",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: "keep newer local notes",
      tags: ["offline-edit"],
      deleted: false,
      totals: { kcal: 520, protein: 36, carbs: 42, fat: 20 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:synced",
      expect.anything(),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_ts:user-1",
      "2026-03-03T12:20:00.000Z|meal-1",
    );
  });

  it("marks pending local edit as conflict when pulled remote meal is newer", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Remote",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:40:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      type: "lunch",
      name: "Local offline edit",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:10:00.000Z",
      syncState: "pending",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: null,
      tags: [],
      deleted: false,
      totals: { kcal: 180, protein: 25, carbs: 5, fat: 4 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "meal-1",
        name: "Local offline edit",
        updatedAt: "2026-03-03T12:10:00.000Z",
        syncState: "conflict",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:synced",
      expect.anything(),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:conflict:ambiguous",
      expect.anything(),
    );
  });

  it("keeps a pending local delete tombstone when pull contains a remote update", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Remote update",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:40:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      type: "lunch",
      name: "Local delete",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:10:00.000Z",
      syncState: "pending",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: null,
      tags: [],
      deleted: true,
      totals: { kcal: 180, protein: 25, carbs: 5, fat: 4 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "meal-1",
        name: "Local delete",
        deleted: true,
        syncState: "conflict",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:synced",
      expect.anything(),
    );
  });

  it("does not mask a dead-lettered local meal when pull contains a remote change", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Remote update",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:40:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      type: "lunch",
      name: "Failed local",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:10:00.000Z",
      syncState: "failed",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: null,
      tags: [],
      deleted: false,
      totals: { kcal: 180, protein: 25, carbs: 5, fat: 4 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:synced",
      expect.anything(),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "meal:conflict:ambiguous",
      expect.anything(),
    );
  });

  it("emits ambiguous conflict event when pending local and remote updates are within 5 minutes", async () => {
    mockFetchMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          {
            userUid: "user-1",
            mealId: "meal-1",
            cloudId: "meal-1",
            timestamp: "2026-03-03T12:00:00.000Z",
            type: "lunch",
            name: "Remote",
            ingredients: [],
            createdAt: "2026-03-03T12:00:00.000Z",
            updatedAt: "2026-03-03T12:10:00.000Z",
            syncState: "synced",
            source: "manual",
            imageId: null,
            photoUrl: null,
            notes: null,
            tags: [],
            deleted: false,
            totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    mockGetMealByCloudIdLocal.mockResolvedValueOnce({
      userUid: "user-1",
      mealId: "meal-1",
      cloudId: "meal-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      type: "lunch",
      name: "Local",
      ingredients: [],
      createdAt: "2026-03-03T12:00:00.000Z",
      updatedAt: "2026-03-03T12:12:00.000Z",
      syncState: "pending",
      source: "manual",
      imageId: null,
      photoUrl: null,
      notes: null,
      tags: [],
      deleted: false,
      totals: { kcal: 180, protein: 25, carbs: 5, fat: 4 },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mealsStrategy } = require("@/services/offline/strategies/meals.strategy");

    await mealsStrategy.pull("user-1");

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "meal-1",
        name: "Local",
        syncState: "conflict",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("meal:conflict:ambiguous", {
      uid: "user-1",
      cloudId: "meal-1",
      localUpdatedAt: "2026-03-03T12:12:00.000Z",
      remoteUpdatedAt: "2026-03-03T12:10:00.000Z",
      reason: "pending-ambiguous",
    });
  });
});
