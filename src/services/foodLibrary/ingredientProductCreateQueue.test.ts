import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";

const mockUpsertIngredientProductSearchProjectionItem = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockRemoveIngredientProductSearchProjectionItem = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockReadIngredientProductSearchProjectionItem = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockUpsertLocalIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockMarkIngredientProductUserRecordDeletePending = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockMarkIngredientProductUserRecordDeleteFailed = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockRemoveIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<void>
>();

jest.mock("@/services/foodLibrary/ingredientProductSearchProjectionRepository", () => ({
  readIngredientProductSearchProjectionItem: (...args: unknown[]) =>
    mockReadIngredientProductSearchProjectionItem(...args),
  upsertIngredientProductSearchProjectionItem: (...args: unknown[]) =>
    mockUpsertIngredientProductSearchProjectionItem(...args),
  removeIngredientProductSearchProjectionItem: (...args: unknown[]) =>
    mockRemoveIngredientProductSearchProjectionItem(...args),
}));

jest.mock(
  "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository",
  () => ({
    upsertLocalIngredientProductUserRecord: (...args: unknown[]) =>
      mockUpsertLocalIngredientProductUserRecord(...args),
    markIngredientProductUserRecordDeletePending: (...args: unknown[]) =>
      mockMarkIngredientProductUserRecordDeletePending(...args),
    markIngredientProductUserRecordDeleteFailed: (...args: unknown[]) =>
      mockMarkIngredientProductUserRecordDeleteFailed(...args),
    removeIngredientProductUserRecord: (...args: unknown[]) =>
      mockRemoveIngredientProductUserRecord(...args),
  }),
);

function sampleRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "user-product-1",
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: "Owsianka domowa",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 120,
      protein: 4,
      fat: 3,
      carbs: 20,
      fiber: null,
      sugar: null,
      salt: null,
      saturatedFat: null,
    },
    confidence: { identity: "medium", nutrition: "medium", profile: "unknown" },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "ingredient-product:create:user-1:mutation-1",
      sourceName: "manual_entry",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: [],
      allergenFlags: [],
    },
    warningReasonCodes: [],
    rankingSignals: ["user_scoped"],
    brandName: "Domowa",
    ingredientName: "Oats",
    packageName: "500 g",
    category: "grain",
    servingSizes: [
      {
        servingSizeId: "serving-1",
        label: "Bowl",
        quantity: 50,
        unit: "g",
      },
    ],
    dietaryFlags: ["vegetarian"],
    allergenFlags: ["wheat"],
    cacheState: "fresh",
    ownerUserId: "user-1",
    ...overrides,
  };
}

