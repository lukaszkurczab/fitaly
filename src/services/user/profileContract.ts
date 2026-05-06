import type {
  AiPersona,
  Allergy,
  ChronicDisease,
  Goal,
  Preference,
  Sex,
  SyncState,
  UnitsSystem,
  UserData,
  UserLanguage,
  UserNutritionProfile,
  UserProfile,
} from "@/types";

export const PROFILE_UNITS = [
  "metric",
  "imperial",
] as const satisfies readonly UnitsSystem[];

export const PROFILE_SEX = [
  "male",
  "female",
] as const satisfies readonly Exclude<Sex, null>[];

export const PROFILE_ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
  "",
] as const satisfies readonly UserNutritionProfile["activityLevel"][];

export const PROFILE_GOALS = [
  "lose",
  "maintain",
  "increase",
  "",
] as const satisfies readonly UserNutritionProfile["goal"][];

export const PROFILE_SYNC_STATES = [
  "synced",
  "pending",
  "conflict",
] as const satisfies readonly SyncState[];

export const PROFILE_LANGUAGES = [
  "en",
  "pl",
] as const satisfies readonly UserLanguage[];

export const PROFILE_PREFERENCES = [
  "lowCarb",
  "keto",
  "highProtein",
  "highCarb",
  "lowFat",
  "balanced",
  "vegetarian",
  "vegan",
  "pescatarian",
  "mediterranean",
  "glutenFree",
  "dairyFree",
  "paleo",
] as const satisfies readonly Preference[];

export const PROFILE_DISEASES = [
  "none",
  "diabetes",
  "hypertension",
  "asthma",
  "other",
] as const satisfies readonly ChronicDisease[];

export const PROFILE_ALLERGIES = [
  "none",
  "peanuts",
  "gluten",
  "lactose",
  "other",
] as const satisfies readonly Allergy[];

export const PROFILE_AI_PERSONAS = [
  "calm_guide",
  "cheerful_companion",
  "focused_coach",
  "mediterranean_friend",
] as const satisfies readonly AiPersona[];

export const PROFILE_EDITABLE_REMOTE_FIELDS = [
  "profile",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_EDITABLE_LOCAL_FIELDS = [
  ...PROFILE_EDITABLE_REMOTE_FIELDS,
  "username",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_ONBOARDING_REQUEST_REQUIRED_FIELDS = [
  "username",
] as const;

export const PROFILE_ONBOARDING_REQUEST_OPTIONAL_FIELDS = [
  "language",
] as const;

export const PROFILE_ONBOARDING_DOCUMENT_FIELDS = [
  "uid",
  "email",
  "username",
  "plan",
  "createdAt",
  "lastLogin",
  "profile",
  "syncState",
  "lastSyncedAt",
  "avatarUrl",
  "avatarLocalPath",
  "avatarlastSyncedAt",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_READINESS_FIELDS = [
  "profile.readiness",
] as const;

export const PROFILE_AI_PERSONA_FIELDS = [
  "profile.aiPreferences.stylePersona",
] as const;

export const PROFILE_AI_STYLE_FIELDS = [
  "profile.aiPreferences.stylePersona",
  "styleProfile",
] as const;

export const PROFILE_NUTRITION_FIELDS = [
  "profile.nutritionProfile.goal",
  "profile.nutritionProfile.calorieTarget",
  "profile.nutritionProfile.preferences",
] as const;

export const PROFILE_ONBOARDING_DEFAULTS = {
  unitsSystem: "metric" as UnitsSystem,
  age: "",
  sex: "female" as Exclude<Sex, null>,
  height: "",
  heightInch: "",
  weight: "",
  preferences: [] as Preference[],
  activityLevel: "moderate" as UserNutritionProfile["activityLevel"],
  goal: "maintain" as UserNutritionProfile["goal"],
  chronicDiseases: [] as ChronicDisease[],
  chronicDiseasesOther: "",
  allergies: [] as Allergy[],
  allergiesOther: "",
  lifestyle: "",
  calorieTarget: 0,
} satisfies UserNutritionProfile;

export const PROFILE_DEFAULTS = {
  language: "en" as UserLanguage,
  nutritionProfile: PROFILE_ONBOARDING_DEFAULTS,
  aiPreferences: {
    stylePersona: "calm_guide" as AiPersona,
  },
  consents: {
    aiHealthDataConsentAt: null,
  },
  readiness: {
    status: "needs_profile",
    onboardingCompletedAt: null,
    readyAt: null,
  },
} satisfies UserProfile;

export const PROFILE_LANGUAGE_NORMALIZATION_EXAMPLES = {
  "pl-PL": "pl",
  "en-US": "en",
  "de-DE": "en",
} as const satisfies Record<string, UserLanguage>;

export const PROFILE_AI_PERSONA_STYLE_LABELS = {
  calm_guide: "Calm Guide",
  cheerful_companion: "Cheerful Companion",
  focused_coach: "Focused Coach",
  mediterranean_friend: "Mediterranean Friend",
} as const satisfies Record<AiPersona, string>;

export const PROFILE_AI_PERSONA_NORMALIZATION_EXAMPLES = {
  "calm guide": "calm_guide",
  "focused-coach": "focused_coach",
  "Mediterranean Friend": "mediterranean_friend",
  unknown: "calm_guide",
} as const;

export const PROFILE_NUTRITION_SEMANTICS = {
  defaultGoal: "maintain" as Goal,
  defaultCalorieTarget: 0,
};
