import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";
import type { IngredientProductUserRecordProjection } from "./ingredientProductUserRecordProjectionRepository";

const mockReadIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductUserRecordProjection | null>
>();
const mockRemoveIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockDiscardQueuedAndDeadLetterOpsByCloudIds = jest.fn<
  (...args: unknown[]) => Promise<{ queued: number; dead: number }>
>();

jest.mock("./ingredientProductUserRecordProjectionRepository", () => ({
  readIngredientProductUserRecord: (...args: unknown[]) =>
    mockReadIngredientProductUserRecord(...args),
  removeIngredientProductUserRecord: (...args: unknown[]) =>
    mockRemoveIngredientProductUserRecord(...args),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  discardQueuedAndDeadLetterOpsByCloudIds: (...args: unknown[]) =>
    mockDiscardQueuedAndDeadLetterOpsByCloudIds(...args),
}));

function sampleItem(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "user-product-1",
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: "Owsianka domowa",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: null,
    confidence: { identity: "medium", nutrition: "unknown", profile: "unknown" },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "mutation-1",
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
    warningReasonCodes: ["pending_user_record"],
    rankingSignals: ["user_scoped", "pending_user_record"],
    brandName: null,
    ingredientName: null,
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "pending_local",
    ownerUserId: "user-1",
    ...overrides,
  };
}

function projection(
  overrides: Partial<IngredientProductUserRecordProjection> = {},
): IngredientProductUserRecordProjection {
  return {
    item: sampleItem(),
    syncState: "conflict",
    updatedAt: "2026-06-16T10:00:00.000Z",
    lastSyncedAt: 0,
    lastErrorCode: "food-library/conflict",
    lastErrorMessage: "Remote record conflicts with pending local create.",
    ...overrides,
  };
}

describe("discardIngredientProductConflict", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveIngredientProductUserRecord.mockResolvedValue(undefined);
    mockDiscardQueuedAndDeadLetterOpsByCloudIds.mockResolvedValue({
      queued: 2,
      dead: 1,
    });
  });

  it("removes a current-user conflict projection and only matching Product/Ingredient ops", async () => {
    mockReadIngredientProductUserRecord.mockResolvedValue(projection());

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { discardIngredientProductConflict } = require("./ingredientProductConflictService") as
      typeof import("./ingredientProductConflictService");

    await expect(
      discardIngredientProductConflict({
        uid: " user-1 ",
        ingredientProductId: " user-product-1 ",
      }),
    ).resolves.toEqual({
      discarded: true,
      ingredientProductId: "user-product-1",
      queuedOpsDiscarded: 2,
      deadLetterOpsDiscarded: 1,
    });

    expect(mockReadIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockRemoveIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
    expect(mockDiscardQueuedAndDeadLetterOpsByCloudIds).toHaveBeenCalledWith({
      uid: "user-1",
      cloudIds: ["user-product-1"],
      kinds: [
        "ingredient_product_create",
        "ingredient_product_update",
        "ingredient_product_delete",
      ],
    });
  });

  it("ignores conflicts that are not current-user scoped local conflict records", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { discardIngredientProductConflict } = require("./ingredientProductConflictService") as
      typeof import("./ingredientProductConflictService");

    mockReadIngredientProductUserRecord.mockResolvedValueOnce(null);
    await expect(
      discardIngredientProductConflict({
        uid: "user-1",
        ingredientProductId: "missing-product",
      }),
    ).resolves.toEqual({
      discarded: false,
      ingredientProductId: "missing-product",
      reason: "missing",
    });

    mockReadIngredientProductUserRecord.mockResolvedValueOnce(
      projection({ syncState: "pending" }),
    );
    await expect(
      discardIngredientProductConflict({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual({
      discarded: false,
      ingredientProductId: "user-product-1",
      reason: "not_conflict",
    });

    mockReadIngredientProductUserRecord.mockResolvedValueOnce(
      projection({ item: sampleItem({ ownerUserId: "other-user" }) }),
    );
    await expect(
      discardIngredientProductConflict({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual({
      discarded: false,
      ingredientProductId: "user-product-1",
      reason: "not_current_user_record",
    });

    mockReadIngredientProductUserRecord.mockResolvedValueOnce(
      projection({
        item: sampleItem({ recordScope: "global_seed", ownerUserId: null }),
      }),
    );
    await expect(
      discardIngredientProductConflict({
        uid: "user-1",
        ingredientProductId: "user-product-1",
      }),
    ).resolves.toEqual({
      discarded: false,
      ingredientProductId: "user-product-1",
      reason: "not_current_user_record",
    });

    expect(mockRemoveIngredientProductUserRecord).not.toHaveBeenCalled();
    expect(mockDiscardQueuedAndDeadLetterOpsByCloudIds).not.toHaveBeenCalled();
  });
});
