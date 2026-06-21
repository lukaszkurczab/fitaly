import { get, type RequestOptions } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  RECIPE_CATALOG_ALLERGEN_FLAGS,
  RECIPE_CATALOG_DIETARY_FLAGS,
  RECIPE_CATALOG_FILTER_STATUSES,
  RECIPE_CATALOG_INGREDIENT_UNITS,
  RECIPE_CATALOG_LIFECYCLE_STATES,
  RECIPE_CATALOG_NUTRITION_CONFIDENCE_LEVELS,
  RECIPE_CATALOG_PROFILE_FLAG_STATES,
  RECIPE_CATALOG_REASON_CODES,
  RECIPE_CATALOG_REASON_TYPES,
  RECIPE_CATALOG_REVIEW_STATES,
  RECIPE_CATALOG_SOFT_PREFERENCE_STATUSES,
  RECIPE_CATALOG_SOURCE_TYPES,
  RECIPE_CATALOG_STYLE_TAGS,
  type RecipeCatalogAllergenFlag,
  type RecipeCatalogDietaryFlag,
  type RecipeCatalogFilterQueryEcho,
  type RecipeCatalogFilterReason,
  type RecipeCatalogFilterResponse,
  type RecipeCatalogFilterResult,
  type RecipeCatalogIngredientRef,
  type RecipeCatalogNutritionSnapshot,
  type RecipeCatalogRecord,
  type RecipeCatalogRequest,
  type RecipeCatalogSourceAttribution,
  type RecipeCatalogStyleTag,
} from "@/types/recipes";
import type { Allergy, ChronicDisease, Preference } from "@/types/onboarding";

const RECIPE_CATALOG_ENDPOINT = withV2("/users/me/recipes/catalog");
const INVALID_RECIPE_CATALOG_RESPONSE = "Invalid Recipe Catalog response.";

const PROFILE_ALLERGIES = [
  "none",
  "peanuts",
  "gluten",
  "lactose",
  "other",
] as const satisfies readonly Allergy[];

const PROFILE_PREFERENCES = [
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

const PROFILE_CHRONIC_DISEASES = [
  "none",
  "diabetes",
  "hypertension",
  "asthma",
  "other",
] as const satisfies readonly ChronicDisease[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue !== null && numberValue >= 0 ? numberValue : null;
}

function positiveNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function stringsArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): Array<T[number]> | null {
  if (!Array.isArray(value)) return null;
  const normalized: Array<T[number]> = [];
  for (const item of value) {
    if (!isOneOf(item, allowed)) return null;
    normalized.push(item);
  }
  return normalized;
}

function requiredStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: string[] = [];
  for (const item of value) {
    const stringValue = requiredString(item);
    if (!stringValue) return null;
    normalized.push(stringValue);
  }
  return normalized;
}

function normalizedArray<T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: T[] = [];
  for (const item of value) {
    const normalizedItem = normalize(item);
    if (normalizedItem === null) return null;
    normalized.push(normalizedItem);
  }
  return normalized;
}

function normalizeSourceAttribution(
  raw: unknown,
): RecipeCatalogSourceAttribution | null {
  if (!isRecord(raw)) return null;
  const sourceType = isOneOf(raw.sourceType, RECIPE_CATALOG_SOURCE_TYPES)
    ? raw.sourceType
    : null;
  const sourceId = requiredString(raw.sourceId);
  const sourceName = requiredString(raw.sourceName);
  const reviewedAt = requiredString(raw.reviewedAt);
  if (!sourceType || !sourceId || !sourceName || !reviewedAt) return null;
  return { sourceType, sourceId, sourceName, reviewedAt };
}

function normalizeIngredientRef(raw: unknown): RecipeCatalogIngredientRef | null {
  if (!isRecord(raw)) return null;
  const snapshotName = requiredString(raw.snapshotName);
  const quantity = nonNegativeNumber(raw.quantity);
  const unit = isOneOf(raw.unit, RECIPE_CATALOG_INGREDIENT_UNITS)
    ? raw.unit
    : null;
  if (!snapshotName || quantity === null || !unit) return null;
  return {
    ingredientProductId: optionalString(raw.ingredientProductId),
    snapshotName,
    quantity,
    unit,
  };
}

