import type {
  ActivityLevel,
  AiPersona,
  Allergy,
  ChronicDisease,
  FormData,
  Goal,
  Preference,
  Sex,
  UnitsSystem,
} from "@/types";

export const ONBOARDING_TOTAL_STEPS = 4;

export const INITIAL_FORM: FormData = {
  unitsSystem: "metric",
  age: "",
  sex: "female",
  height: "",
  heightInch: "",
  weight: "",
  preferences: [],
  activityLevel: "moderate",
  goal: "maintain",
  calorieDeficit: 0.2,
  calorieSurplus: 0.2,
  chronicDiseases: [],
  chronicDiseasesOther: "",
  allergies: [],
  allergiesOther: "",
  lifestyle: "",
  aiPersona: "calm_guide",
  avatarLocalPath: "",
  surveyComplited: false,
  calorieTarget: 0,
};

export const UNITS_OPTIONS: Array<{
  value: UnitsSystem;
  labelKey: string;
}> = [
  { value: "metric", labelKey: "metric" },
  { value: "imperial", labelKey: "imperial" },
];

export const SEX_OPTIONS: Array<{
  value: Exclude<Sex, null>;
  labelKey: string;
}> = [
  { value: "female", labelKey: "female" },
  { value: "male", labelKey: "male" },
];

export const PREFERENCE_OPTIONS: Array<{
  value: Preference;
  labelKey: string;
}> = [
  { value: "lowCarb", labelKey: "preferences.lowCarb" },
  { value: "keto", labelKey: "preferences.keto" },
  { value: "highProtein", labelKey: "preferences.highProtein" },
  { value: "highCarb", labelKey: "preferences.highCarb" },
  { value: "lowFat", labelKey: "preferences.lowFat" },
  { value: "balanced", labelKey: "preferences.balanced" },
  { value: "vegetarian", labelKey: "preferences.vegetarian" },
  { value: "vegan", labelKey: "preferences.vegan" },
  { value: "pescatarian", labelKey: "preferences.pescatarian" },
  { value: "mediterranean", labelKey: "preferences.mediterranean" },
  { value: "glutenFree", labelKey: "preferences.glutenFree" },
  { value: "dairyFree", labelKey: "preferences.dairyFree" },
  { value: "paleo", labelKey: "preferences.paleo" },
];

export const ACTIVITY_OPTIONS: Array<{
  value: ActivityLevel;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "sedentary",
    labelKey: "activityShort.sedentary",
    descriptionKey: "activity.sedentary",
  },
  {
    value: "light",
    labelKey: "activityShort.light",
    descriptionKey: "activity.light",
  },
  {
    value: "moderate",
    labelKey: "activityShort.moderate",
    descriptionKey: "activity.moderate",
  },
  {
    value: "active",
    labelKey: "activityShort.active",
    descriptionKey: "activity.active",
  },
  {
    value: "very_active",
    labelKey: "activityShort.very_active",
    descriptionKey: "activity.very_active",
  },
];

export const GOAL_OPTIONS: Array<{
  value: Goal;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "lose",
    labelKey: "goal.lose",
    descriptionKey: "goalDescription.lose",
  },
  {
    value: "maintain",
    labelKey: "goal.maintain",
    descriptionKey: "goalDescription.maintain",
  },
  {
    value: "increase",
    labelKey: "goal.increase",
    descriptionKey: "goalDescription.increase",
  },
];

export const CHRONIC_DISEASE_OPTIONS: Array<{
  value: ChronicDisease;
  labelKey: string;
}> = [
  { value: "diabetes", labelKey: "healthProfile.disease.diabetes" },
  { value: "hypertension", labelKey: "healthProfile.disease.hypertension" },
  { value: "asthma", labelKey: "healthProfile.disease.asthma" },
  { value: "other", labelKey: "healthProfile.disease.other" },
];

export const ALLERGY_OPTIONS: Array<{
  value: Allergy;
  labelKey: string;
}> = [
  { value: "peanuts", labelKey: "healthProfile.allergy.peanuts" },
  { value: "gluten", labelKey: "healthProfile.allergy.gluten" },
  { value: "lactose", labelKey: "healthProfile.allergy.lactose" },
  { value: "other", labelKey: "healthProfile.allergy.other" },
];

export const AI_PERSONA_OPTIONS: Array<{
  value: AiPersona;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "calm_guide",
    labelKey: "ai.style.none",
    descriptionKey: "ai.styleDescription.none",
  },
  {
    value: "focused_coach",
    labelKey: "ai.style.concise",
    descriptionKey: "ai.styleDescription.concise",
  },
  {
    value: "cheerful_companion",
    labelKey: "ai.style.friendly",
    descriptionKey: "ai.styleDescription.friendly",
  },
  {
    value: "mediterranean_friend",
    labelKey: "ai.style.detailed",
    descriptionKey: "ai.styleDescription.detailed",
  },
];

export const PREFERENCE_CONFLICTS: Record<Preference, Preference[]> = {
  lowCarb: ["highCarb", "balanced", "keto"],
  keto: ["highCarb", "balanced", "lowFat", "lowCarb"],
  highProtein: [],
  highCarb: ["keto", "lowCarb"],
  lowFat: ["keto"],
  balanced: ["keto", "lowCarb"],
  vegetarian: ["vegan", "pescatarian"],
  vegan: ["vegetarian", "pescatarian"],
  pescatarian: ["vegan", "vegetarian"],
  mediterranean: [],
  glutenFree: [],
  dairyFree: [],
  paleo: [],
};

export function resetOptionalHealthFields(form: FormData): FormData {
  return {
    ...form,
    chronicDiseases: [],
    chronicDiseasesOther: "",
    allergies: [],
    allergiesOther: "",
    lifestyle: "",
  };
}

export function resetOptionalAssistantFields(form: FormData): FormData {
  return {
    ...form,
    aiPersona: "calm_guide",
  };
}
