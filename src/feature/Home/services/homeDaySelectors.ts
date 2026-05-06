import type { Meal, UserNutritionProfile } from "@/types";
import { calculateMacroTargets } from "@/utils/calculateMacroTargets";
import type { MacroTargets } from "@/utils/calculateMacroTargets";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";
import { getMealsForDayKey, normalizeMealDayKey } from "@/services/meals/mealMetadata";

export type HomeDayStatus =
  | "completed"
  | "past_empty"
  | "today_empty"
  | "in_progress";

export type HomeDayState = {
  dayKey: string | null;
  dayMeals: Meal[];
  mealCount: number;
  consumed: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  goalCalories: number;
  macroTargets: MacroTargets | null;
  kcalProgress: number | null;
  status: HomeDayStatus;
  isToday: boolean;
  isCompletedDay: boolean;
  isEmptyDay: boolean;
  isPastEmptyDay: boolean;
  isTodayEmpty: boolean;
};

function clampProgress(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

export function buildHomeDayState(params: {
  meals: Meal[];
  selectedDayKey: string | null | undefined;
  todayDayKey: string | null | undefined;
  nutritionProfile: UserNutritionProfile | null | undefined;
}): HomeDayState {
  const dayKey = normalizeMealDayKey(params.selectedDayKey);
  const todayDayKey = normalizeMealDayKey(params.todayDayKey);
  const dayMeals = getMealsForDayKey(params.meals, dayKey, "asc");
  const consumed = calculateTotalNutrients(dayMeals);
  const goalCalories = params.nutritionProfile?.calorieTarget ?? 0;
  const mealCount = dayMeals.length;
  const isToday = !!dayKey && dayKey === todayDayKey;
  const isCompletedDay =
    mealCount > 0 && goalCalories > 0 && consumed.kcal >= goalCalories;
  const isEmptyDay = mealCount === 0;
  const isPastEmptyDay = !isToday && isEmptyDay;
  const isTodayEmpty = isToday && isEmptyDay;

  const macroTargets =
    goalCalories > 0
      ? calculateMacroTargets({
          calorieTarget: goalCalories,
          preferences: params.nutritionProfile?.preferences,
          goal: params.nutritionProfile?.goal,
        })
      : null;

  const status: HomeDayStatus = isCompletedDay
    ? "completed"
    : isPastEmptyDay
      ? "past_empty"
      : isTodayEmpty
        ? "today_empty"
        : "in_progress";

  return {
    dayKey,
    dayMeals,
    mealCount,
    consumed,
    goalCalories,
    macroTargets,
    kcalProgress: goalCalories > 0 ? clampProgress(consumed.kcal / goalCalories) : null,
    status,
    isToday,
    isCompletedDay,
    isEmptyDay,
    isPastEmptyDay,
    isTodayEmpty,
  };
}
