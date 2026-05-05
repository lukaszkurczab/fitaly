import type { FormData } from "@/types";

export type OnboardingFormData = FormData & {
  calorieDeficit?: number;
  calorieSurplus?: number;
};
