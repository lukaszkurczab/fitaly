import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockUpsertIngredientProductSearchProjectionItem = jest.fn<
  (...args: unknown[]) => Promise<void>
>();

jest.mock("@/services/foodLibrary/ingredientProductSearchProjectionRepository", () => ({
  upsertIngredientProductSearchProjectionItem: (...args: unknown[]) =>
    mockUpsertIngredientProductSearchProjectionItem(...args),
}));

describe("ingredientProductCreateQueue", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUpsertIngredientProductSearchProjectionItem.mockResolvedValue();
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
  });
});
