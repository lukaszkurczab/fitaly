import {
  get,
  patch,
  post,
  request,
  type RequestOptions,
} from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { requireRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  PLANNED_MEAL_CONFIDENCE_LEVELS,
  PLANNED_MEAL_ESTIMATE_STATES,
  PLANNED_MEAL_NUTRITION_FIELDS,
  PLANNED_MEAL_SOURCE_TYPES,
  PLANNED_MEAL_STATUSES,
  PLANNED_MEAL_TIME_BUCKETS,
  type PlannedMealCreateRequest,
  type PlannedMealDeleteRequest,
  type PlannedMealDraftSnapshot,
  type PlannedMealItem,
  type PlannedMealMutationResponse,
  type PlannedMealNutritionEstimate,
  type PlannedMealNutritionField,
  type PlannedMealsListQueryEcho,
  type PlannedMealsListRequest,
  type PlannedMealsListResponse,
  type PlannedMealSourceRef,
  type PlannedMealUpdateRequest,
} from "@/types/plannedMeals";
import type { Ingredient, MealType, Nutrients } from "@/types/meal";

const PLANNED_MEALS_ENDPOINT = withV2("/users/me/planned-meals");
const INVALID_PLANNED_MEAL_RESPONSE = "Invalid Planned Meal response.";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
const SOURCE_REF_KEYS = ["sourceId", "sourceVersion", "snapshotName"] as const;
const INGREDIENT_KEYS = [
  "id",
  "name",
  "amount",
  "unit",
  "kcal",
  "protein",
  "fat",
  "carbs",
] as const;
const TOTALS_KEYS = ["protein", "fat", "carbs", "kcal"] as const;
const DRAFT_KEYS = ["name", "type", "ingredients", "totals", "notes", "tags"] as const;
const ESTIMATE_KEYS = ["state", "totals", "missingFields", "confidence"] as const;
const ITEM_KEYS = [
  "plannedMealId",
  "version",
  "dateBucket",
  "timeBucket",
  "sourceType",
  "sourceRef",
  "draftSnapshot",
  "nutritionEstimate",
  "status",
  "linkedMealId",
  "convertedAt",
  "conversionClientMutationId",
  "createdAt",
  "updatedAt",
] as const;
const QUERY_ECHO_KEYS = [
  "startDate",
  "days",
  "includeDeleted",
  "returnedItems",
] as const;
const LIST_RESPONSE_KEYS = ["items", "queryEcho"] as const;
const MUTATION_RESPONSE_KEYS = ["item", "updated"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
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

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requiredDate(value: unknown): string | null {
  const stringValue = requiredString(value);
  return stringValue && DATE_RE.test(stringValue) ? stringValue : null;
}

function normalizeTotals(raw: unknown): Nutrients | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, TOTALS_KEYS)) return null;
  const protein = finiteNumber(raw.protein);
  const fat = finiteNumber(raw.fat);
  const carbs = finiteNumber(raw.carbs);
  const kcal = finiteNumber(raw.kcal);
  if (protein === null || fat === null || carbs === null || kcal === null) {
    return null;
  }
  return { protein, fat, carbs, kcal };
}

function normalizeIngredient(raw: unknown): Ingredient | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, INGREDIENT_KEYS)) return null;
  const id = requiredString(raw.id);
  const name = requiredString(raw.name);
  const amount = finiteNumber(raw.amount);
  const kcal = finiteNumber(raw.kcal);
  const protein = finiteNumber(raw.protein);
  const fat = finiteNumber(raw.fat);
  const carbs = finiteNumber(raw.carbs);
  const unit = raw.unit === undefined ? undefined : raw.unit;
  if (
    !id ||
    !name ||
    amount === null ||
    kcal === null ||
    protein === null ||
    fat === null ||
    carbs === null ||
    (unit !== undefined && unit !== null && unit !== "g" && unit !== "ml")
  ) {
    return null;
  }
  return {
    id,
    name,
    amount,
    ...(unit ? { unit } : {}),
    kcal,
    protein,
    fat,
    carbs,
  };
}

function normalizeSourceRef(raw: unknown): PlannedMealSourceRef | null {
  if (raw === null) return null;
  if (!isRecord(raw) || !hasOnlyKeys(raw, SOURCE_REF_KEYS)) return null;
  const sourceId = requiredString(raw.sourceId);
  const sourceVersion =
    raw.sourceVersion === null ? null : positiveInteger(raw.sourceVersion);
  const hasValidSourceVersion =
    raw.sourceVersion === null || sourceVersion !== null;
  const snapshotName =
    raw.snapshotName === null ? null : optionalString(raw.snapshotName);
  const hasValidSnapshotName = raw.snapshotName === null || snapshotName !== null;
  if (!sourceId || !hasValidSourceVersion || !hasValidSnapshotName) return null;
  return { sourceId, sourceVersion, snapshotName };
}

