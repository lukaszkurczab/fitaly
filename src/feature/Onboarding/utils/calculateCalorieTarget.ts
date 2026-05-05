import type { OnboardingFormData } from "@/feature/Onboarding/types";

export function calculateCalorieTarget(form: OnboardingFormData): number {
  const weightKg = Number(form.weight);
  const heightCm = Number(form.height);
  const age = Number(form.age);
  const sex = form.sex;

  if (!weightKg || !heightCm || !age || !sex) return 0;

  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : sex === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 0;
  if (!bmr) return 0;

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  } as const;

  let tdee;

  if (form.activityLevel != "") {
    tdee = bmr * multipliers[form.activityLevel];
  } else {
    tdee = bmr * 1.375;
  }

  const target =
    form.goal === "lose"
      ? tdee *
        (1 -
          (typeof form.calorieDeficit === "number"
            ? form.calorieDeficit
            : 0.15))
      : form.goal === "increase"
      ? tdee *
        (1 +
          (typeof form.calorieSurplus === "number" ? form.calorieSurplus : 0.1))
      : tdee;

  const rounded = Math.round(target);
  return rounded < 1000 || rounded > 6000 ? 0 : rounded;
}
