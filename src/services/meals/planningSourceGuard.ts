import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import type { Meal } from "@/types/meal";

export function requirePlanningEnabledForMeal(
  meal: Pick<Meal, "planningSource">,
): void {
  if (meal.planningSource) {
    requireRuntimeFeatureEnabled("planning");
  }
}
