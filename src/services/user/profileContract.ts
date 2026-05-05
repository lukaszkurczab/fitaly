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
] as const satisfies readonly UserData["activityLevel"][];

export const PROFILE_GOALS = [
  "lose",
  "maintain",
  "increase",
  "",
] as const satisfies readonly UserData["goal"][];

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
  "unitsSystem",
  "age",
  "sex",
  "height",
  "heightInch",
  "weight",
  "preferences",
  "activityLevel",
  "goal",
  "chronicDiseases",
  "chronicDiseasesOther",
  "allergies",
  "allergiesOther",
  "lifestyle",
  "aiPersona",
  "readiness",
  "calorieTarget",
  "language",
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
  "unitsSystem",
  "age",
  "sex",
  "height",
  "heightInch",
  "weight",
  "preferences",
  "activityLevel",
  "goal",
  "chronicDiseases",
  "chronicDiseasesOther",
  "allergies",
  "allergiesOther",
  "lifestyle",
  "aiPersona",
  "readiness",
  "calorieTarget",
  "syncState",
  "lastSyncedAt",
  "avatarUrl",
  "avatarLocalPath",
  "avatarlastSyncedAt",
  "language",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_READINESS_FIELDS = [
  "readiness",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_AI_PERSONA_FIELDS = [
  "aiPersona",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_AI_STYLE_FIELDS = [
  "aiPersona",
  "styleProfile",
] as const;

export const PROFILE_NUTRITION_FIELDS = [
  "goal",
  "calorieTarget",
  "preferences",
] as const satisfies readonly (keyof UserData)[];

export const PROFILE_ONBOARDING_DEFAULTS = {
  unitsSystem: "metric" as UnitsSystem,
  age: "",
  sex: "female" as Exclude<Sex, null>,
  height: "",
  heightInch: "",
  weight: "",
  preferences: [] as Preference[],
  activityLevel: "moderate" as UserData["activityLevel"],
  goal: "maintain" as UserData["goal"],
  chronicDiseases: [] as ChronicDisease[],
  chronicDiseasesOther: "",
  allergies: [] as Allergy[],
  allergiesOther: "",
  lifestyle: "",
  aiPersona: "calm_guide" as AiPersona,
  readiness: {
    status: "needs_profile",
    onboardingCompletedAt: null,
    readyAt: null,
  } as UserData["readiness"],
  calorieTarget: 0,
  syncState: "pending" as SyncState,
  lastSyncedAt: "",
  avatarUrl: "",
  avatarLocalPath: "",
  avatarlastSyncedAt: "",
  language: "en" as UserLanguage,
};

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
