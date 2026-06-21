import type { Meal, MealImageRef } from "@/types/meal";
import type { MealDocument } from "@/types/mealDocument";
import { get, post } from "@/services/core/apiClient";
import { updateMyMealRemote } from "@/services/meals/myMealsRepository";
import {
  normalizeMealAiMeta,
  normalizeMealInputMethod,
} from "@/services/meals/mealMetadata";
import { requirePlanningEnabledForMeal } from "@/services/meals/planningSourceGuard";

export type MealHistoryFilters = {
  calories?: [number, number];
  protein?: [number, number];
  carbs?: [number, number];
  fat?: [number, number];
  dateRange?: { start: Date; end: Date };
};

export type MealsRemoteCursor = string | null;

export type MealsRemotePage = {
  items: Meal[];
  nextCursor: MealsRemoteCursor;
};

type MealsRemoteResponse = {
  items?: unknown[];
  nextCursor?: string | null;
};

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeTotalsFromIngredients(meal: Partial<Meal>) {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  return {
    kcal: ingredients.reduce((sum, item) => sum + toFiniteNumber(item?.kcal), 0),
    protein: ingredients.reduce(
      (sum, item) => sum + toFiniteNumber(item?.protein),
      0,
    ),
    carbs: ingredients.reduce((sum, item) => sum + toFiniteNumber(item?.carbs), 0),
    fat: ingredients.reduce((sum, item) => sum + toFiniteNumber(item?.fat), 0),
  };
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function parseImageRef(raw: unknown): MealImageRef | null {
  const imageRef = asMap(raw);
  if (!imageRef) return null;
  const imageId = String(imageRef.imageId || "").trim();
  const storagePath = String(imageRef.storagePath || "").trim();
  if (!imageId || !storagePath) return null;
  const downloadUrl =
    typeof imageRef.downloadUrl === "string" && imageRef.downloadUrl.trim().length > 0
      ? imageRef.downloadUrl.trim()
      : null;
  return {
    imageId,
    storagePath,
    downloadUrl,
  };
}

function parsePlanningSource(raw: unknown): Meal["planningSource"] {
  const source = asMap(raw);
  if (!source) return null;

  const plannedMealId = String(source.plannedMealId || "").trim();
  const plannedMealVersion = Number(source.plannedMealVersion);
  const sourceType = source.sourceType;
  const nutritionEstimateState = source.nutritionEstimateState;
  if (
    !plannedMealId ||
    !Number.isInteger(plannedMealVersion) ||
    plannedMealVersion < 1 ||
    !(
      sourceType === "manual" ||
      sourceType === "saved_meal" ||
      sourceType === "recipe" ||
      sourceType === "ingredient_product_draft"
    ) ||
    !(
      nutritionEstimateState === "known" ||
      nutritionEstimateState === "partial" ||
      nutritionEstimateState === "unknown"
    )
  ) {
    return null;
  }

  const sourceRefMap = asMap(source.sourceRef);
  const sourceRef = sourceRefMap
    ? {
        sourceId: String(sourceRefMap.sourceId || "").trim(),
        sourceVersion:
          typeof sourceRefMap.sourceVersion === "number"
            ? sourceRefMap.sourceVersion
            : null,
        snapshotName:
          typeof sourceRefMap.snapshotName === "string"
            ? sourceRefMap.snapshotName
            : null,
      }
    : null;
  const validSourceRef = sourceRef?.sourceId ? sourceRef : null;
  const missingNutritionFields = Array.isArray(source.missingNutritionFields)
    ? source.missingNutritionFields.filter(
        (field): field is "kcal" | "protein" | "fat" | "carbs" =>
          field === "kcal" ||
          field === "protein" ||
          field === "fat" ||
          field === "carbs",
      )
    : [];

  return {
    plannedMealId,
    plannedMealVersion,
    sourceType,
    sourceRef: validSourceRef,
    nutritionEstimateState,
    missingNutritionFields,
  };
}

function normalizeMeal(raw: unknown, uid: string): Meal | null {
  const doc = raw as Partial<MealDocument> & Partial<Meal>;
  const id = String(doc.id || doc.cloudId || doc.mealId || "").trim();
  const loggedAt = String(doc.loggedAt || doc.timestamp || "").trim();
  const updatedAt = String(doc.updatedAt || "").trim();
  if (!id || !loggedAt || !updatedAt) {
    return null;
  }

  const type = doc.type;
  const normalizedType =
    type === "breakfast" ||
    type === "lunch" ||
    type === "dinner" ||
    type === "snack" ||
    type === "other"
      ? type
      : "other";

  const ownerUid = String(uid || "").trim();
  const imageRef =
    parseImageRef(doc.imageRef) ||
    (typeof doc.imageId === "string" && doc.imageId.trim().length > 0
      ? {
          imageId: doc.imageId.trim(),
          ...(ownerUid
            ? { storagePath: `meals/${ownerUid}/${doc.imageId.trim()}.jpg` }
            : {}),
          downloadUrl:
            typeof doc.photoUrl === "string" && doc.photoUrl.trim().length > 0
              ? doc.photoUrl.trim()
              : null,
        }
      : null);

  const totals =
    doc.totals && typeof doc.totals === "object"
      ? {
          kcal: toFiniteNumber(doc.totals.kcal),
          protein: toFiniteNumber(doc.totals.protein),
          carbs: toFiniteNumber(doc.totals.carbs),
          fat: toFiniteNumber(doc.totals.fat),
        }
      : computeTotalsFromIngredients(doc);

  return {
    userUid: uid,
    mealId: id,
    cloudId: id,
    timestamp: loggedAt,
    dayKey: typeof doc.dayKey === "string" ? doc.dayKey : null,
    loggedAtLocalMin:
      typeof doc.loggedAtLocalMin === "number" ? doc.loggedAtLocalMin : null,
    tzOffsetMin:
      typeof doc.tzOffsetMin === "number" ? doc.tzOffsetMin : null,
    type: normalizedType,
    name: typeof doc.name === "string" ? doc.name : null,
    ingredients: Array.isArray(doc.ingredients) ? doc.ingredients : [],
    createdAt: String(doc.createdAt || loggedAt),
    updatedAt,
    syncState: "synced",
    source:
      doc.source === "ai" || doc.source === "manual" || doc.source === "saved"
        ? doc.source
        : null,
    inputMethod: normalizeMealInputMethod(doc.inputMethod),
    aiMeta: normalizeMealAiMeta(doc.aiMeta),
    imageId: imageRef?.imageId ?? null,
    photoUrl: imageRef?.downloadUrl ?? null,
    planningSource: parsePlanningSource(doc.planningSource),
    notes: typeof doc.notes === "string" ? doc.notes : null,
    tags: Array.isArray(doc.tags)
      ? doc.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    deleted: Boolean(doc.deleted),
    totals,
  };
}

function toMealsPage(payload: unknown, uid: string): MealsRemotePage {
  const page = (payload || {}) as MealsRemoteResponse;
  const items = Array.isArray(page.items)
    ? page.items
        .map((item) => normalizeMeal(item, uid))
        .filter((item): item is Meal => item !== null)
    : [];

  return {
    items,
    nextCursor:
      typeof page.nextCursor === "string" && page.nextCursor.trim().length > 0
        ? page.nextCursor
        : null,
  };
}

function appendRangeParams(
  params: URLSearchParams,
  key: "calories" | "protein" | "carbs" | "fat",
  value?: [number, number],
) {
  if (!value) return;
  params.set(`${key}Min`, String(value[0]));
  params.set(`${key}Max`, String(value[1]));
}

function buildHistoryPath(input: {
  pageSize: number;
  cursor: MealsRemoteCursor;
  filters?: MealHistoryFilters;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.pageSize));
  if (input.cursor) {
    params.set("beforeCursor", input.cursor);
  }

  appendRangeParams(params, "calories", input.filters?.calories);
  appendRangeParams(params, "protein", input.filters?.protein);
  appendRangeParams(params, "carbs", input.filters?.carbs);
  appendRangeParams(params, "fat", input.filters?.fat);

  if (input.filters?.dateRange) {
    params.set("loggedAtStart", input.filters.dateRange.start.toISOString());
    params.set("loggedAtEnd", input.filters.dateRange.end.toISOString());
  }

  return `/users/me/meals/history?${params.toString()}`;
}