function normalizeNutritionSnapshot(
  raw: unknown,
): RecipeCatalogNutritionSnapshot | null {
  if (!isRecord(raw)) return null;
  const kcal = nonNegativeNumber(raw.kcal);
  const proteinGrams = nonNegativeNumber(raw.proteinGrams);
  const fatGrams = nonNegativeNumber(raw.fatGrams);
  const carbsGrams = nonNegativeNumber(raw.carbsGrams);
  const confidence = isOneOf(
    raw.confidence,
    RECIPE_CATALOG_NUTRITION_CONFIDENCE_LEVELS,
  )
    ? raw.confidence
    : null;
  if (
    kcal === null ||
    proteinGrams === null ||
    fatGrams === null ||
    carbsGrams === null ||
    !confidence ||
    typeof raw.isPartial !== "boolean"
  ) {
    return null;
  }
  return {
    kcal,
    proteinGrams,
    fatGrams,
    carbsGrams,
    confidence,
    isPartial: raw.isPartial,
  };
}

export function normalizeRecipeCatalogRecord(
  raw: unknown,
): RecipeCatalogRecord | null {
  if (!isRecord(raw)) return null;

  const recipeId = requiredString(raw.recipeId);
  const version = positiveNumber(raw.version);
  const lifecycleState = isOneOf(
    raw.lifecycleState,
    RECIPE_CATALOG_LIFECYCLE_STATES,
  )
    ? raw.lifecycleState
    : null;
  const locale = requiredString(raw.locale);
  const title = requiredString(raw.title);
  const servings = positiveNumber(raw.servings);
  const yieldText = requiredString(raw.yield);
  const sourceAttribution = normalizeSourceAttribution(raw.sourceAttribution);
  const updatedAt = requiredString(raw.updatedAt);
  const reviewState = isOneOf(raw.reviewState, RECIPE_CATALOG_REVIEW_STATES)
    ? raw.reviewState
    : null;
  const ingredients = normalizedArray(raw.ingredients, normalizeIngredientRef);
  const steps = requiredStringArray(raw.steps);
  const prepTimeMin = nonNegativeNumber(raw.prepTimeMin);
  const cookTimeMin = nonNegativeNumber(raw.cookTimeMin);
  const nutritionSnapshot = normalizeNutritionSnapshot(raw.nutritionSnapshot);
  const profileFlagState = isOneOf(
    raw.profileFlagState,
    RECIPE_CATALOG_PROFILE_FLAG_STATES,
  )
    ? raw.profileFlagState
    : null;
  const dietaryFlags = stringsArray(
    raw.dietaryFlags,
    RECIPE_CATALOG_DIETARY_FLAGS,
  );
  const allergenFlags = stringsArray(
    raw.allergenFlags,
    RECIPE_CATALOG_ALLERGEN_FLAGS,
  );
  const unknownDietaryFlags = stringsArray(
    raw.unknownDietaryFlags,
    RECIPE_CATALOG_DIETARY_FLAGS,
  );
  const unknownAllergenFlags = stringsArray(
    raw.unknownAllergenFlags,
    RECIPE_CATALOG_ALLERGEN_FLAGS,
  );
  const styleTags = stringsArray(raw.styleTags, RECIPE_CATALOG_STYLE_TAGS);

  if (
    !recipeId ||
    version === null ||
    !lifecycleState ||
    !locale ||
    !title ||
    servings === null ||
    !yieldText ||
    !sourceAttribution ||
    !updatedAt ||
    !reviewState ||
    !ingredients ||
    ingredients.length === 0 ||
    !steps ||
    steps.length === 0 ||
    prepTimeMin === null ||
    cookTimeMin === null ||
    !nutritionSnapshot ||
    !profileFlagState ||
    !dietaryFlags ||
    !allergenFlags ||
    !unknownDietaryFlags ||
    !unknownAllergenFlags ||
    !styleTags
  ) {
    return null;
  }

  return {
    recipeId,
    version,
    lifecycleState,
    locale,
    title,
    description: optionalString(raw.description),
    servings,
    yield: yieldText,
    sourceAttribution,
    updatedAt,
    reviewState,
    ingredients,
    steps,
    prepTimeMin,
    cookTimeMin,
    nutritionSnapshot,
    imageRef: optionalString(raw.imageRef),
    profileFlagState,
    dietaryFlags: dietaryFlags as RecipeCatalogDietaryFlag[],
    allergenFlags: allergenFlags as RecipeCatalogAllergenFlag[],
    unknownDietaryFlags: unknownDietaryFlags as RecipeCatalogDietaryFlag[],
    unknownAllergenFlags: unknownAllergenFlags as RecipeCatalogAllergenFlag[],
    styleTags: styleTags as RecipeCatalogStyleTag[],
  };
}

