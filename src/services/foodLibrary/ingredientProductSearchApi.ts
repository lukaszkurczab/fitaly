import { get, post, type RequestOptions } from "@/services/core/apiClient";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import { withV2 } from "@/services/core/apiVersioning";
import {
  INGREDIENT_PRODUCT_ALLERGEN_FLAGS,
  INGREDIENT_PRODUCT_CACHE_STATES,
  INGREDIENT_PRODUCT_CONFIDENCE_LEVELS,
  INGREDIENT_PRODUCT_DIETARY_FLAGS,
  INGREDIENT_PRODUCT_KINDS,
  INGREDIENT_PRODUCT_LIFECYCLE_STATES,
  INGREDIENT_PRODUCT_NUTRITION_BASES,
  INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES,
  INGREDIENT_PRODUCT_RANKING_SIGNALS,
  INGREDIENT_PRODUCT_RECORD_SCOPES,
  INGREDIENT_PRODUCT_REMOVAL_REASONS,
  INGREDIENT_PRODUCT_SERVING_UNITS,
  INGREDIENT_PRODUCT_SOURCE_TYPES,
  INGREDIENT_PRODUCT_WARNING_REASON_CODES,
  type IngredientProductAllergenFlag,
  type IngredientProductCacheState,
  type IngredientProductConfidence,
  type IngredientProductCreateRequest,
  type IngredientProductCreateResponse,
  type IngredientProductDeleteRequest,
  type IngredientProductDeleteResponse,
  type IngredientProductDietaryFlag,
  type IngredientProductNutritionPer100,
  type IngredientProductPulledRecord,
  type IngredientProductPullResponse,
  type IngredientProductRemovedRecord,
  type IngredientProductProfileCompatibility,
  type IngredientProductRankingSignal,
  type IngredientProductSearchCachePolicy,
  type IngredientProductSearchQueryEcho,
  type IngredientProductSearchRequest,
  type IngredientProductSearchResponse,
  type IngredientProductSearchRow,
  type IngredientProductServing,
  type IngredientProductServingSize,
  type IngredientProductSourceAttribution,
  type IngredientProductUpdateRequest,
  type IngredientProductUpdateResponse,
  type IngredientProductWarningReasonCode,
} from "@/types/foodLibrary";

const SEARCH_ENDPOINT = withV2("/users/me/ingredient-products/search");
const CREATE_ENDPOINT = withV2("/users/me/ingredient-products");
const PULL_ENDPOINT = withV2("/users/me/ingredient-products/pull");
export const INGREDIENT_PRODUCT_SEARCH_MIN_QUERY_LENGTH = 2;
export const INGREDIENT_PRODUCT_SEARCH_DEFAULT_LIMIT = 8;
export const INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT = 12;
export const INGREDIENT_PRODUCT_PULL_DEFAULT_LIMIT = 100;
export const INGREDIENT_PRODUCT_PULL_MAX_LIMIT = 250;

type IngredientProductUpdateBody = Omit<
  IngredientProductUpdateRequest,
  "ingredientProductId"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function nonNegativeNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue !== null && numberValue >= 0 ? numberValue : null;
}

function positiveNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringsArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): Array<T[number]> {
  return Array.isArray(value)
    ? value.filter((item): item is T[number] => isOneOf(item, allowed))
    : [];
}

export function normalizeIngredientProductSearchQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function clampIngredientProductSearchLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return INGREDIENT_PRODUCT_SEARCH_DEFAULT_LIMIT;
  return Math.max(
    1,
    Math.min(Math.floor(Number(limit)), INGREDIENT_PRODUCT_SEARCH_MAX_LIMIT),
  );
}

export function clampIngredientProductPullLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return INGREDIENT_PRODUCT_PULL_DEFAULT_LIMIT;
  return Math.max(
    1,
    Math.min(Math.floor(Number(limit)), INGREDIENT_PRODUCT_PULL_MAX_LIMIT),
  );
}

function normalizeServing(raw: unknown): IngredientProductServing | null {
  if (!isRecord(raw)) return null;
  const quantity = positiveNumber(raw.quantity);
  const unit = isOneOf(raw.unit, INGREDIENT_PRODUCT_SERVING_UNITS)
    ? raw.unit
    : null;
  if (quantity === null || !unit) return null;
  return { quantity, unit };
}