export function extractMealTimestampCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  const normalized = cursor.trim();
  if (!normalized) return null;
  const pipeIndex = normalized.lastIndexOf("|");
  return pipeIndex === -1 ? normalized : normalized.slice(0, pipeIndex);
}

export function buildMealUpdatedCursor(
  meal: Pick<Meal, "updatedAt" | "cloudId">,
): string {
  return `${meal.updatedAt}|${meal.cloudId || meal.updatedAt}`;
}

export async function fetchMealsPageRemote(params: {
  uid: string;
  pageSize: number;
  cursor: MealsRemoteCursor;
  filters?: MealHistoryFilters;
}): Promise<MealsRemotePage> {
  const response = await get<MealsRemoteResponse>(
    buildHistoryPath({
      pageSize: params.pageSize,
      cursor: params.cursor,
      filters: params.filters,
    }),
  );
  return toMealsPage(response, params.uid);
}

export async function fetchMealChangesRemote(params: {
  uid: string;
  pageSize: number;
  cursor: MealsRemoteCursor;
}): Promise<MealsRemotePage> {
  const query = new URLSearchParams();
  query.set("limit", String(params.pageSize));
  if (params.cursor) {
    query.set("afterCursor", params.cursor);
  }

  const response = await get<MealsRemoteResponse>(
    `/users/me/meals/changes?${query.toString()}`,
  );
  return toMealsPage(response, params.uid);
}

