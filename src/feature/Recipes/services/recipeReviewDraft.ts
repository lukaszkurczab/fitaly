import { v4 as uuidv4 } from "uuid";
import type { Ingredient, Meal, Nutrients } from "@/types/meal";
import type {
  RecipeCatalogIngredientRef,
  RecipeCatalogRecord,
} from "@/types/recipes";
import {
  deriveMealTimingMetadata,
  formatMealDayKey,
} from "@/services/meals/mealMetadata";

const NUTRIENT_PRECISION = 3;

type BuildRecipeReviewDraftParams = {
  recipe: RecipeCatalogRecord;
  uid: string;
  now?: Date;
};

function roundNutrient(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(NUTRIENT_PRECISION));
}

function toSnapshotTotals(recipe: RecipeCatalogRecord): Nutrients {
  const snapshot = recipe.nutritionSnapshot;
  return {
    kcal: roundNutrient(Math.max(0, snapshot.kcal)),
    protein: roundNutrient(Math.max(0, snapshot.proteinGrams)),
    fat: roundNutrient(Math.max(0, snapshot.fatGrams)),
    carbs: roundNutrient(Math.max(0, snapshot.carbsGrams)),
  };
}

function distributeNutrient(total: number, index: number, count: number): number {
  if (count <= 1) return roundNutrient(total);
  if (index === count - 1) {
    const previousTotal = roundNutrient((roundNutrient(total / count)) * index);
    return roundNutrient(total - previousTotal);
  }

  return roundNutrient(total / count);
}

function toDraftIngredientUnit(
  unit: RecipeCatalogIngredientRef["unit"],
): Ingredient["unit"] | undefined {
  return unit === "g" || unit === "ml" ? unit : undefined;
}

function createDraftIngredient(
  ref: RecipeCatalogIngredientRef,
  totals: Nutrients,
  index: number,
  count: number,
): Ingredient {
  return {
    id: uuidv4(),
    name: ref.snapshotName.trim() || `Ingredient ${index + 1}`,
    amount:
      Number.isFinite(ref.quantity) && ref.quantity > 0
        ? ref.quantity
        : 1,
    unit: toDraftIngredientUnit(ref.unit),
    kcal: distributeNutrient(totals.kcal, index, count),
    protein: distributeNutrient(totals.protein, index, count),
    fat: distributeNutrient(totals.fat, index, count),
    carbs: distributeNutrient(totals.carbs, index, count),
  };
}

function getDraftIngredientRefs(
  recipe: RecipeCatalogRecord,
): RecipeCatalogIngredientRef[] {
  if (recipe.ingredients.length > 0) return recipe.ingredients;

  return [
    {
      ingredientProductId: null,
      snapshotName: recipe.title,
      quantity: Math.max(1, recipe.servings),
      unit: "serving",
    },
  ];
}

export function recipeNeedsReviewEstimateNote(
  recipe: RecipeCatalogRecord,
): boolean {
  return (
    recipe.nutritionSnapshot.isPartial ||
    recipe.nutritionSnapshot.confidence === "unknown" ||
    recipe.profileFlagState !== "complete" ||
    recipe.unknownAllergenFlags.length > 0 ||
    recipe.unknownDietaryFlags.length > 0
  );
}

export function buildRecipeReviewDraft({
  recipe,
  uid,
  now = new Date(),
}: BuildRecipeReviewDraftParams): Meal {
  const timestamp = now.toISOString();
  const timing = deriveMealTimingMetadata(timestamp);
  const totals = toSnapshotTotals(recipe);
  const mealId = uuidv4();
  const ingredientRefs = getDraftIngredientRefs(recipe);
  const ingredients = ingredientRefs.map((ingredient, index) =>
    createDraftIngredient(ingredient, totals, index, ingredientRefs.length),
  );
  const notes = recipeNeedsReviewEstimateNote(recipe)
    ? "Recipe catalog estimate. Review ingredients, allergens, portions, and nutrition before saving. Profile or nutrition flags are incomplete or unknown, so this is not marked safe."
    : "Recipe catalog estimate. Review ingredients, portions, and nutrition before saving.";

  return {
    mealId,
    userUid: uid,
    savedMealRefId: null,
    timestamp,
    dayKey: formatMealDayKey(now),
    loggedAtLocalMin: timing.loggedAtLocalMin,
    tzOffsetMin: timing.tzOffsetMin,
    type: "other",
    name: recipe.title,
    ingredients,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: "pending",
    source: "manual",
    inputMethod: "manual",
    aiMeta: null,
    imageRef: null,
    imageId: null,
    photoLocalPath: null,
    photoUrl: null,
    localPhotoUrl: null,
    notes,
    tags: [],
    deleted: false,
    cloudId: undefined,
    totals,
  };
}
