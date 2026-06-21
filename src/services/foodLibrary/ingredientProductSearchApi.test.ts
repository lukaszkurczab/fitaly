import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRuntimeConfig = {
  apiVersion: "v1",
  foodLibraryEnabled: true,
  smartMemoryEnabled: true,
  knownPatternsEnabled: true,
  recipeCatalogEnabled: true,
  planningEnabled: true,
  homeNextActionEnabled: true,
};

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

function sampleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ingredientProductId: "ingredient-product-1",
    recordScope: "global_seed",
    lifecycleState: "verified",
    displayName: "Owies",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: {
      basis: "per_100g",
      unit: "g",
      kcal: 389,
      protein: 16.9,
      fat: 6.9,
      carbs: 66.3,
      fiber: 10.6,
      sugar: 0.9,
      salt: 0.01,
      saturatedFat: 1.2,
    },
    confidence: { identity: "verified", nutrition: "high", profile: "unknown" },
    sourceAttribution: {
      sourceType: "internal_seed",
      sourceId: "seed-1",
      sourceName: "Fitaly seed",
    },
    profileCompatibility: {
      status: "warning",
      dietaryFlags: ["vegan"],
      allergenFlags: ["wheat"],
    },
    warningReasonCodes: ["profile_unknown"],
    rankingSignals: ["verified_seed"],
    servingSizes: [{ servingSizeId: "50g", label: "50 g", quantity: 50, unit: "g" }],
    dietaryFlags: ["vegan"],
    allergenFlags: ["wheat"],
    cacheState: "fresh",
    ...overrides,
  };
}