function normalizeDraftSnapshot(raw: unknown): PlannedMealDraftSnapshot | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, DRAFT_KEYS)) return null;
  const name = raw.name === null ? null : optionalString(raw.name);
  const hasValidName = raw.name === null || name !== null;
  const type = isOneOf(raw.type, MEAL_TYPES) ? (raw.type as MealType) : null;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map(normalizeIngredient)
    : null;
  const totals = raw.totals === null ? null : normalizeTotals(raw.totals);
  const hasValidTotals = raw.totals === null || totals !== null;
  const notes = raw.notes === null ? null : optionalString(raw.notes);
  const hasValidNotes = raw.notes === null || notes !== null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => requiredString(tag))
    : null;
  if (
    !hasValidName ||
    !type ||
    !ingredients ||
    ingredients.some((item) => item === null) ||
    !hasValidTotals ||
    !hasValidNotes ||
    !tags ||
    tags.some((tag) => tag === null)
  ) {
    return null;
  }
  return {
    name,
    type,
    ingredients: ingredients as Ingredient[],
    totals,
    notes,
    tags: tags as string[],
  };
}

function normalizeNutritionEstimate(
  raw: unknown,
): PlannedMealNutritionEstimate | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ESTIMATE_KEYS)) return null;
  const state = isOneOf(raw.state, PLANNED_MEAL_ESTIMATE_STATES)
    ? raw.state
    : null;
  const totals = raw.totals === null ? null : normalizeTotals(raw.totals);
  const hasValidTotals = raw.totals === null || totals !== null;
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.map((field) =>
        isOneOf(field, PLANNED_MEAL_NUTRITION_FIELDS) ? field : null,
      )
    : null;
  const confidence =
    raw.confidence === null
      ? null
      : isOneOf(raw.confidence, PLANNED_MEAL_CONFIDENCE_LEVELS)
        ? raw.confidence
        : null;
  const hasValidConfidence = raw.confidence === null || confidence !== null;
  if (
    !state ||
    !hasValidTotals ||
    !missingFields ||
    missingFields.some((field) => field === null) ||
    !hasValidConfidence
  ) {
    return null;
  }
  if (state === "known" && (totals === null || missingFields.length > 0)) {
    return null;
  }
  if (state === "unknown" && totals !== null) {
    return null;
  }
  return {
    state,
    totals,
    missingFields: missingFields as PlannedMealNutritionField[],
    confidence,
  };
}

export function normalizePlannedMealItem(raw: unknown): PlannedMealItem | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ITEM_KEYS)) return null;
  const plannedMealId = requiredString(raw.plannedMealId);
  const version = positiveInteger(raw.version);
  const dateBucket = requiredDate(raw.dateBucket);
  const timeBucket =
    raw.timeBucket === null
      ? null
      : isOneOf(raw.timeBucket, PLANNED_MEAL_TIME_BUCKETS)
        ? raw.timeBucket
        : null;
  const hasValidTimeBucket = raw.timeBucket === null || timeBucket !== null;
  const sourceType = isOneOf(raw.sourceType, PLANNED_MEAL_SOURCE_TYPES)
    ? raw.sourceType
    : null;
  const sourceRef = normalizeSourceRef(raw.sourceRef);
  const hasValidSourceRef = raw.sourceRef === null || sourceRef !== null;
  const draftSnapshot = normalizeDraftSnapshot(raw.draftSnapshot);
  const nutritionEstimate = normalizeNutritionEstimate(raw.nutritionEstimate);
  const status = isOneOf(raw.status, PLANNED_MEAL_STATUSES)
    ? raw.status
    : null;
  const linkedMealId =
    raw.linkedMealId === undefined || raw.linkedMealId === null
      ? null
      : requiredString(raw.linkedMealId);
  const hasValidLinkedMealId =
    raw.linkedMealId === undefined ||
    raw.linkedMealId === null ||
    linkedMealId !== null;
  const convertedAt =
    raw.convertedAt === undefined || raw.convertedAt === null
      ? null
      : requiredString(raw.convertedAt);
  const hasValidConvertedAt =
    raw.convertedAt === undefined ||
    raw.convertedAt === null ||
    convertedAt !== null;
  const conversionClientMutationId =
    raw.conversionClientMutationId === undefined ||
    raw.conversionClientMutationId === null
      ? null
      : requiredString(raw.conversionClientMutationId);
  const hasValidConversionClientMutationId =
    raw.conversionClientMutationId === undefined ||
    raw.conversionClientMutationId === null ||
    conversionClientMutationId !== null;
  const createdAt = requiredString(raw.createdAt);
  const updatedAt = requiredString(raw.updatedAt);
  if (
    !plannedMealId ||
    !version ||
    !dateBucket ||
    !hasValidTimeBucket ||
    !sourceType ||
    !hasValidSourceRef ||
    !draftSnapshot ||
    !nutritionEstimate ||
    !status ||
    !hasValidLinkedMealId ||
    !hasValidConvertedAt ||
    !hasValidConversionClientMutationId ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    plannedMealId,
    version,
    dateBucket,
    timeBucket,
    sourceType,
    sourceRef,
    draftSnapshot,
    nutritionEstimate,
    status,
    linkedMealId,
    convertedAt,
    conversionClientMutationId,
    createdAt,
    updatedAt,
  };
}