describe("ingredientProductCreateQueue", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUpsertIngredientProductSearchProjectionItem.mockResolvedValue();
    mockRemoveIngredientProductSearchProjectionItem.mockResolvedValue();
    mockReadIngredientProductSearchProjectionItem.mockResolvedValue(null);
    mockUpsertLocalIngredientProductUserRecord.mockResolvedValue();
    mockMarkIngredientProductUserRecordDeletePending.mockResolvedValue();
    mockMarkIngredientProductUserRecordDeleteFailed.mockResolvedValue();
    mockRemoveIngredientProductUserRecord.mockResolvedValue();
  });

  it("projects pending queued creates as explicit local records", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    const row = queue.buildPendingIngredientProductRow({
      uid: "user-1",
      request: {
        clientMutationId: "ingredient-product:create:user-1:mutation-1",
        ingredientProductId: "user-product-1",
        displayName: "Owsianka domowa",
        kind: "generic_ingredient",
        defaultServing: { quantity: 50, unit: "g" },
        nutritionPer100: null,
      },
    });

    expect(row).toEqual(
      expect.objectContaining({
        ingredientProductId: "user-product-1",
        recordScope: "user_scoped",
        lifecycleState: "candidate",
        cacheState: "pending_local",
        ownerUserId: "user-1",
        warningReasonCodes: ["pending_user_record"],
      }),
    );
  });

  it("marks dead queued creates as degraded projection records", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markIngredientProductCreateSyncFailed({
      uid: "user-1",
      dead: true,
      op: {
        id: 10,
        client_mutation_id: "ingredient-product:create:user-1:mutation-1",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_create",
        updated_at: "2026-06-16T10:00:00.000Z",
        attempts: 10,
        payload: {
          searchQuery: "Owsianka domowa",
          locale: "pl-PL",
          request: {
            clientMutationId: "ingredient-product:create:user-1:mutation-1",
            ingredientProductId: "user-product-1",
            displayName: "Owsianka domowa",
            kind: "generic_ingredient",
            defaultServing: { quantity: 50, unit: "g" },
            nutritionPer100: null,
          },
        },
      },
    });

    expect(mockUpsertIngredientProductSearchProjectionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        query: "Owsianka domowa",
        locale: "pl-PL",
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          cacheState: "stale",
          warningReasonCodes: ["pending_user_record", "backend_degraded"],
        }),
        warnings: ["pending_user_record", "backend_degraded"],
      }),
    );
    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncState: "failed",
        lastErrorCode: "food-library/sync-failed",
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          cacheState: "stale",
        }),
      }),
    );
  });

  it("marks 409 dead queued creates as conflict user records", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markIngredientProductCreateSyncFailed({
      uid: "user-1",
      dead: true,
      status: 409,
      op: {
        id: 11,
        client_mutation_id: "ingredient-product:create:user-1:mutation-1",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_create",
        updated_at: "2026-06-16T10:00:00.000Z",
        attempts: 1,
        payload: {
          searchQuery: "Owsianka domowa",
          locale: "pl-PL",
          request: {
            clientMutationId: "ingredient-product:create:user-1:mutation-1",
            ingredientProductId: "user-product-1",
            displayName: "Owsianka domowa",
            kind: "generic_ingredient",
            defaultServing: { quantity: 50, unit: "g" },
            nutritionPer100: null,
          },
        },
      },
    });

    expect(mockUpsertIngredientProductSearchProjectionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        query: "Owsianka domowa",
        locale: "pl-PL",
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          recordScope: "user_scoped",
          cacheState: "stale",
          ownerUserId: "user-1",
          warningReasonCodes: ["pending_user_record", "backend_degraded"],
        }),
        warnings: ["pending_user_record", "backend_degraded"],
      }),
    );
    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncState: "conflict",
        lastErrorCode: "food-library/conflict",
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          cacheState: "stale",
        }),
      }),
    );
  });

  it("parses Product/Ingredient delete queue payloads", () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    expect(
      queue.toIngredientProductDeleteQueuePayload({
        ingredientProductId: "user-product-1",
      }),
    ).toEqual({ ingredientProductId: "user-product-1" });
    expect(
      queue.toIngredientProductDeleteQueuePayload({ ingredientProductId: "" }),
    ).toBeNull();
  });

  it("parses Product/Ingredient update queue payloads and rejects malformed IDs", () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );
    const baseItem = sampleRow();

    expect(queue.ingredientProductQueueKinds()).toContain(
      "ingredient_product_update",
    );
    expect(
      queue.toIngredientProductUpdateQueuePayload({
        searchQuery: "Updated oats",
        locale: "pl-PL",
        baseItem,
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: " user-product-1 ",
          displayName: "Updated oats",
          brandName: null,
        },
      }),
    ).toEqual({
      searchQuery: "Updated oats",
      locale: "pl-PL",
      baseItem,
      request: {
        clientMutationId: "ingredient-product:update:user-1:mutation-1",
        ingredientProductId: "user-product-1",
        displayName: "Updated oats",
        brandName: null,
      },
    });
    expect(
      queue.toIngredientProductUpdateQueuePayload({
        baseItem,
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: "",
          displayName: "Updated oats",
        },
      }),
    ).toBeNull();
    expect(
      queue.toIngredientProductUpdateQueuePayload({
        baseItem: sampleRow({ ingredientProductId: "other-product" }),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: "user-product-1",
          displayName: "Updated oats",
        },
      }),
    ).toBeNull();
    expect(
      queue.toIngredientProductUpdateQueuePayload({
        baseItem,
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: "user-product-1",
        },
      }),
    ).toBeNull();
  });

  it("applies pending updates to current-user rows without changing ownership metadata", () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );
    const baseItem = sampleRow();

    const row = queue.applyIngredientProductUpdateRequestToLocalRow({
      uid: "user-1",
      item: baseItem,
      request: {
        clientMutationId: "ingredient-product:update:user-1:mutation-1",
        ingredientProductId: "user-product-1",
        displayName: "Updated oats",
        nutritionPer100: null,
        brandName: null,
        servingSizes: null,
        dietaryFlags: [],
      },
    });

    expect(row).toEqual(
      expect.objectContaining({
        ingredientProductId: "user-product-1",
        recordScope: "user_scoped",
        ownerUserId: "user-1",
        displayName: "Updated oats",
        brandName: null,
        servingSizes: [],
        dietaryFlags: [],
        allergenFlags: ["wheat"],
        nutritionPer100: null,
        cacheState: "pending_local",
        warningReasonCodes: ["pending_user_record"],
        rankingSignals: ["user_scoped", "pending_user_record"],
        sourceAttribution: baseItem.sourceAttribution,
      }),
    );
    expect(row?.profileCompatibility.dietaryFlags).toEqual([]);
    expect(row?.profileCompatibility.allergenFlags).toEqual(["wheat"]);
    expect(
      queue.applyIngredientProductUpdateRequestToLocalRow({
        uid: "user-1",
        item: sampleRow({ recordScope: "global_seed", ownerUserId: null }),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: "user-product-1",
          displayName: "Blocked global update",
        },
      }),
    ).toBeNull();
  });

  it("marks queued deletes as hidden local tombstones and removes search cache", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );
    const cachedItem = {
      ingredientProductId: "user-product-1",
      recordScope: "user_scoped",
      ownerUserId: "user-1",
    };
    mockReadIngredientProductSearchProjectionItem.mockResolvedValueOnce(cachedItem);

    await queue.markQueuedIngredientProductDeletePending({
      uid: "user-1",
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });

    expect(mockReadIngredientProductSearchProjectionItem).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockRemoveIngredientProductSearchProjectionItem).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockMarkIngredientProductUserRecordDeletePending).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      fallbackItem: cachedItem,
    });
  });

  it("removes local projections after a queued delete syncs", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markQueuedIngredientProductDeleted({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });

    expect(mockRemoveIngredientProductSearchProjectionItem).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockRemoveIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
  });

  it("marks dead queued deletes as explicit hidden delete failures", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markIngredientProductQueueSyncFailed({
      uid: "user-1",
      dead: true,
      status: 404,
      op: {
        id: 12,
        client_mutation_id: "ingredient-product:delete:user-1:product-1:uuid",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_delete",
        updated_at: "2026-06-16T12:00:00.000Z",
        attempts: 10,
        payload: {
          ingredientProductId: "user-product-1",
        },
      },
    });

    expect(mockRemoveIngredientProductSearchProjectionItem).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockMarkIngredientProductUserRecordDeleteFailed).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      lastErrorCode: "food-library/delete-not-found",
    });
  });

  it("marks queued update failures as pending update projections before dead letter", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markIngredientProductQueueSyncFailed({
      uid: "user-1",
      dead: false,
      op: {
        id: 13,
        client_mutation_id: "ingredient-product:update:user-1:product-1:uuid",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_update",
        updated_at: "2026-06-16T12:00:00.000Z",
        attempts: 1,
        payload: {
          searchQuery: "Updated oats",
          locale: "pl-PL",
          baseItem: sampleRow(),
          request: {
            clientMutationId: "ingredient-product:update:user-1:product-1:uuid",
            ingredientProductId: "user-product-1",
            displayName: "Updated oats",
            brandName: null,
          },
        },
      },
    });

    expect(mockUpsertIngredientProductSearchProjectionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        query: "Updated oats",
        locale: "pl-PL",
        item: expect.objectContaining({
          ingredientProductId: "user-product-1",
          displayName: "Updated oats",
          brandName: null,
          cacheState: "pending_local",
          warningReasonCodes: ["pending_user_record"],
        }),
      }),
    );
    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncState: "pending_update",
        updatedAt: "2026-06-16T12:00:00.000Z",
        lastErrorCode: null,
      }),
    );
  });

  it("marks dead queued updates as failed or conflict user records", async () => {
    const queue =
      jest.requireActual<typeof import("./ingredientProductCreateQueue")>(
        "./ingredientProductCreateQueue",
      );

    await queue.markIngredientProductQueueSyncFailed({
      uid: "user-1",
      dead: true,
      op: {
        id: 14,
        client_mutation_id: "ingredient-product:update:user-1:product-1:uuid",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_update",
        updated_at: "2026-06-16T12:00:00.000Z",
        attempts: 10,
        payload: {
          searchQuery: "Updated oats",
          baseItem: sampleRow(),
          request: {
            clientMutationId: "ingredient-product:update:user-1:product-1:uuid",
            ingredientProductId: "user-product-1",
            displayName: "Updated oats",
          },
        },
      },
    });
    await queue.markIngredientProductQueueSyncFailed({
      uid: "user-1",
      dead: true,
      status: 409,
      op: {
        id: 15,
        client_mutation_id: "ingredient-product:update:user-1:product-1:uuid",
        cloud_id: "user-product-1",
        user_uid: "user-1",
        kind: "ingredient_product_update",
        updated_at: "2026-06-16T12:05:00.000Z",
        attempts: 10,
        payload: {
          searchQuery: "Updated oats",
          baseItem: sampleRow(),
          request: {
            clientMutationId: "ingredient-product:update:user-1:product-1:uuid",
            ingredientProductId: "user-product-1",
            displayName: "Updated oats",
          },
        },
      },
    });

    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        syncState: "failed",
        lastErrorCode: "food-library/sync-failed",
        item: expect.objectContaining({
          cacheState: "stale",
          warningReasonCodes: ["pending_user_record", "backend_degraded"],
        }),
      }),
    );
    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        syncState: "conflict",
        lastErrorCode: "food-library/conflict",
        item: expect.objectContaining({
          cacheState: "stale",
          warningReasonCodes: ["pending_user_record", "backend_degraded"],
        }),
      }),
    );
  });
});