function normalizeServingSize(raw: unknown): IngredientProductServingSize | null {
  if (!isRecord(raw)) return null;
  const baseServing = normalizeServing(raw);
  const servingSizeId = requiredString(raw.servingSizeId);
  const label = requiredString(raw.label);
  if (!baseServing || !servingSizeId || !label) return null;
  return { ...baseServing, servingSizeId, label };
}

function normalizeNutrition(raw: unknown): IngredientProductNutritionPer100 | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;

  const basis = isOneOf(raw.basis, INGREDIENT_PRODUCT_NUTRITION_BASES)
    ? raw.basis
    : null;
  const unit = isOneOf(raw.unit, INGREDIENT_PRODUCT_SERVING_UNITS)
    ? raw.unit
    : null;
  const kcal = nonNegativeNumber(raw.kcal);
  const protein = nonNegativeNumber(raw.protein);
  const fat = nonNegativeNumber(raw.fat);
  const carbs = nonNegativeNumber(raw.carbs);
  if (!basis || !unit || kcal === null || protein === null || fat === null || carbs === null) {
    return null;
  }

  return {
    basis,
    unit,
    kcal,
    protein,
    fat,
    carbs,
    fiber: nonNegativeNumber(raw.fiber),
    sugar: nonNegativeNumber(raw.sugar),
    salt: nonNegativeNumber(raw.salt),
    saturatedFat: nonNegativeNumber(raw.saturatedFat),
  };
}

function normalizeConfidence(raw: unknown): IngredientProductConfidence | null {
  if (!isRecord(raw)) return null;
  const identity = isOneOf(raw.identity, INGREDIENT_PRODUCT_CONFIDENCE_LEVELS)
    ? raw.identity
    : null;
  const nutrition = isOneOf(raw.nutrition, INGREDIENT_PRODUCT_CONFIDENCE_LEVELS)
    ? raw.nutrition
    : null;
  const profile = isOneOf(raw.profile, INGREDIENT_PRODUCT_CONFIDENCE_LEVELS)
    ? raw.profile
    : null;
  if (!identity || !nutrition || !profile) return null;
  return { identity, nutrition, profile };
}

function normalizeSourceAttribution(
  raw: unknown,
): IngredientProductSourceAttribution | null {
  if (!isRecord(raw)) return null;
  const sourceType = isOneOf(raw.sourceType, INGREDIENT_PRODUCT_SOURCE_TYPES)
    ? raw.sourceType
    : null;
  const sourceId = requiredString(raw.sourceId);
  const sourceName = requiredString(raw.sourceName);
  if (!sourceType || !sourceId || !sourceName) return null;
  return {
    sourceType,
    sourceId,
    sourceName,
    provider: optionalString(raw.provider),
    license: optionalString(raw.license),
    observedAt: optionalString(raw.observedAt),
    reviewedAt: optionalString(raw.reviewedAt),
    reviewedBy: optionalString(raw.reviewedBy),
  };
}

function normalizeProfileCompatibility(
  raw: unknown,
): IngredientProductProfileCompatibility | null {
  if (!isRecord(raw)) return null;
  const status = isOneOf(
    raw.status,
    INGREDIENT_PRODUCT_PROFILE_COMPATIBILITY_STATUSES,
  )
    ? raw.status
    : null;
  if (!status) return null;
  return {
    status,
    dietaryFlags: stringsArray(raw.dietaryFlags, INGREDIENT_PRODUCT_DIETARY_FLAGS),
    allergenFlags: stringsArray(raw.allergenFlags, INGREDIENT_PRODUCT_ALLERGEN_FLAGS),
  };
}

