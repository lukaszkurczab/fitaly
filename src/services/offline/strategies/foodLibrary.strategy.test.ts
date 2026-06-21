import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { QueueOp } from "@/services/offline/sync.strategy";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";

const mockCreateIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{ item: IngredientProductSearchRow }>
>();
const mockDeleteIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{
    ingredientProductId: string;
    updatedAt: string;
    updated: boolean;
  }>
>();
const mockUpdateIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{ item: IngredientProductSearchRow }>
>();
const mockPullIngredientProductsRemote = jest.fn<
  (...args: unknown[]) => Promise<{
    records: Array<{
      item: IngredientProductSearchRow;
      updatedAt: string;
      creationClientMutationId: string | null;
    }>;
    removedRecords: Array<{
      ingredientProductId: string;
      updatedAt: string;
      removalReason: "rejected";
    }>;
    nextUpdatedAfter: string | null;
  }>
>();
const mockUpsertQueuedIngredientProductProjection = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow>
>();
const mockUpsertQueuedIngredientProductUpdateProjection = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow | null>
>();
const mockMarkQueuedIngredientProductDeleted = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockApplyPulledIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<"synced" | "conflict" | "ignored">
>();
const mockRemoveIngredientProductUserRecord = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockRemoveIngredientProductSearchProjectionItem = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockGetLastFoodLibraryPullTs = jest.fn<
  (...args: unknown[]) => Promise<string | null>
>();
const mockSetLastFoodLibraryPullTs = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockRuntimeConfig = {
  apiVersion: "v1",
  foodLibraryEnabled: true,
  smartMemoryEnabled: true,
  knownPatternsEnabled: true,
  recipeCatalogEnabled: true,
  planningEnabled: true,
  homeNextActionEnabled: true,
};

jest.mock("@/services/foodLibrary/ingredientProductSearchApi", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductSearchApi")
  >("@/services/foodLibrary/ingredientProductSearchApi");
  return {
    ...actual,
    createIngredientProductRemote: (...args: unknown[]) =>
      mockCreateIngredientProductRemote(...args),
    deleteIngredientProductRemote: (...args: unknown[]) =>
      mockDeleteIngredientProductRemote(...args),
    updateIngredientProductRemote: (...args: unknown[]) =>
      mockUpdateIngredientProductRemote(...args),
    pullIngredientProductsRemote: (...args: unknown[]) =>
      mockPullIngredientProductsRemote(...args),
  };
});

jest.mock("@/services/foodLibrary/ingredientProductCreateQueue", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductCreateQueue")
  >("@/services/foodLibrary/ingredientProductCreateQueue");
  return {
    ...actual,
    upsertQueuedIngredientProductProjection: (...args: unknown[]) =>
      mockUpsertQueuedIngredientProductProjection(...args),
    upsertQueuedIngredientProductUpdateProjection: (...args: unknown[]) =>
      mockUpsertQueuedIngredientProductUpdateProjection(...args),
    markQueuedIngredientProductDeleted: (...args: unknown[]) =>
      mockMarkQueuedIngredientProductDeleted(...args),
  };
});

jest.mock(
  "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository",
  () => ({
    applyPulledIngredientProductUserRecord: (...args: unknown[]) =>
      mockApplyPulledIngredientProductUserRecord(...args),
    removeIngredientProductUserRecord: (...args: unknown[]) =>
      mockRemoveIngredientProductUserRecord(...args),
  }),
);

jest.mock("@/services/foodLibrary/ingredientProductSearchProjectionRepository", () => ({
  removeIngredientProductSearchProjectionItem: (...args: unknown[]) =>
    mockRemoveIngredientProductSearchProjectionItem(...args),
}));