function normalizeReason(raw: unknown): RecipeCatalogFilterReason | null {
  if (!isRecord(raw)) return null;
  const code = isOneOf(raw.code, RECIPE_CATALOG_REASON_CODES)
    ? raw.code
    : null;
  const filterType = isOneOf(raw.filterType, RECIPE_CATALOG_REASON_TYPES)
    ? raw.filterType
    : null;
  const profileValue = requiredString(raw.profileValue);
  const catalogFlag = requiredString(raw.catalogFlag);
  if (!code || !filterType || !profileValue || !catalogFlag) return null;
  return { code, filterType, profileValue, catalogFlag };
}

function normalizeResult(raw: unknown): RecipeCatalogFilterResult | null {
  if (!isRecord(raw)) return null;
  const recipe = normalizeRecipeCatalogRecord(raw.recipe);
  const status = isOneOf(raw.status, RECIPE_CATALOG_FILTER_STATUSES)
    ? raw.status
    : null;
  const softPreferenceStatus = isOneOf(
    raw.softPreferenceStatus,
    RECIPE_CATALOG_SOFT_PREFERENCE_STATUSES,
  )
    ? raw.softPreferenceStatus
    : null;
  const softPreferenceScore = nonNegativeNumber(raw.softPreferenceScore);
  const hardExclusionReasons = normalizedArray(
    raw.hardExclusionReasons,
    normalizeReason,
  );
  const unknownReasons = normalizedArray(raw.unknownReasons, normalizeReason);
  const softPreferenceMatches = stringsArray(
    raw.softPreferenceMatches,
    PROFILE_PREFERENCES,
  );
  const softPreferenceMisses = stringsArray(
    raw.softPreferenceMisses,
    PROFILE_PREFERENCES,
  );
  if (
    !recipe ||
    !status ||
    !softPreferenceStatus ||
    softPreferenceScore === null ||
    !hardExclusionReasons ||
    !unknownReasons ||
    !softPreferenceMatches ||
    !softPreferenceMisses
  ) {
    return null;
  }

  return {
    recipe,
    status,
    hardExclusionReasons,
    unknownReasons,
    softPreferenceStatus,
    softPreferenceMatches: softPreferenceMatches as Preference[],
    softPreferenceMisses: softPreferenceMisses as Preference[],
    softPreferenceScore,
  };
}