export function normalizeIngredientProductSearchRow(
  raw: unknown,
): IngredientProductSearchRow | null {
  if (!isRecord(raw)) return null;
  const ingredientProductId = requiredString(raw.ingredientProductId);
  const recordScope = isOneOf(raw.recordScope, INGREDIENT_PRODUCT_RECORD_SCOPES)
    ? raw.recordScope
    : null;
  const lifecycleState = isOneOf(
    raw.lifecycleState,
    INGREDIENT_PRODUCT_LIFECYCLE_STATES,
  )
    ? raw.lifecycleState
    : null;
  const displayName = requiredString(raw.displayName);
  const kind = isOneOf(raw.kind, INGREDIENT_PRODUCT_KINDS) ? raw.kind : null;
  const defaultServing = normalizeServing(raw.defaultServing);
  const confidence = normalizeConfidence(raw.confidence);
  const sourceAttribution = normalizeSourceAttribution(raw.sourceAttribution);
  const profileCompatibility = normalizeProfileCompatibility(raw.profileCompatibility);
  if (
    !ingredientProductId ||
    !recordScope ||
    !lifecycleState ||
    !displayName ||
    !kind ||
    !defaultServing ||
    !confidence ||
    !sourceAttribution ||
    !profileCompatibility
  ) {
    return null;
  }

  const cacheState = isOneOf(raw.cacheState, INGREDIENT_PRODUCT_CACHE_STATES)
    ? raw.cacheState
    : null;

  return {
    ingredientProductId,
    recordScope,
    lifecycleState,
    displayName,
    kind,
    defaultServing,
    nutritionPer100: normalizeNutrition(raw.nutritionPer100),
    confidence,
    sourceAttribution,
    profileCompatibility,
    warningReasonCodes: stringsArray(
      raw.warningReasonCodes,
      INGREDIENT_PRODUCT_WARNING_REASON_CODES,
    ) as IngredientProductWarningReasonCode[],
    rankingSignals: stringsArray(
      raw.rankingSignals,
      INGREDIENT_PRODUCT_RANKING_SIGNALS,
    ) as IngredientProductRankingSignal[],
    brandName: optionalString(raw.brandName),
    ingredientName: optionalString(raw.ingredientName),
    packageName: optionalString(raw.packageName),
    category: optionalString(raw.category),
    servingSizes: Array.isArray(raw.servingSizes)
      ? raw.servingSizes
          .map(normalizeServingSize)
          .filter((item): item is IngredientProductServingSize => item !== null)
      : [],
    dietaryFlags: stringsArray(
      raw.dietaryFlags,
      INGREDIENT_PRODUCT_DIETARY_FLAGS,
    ) as IngredientProductDietaryFlag[],
    allergenFlags: stringsArray(
      raw.allergenFlags,
      INGREDIENT_PRODUCT_ALLERGEN_FLAGS,
    ) as IngredientProductAllergenFlag[],
    cacheState: cacheState as IngredientProductCacheState | null,
    ownerUserId: optionalString(raw.ownerUserId),
  };
}

function normalizeQueryEcho(
  raw: unknown,
  fallback: IngredientProductSearchRequest,
): IngredientProductSearchQueryEcho {
  const queryEcho = isRecord(raw) ? raw : {};
  const normalizedQuery =
    requiredString(queryEcho.normalizedQuery) ??
    normalizeIngredientProductSearchQuery(fallback.query);
  const limit = finiteNumber(queryEcho.limit);
  return {
    normalizedQuery,
    queryLength:
      finiteNumber(queryEcho.queryLength) ?? normalizedQuery.length,
    limit: clampIngredientProductSearchLimit(
      limit === null ? fallback.limit : limit,
    ),
    includeUserScoped: booleanOrDefault(
      queryEcho.includeUserScoped,
      fallback.includeUserScoped ?? true,
    ),
    includeGlobal: booleanOrDefault(
      queryEcho.includeGlobal,
      fallback.includeGlobal ?? true,
    ),
    locale: optionalString(queryEcho.locale) ?? fallback.locale ?? null,
  };
}

function normalizeCachePolicy(
  raw: unknown,
): IngredientProductSearchCachePolicy | null {
  if (!isRecord(raw)) return null;
  const maxAgeSeconds = finiteNumber(raw.maxAgeSeconds);
  if (
    raw.cacheGeneration !== "ingredient_product_search_v1" ||
    maxAgeSeconds === null ||
    maxAgeSeconds < 0
  ) {
    return null;
  }
  return {
    cacheGeneration: "ingredient_product_search_v1",
    maxAgeSeconds: Math.floor(maxAgeSeconds),
  };
}

export function normalizeIngredientProductSearchResponse(
  raw: unknown,
  fallbackRequest: IngredientProductSearchRequest,
): IngredientProductSearchResponse {
  const response = isRecord(raw) ? raw : {};
  return {
    items: Array.isArray(response.items)
      ? response.items
          .map(normalizeIngredientProductSearchRow)
          .filter((item): item is IngredientProductSearchRow => item !== null)
      : [],
    queryEcho: normalizeQueryEcho(response.queryEcho, fallbackRequest),
    cachePolicy: normalizeCachePolicy(response.cachePolicy),
    warnings: stringsArray(
      response.warnings,
      INGREDIENT_PRODUCT_WARNING_REASON_CODES,
    ) as IngredientProductWarningReasonCode[],
  };
}