jest.mock("@/services/offline/sync.storage", () => ({
  getLastFoodLibraryPullTs: (...args: unknown[]) =>
    mockGetLastFoodLibraryPullTs(...args),
  setLastFoodLibraryPullTs: (...args: unknown[]) =>
    mockSetLastFoodLibraryPullTs(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

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
    nutritionPer100: null,
    confidence: { identity: "medium", nutrition: "unknown", profile: "unknown" },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "ingredient-product:create:user-1:queued",
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
    cacheState: "fresh",
    ownerUserId: "user-1",
    ...overrides,
  };
}

function queuedCreateOp(overrides: Partial<QueueOp> = {}): QueueOp {
  return {
    id: 1,
    user_uid: "user-1",
    cloud_id: "user-product-1",
    client_mutation_id: "ingredient-product:create:user-1:queued",
    kind: "ingredient_product_create",
    payload: {
      searchQuery: "Owsianka domowa",
      locale: "pl-PL",
      request: {
        clientMutationId: "ingredient-product:create:user-1:local",
        ingredientProductId: "user-product-1",
        displayName: "Owsianka domowa",
        kind: "generic_ingredient",
        defaultServing: { quantity: 50, unit: "g" },
        nutritionPer100: null,
      },
    },
    updated_at: "2026-06-16T10:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

function queuedUpdateOp(overrides: Partial<QueueOp> = {}): QueueOp {
  return {
    id: 4,
    user_uid: "user-1",
    cloud_id: "user-product-1",
    client_mutation_id: "ingredient-product:update:user-1:queued",
    kind: "ingredient_product_update",
    payload: {
      searchQuery: "Updated oats",
      locale: "pl-PL",
      baseItem: sampleRow(),
      request: {
        clientMutationId: "ingredient-product:update:user-1:local",
        ingredientProductId: "user-product-1",
        displayName: "Updated oats",
        brandName: null,
      },
    },
    updated_at: "2026-06-16T11:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

describe("foodLibraryStrategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateIngredientProductRemote.mockResolvedValue({ item: sampleRow() });
    mockDeleteIngredientProductRemote.mockResolvedValue({
      ingredientProductId: "user-product-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      updated: true,
    });
    mockUpdateIngredientProductRemote.mockResolvedValue({
      item: sampleRow({ displayName: "Updated oats", brandName: null }),
    });
    mockPullIngredientProductsRemote.mockResolvedValue({
      records: [
        {
          item: sampleRow(),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "ingredient-product:create:user-1:queued",
        },
      ],
      removedRecords: [],
      nextUpdatedAfter: "2026-06-16T10:00:00.000Z|user-product-1",
    });
    mockUpsertQueuedIngredientProductProjection.mockResolvedValue(sampleRow());
    mockUpsertQueuedIngredientProductUpdateProjection.mockResolvedValue(
      sampleRow({ displayName: "Updated oats", brandName: null }),
    );
    mockMarkQueuedIngredientProductDeleted.mockResolvedValue();
    mockApplyPulledIngredientProductUserRecord.mockResolvedValue("synced");
    mockGetLastFoodLibraryPullTs.mockResolvedValue("2026-06-15T10:00:00.000Z");
    mockSetLastFoodLibraryPullTs.mockResolvedValue();
    mockRuntimeConfig.foodLibraryEnabled = true;
  });

  it("does not pull or push Product/Ingredient backend work when Food Library is disabled", async () => {
    mockRuntimeConfig.foodLibraryEnabled = false;
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(foodLibraryStrategy.pull("user-1")).resolves.toBe(0);
    await expect(
      foodLibraryStrategy.handlePushOp("user-1", queuedCreateOp()),
    ).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });

    expect(mockGetLastFoodLibraryPullTs).not.toHaveBeenCalled();
    expect(mockPullIngredientProductsRemote).not.toHaveBeenCalled();
    expect(mockCreateIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockUpdateIngredientProductRemote).not.toHaveBeenCalled();
    expect(mockDeleteIngredientProductRemote).not.toHaveBeenCalled();
  });

  it("pushes queued Product/Ingredient creates through the backend API", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");
    const op = queuedCreateOp();

    await expect(
      foodLibraryStrategy.handlePushOp("user-1", op),
    ).resolves.toBe(true);

    expect(mockCreateIngredientProductRemote).toHaveBeenCalledWith({
      clientMutationId: "ingredient-product:create:user-1:queued",
      ingredientProductId: "user-product-1",
      displayName: "Owsianka domowa",
      kind: "generic_ingredient",
      defaultServing: { quantity: 50, unit: "g" },
      nutritionPer100: null,
    });
    expect(mockUpsertQueuedIngredientProductProjection).toHaveBeenCalledWith({
      uid: "user-1",
      payload: op.payload,
      item: sampleRow(),
    });
  });

  it("pushes queued Product/Ingredient deletes through the backend API", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(
      foodLibraryStrategy.handlePushOp("user-1", {
        id: 2,
        user_uid: "user-1",
        cloud_id: "user-product-1",
        client_mutation_id: "ingredient-product:delete:user-1:user-product-1:uuid",
        kind: "ingredient_product_delete",
        payload: {
          ingredientProductId: "user-product-1",
        },
        updated_at: "2026-06-16T12:00:00.000Z",
        attempts: 0,
      }),
    ).resolves.toBe(true);

    expect(mockDeleteIngredientProductRemote).toHaveBeenCalledWith({
      ingredientProductId: "user-product-1",
      clientMutationId: "ingredient-product:delete:user-1:user-product-1:uuid",
    });
    expect(mockMarkQueuedIngredientProductDeleted).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-1",
    });
  });

  it("pushes queued Product/Ingredient updates through the backend API", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");
    const op = queuedUpdateOp();

    await expect(
      foodLibraryStrategy.handlePushOp("user-1", op),
    ).resolves.toBe(true);

    expect(mockUpdateIngredientProductRemote).toHaveBeenCalledWith({
      clientMutationId: "ingredient-product:update:user-1:queued",
      ingredientProductId: "user-product-1",
      displayName: "Updated oats",
      brandName: null,
    });
    expect(mockUpsertQueuedIngredientProductUpdateProjection).toHaveBeenCalledWith({
      uid: "user-1",
      payload: op.payload,
      item: sampleRow({ displayName: "Updated oats", brandName: null }),
      syncState: "synced",
    });
  });

  it("pulls current-user Product/Ingredient records into projection", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(foodLibraryStrategy.pull("user-1")).resolves.toBe(1);

    expect(mockPullIngredientProductsRemote).toHaveBeenCalledWith({
      updatedAfter: "2026-06-15T10:00:00.000Z",
      limit: 100,
    });
    expect(mockApplyPulledIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      record: {
        item: sampleRow(),
        updatedAt: "2026-06-16T10:00:00.000Z",
        creationClientMutationId: "ingredient-product:create:user-1:queued",
      },
      pulledAt: expect.any(Number),
    });
    expect(mockSetLastFoodLibraryPullTs).toHaveBeenCalledWith(
      "user-1",
      "2026-06-16T10:00:00.000Z|user-product-1",
    );
  });

  it("does not advance Product/Ingredient pull marker without a response cursor", async () => {
    mockPullIngredientProductsRemote.mockResolvedValueOnce({
      records: [],
      removedRecords: [],
      nextUpdatedAfter: null,
    });
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(foodLibraryStrategy.pull("user-1")).resolves.toBe(0);

    expect(mockSetLastFoodLibraryPullTs).not.toHaveBeenCalled();
  });

  it("does not advance Product/Ingredient pull marker when pull fails", async () => {
    mockPullIngredientProductsRemote.mockRejectedValueOnce(
      new Error("Invalid Ingredient/Product pull response."),
    );
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(foodLibraryStrategy.pull("user-1")).rejects.toThrow(
      "Invalid Ingredient/Product pull response.",
    );

    expect(mockSetLastFoodLibraryPullTs).not.toHaveBeenCalled();
  });

  it("applies removed Product/Ingredient records after normal pull records", async () => {
    mockPullIngredientProductsRemote.mockResolvedValueOnce({
      records: [
        {
          item: sampleRow({ ingredientProductId: "user-product-rejected" }),
          updatedAt: "2026-06-16T11:00:00.000Z",
          creationClientMutationId: "ingredient-product:create:user-1:queued",
        },
      ],
      removedRecords: [
        {
          ingredientProductId: "user-product-rejected",
          updatedAt: "2026-06-16T12:00:00.000Z",
          removalReason: "rejected",
        },
      ],
      nextUpdatedAfter: "2026-06-16T12:00:00.000Z|user-product-rejected",
    });
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(foodLibraryStrategy.pull("user-1")).resolves.toBe(2);

    expect(mockApplyPulledIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      record: {
        item: sampleRow({ ingredientProductId: "user-product-rejected" }),
        updatedAt: "2026-06-16T11:00:00.000Z",
        creationClientMutationId: "ingredient-product:create:user-1:queued",
      },
      pulledAt: expect.any(Number),
    });
    expect(mockRemoveIngredientProductUserRecord).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-rejected",
    });
    expect(mockRemoveIngredientProductSearchProjectionItem).toHaveBeenCalledWith({
      uid: "user-1",
      ingredientProductId: "user-product-rejected",
    });
    expect(mockSetLastFoodLibraryPullTs).toHaveBeenCalledWith(
      "user-1",
      "2026-06-16T12:00:00.000Z|user-product-rejected",
    );
  });

  it("rejects malformed Product/Ingredient create payloads as non-retryable", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(
      foodLibraryStrategy.handlePushOp(
        "user-1",
        queuedCreateOp({ payload: { request: { displayName: "Broken" } } }),
      ),
    ).rejects.toMatchObject({
      code: "sync/ingredient-product-create-invalid-payload",
      retryable: false,
    });
    expect(mockCreateIngredientProductRemote).not.toHaveBeenCalled();
  });

  it("rejects malformed Product/Ingredient delete payloads as non-retryable", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(
      foodLibraryStrategy.handlePushOp("user-1", {
        id: 3,
        user_uid: "user-1",
        cloud_id: "user-product-1",
        client_mutation_id: "ingredient-product:delete:user-1:user-product-1:uuid",
        kind: "ingredient_product_delete",
        payload: {
          ingredientProductId: "",
        },
        updated_at: "2026-06-16T12:00:00.000Z",
        attempts: 0,
      }),
    ).rejects.toMatchObject({
      code: "sync/ingredient-product-delete-invalid-payload",
      retryable: false,
    });
    expect(mockDeleteIngredientProductRemote).not.toHaveBeenCalled();
  });

  it("rejects malformed Product/Ingredient update payloads as non-retryable", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(
      foodLibraryStrategy.handlePushOp(
        "user-1",
        queuedUpdateOp({
          payload: {
            request: {
              clientMutationId: "ingredient-product:update:user-1:queued",
              ingredientProductId: "",
              displayName: "Broken",
            },
          },
        }),
      ),
    ).rejects.toMatchObject({
      code: "sync/ingredient-product-update-invalid-payload",
      retryable: false,
    });
    expect(mockUpdateIngredientProductRemote).not.toHaveBeenCalled();
  });

  it("propagates backend create conflicts for push classification", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");
    const conflictError = Object.assign(new Error("conflict"), {
      code: "api/http-error",
      source: "ApiClient",
      retryable: false,
      status: 409,
    });
    mockCreateIngredientProductRemote.mockRejectedValueOnce(conflictError);

    await expect(
      foodLibraryStrategy.handlePushOp("user-1", queuedCreateOp()),
    ).rejects.toMatchObject({
      code: "api/http-error",
      retryable: false,
      status: 409,
    });
    expect(mockUpsertQueuedIngredientProductProjection).not.toHaveBeenCalled();
  });

  it("leaves non-Product/Ingredient queue ops for other strategies", async () => {
    const { foodLibraryStrategy } = jest.requireActual<
      typeof import("./foodLibrary.strategy")
    >("./foodLibrary.strategy");

    await expect(
      foodLibraryStrategy.handlePushOp(
        "user-1",
        queuedCreateOp({ kind: "upsert", cloud_id: "meal-1" }),
      ),
    ).resolves.toBe(false);
  });
});
