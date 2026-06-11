import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockGetItem = jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockSetItem = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFetchMyMealChangesRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdateMyMealRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUploadMyMealPhotoRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMarkMyMealDeletedRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetMyMealByCloudIdLocal = jest.fn<(...args: unknown[]) => Promise<Meal | null>>();
const mockUpsertMyMealLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSetMyMealSyncStateLocal = jest.fn<(...args: unknown[]) => Promise<void>>();
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

jest.mock("@/services/meals/myMealsRepository", () => ({
  buildMyMealUpdatedCursor: (meal: { updatedAt: string; cloudId?: string }) =>
    `${meal.updatedAt}|${meal.cloudId || meal.updatedAt}`,
  fetchMyMealChangesRemote: (...args: unknown[]) => mockFetchMyMealChangesRemote(...args),
  markMyMealDeletedRemote: (...args: unknown[]) => mockMarkMyMealDeletedRemote(...args),
  updateMyMealRemote: (...args: unknown[]) => mockUpdateMyMealRemote(...args),
  uploadMyMealPhotoRemote: (...args: unknown[]) => mockUploadMyMealPhotoRemote(...args),
}));

jest.mock("@/services/offline/myMeals.repo", () => ({
  getMyMealByCloudIdLocal: (...args: unknown[]) => mockGetMyMealByCloudIdLocal(...args),
  upsertMyMealLocal: (...args: unknown[]) => mockUpsertMyMealLocal(...args),
  setMyMealSyncStateLocal: (...args: unknown[]) => mockSetMyMealSyncStateLocal(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

function baseSavedMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    userUid: "user-1",
    mealId: "saved-1",
    cloudId: "saved-1",
    timestamp: "2026-03-03T12:00:00.000Z",
    type: "lunch",
    name: "Saved meal",
    ingredients: [],
    createdAt: "2026-03-03T12:00:00.000Z",
    updatedAt: "2026-03-03T12:40:00.000Z",
    syncState: "synced",
    source: "saved",
    imageId: null,
    photoUrl: null,
    notes: null,
    tags: [],
    deleted: false,
    totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
    ...overrides,
  };
}

describe("myMeals strategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
    mockFetchMyMealChangesRemote
      .mockReset()
      .mockResolvedValue({ items: [], nextCursor: null });
    mockUpdateMyMealRemote.mockResolvedValue();
    mockUploadMyMealPhotoRemote.mockResolvedValue({
      imageId: "image-1",
      photoUrl: "https://cdn/mymeal.jpg",
    });
    mockMarkMyMealDeletedRemote.mockResolvedValue();
    mockGetMyMealByCloudIdLocal.mockReset().mockResolvedValue(null);
    mockUpsertMyMealLocal.mockResolvedValue();
    mockSetMyMealSyncStateLocal.mockResolvedValue();
  });

  it("handles saved meal upsert push ops and uploads local photo", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const handled = await myMealsStrategy.handlePushOp("user-1", {
      id: 3,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "upsert_mymeal",
      payload: {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:10:00.000Z",
        source: "saved",
        photoUrl: "file://saved.jpg",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-upsert-1",
    });

    expect(handled).toBe(true);
    expect(mockUploadMyMealPhotoRemote).toHaveBeenCalledWith(
      "user-1",
      "saved-1",
      "file://saved.jpg",
    );
    expect(mockUpdateMyMealRemote).toHaveBeenCalledWith(
      "user-1",
      "saved-1",
      expect.objectContaining({
        mealId: "saved-1",
        cloudId: "saved-1",
        source: "saved",
        imageId: "image-1",
        photoUrl: "https://cdn/mymeal.jpg",
      }),
      "mutation-saved-upsert-1",
    );
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-1",
        photoLocalPath: "file://saved.jpg",
      }),
    );
    expect(mockSetMyMealSyncStateLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        cloudId: "saved-1",
        syncState: "synced",
      }),
    );
  });

  it("attaches uploaded saved meal storagePath to the immediate upsert payload", async () => {
    mockUploadMyMealPhotoRemote.mockResolvedValueOnce({
      imageId: "image-1",
      photoUrl: "https://cdn/mymeal.jpg",
      storagePath: "mealTemplates/user-1/saved-1-uploaded-image-1.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.handlePushOp("user-1", {
      id: 3,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "upsert_mymeal",
      payload: {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:10:00.000Z",
        source: "saved",
        photoUrl: "file://saved.jpg",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-upsert-1",
    });

    expect(mockUpdateMyMealRemote).toHaveBeenCalledWith(
      "user-1",
      "saved-1",
      expect.objectContaining({
        imageId: "image-1",
        photoUrl: "https://cdn/mymeal.jpg",
        imageRef: {
          imageId: "image-1",
          storagePath: "mealTemplates/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/mymeal.jpg",
        },
      }),
      "mutation-saved-upsert-1",
    );
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-1",
        imageRef: {
          imageId: "image-1",
          storagePath: "mealTemplates/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/mymeal.jpg",
        },
      }),
    );
  });

  it("omits uploaded saved meal storagePath when the upload response lacks one", async () => {
    mockUploadMyMealPhotoRemote.mockResolvedValueOnce({
      imageId: "image-1",
      photoUrl: "https://cdn/mymeal.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.handlePushOp("user-1", {
      id: 3,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "upsert_mymeal",
      payload: {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:10:00.000Z",
        source: "saved",
        photoUrl: "file://saved.jpg",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-upsert-1",
    });

    const updatePayload = mockUpdateMyMealRemote.mock.calls[0]?.[2] as {
      imageRef?: Record<string, unknown>;
    };
    expect(updatePayload.imageRef).toEqual({
      imageId: "image-1",
      downloadUrl: "https://cdn/mymeal.jpg",
    });
    expect(updatePayload.imageRef).not.toHaveProperty("storagePath");
  });

  it("omits uploaded saved meal storagePath when it is outside the active user scope", async () => {
    mockUploadMyMealPhotoRemote.mockResolvedValueOnce({
      imageId: "image-1",
      photoUrl: "https://cdn/mymeal.jpg",
      storagePath: "mealTemplates/other-user/saved-1-uploaded-image-1.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.handlePushOp("user-1", {
      id: 3,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "upsert_mymeal",
      payload: {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:10:00.000Z",
        source: "saved",
        photoUrl: "file://saved.jpg",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-upsert-1",
    });

    const updatePayload = mockUpdateMyMealRemote.mock.calls[0]?.[2] as {
      imageRef?: Record<string, unknown>;
    };
    expect(updatePayload.imageRef).toEqual({
      imageId: "image-1",
      downloadUrl: "https://cdn/mymeal.jpg",
    });
    expect(updatePayload.imageRef).not.toHaveProperty("storagePath");
  });

  it("omits uploaded saved meal storagePath when it uses the old namespace", async () => {
    mockUploadMyMealPhotoRemote.mockResolvedValueOnce({
      imageId: "image-1",
      photoUrl: "https://cdn/mymeal.jpg",
      storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.handlePushOp("user-1", {
      id: 3,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "upsert_mymeal",
      payload: {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:10:00.000Z",
        source: "saved",
        photoUrl: "file://saved.jpg",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-upsert-1",
    });

    const updatePayload = mockUpdateMyMealRemote.mock.calls[0]?.[2] as {
      imageRef?: Record<string, unknown>;
    };
    expect(updatePayload.imageRef).toEqual({
      imageId: "image-1",
      downloadUrl: "https://cdn/mymeal.jpg",
    });
    expect(updatePayload.imageRef).not.toHaveProperty("storagePath");
  });

  it("passes client mutation id to saved meal delete push ops", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const handled = await myMealsStrategy.handlePushOp("user-1", {
      id: 4,
      cloud_id: "saved-1",
      user_uid: "user-1",
      kind: "delete_mymeal",
      payload: {},
      updated_at: "2026-03-03T12:20:00.000Z",
      attempts: 0,
      client_mutation_id: "mutation-saved-delete-1",
    });

    expect(handled).toBe(true);
    expect(mockMarkMyMealDeletedRemote).toHaveBeenCalledWith(
      "user-1",
      "saved-1",
      "2026-03-03T12:20:00.000Z",
      { clientMutationId: "mutation-saved-delete-1" },
    );
  });

  it("pulls saved meal changes and advances the saved meals cursor", async () => {
    mockFetchMyMealChangesRemote.mockResolvedValueOnce({
      items: [
        baseSavedMeal({
          updatedAt: "2026-03-03T12:40:00.000Z",
        }),
      ],
      nextCursor: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const synced = await myMealsStrategy.pull("user-1");

    expect(synced).toBe(1);
    expect(mockFetchMyMealChangesRemote).toHaveBeenCalledWith({
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
    expect(mockGetMyMealByCloudIdLocal).toHaveBeenCalledWith(
      "user-1",
      "saved-1",
    );
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-1",
        updatedAt: "2026-03-03T12:40:00.000Z",
        syncState: "synced",
        source: "saved",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("mymeal:synced", {
      uid: "user-1",
      cloudId: "saved-1",
      updatedAt: "2026-03-03T12:40:00.000Z",
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_my_meals:user-1",
      "2026-03-03T12:40:00.000Z|saved-1",
    );
  });

  it("uses stored composite saved meal cursor and follows backend page cursors", async () => {
    mockGetItem.mockResolvedValueOnce("2026-03-03T12:00:00.000Z|saved-0");
    mockFetchMyMealChangesRemote
      .mockResolvedValueOnce({
        items: [
          baseSavedMeal({
            updatedAt: "2026-03-03T12:40:00.000Z",
          }),
        ],
        nextCursor: "2026-03-03T12:40:00.000Z|saved-1",
      })
      .mockResolvedValueOnce({
        items: [
          baseSavedMeal({
            mealId: "saved-2",
            cloudId: "saved-2",
            updatedAt: "2026-03-03T13:30:00.000Z",
          }),
        ],
        nextCursor: null,
      });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const synced = await myMealsStrategy.pull("user-1");

    expect(synced).toBe(2);
    expect(mockFetchMyMealChangesRemote).toHaveBeenNthCalledWith(1, {
      uid: "user-1",
      pageSize: 100,
      cursor: "2026-03-03T12:00:00.000Z|saved-0",
    });
    expect(mockFetchMyMealChangesRemote).toHaveBeenNthCalledWith(2, {
      uid: "user-1",
      pageSize: 100,
      cursor: "2026-03-03T12:40:00.000Z|saved-1",
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_my_meals:user-1",
      "2026-03-03T13:30:00.000Z|saved-2",
    );
  });

  it("ignores legacy timestamp-only saved meal pull cursor", async () => {
    mockGetItem.mockResolvedValueOnce("1970-01-01T00:00:00.000Z");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.pull("user-1");

    expect(mockFetchMyMealChangesRemote).toHaveBeenCalledWith({
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
  });

  it("preserves a pending saved meal edit as conflict when remote change is ambiguous", async () => {
    mockFetchMyMealChangesRemote.mockResolvedValueOnce({
      items: [
        baseSavedMeal({
          name: "Remote update",
          updatedAt: "2026-03-03T12:12:00.000Z",
        }),
      ],
      nextCursor: null,
    });
    mockGetMyMealByCloudIdLocal.mockResolvedValueOnce(
      baseSavedMeal({
        name: "Local pending edit",
        updatedAt: "2026-03-03T12:10:00.000Z",
        syncState: "pending",
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const synced = await myMealsStrategy.pull("user-1");

    expect(synced).toBe(1);
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-1",
        name: "Local pending edit",
        updatedAt: "2026-03-03T12:10:00.000Z",
        syncState: "conflict",
        source: "saved",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:synced",
      expect.anything(),
    );
    expect(mockEmit).toHaveBeenCalledWith("mymeal:conflict:ambiguous", {
      uid: "user-1",
      cloudId: "saved-1",
      localUpdatedAt: "2026-03-03T12:10:00.000Z",
      remoteUpdatedAt: "2026-03-03T12:12:00.000Z",
      reason: "pending-ambiguous",
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_my_meals:user-1",
      "2026-03-03T12:12:00.000Z|saved-1",
    );
  });

  it("keeps a newer pending saved meal edit pending and skips remote overwrite", async () => {
    mockFetchMyMealChangesRemote.mockResolvedValueOnce({
      items: [
        baseSavedMeal({
          name: "Older remote update",
          updatedAt: "2026-03-03T12:04:00.000Z",
        }),
      ],
      nextCursor: null,
    });
    mockGetMyMealByCloudIdLocal.mockResolvedValueOnce(
      baseSavedMeal({
        name: "Newer local pending edit",
        updatedAt: "2026-03-03T12:10:00.000Z",
        syncState: "pending",
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    const synced = await myMealsStrategy.pull("user-1");

    expect(synced).toBe(1);
    expect(mockUpsertMyMealLocal).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:synced",
      expect.anything(),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:conflict:ambiguous",
      expect.anything(),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_my_meals:user-1",
      "2026-03-03T12:04:00.000Z|saved-1",
    );
  });

  it("preserves a pending saved meal delete tombstone as conflict when remote update arrives", async () => {
    mockFetchMyMealChangesRemote.mockResolvedValueOnce({
      items: [
        baseSavedMeal({
          name: "Remote update",
          updatedAt: "2026-03-03T12:40:00.000Z",
          deleted: false,
        }),
      ],
      nextCursor: null,
    });
    mockGetMyMealByCloudIdLocal.mockResolvedValueOnce(
      baseSavedMeal({
        name: "Local pending delete",
        updatedAt: "2026-03-03T12:12:00.000Z",
        syncState: "pending",
        deleted: true,
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.pull("user-1");

    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-1",
        name: "Local pending delete",
        deleted: true,
        syncState: "conflict",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:synced",
      expect.anything(),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:conflict:ambiguous",
      expect.anything(),
    );
  });

  it("does not mask existing failed or conflict saved meal local states during pull", async () => {
    mockFetchMyMealChangesRemote.mockResolvedValueOnce({
      items: [
        baseSavedMeal({
          mealId: "saved-failed",
          cloudId: "saved-failed",
          name: "Remote failed replacement",
          updatedAt: "2026-03-03T12:40:00.000Z",
        }),
        baseSavedMeal({
          mealId: "saved-conflict",
          cloudId: "saved-conflict",
          name: "Remote conflict replacement",
          updatedAt: "2026-03-03T12:45:00.000Z",
        }),
      ],
      nextCursor: null,
    });
    mockGetMyMealByCloudIdLocal
      .mockResolvedValueOnce(
        baseSavedMeal({
          mealId: "saved-failed",
          cloudId: "saved-failed",
          name: "Existing failed",
          updatedAt: "2026-03-03T12:10:00.000Z",
          syncState: "failed",
        }),
      )
      .mockResolvedValueOnce(
        baseSavedMeal({
          mealId: "saved-conflict",
          cloudId: "saved-conflict",
          name: "Existing conflict",
          updatedAt: "2026-03-03T12:11:00.000Z",
          syncState: "conflict",
        }),
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { myMealsStrategy } = require("@/services/offline/strategies/myMeals.strategy");

    await myMealsStrategy.pull("user-1");

    expect(mockGetMyMealByCloudIdLocal).toHaveBeenCalledTimes(2);
    expect(mockUpsertMyMealLocal).toHaveBeenCalledTimes(1);
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-conflict",
        name: "Existing conflict",
        syncState: "conflict",
      }),
    );
    expect(mockUpsertMyMealLocal).not.toHaveBeenCalledWith(
      expect.objectContaining({
        cloudId: "saved-failed",
      }),
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "mymeal:synced",
      expect.anything(),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "sync:last_pull_my_meals:user-1",
      "2026-03-03T12:45:00.000Z|saved-conflict",
    );
  });
});