export function normalizeIngredientProductCreateResponse(
  raw: unknown,
): IngredientProductCreateResponse {
  const response = isRecord(raw) ? raw : {};
  const item = normalizeIngredientProductSearchRow(response.item);
  if (!item || typeof response.updated !== "boolean") {
    throw new Error("Invalid Ingredient/Product create response.");
  }
  return {
    item,
    updated: response.updated,
  };
}

export function normalizeIngredientProductUpdateResponse(
  raw: unknown,
): IngredientProductUpdateResponse {
  const response = isRecord(raw) ? raw : {};
  const item = normalizeIngredientProductSearchRow(response.item);
  if (!item || typeof response.updated !== "boolean") {
    throw new Error("Invalid Ingredient/Product update response.");
  }
  return {
    item,
    updated: response.updated,
  };
}

export function normalizeIngredientProductDeleteResponse(
  raw: unknown,
): IngredientProductDeleteResponse {
  const response = isRecord(raw) ? raw : {};
  const ingredientProductId = requiredString(response.ingredientProductId);
  const updatedAt = requiredString(response.updatedAt);
  if (
    !ingredientProductId ||
    !updatedAt ||
    typeof response.updated !== "boolean"
  ) {
    throw new Error("Invalid Ingredient/Product delete response.");
  }
  return {
    ingredientProductId,
    updatedAt,
    updated: response.updated,
  };
}

export function normalizeIngredientProductPullResponse(
  raw: unknown,
): IngredientProductPullResponse {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.records) ||
    !Array.isArray(raw.removedRecords)
  ) {
    throw new Error("Invalid Ingredient/Product pull response.");
  }

  const records: IngredientProductPulledRecord[] = raw.records.map(
    (rawRecord): IngredientProductPulledRecord => {
      if (!isRecord(rawRecord) || typeof rawRecord.updatedAt !== "string") {
        throw new Error("Invalid Ingredient/Product pull response.");
      }
      const item = normalizeIngredientProductSearchRow(rawRecord.item);
      if (!item) {
        throw new Error("Invalid Ingredient/Product pull response.");
      }
      return {
        item,
        updatedAt: rawRecord.updatedAt,
        creationClientMutationId: optionalString(
          rawRecord.creationClientMutationId,
        ),
      };
    },
  );
  const removedRecords: IngredientProductRemovedRecord[] = raw.removedRecords.map(
    (rawRecord): IngredientProductRemovedRecord => {
      if (!isRecord(rawRecord)) {
        throw new Error("Invalid Ingredient/Product pull response.");
      }
      const ingredientProductId = requiredString(rawRecord.ingredientProductId);
      const updatedAt = requiredString(rawRecord.updatedAt);
      if (
        !ingredientProductId ||
        !updatedAt ||
        !isOneOf(rawRecord.removalReason, INGREDIENT_PRODUCT_REMOVAL_REASONS)
      ) {
        throw new Error("Invalid Ingredient/Product pull response.");
      }
      return {
        ingredientProductId,
        updatedAt,
        removalReason: rawRecord.removalReason,
      };
    },
  );
  const nextUpdatedAfter = optionalString(raw.nextUpdatedAfter);
  if (raw.nextUpdatedAfter != null && nextUpdatedAfter === null) {
    throw new Error("Invalid Ingredient/Product pull response.");
  }
  return {
    records,
    removedRecords,
    nextUpdatedAfter,
  };
}

function buildSearchPath(request: IngredientProductSearchRequest): string {
  const params = new URLSearchParams();
  params.set("query", request.query.trim());
  params.set(
    "limit",
    String(clampIngredientProductSearchLimit(request.limit)),
  );
  if (request.locale) params.set("locale", request.locale);
  if (request.includeUserScoped !== undefined) {
    params.set("includeUserScoped", String(request.includeUserScoped));
  }
  if (request.includeGlobal !== undefined) {
    params.set("includeGlobal", String(request.includeGlobal));
  }
  return `${SEARCH_ENDPOINT}?${params.toString()}`;
}

