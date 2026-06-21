import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
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
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

function sampleRecipe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recipeId: "recipe-1",
    version: 1,
    lifecycleState: "active",
    locale: "pl-PL",
    title: "Owsianka z owocami",
    description: "Prosty posilek",
    servings: 2,
    yield: "2 porcje",
    sourceAttribution: {
      sourceType: "internal_curated",
      sourceId: "seed-1",
      sourceName: "Fitaly curated",
      reviewedAt: "2026-06-18T08:00:00.000Z",
    },
    updatedAt: "2026-06-18T08:00:00.000Z",
    reviewState: "curated",
    ingredients: [
      {
        ingredientProductId: "oats",
        snapshotName: "Platki owsiane",
        quantity: 80,
        unit: "g",
      },
    ],
    steps: ["Wymieszaj skladniki."],
    prepTimeMin: 5,
    cookTimeMin: 10,
    nutritionSnapshot: {
      kcal: 420,
      proteinGrams: 18,
      fatGrams: 12,
      carbsGrams: 56,
      confidence: "medium",
      isPartial: true,
    },
    imageRef: null,
    profileFlagState: "unknown",
    dietaryFlags: ["vegetarian"],
    allergenFlags: [],
    unknownDietaryFlags: ["dairy_free"],
    unknownAllergenFlags: ["gluten"],
    styleTags: ["balanced"],
    ...overrides,
  };
}

function sampleResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    recipe: sampleRecipe(),
    status: "unknown_reveal_required",
    hardExclusionReasons: [
      {
        code: "explicit_allergen_match",
        filterType: "allergy",
        profileValue: "peanuts",
        catalogFlag: "peanuts",
      },
    ],
    unknownReasons: [
      {
        code: "unknown_allergen_flag",
        filterType: "allergy",
        profileValue: "gluten",
        catalogFlag: "gluten",
      },
    ],
    softPreferenceStatus: "mixed",
    softPreferenceMatches: ["balanced"],
    softPreferenceMisses: ["highProtein"],
    softPreferenceScore: 1,
    ...overrides,
  };
}

function sampleResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    items: [sampleResult()],
    queryEcho: {
      activeAllergies: ["gluten"],
      activeRestrictions: ["glutenFree"],
      activeSoftPreferences: ["balanced"],
      ignoredChronicDiseases: ["diabetes"],
      ignoredAllergiesOtherPresent: true,
      ignoredLifestylePresent: true,
      showHidden: true,
      revealUnknown: false,
      lowResultsThreshold: 6,
    },
    totalCatalogCount: 48,
    visibleCount: 3,
    hiddenHardExclusionCount: 2,
    unknownRevealRequiredCount: 4,
    lowResults: true,
    emptyCatalog: false,
    ...overrides,
  };
}

describe("recipeCatalogApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRuntimeConfig.recipeCatalogEnabled = true;
  });

  it("does not call backend requests when Recipe Catalog is disabled", async () => {
    mockRuntimeConfig.recipeCatalogEnabled = false;
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    await expect(api.fetchRecipeCatalogRemote()).rejects.toMatchObject({
      code: "feature/recipe-catalog-disabled",
      retryable: false,
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("calls the read-only v2 catalog endpoint without params for profile defaults", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse({ items: [] }));

    await api.fetchRecipeCatalogRemote();

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/recipes/catalog",
      undefined,
    );
  });

  it("serializes explicit filter overrides and preserves unknown and count state", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse());

    await expect(
      api.fetchRecipeCatalogRemote({
        allergies: ["gluten", "peanuts"],
        preferences: ["glutenFree", "balanced"],
        chronicDiseases: ["diabetes"],
        allergiesOther: "sesame",
        lifestyle: "night shifts",
        showHidden: true,
        revealUnknown: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        totalCatalogCount: 48,
        visibleCount: 3,
        hiddenHardExclusionCount: 2,
        unknownRevealRequiredCount: 4,
        lowResults: true,
        emptyCatalog: false,
        queryEcho: expect.objectContaining({
          ignoredAllergiesOtherPresent: true,
          ignoredLifestylePresent: true,
          revealUnknown: false,
        }),
        items: [
          expect.objectContaining({
            status: "unknown_reveal_required",
            hardExclusionReasons: [
              {
                code: "explicit_allergen_match",
                filterType: "allergy",
                profileValue: "peanuts",
                catalogFlag: "peanuts",
              },
            ],
            unknownReasons: [
              {
                code: "unknown_allergen_flag",
                filterType: "allergy",
                profileValue: "gluten",
                catalogFlag: "gluten",
              },
            ],
            softPreferenceStatus: "mixed",
            recipe: expect.objectContaining({
              profileFlagState: "unknown",
              unknownAllergenFlags: ["gluten"],
              unknownDietaryFlags: ["dairy_free"],
              nutritionSnapshot: expect.objectContaining({
                confidence: "medium",
                isPartial: true,
              }),
            }),
          }),
        ],
      }),
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/recipes/catalog?useProfileAllergies=false&allergies=gluten&allergies=peanuts&useProfilePreferences=false&preferences=glutenFree&preferences=balanced&chronicDiseases=diabetes&allergiesOther=sesame&lifestyle=night+shifts&showHidden=true&revealUnknown=false",
      undefined,
    );
  });

  it("serializes empty allergy and preference arrays as explicit profile clears", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse({ items: [] }));

    await api.fetchRecipeCatalogRemote({
      allergies: [],
      preferences: [],
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/recipes/catalog?useProfileAllergies=false&useProfilePreferences=false",
      undefined,
    );
  });

  it("rejects malformed item rows instead of hiding catalog evidence", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleResult({ recipe: sampleRecipe({ recipeId: "" }) }),
          sampleResult({
            status: "unknown_reveal_required",
            recipe: sampleRecipe({ recipeId: "recipe-valid" }),
          }),
        ],
      }),
    );

    await expect(api.fetchRecipeCatalogRemote()).rejects.toThrow(
      "Invalid Recipe Catalog response.",
    );
  });

  it("rejects malformed reason arrays instead of dropping warning state", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleResult({
            unknownReasons: [
              {
                code: "unknown_allergen_flag",
                filterType: "allergy",
                profileValue: "gluten",
              },
            ],
          }),
        ],
      }),
    );

    await expect(api.fetchRecipeCatalogRemote()).rejects.toThrow(
      "Invalid Recipe Catalog response.",
    );
  });

  it("rejects malformed required top-level response fields", async () => {
    const api =
      jest.requireActual<typeof import("./recipeCatalogApi")>(
        "./recipeCatalogApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse({ visibleCount: -1 }));

    await expect(api.fetchRecipeCatalogRemote()).rejects.toThrow(
      "Invalid Recipe Catalog response.",
    );
  });
});