describe("ingredientProductSearchApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRuntimeConfig.foodLibraryEnabled = true;
  });

  it("does not call backend requests when Food Library is disabled", async () => {
    mockRuntimeConfig.foodLibraryEnabled = false;
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    await expect(
      api.searchIngredientProductsRemote({ query: "Owies" }),
    ).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });
    await expect(
      api.createIngredientProductRemote({
        clientMutationId: "mutation-1",
      } as never),
    ).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });
    await expect(
      api.updateIngredientProductRemote({
        ingredientProductId: "ingredient-product-1",
        clientMutationId: "mutation-2",
      } as never),
    ).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });
    await expect(
      api.deleteIngredientProductRemote({
        ingredientProductId: "ingredient-product-1",
        clientMutationId: "mutation-3",
      }),
    ).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });
    await expect(api.pullIngredientProductsRemote()).rejects.toMatchObject({
      code: "feature/food-library-disabled",
      retryable: false,
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls the v2 search endpoint with bounded params and parses valid rows", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockGet.mockResolvedValueOnce({
      items: [sampleRow()],
      queryEcho: {
        normalizedQuery: "owies",
        queryLength: 5,
        limit: 12,
        includeUserScoped: true,
        includeGlobal: false,
        locale: "pl-PL",
      },
      cachePolicy: {
        cacheGeneration: "ingredient_product_search_v1",
        maxAgeSeconds: 3600,
      },
      warnings: ["profile_unknown"],
    });

    await expect(
      api.searchIngredientProductsRemote({
        query: " Owies ",
        locale: "pl-PL",
        limit: 99,
        includeGlobal: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            ingredientProductId: "ingredient-product-1",
            displayName: "Owies",
            warningReasonCodes: ["profile_unknown"],
            cacheState: "fresh",
          }),
        ],
        warnings: ["profile_unknown"],
        cachePolicy: expect.objectContaining({ maxAgeSeconds: 3600 }),
      }),
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/ingredient-products/search?query=Owies&limit=12&locale=pl-PL&includeGlobal=false",
      undefined,
    );
  });

  it("drops malformed rows but preserves degraded warning metadata", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockGet.mockResolvedValueOnce({
      items: [
        sampleRow({ ingredientProductId: "" }),
        sampleRow({ displayName: "Owies verified" }),
      ],
      queryEcho: {
        normalizedQuery: "owies",
        queryLength: 5,
        limit: 8,
        includeUserScoped: true,
        includeGlobal: true,
      },
      cachePolicy: null,
      warnings: ["backend_degraded", "not_allowed"],
    });

    const result = await api.searchIngredientProductsRemote({ query: "owies" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.displayName).toBe("Owies verified");
    expect(result.warnings).toEqual(["backend_degraded"]);
    expect(result.cachePolicy).toBeNull();
  });

  it("rejects malformed Product/Ingredient pull records", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockGet.mockResolvedValueOnce({
      records: [
        {
          item: sampleRow({
            ingredientProductId: "user-oats-1",
            recordScope: "user_scoped",
            ownerUserId: "user-1",
            sourceAttribution: {
              sourceType: "user_created",
              sourceId: "mutation-1",
              sourceName: "manual_entry",
            },
            warningReasonCodes: ["pending_user_record"],
            rankingSignals: ["user_scoped", "pending_user_record"],
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "mutation-1",
        },
        {
          item: sampleRow({ ingredientProductId: "" }),
          updatedAt: "2026-06-16T11:00:00.000Z",
        },
      ],
      removedRecords: [
        {
          ingredientProductId: "user-oats-rejected",
          updatedAt: "2026-06-16T12:00:00.000Z",
          removalReason: "rejected",
        },
      ],
      nextUpdatedAfter: "2026-06-16T10:00:00.000Z|user-oats",
    });

    await expect(
      api.pullIngredientProductsRemote({
        updatedAfter: "2026-06-15T10:00:00.000Z",
        limit: 999,
      }),
    ).rejects.toThrow("Invalid Ingredient/Product pull response.");
  });

  it("pulls current-user Product/Ingredient records with bounded params", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockGet.mockResolvedValueOnce({
      records: [
        {
          item: sampleRow({
            ingredientProductId: "user-oats-1",
            recordScope: "user_scoped",
            ownerUserId: "user-1",
            sourceAttribution: {
              sourceType: "user_created",
              sourceId: "mutation-1",
              sourceName: "manual_entry",
            },
            warningReasonCodes: ["pending_user_record"],
            rankingSignals: ["user_scoped", "pending_user_record"],
          }),
          updatedAt: "2026-06-16T10:00:00.000Z",
          creationClientMutationId: "mutation-1",
        },
      ],
      removedRecords: [
        {
          ingredientProductId: "user-oats-rejected",
          updatedAt: "2026-06-16T12:00:00.000Z",
          removalReason: "rejected",
        },
      ],
      nextUpdatedAfter: "2026-06-16T10:00:00.000Z|user-oats",
    });

    const result = await api.pullIngredientProductsRemote({
      updatedAfter: "2026-06-15T10:00:00.000Z",
      limit: 999,
    });

    expect(result.records).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          ingredientProductId: "user-oats-1",
          recordScope: "user_scoped",
          ownerUserId: "user-1",
        }),
        updatedAt: "2026-06-16T10:00:00.000Z",
        creationClientMutationId: "mutation-1",
      }),
    ]);
    expect(result.removedRecords).toEqual([
      {
        ingredientProductId: "user-oats-rejected",
        updatedAt: "2026-06-16T12:00:00.000Z",
        removalReason: "rejected",
      },
    ]);
    expect(result.nextUpdatedAfter).toBe("2026-06-16T10:00:00.000Z|user-oats");
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/ingredient-products/pull?limit=250&updatedAfter=2026-06-15T10%3A00%3A00.000Z",
      undefined,
    );
  });

  it("rejects malformed removed Product/Ingredient pull records", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockGet.mockResolvedValueOnce({
      records: [],
      removedRecords: [
        {
          ingredientProductId: "user-oats-unknown",
          updatedAt: "2026-06-16T14:00:00.000Z",
          removalReason: "unknown",
        },
      ],
      nextUpdatedAfter: null,
    });

    await expect(api.pullIngredientProductsRemote({})).rejects.toThrow(
      "Invalid Ingredient/Product pull response.",
    );
  });

  it("calls the v2 create endpoint with the explicit user-created payload", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({
      item: sampleRow({
        ingredientProductId: "user-oats-1",
        recordScope: "user_scoped",
        lifecycleState: "candidate",
        displayName: "Owsianka domowa",
        confidence: { identity: "low", nutrition: "low", profile: "unknown" },
        sourceAttribution: {
          sourceType: "user_created",
          sourceId: "mutation-1",
          sourceName: "manual_entry",
        },
        profileCompatibility: {
          status: "unknown",
          dietaryFlags: [],
          allergenFlags: [],
        },
        warningReasonCodes: [
          "profile_unknown",
          "nutrition_low_confidence",
          "pending_user_record",
        ],
        rankingSignals: [
          "user_scoped",
          "exact_user",
          "profile_warning",
          "nutrition_warning",
          "pending_user_record",
        ],
        ownerUserId: "user-1",
      }),
      updated: true,
    });

    const payload = {
      clientMutationId: "mutation-1",
      ingredientProductId: "user-oats-1",
      displayName: "Owsianka domowa",
      kind: "generic_ingredient" as const,
      defaultServing: { quantity: 50, unit: "g" as const },
      nutritionPer100: {
        basis: "per_100g" as const,
        unit: "g" as const,
        kcal: 370,
        protein: 13,
        fat: 7,
        carbs: 60,
        fiber: null,
        sugar: null,
        salt: null,
        saturatedFat: null,
      },
    };

    await expect(api.createIngredientProductRemote(payload)).resolves.toEqual({
      item: expect.objectContaining({
        ingredientProductId: "user-oats-1",
        recordScope: "user_scoped",
        lifecycleState: "candidate",
        sourceAttribution: expect.objectContaining({ sourceType: "user_created" }),
        ownerUserId: "user-1",
      }),
      updated: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/ingredient-products",
      payload,
      undefined,
    );
  });

  it("rejects malformed create responses instead of treating them as success", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({ item: sampleRow({ displayName: "" }), updated: true });

    await expect(
      api.createIngredientProductRemote({
        clientMutationId: "mutation-1",
        ingredientProductId: "user-oats-1",
        displayName: "Owsianka domowa",
        defaultServing: { quantity: 50, unit: "g" },
      }),
    ).rejects.toThrow("Invalid Ingredient/Product create response.");
  });

  it("calls the v2 update endpoint with an encoded path id and explicit partial payload", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({
      item: sampleRow({
        ingredientProductId: "user oats 1",
        recordScope: "user_scoped",
        lifecycleState: "candidate",
        displayName: "Owsianka po edycji",
        nutritionPer100: null,
        brandName: null,
        sourceAttribution: {
          sourceType: "user_created",
          sourceId: "mutation-1",
          sourceName: "manual_entry",
        },
        ownerUserId: "user-1",
      }),
      updated: true,
    });

    await expect(
      api.updateIngredientProductRemote({
        clientMutationId: "update-mutation-1",
        ingredientProductId: "user oats 1",
        displayName: "Owsianka po edycji",
        nutritionPer100: null,
        brandName: null,
        dietaryFlags: null,
      }),
    ).resolves.toEqual({
      item: expect.objectContaining({
        ingredientProductId: "user oats 1",
        displayName: "Owsianka po edycji",
        nutritionPer100: null,
        brandName: null,
        ownerUserId: "user-1",
      }),
      updated: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/ingredient-products/user%20oats%201/update",
      {
        clientMutationId: "update-mutation-1",
        displayName: "Owsianka po edycji",
        nutritionPer100: null,
        brandName: null,
        dietaryFlags: null,
      },
      undefined,
    );
  });

  it("rejects empty update requests before making a request", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    await expect(
      api.updateIngredientProductRemote({
        clientMutationId: "update-mutation-1",
        ingredientProductId: "user-oats-1",
      }),
    ).rejects.toThrow(
      "At least one editable Ingredient/Product update field is required.",
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects malformed update responses instead of treating them as success", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({
      item: sampleRow({ displayName: "" }),
      updated: true,
    });

    await expect(
      api.updateIngredientProductRemote({
        clientMutationId: "update-mutation-1",
        ingredientProductId: "user-oats-1",
        brandName: null,
      }),
    ).rejects.toThrow("Invalid Ingredient/Product update response.");
  });

  it("calls the v2 delete endpoint with the explicit user-scoped tombstone payload", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({
      ingredientProductId: "user-oats-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      updated: true,
    });

    await expect(
      api.deleteIngredientProductRemote({
        ingredientProductId: "user-oats-1",
        clientMutationId: "delete-mutation-1",
      }),
    ).resolves.toEqual({
      ingredientProductId: "user-oats-1",
      updatedAt: "2026-06-16T12:00:00.000Z",
      updated: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/ingredient-products/user-oats-1/delete",
      { clientMutationId: "delete-mutation-1" },
      undefined,
    );
  });

  it("rejects malformed delete responses instead of treating them as success", async () => {
    const api =
      jest.requireActual<typeof import("./ingredientProductSearchApi")>(
        "./ingredientProductSearchApi",
      );

    mockPost.mockResolvedValueOnce({
      ingredientProductId: "user-oats-1",
      updated: true,
    });

    await expect(
      api.deleteIngredientProductRemote({
        ingredientProductId: "user-oats-1",
        clientMutationId: "delete-mutation-1",
      }),
    ).rejects.toThrow("Invalid Ingredient/Product delete response.");
  });
});
