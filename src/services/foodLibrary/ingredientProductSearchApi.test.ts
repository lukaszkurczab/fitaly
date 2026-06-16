import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
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
});
