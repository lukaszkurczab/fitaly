import type { Allergy, ChronicDisease, Preference } from "@/types/onboarding";

export const RECIPE_CATALOG_LIFECYCLE_STATES = [
  "active",
  "retired",
] as const;

export const RECIPE_CATALOG_REVIEW_STATES = [
  "curated",
  "needs_review",
] as const;

export const RECIPE_CATALOG_NUTRITION_CONFIDENCE_LEVELS = [
  "unknown",
  "low",
  "medium",
  "high",
  "verified",
] as const;

export const RECIPE_CATALOG_PROFILE_FLAG_STATES = [
  "complete",
  "partial",
  "unknown",
] as const;

export const RECIPE_CATALOG_ALLERGEN_FLAGS = [
  "peanuts",
  "gluten",
  "lactose",
] as const;

export const RECIPE_CATALOG_DIETARY_FLAGS = [
  "vegan",
  "vegetarian",
  "pescatarian",
  "gluten_free",
  "dairy_free",
] as const;

export const RECIPE_CATALOG_STYLE_TAGS = [
  "balanced",
  "mediterranean",
  "paleo",
] as const;

export const RECIPE_CATALOG_FILTER_STATUSES = [
  "visible",
  "hidden_hard_exclusion",
  "unknown_reveal_required",
] as const;

export const RECIPE_CATALOG_SOFT_PREFERENCE_STATUSES = [
  "not_applicable",
  "match",
  "miss",
  "mixed",
] as const;

export const RECIPE_CATALOG_REASON_CODES = [
  "explicit_allergen_match",
  "explicit_restriction_mismatch",
  "unknown_allergen_flag",
  "unknown_restriction_flag",
] as const;

export const RECIPE_CATALOG_REASON_TYPES = [
  "allergy",
  "restriction",
] as const;

export const RECIPE_CATALOG_SOURCE_TYPES = [
  "internal_curated",
] as const;

export const RECIPE_CATALOG_INGREDIENT_UNITS = [
  "g",
  "ml",
  "piece",
  "serving",
  "tbsp",
  "tsp",
] as const;

export type RecipeCatalogLifecycleState =
  (typeof RECIPE_CATALOG_LIFECYCLE_STATES)[number];
export type RecipeCatalogReviewState =
  (typeof RECIPE_CATALOG_REVIEW_STATES)[number];
export type RecipeCatalogNutritionConfidence =
  (typeof RECIPE_CATALOG_NUTRITION_CONFIDENCE_LEVELS)[number];
export type RecipeCatalogProfileFlagState =
  (typeof RECIPE_CATALOG_PROFILE_FLAG_STATES)[number];
export type RecipeCatalogAllergenFlag =
  (typeof RECIPE_CATALOG_ALLERGEN_FLAGS)[number];
export type RecipeCatalogDietaryFlag =
  (typeof RECIPE_CATALOG_DIETARY_FLAGS)[number];
export type RecipeCatalogStyleTag =
  (typeof RECIPE_CATALOG_STYLE_TAGS)[number];
export type RecipeCatalogFilterStatus =
  (typeof RECIPE_CATALOG_FILTER_STATUSES)[number];
export type RecipeCatalogSoftPreferenceStatus =
  (typeof RECIPE_CATALOG_SOFT_PREFERENCE_STATUSES)[number];
export type RecipeCatalogReasonCode =
  (typeof RECIPE_CATALOG_REASON_CODES)[number];
export type RecipeCatalogReasonType =
  (typeof RECIPE_CATALOG_REASON_TYPES)[number];
export type RecipeCatalogSourceType =
  (typeof RECIPE_CATALOG_SOURCE_TYPES)[number];
export type RecipeCatalogIngredientUnit =
  (typeof RECIPE_CATALOG_INGREDIENT_UNITS)[number];

export type RecipeCatalogSourceAttribution = {
  sourceType: RecipeCatalogSourceType;
  sourceId: string;
  sourceName: string;
  reviewedAt: string;
};

export type RecipeCatalogIngredientRef = {
  ingredientProductId: string | null;
  snapshotName: string;
  quantity: number;
  unit: RecipeCatalogIngredientUnit;
};

export type RecipeCatalogNutritionSnapshot = {
  kcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  confidence: RecipeCatalogNutritionConfidence;
  isPartial: boolean;
};

export type RecipeCatalogRecord = {
  recipeId: string;
  version: number;
  lifecycleState: RecipeCatalogLifecycleState;
  locale: string;
  title: string;
  description: string | null;
  servings: number;
  yield: string;
  sourceAttribution: RecipeCatalogSourceAttribution;
  updatedAt: string;
  reviewState: RecipeCatalogReviewState;
  ingredients: RecipeCatalogIngredientRef[];
  steps: string[];
  prepTimeMin: number;
  cookTimeMin: number;
  nutritionSnapshot: RecipeCatalogNutritionSnapshot;
  imageRef: string | null;
  profileFlagState: RecipeCatalogProfileFlagState;
  dietaryFlags: RecipeCatalogDietaryFlag[];
  allergenFlags: RecipeCatalogAllergenFlag[];
  unknownDietaryFlags: RecipeCatalogDietaryFlag[];
  unknownAllergenFlags: RecipeCatalogAllergenFlag[];
  styleTags: RecipeCatalogStyleTag[];
};

export type RecipeCatalogFilterReason = {
  code: RecipeCatalogReasonCode;
  filterType: RecipeCatalogReasonType;
  profileValue: string;
  catalogFlag: string;
};

export type RecipeCatalogFilterResult = {
  recipe: RecipeCatalogRecord;
  status: RecipeCatalogFilterStatus;
  hardExclusionReasons: RecipeCatalogFilterReason[];
  unknownReasons: RecipeCatalogFilterReason[];
  softPreferenceStatus: RecipeCatalogSoftPreferenceStatus;
  softPreferenceMatches: Preference[];
  softPreferenceMisses: Preference[];
  softPreferenceScore: number;
};

export type RecipeCatalogFilterQueryEcho = {
  activeAllergies: Allergy[];
  activeRestrictions: Preference[];
  activeSoftPreferences: Preference[];
  ignoredChronicDiseases: ChronicDisease[];
  ignoredAllergiesOtherPresent: boolean;
  ignoredLifestylePresent: boolean;
  showHidden: boolean;
  revealUnknown: boolean;
  lowResultsThreshold: number;
};

export type RecipeCatalogFilterResponse = {
  items: RecipeCatalogFilterResult[];
  queryEcho: RecipeCatalogFilterQueryEcho;
  totalCatalogCount: number;
  visibleCount: number;
  hiddenHardExclusionCount: number;
  unknownRevealRequiredCount: number;
  lowResults: boolean;
  emptyCatalog: boolean;
};

export type RecipeCatalogRequest = {
  allergies?: Allergy[];
  preferences?: Preference[];
  chronicDiseases?: ChronicDisease[];
  allergiesOther?: string | null;
  lifestyle?: string | null;
  showHidden?: boolean;
  revealUnknown?: boolean;
};