function normalizeQueryEcho(raw: unknown): PlannedMealsListQueryEcho | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, QUERY_ECHO_KEYS)) return null;
  const startDate = requiredDate(raw.startDate);
  const days = positiveInteger(raw.days);
  const returnedItems = nonNegativeInteger(raw.returnedItems);
  if (
    !startDate ||
    days === null ||
    days > 3 ||
    typeof raw.includeDeleted !== "boolean" ||
    returnedItems === null
  ) {
    return null;
  }
  return {
    startDate,
    days,
    includeDeleted: raw.includeDeleted,
    returnedItems,
  };
}

export function normalizePlannedMealsListResponse(
  raw: unknown,
): PlannedMealsListResponse {
  if (!isRecord(raw) || !hasOnlyKeys(raw, LIST_RESPONSE_KEYS)) {
    throw new Error(INVALID_PLANNED_MEAL_RESPONSE);
  }
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizePlannedMealItem)
    : null;
  const queryEcho = normalizeQueryEcho(raw.queryEcho);
  if (!items || items.some((item) => item === null) || !queryEcho) {
    throw new Error(INVALID_PLANNED_MEAL_RESPONSE);
  }
  return {
    items: items as PlannedMealItem[],
    queryEcho,
  };
}

export function normalizePlannedMealMutationResponse(
  raw: unknown,
): PlannedMealMutationResponse {
  if (!isRecord(raw) || !hasOnlyKeys(raw, MUTATION_RESPONSE_KEYS)) {
    throw new Error(INVALID_PLANNED_MEAL_RESPONSE);
  }
  const item = normalizePlannedMealItem(raw.item);
  if (!item || typeof raw.updated !== "boolean") {
    throw new Error(INVALID_PLANNED_MEAL_RESPONSE);
  }
  return { item, updated: raw.updated };
}

function buildListQuery(params?: PlannedMealsListRequest) {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.days !== undefined) searchParams.set("days", String(params.days));
  if (params?.includeDeleted !== undefined) {
    searchParams.set("includeDeleted", String(params.includeDeleted));
  }
  const query = searchParams.toString();
  return query ? `${PLANNED_MEALS_ENDPOINT}?${query}` : PLANNED_MEALS_ENDPOINT;
}

function encodeId(value: string) {
  if (!value.trim() || value.includes("/")) {
    throw new Error("Invalid plannedMealId.");
  }
  return encodeURIComponent(value);
}

export async function fetchPlannedMealsRemote(
  params?: PlannedMealsListRequest,
  options?: RequestOptions,
): Promise<PlannedMealsListResponse> {
  requireRuntimeFeatureEnabled("planning");
  const raw = await get<unknown>(buildListQuery(params), options);
  return normalizePlannedMealsListResponse(raw);
}

export async function createPlannedMealRemote(
  payload: PlannedMealCreateRequest,
  options?: RequestOptions,
): Promise<PlannedMealMutationResponse> {
  requireRuntimeFeatureEnabled("planning");
  const raw = await post<unknown>(PLANNED_MEALS_ENDPOINT, payload, {
    retryMode: "idempotent",
    ...options,
  });
  return normalizePlannedMealMutationResponse(raw);
}

export async function updatePlannedMealRemote(
  plannedMealId: string,
  payload: PlannedMealUpdateRequest,
  options?: RequestOptions,
): Promise<PlannedMealMutationResponse> {
  requireRuntimeFeatureEnabled("planning");
  const raw = await patch<unknown>(
    `${PLANNED_MEALS_ENDPOINT}/${encodeId(plannedMealId)}`,
    payload,
    {
      retryMode: "idempotent",
      ...options,
    },
  );
  return normalizePlannedMealMutationResponse(raw);
}

export async function deletePlannedMealRemote(
  plannedMealId: string,
  payload: PlannedMealDeleteRequest,
  options?: RequestOptions,
): Promise<PlannedMealMutationResponse> {
  requireRuntimeFeatureEnabled("planning");
  const searchParams = new URLSearchParams({
    clientMutationId: payload.clientMutationId,
    expectedVersion: String(payload.expectedVersion),
  });
  const raw = await request<unknown>(
    "DELETE",
    `${PLANNED_MEALS_ENDPOINT}/${encodeId(plannedMealId)}?${searchParams.toString()}`,
    undefined,
    {
      retryMode: "idempotent",
      ...options,
    },
  );
  return normalizePlannedMealMutationResponse(raw);
}
