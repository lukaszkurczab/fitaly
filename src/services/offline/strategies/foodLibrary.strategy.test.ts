import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { QueueOp } from "@/services/offline/sync.strategy";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";

const mockCreateIngredientProductRemote = jest.fn<
  (...args: unknown[]) => Promise<{ item: IngredientProductSearchRow }>
>();
const mockUpsertQueuedIngredientProductProjection = jest.fn<
  (...args: unknown[]) => Promise<IngredientProductSearchRow>
>();

jest.mock("@/services/foodLibrary/ingredientProductSearchApi", () => ({
  createIngredientProductRemote: (...args: unknown[]) =>
    mockCreateIngredientProductRemote(...args),
}));

jest.mock("@/services/foodLibrary/ingredientProductCreateQueue", () => {
  const actual = jest.requireActual<
    typeof import("@/services/foodLibrary/ingredientProductCreateQueue")
  >("@/services/foodLibrary/ingredientProductCreateQueue");
  return {
    ...actual,
    upsertQueuedIngredientProductProjection: (...args: unknown[]) =>
      mockUpsertQueuedIngredientProductProjection(...args),
  };
});

function sampleRow(): IngredientProductSearchRow {
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

describe("foodLibraryStrategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateIngredientProductRemote.mockResolvedValue({ item: sampleRow() });
    mockUpsertQueuedIngredientProductProjection.mockResolvedValue(sampleRow());
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
