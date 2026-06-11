import type { MealInputMethod } from "@/types/meal";
import type { MealAddScreenName } from "@/feature/Meals/feature/MapMealAddScreens";

export type MealAddFlowPath =
  | "photo"
  | "text"
  | "manual"
  | "barcode"
  | "saved"
  | "review";

export type MealAddFlowProgress = {
  current: number;
  total: number;
  path: MealAddFlowPath;
};

const FLOW_STEPS: Record<MealAddFlowPath, MealAddScreenName[]> = {
  photo: ["CameraDefault", "PreparingReviewPhoto", "ReviewMeal"],
  text: ["DescribeMeal", "TextAnalyzing", "ReviewMeal"],
  manual: ["EditMealDetails", "ReviewMeal"],
  barcode: ["BarcodeScan", "ReviewMeal"],
  saved: ["SelectSavedMeal", "ReviewMeal"],
  review: ["ReviewMeal"],
};

export function resolveMealAddFlowPath(
  stepName: MealAddScreenName,
  inputMethod?: MealInputMethod | null,
  isSavedFlow = false,
): MealAddFlowPath {
  if (stepName === "CameraDefault" || stepName === "PreparingReviewPhoto") {
    return "photo";
  }
  if (stepName === "DescribeMeal" || stepName === "TextAnalyzing") {
    return "text";
  }
  if (stepName === "BarcodeScan") {
    return "barcode";
  }
  if (stepName === "SelectSavedMeal") {
    return "saved";
  }
  if (stepName === "EditMealDetails") {
    return isSavedFlow ? "saved" : "manual";
  }
  if (isSavedFlow) return "saved";
  if (inputMethod === "photo") return "photo";
  if (inputMethod === "text") return "text";
  if (inputMethod === "manual") return "manual";
  if (inputMethod === "barcode") return "barcode";
  return "review";
}

export function resolveMealAddFlowProgress(
  path: MealAddFlowPath,
  stepName: MealAddScreenName,
): MealAddFlowProgress {
  const steps = FLOW_STEPS[path] ?? FLOW_STEPS.review;
  const stepIndex = steps.indexOf(stepName);
  const current = stepIndex >= 0 ? stepIndex + 1 : steps.length;

  return {
    current,
    total: steps.length,
    path,
  };
}