function normalizeQueryEcho(raw: unknown): RecipeCatalogFilterQueryEcho | null {
  if (!isRecord(raw)) return null;
  const lowResultsThreshold = nonNegativeNumber(raw.lowResultsThreshold);
  const activeAllergies = stringsArray(raw.activeAllergies, PROFILE_ALLERGIES);
  const activeRestrictions = stringsArray(
    raw.activeRestrictions,
    PROFILE_PREFERENCES,
  );
  const activeSoftPreferences = stringsArray(
    raw.activeSoftPreferences,
    PROFILE_PREFERENCES,
  );
  const ignoredChronicDiseases = stringsArray(
    raw.ignoredChronicDiseases,
    PROFILE_CHRONIC_DISEASES,
  );
  if (
    !activeAllergies ||
    !activeRestrictions ||
    !activeSoftPreferences ||
    !ignoredChronicDiseases ||
    typeof raw.ignoredAllergiesOtherPresent !== "boolean" ||
    typeof raw.ignoredLifestylePresent !== "boolean" ||
    typeof raw.showHidden !== "boolean" ||
    typeof raw.revealUnknown !== "boolean" ||
    lowResultsThreshold === null
  ) {
    return null;
  }

  return {
    activeAllergies: activeAllergies as Allergy[],
    activeRestrictions: activeRestrictions as Preference[],
    activeSoftPreferences: activeSoftPreferences as Preference[],
    ignoredChronicDiseases: ignoredChronicDiseases as ChronicDisease[],
    ignoredAllergiesOtherPresent: raw.ignoredAllergiesOtherPresent,
    ignoredLifestylePresent: raw.ignoredLifestylePresent,
    showHidden: raw.showHidden,
    revealUnknown: raw.revealUnknown,
    lowResultsThreshold,
  };
}

export function normalizeRecipeCatalogResponse(
  raw: unknown,
): RecipeCatalogFilterResponse {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new Error(INVALID_RECIPE_CATALOG_RESPONSE);
  }
  const items = normalizedArray(raw.items, normalizeResult);
  const queryEcho = normalizeQueryEcho(raw.queryEcho);
  const totalCatalogCount = nonNegativeNumber(raw.totalCatalogCount);
  const visibleCount = nonNegativeNumber(raw.visibleCount);
  const hiddenHardExclusionCount = nonNegativeNumber(
    raw.hiddenHardExclusionCount,
  );
  const unknownRevealRequiredCount = nonNegativeNumber(
    raw.unknownRevealRequiredCount,
  );

  if (
    !items ||
    !queryEcho ||
    totalCatalogCount === null ||
    visibleCount === null ||
    hiddenHardExclusionCount === null ||
    unknownRevealRequiredCount === null ||
    typeof raw.lowResults !== "boolean" ||
    typeof raw.emptyCatalog !== "boolean"
  ) {
    throw new Error(INVALID_RECIPE_CATALOG_RESPONSE);
  }

  return {
    items,
    queryEcho,
    totalCatalogCount,
    visibleCount,
    hiddenHardExclusionCount,
    unknownRevealRequiredCount,
    lowResults: raw.lowResults,
    emptyCatalog: raw.emptyCatalog,
  };
}

function appendArrayParams<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[] | undefined,
): void {
  if (values === undefined) return;
  for (const value of values) {
    params.append(key, value);
  }
}

function appendProfileArrayParams<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[] | undefined,
  useProfileKey: string,
): void {
  if (values === undefined) return;
  params.set(useProfileKey, "false");
  appendArrayParams(params, key, values);
}

function buildRecipeCatalogPath(request: RecipeCatalogRequest = {}): string {
  const params = new URLSearchParams();
  appendProfileArrayParams(
    params,
    "allergies",
    request.allergies,
    "useProfileAllergies",
  );
  appendProfileArrayParams(
    params,
    "preferences",
    request.preferences,
    "useProfilePreferences",
  );
  appendArrayParams(params, "chronicDiseases", request.chronicDiseases);
  if (request.allergiesOther) params.set("allergiesOther", request.allergiesOther);
  if (request.lifestyle) params.set("lifestyle", request.lifestyle);
  if (request.showHidden !== undefined) {
    params.set("showHidden", String(request.showHidden));
  }
  if (request.revealUnknown !== undefined) {
    params.set("revealUnknown", String(request.revealUnknown));
  }

  const query = params.toString();
  return query ? `${RECIPE_CATALOG_ENDPOINT}?${query}` : RECIPE_CATALOG_ENDPOINT;
}

export async function fetchRecipeCatalogRemote(
  request: RecipeCatalogRequest = {},
  options?: RequestOptions,
): Promise<RecipeCatalogFilterResponse> {
  requireRuntimeFeatureEnabled("recipeCatalog");
  return normalizeRecipeCatalogResponse(
    await get(buildRecipeCatalogPath(request), options),
  );
}
