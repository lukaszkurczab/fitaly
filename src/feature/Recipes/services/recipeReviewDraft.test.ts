import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  buildRecipeReviewDraft,
  recipeNeedsReviewEstimateNote,
} from "@/feature/Recipes/services/recipeReviewDraft";
import type { RecipeCatalogRecord } from "@/types/recipes";

const mockUuid = jest.fn<() => string>();

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

function recipe(overrides: Partial<RecipeCatalogRecord> = {}): RecipeCatalogRecord {
  return {
    recipeId: "recipe-visible",
    version: 1,
    lifecycleState: "active",
    locale: "en-US",
    title: "Oat bowl",
    description: "Oats with fruit",
    servings: 1,
    yield: "1 serving",
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
        snapshotName: "Oats",
        quantity: 80,
        unit: "g",
      },
      {
        ingredientProductId: null,
        snapshotName: "Blueberries",
        quantity: 1,
        unit: "piece",
      },
    ],
    steps: ["Mix ingredients."],
    prepTimeMin: 5,
    cookTimeMin: 10,
    nutritionSnapshot: {
      kcal: 421,
      proteinGrams: 18,
      fatGrams: 12,
      carbsGrams: 56,
      confidence: "unknown",
      isPartial: true,
    },
    imageRef: null,
    profileFlagState: "unknown",
    dietaryFlags: ["vegetarian"],
    allergenFlags: [],
    unknownDietaryFlags: [],
    unknownAllergenFlags: ["gluten"],
    styleTags: ["balanced"],
    ...overrides,
  };
}

describe("recipeReviewDraft", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-20T08:30:00.000Z"));
    mockUuid
      .mockImplementationOnce(() => "draft-meal-id")
      .mockImplementationOnce(() => "ingredient-1")
      .mockImplementationOnce(() => "ingredient-2");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("maps a recipe catalog record to a local manual Review draft with matching totals", () => {
    const draft = buildRecipeReviewDraft({
      recipe: recipe(),
      uid: "user-1",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        mealId: "draft-meal-id",
        userUid: "user-1",
        timestamp: "2026-03-20T08:30:00.000Z",
        dayKey: "2026-03-20",
        loggedAtLocalMin: 570,
        type: "other",
        name: "Oat bowl",
        createdAt: "2026-03-20T08:30:00.000Z",
        updatedAt: "2026-03-20T08:30:00.000Z",
        syncState: "pending",
        source: "manual",
        inputMethod: "manual",
        totals: {
          kcal: 421,
          protein: 18,
          fat: 12,
          carbs: 56,
        },
      }),
    );
    expect(draft.savedMealRefId).toBeNull();
    expect(draft.cloudId).toBeUndefined();
    expect(draft.ingredients).toEqual([
      {
        id: "ingredient-1",
        name: "Oats",
        amount: 80,
        unit: "g",
        kcal: 210.5,
        protein: 9,
        fat: 6,
        carbs: 28,
      },
      {
        id: "ingredient-2",
        name: "Blueberries",
        amount: 1,
        unit: undefined,
        kcal: 210.5,
        protein: 9,
        fat: 6,
        carbs: 28,
      },
    ]);

    const summed = draft.ingredients.reduce(
      (total, ingredient) => ({
        kcal: total.kcal + ingredient.kcal,
        protein: total.protein + ingredient.protein,
        fat: total.fat + ingredient.fat,
        carbs: total.carbs + ingredient.carbs,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    );
    expect(summed).toEqual(draft.totals);
    expect(draft.notes).toContain("Recipe catalog estimate");
    expect(draft.notes).toContain("not marked safe");
  });

  it("marks partial or unknown nutrition/profile recipes as estimates to review", () => {
    expect(recipeNeedsReviewEstimateNote(recipe())).toBe(true);
    expect(
      recipeNeedsReviewEstimateNote(
        recipe({
          nutritionSnapshot: {
            kcal: 420,
            proteinGrams: 18,
            fatGrams: 12,
            carbsGrams: 56,
            confidence: "verified",
            isPartial: false,
          },
          profileFlagState: "complete",
          unknownDietaryFlags: [],
          unknownAllergenFlags: [],
        }),
      ),
    ).toBe(false);
  });
});
