import type { Meal } from "@/types/meal";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";

export const hasNonEmptyMealText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const hasPositiveMealNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function hasMeaningfulMealIngredient(
  ingredient: Meal["ingredients"][number],
) {
  return (
    hasNonEmptyMealText(ingredient.name) ||
    hasPositiveMealNumber(ingredient.amount) ||
    hasPositiveMealNumber(ingredient.kcal) ||
    hasPositiveMealNumber(ingredient.protein) ||
    hasPositiveMealNumber(ingredient.carbs) ||
    hasPositiveMealNumber(ingredient.fat)
  );
}

export function hasReviewableMealContent(meal?: Meal | null) {
  if (!meal) return false;

  const nutrition = calculateTotalNutrients([meal]);
  const hasNutrition =
    hasPositiveMealNumber(nutrition.kcal) ||
    hasPositiveMealNumber(nutrition.protein) ||
    hasPositiveMealNumber(nutrition.carbs) ||
    hasPositiveMealNumber(nutrition.fat);
  const hasIngredients = (meal.ingredients ?? []).some(
    hasMeaningfulMealIngredient,
  );
  const hasPhoto =
    hasNonEmptyMealText(meal.photoUrl) ||
    hasNonEmptyMealText(meal.localPhotoUrl) ||
    hasNonEmptyMealText(meal.photoLocalPath);

  return (
    hasNonEmptyMealText(meal.name) ||
    hasIngredients ||
    hasNutrition ||
    hasPhoto
  );
}