function buildPullPath(request: {
  updatedAfter?: string | null;
  limit?: number;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(clampIngredientProductPullLimit(request.limit)));
  if (request.updatedAfter) params.set("updatedAfter", request.updatedAfter);
  return `${PULL_ENDPOINT}?${params.toString()}`;
}

function buildDeletePath(ingredientProductId: string): string {
  return withV2(
    `/users/me/ingredient-products/${encodeURIComponent(ingredientProductId)}/delete`,
  );
}

function buildUpdatePath(ingredientProductId: string): string {
  return withV2(
    `/users/me/ingredient-products/${encodeURIComponent(ingredientProductId)}/update`,
  );
}

function buildUpdateBody(
  request: IngredientProductUpdateRequest,
): IngredientProductUpdateBody {
  const body: IngredientProductUpdateBody = {
    clientMutationId: request.clientMutationId,
  };

  if (
    Object.prototype.hasOwnProperty.call(request, "displayName") &&
    request.displayName !== undefined
  ) {
    body.displayName = request.displayName;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "kind") &&
    request.kind !== undefined
  ) {
    body.kind = request.kind;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "defaultServing") &&
    request.defaultServing !== undefined
  ) {
    body.defaultServing = request.defaultServing;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "nutritionPer100") &&
    request.nutritionPer100 !== undefined
  ) {
    body.nutritionPer100 = request.nutritionPer100;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "brandName") &&
    request.brandName !== undefined
  ) {
    body.brandName = request.brandName;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "ingredientName") &&
    request.ingredientName !== undefined
  ) {
    body.ingredientName = request.ingredientName;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "packageName") &&
    request.packageName !== undefined
  ) {
    body.packageName = request.packageName;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "category") &&
    request.category !== undefined
  ) {
    body.category = request.category;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "servingSizes") &&
    request.servingSizes !== undefined
  ) {
    body.servingSizes = request.servingSizes;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "dietaryFlags") &&
    request.dietaryFlags !== undefined
  ) {
    body.dietaryFlags = request.dietaryFlags;
  }
  if (
    Object.prototype.hasOwnProperty.call(request, "allergenFlags") &&
    request.allergenFlags !== undefined
  ) {
    body.allergenFlags = request.allergenFlags;
  }

  if (Object.keys(body).length === 1) {
    throw new Error(
      "At least one editable Ingredient/Product update field is required.",
    );
  }

  return body;
}

export async function searchIngredientProductsRemote(
  request: IngredientProductSearchRequest,
  options?: RequestOptions,
): Promise<IngredientProductSearchResponse> {
  requireRuntimeFeatureEnabled("foodLibrary");
  return normalizeIngredientProductSearchResponse(
    await get(buildSearchPath(request), options),
    request,
  );
}

export async function createIngredientProductRemote(
  request: IngredientProductCreateRequest,
  options?: RequestOptions,
): Promise<IngredientProductCreateResponse> {
  requireRuntimeFeatureEnabled("foodLibrary");
  return normalizeIngredientProductCreateResponse(
    await post(CREATE_ENDPOINT, request, options),
  );
}

export async function updateIngredientProductRemote(
  request: IngredientProductUpdateRequest,
  options?: RequestOptions,
): Promise<IngredientProductUpdateResponse> {
  requireRuntimeFeatureEnabled("foodLibrary");
  return normalizeIngredientProductUpdateResponse(
    await post(
      buildUpdatePath(request.ingredientProductId),
      buildUpdateBody(request),
      options,
    ),
  );
}

export async function deleteIngredientProductRemote(
  request: IngredientProductDeleteRequest,
  options?: RequestOptions,
): Promise<IngredientProductDeleteResponse> {
  requireRuntimeFeatureEnabled("foodLibrary");
  return normalizeIngredientProductDeleteResponse(
    await post(
      buildDeletePath(request.ingredientProductId),
      { clientMutationId: request.clientMutationId },
      options,
    ),
  );
}

export async function pullIngredientProductsRemote(
  request: { updatedAfter?: string | null; limit?: number } = {},
  options?: RequestOptions,
): Promise<IngredientProductPullResponse> {
  requireRuntimeFeatureEnabled("foodLibrary");
  return normalizeIngredientProductPullResponse(
    await get(buildPullPath(request), options),
  );
}