function toMealDocumentPayload(meal: Meal, ownerUid: string): MealDocument {
  const id = String(meal.cloudId || meal.mealId || "").trim();
  const imageId =
    typeof meal.imageId === "string" && meal.imageId.trim().length > 0
      ? meal.imageId.trim()
      : null;
  const uid = String(meal.userUid || ownerUid || "").trim();
  const downloadUrl =
    typeof meal.photoUrl === "string" && /^https?:\/\//i.test(meal.photoUrl)
      ? meal.photoUrl
      : null;

  const imageRef = imageId
    ? {
        imageId,
        ...(uid ? { storagePath: `meals/${uid}/${imageId}.jpg` } : {}),
        downloadUrl,
      }
    : null;

  return {
    id,
    loggedAt: meal.timestamp,
    dayKey: meal.dayKey ?? null,
    loggedAtLocalMin: meal.loggedAtLocalMin ?? null,
    tzOffsetMin: meal.tzOffsetMin ?? null,
    type: meal.type,
    name: meal.name ?? null,
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt,
    source: meal.source,
    inputMethod: normalizeMealInputMethod(meal.inputMethod),
    aiMeta: normalizeMealAiMeta(meal.aiMeta),
    imageRef,
    planningSource: meal.planningSource ?? null,
    notes: meal.notes ?? null,
    tags: Array.isArray(meal.tags) ? meal.tags : [],
    deleted: Boolean(meal.deleted),
    totals: meal.totals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

export async function saveMealRemote(params: {
  uid: string;
  meal: Meal;
  clientMutationId: string;
  alsoSaveToMyMeals?: boolean;
}): Promise<void> {
  requirePlanningEnabledForMeal(params.meal);

  const payload = {
    ...toMealDocumentPayload(params.meal, params.uid),
    clientMutationId: params.clientMutationId,
  };
  await post("/users/me/meals", payload);
  if (params.alsoSaveToMyMeals) {
    await updateMyMealRemote(
      params.uid,
      params.meal.mealId,
      {
        ...payload,
        source: "saved",
      },
      `${params.clientMutationId}:my-meal-upsert`,
    );
  }
}

export async function markMealDeletedRemote(
  uid: string,
  cloudId: string,
  updatedAt: string,
  options: { clientMutationId: string },
): Promise<void> {
  void uid;
  await post(`/users/me/meals/${encodeURIComponent(cloudId)}/delete`, {
    updatedAt,
    clientMutationId: options.clientMutationId,
  });
}
