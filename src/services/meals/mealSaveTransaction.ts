import { v4 as uuidv4 } from "uuid";
import type { Meal } from "@/types/meal";
import { emit } from "@/services/core/events";
import { insertOrUpdateImage } from "@/services/offline/images.repo";
import { upsertMealLocal } from "@/services/offline/meals.repo";
import { enqueueUpsert } from "@/services/offline/queue.repo";
import {
  deriveMealTimingMetadata,
  formatMealDayKey,
} from "@/services/meals/mealMetadata";
import { upsertMyMealWithPhoto } from "@/services/meals/myMealService";
import { requirePlanningEnabledForMeal } from "@/services/meals/planningSourceGuard";
import { trackMealLogged } from "@/services/telemetry/telemetryInstrumentation";

export type SavedMealTemplateSave =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "update"; templateId: string };

export type SaveMealTransactionOperation = "create" | "update";

export type SaveMealTransactionInput = {
  uid: string;
  meal: Meal;
  operation?: SaveMealTransactionOperation;
  savedTemplate?: SavedMealTemplateSave;
  nowISO?: string;
  onLocalCommitted?: (meal: Meal) => void;
};

export type SaveMealTransactionResult = {
  meal: Meal;
};

function computeTotals(meal: Pick<Meal, "ingredients" | "totals">) {
  const ing = meal.ingredients || [];
  if (ing.length === 0 && meal.totals) {
    return {
      kcal: Number(meal.totals.kcal) || 0,
      protein: Number(meal.totals.protein) || 0,
      carbs: Number(meal.totals.carbs) || 0,
      fat: Number(meal.totals.fat) || 0,
    };
  }
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") =>
    ing.reduce((a, b) => a + (Number(b?.[k]) || 0), 0);
  return {
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
  };
}

function isLocalUri(u?: string | null): u is string {
  if (!u || typeof u !== "string") return false;
  return u.startsWith("file://") || u.startsWith("content://");
}

function omitDraftOnlyFields(meal: Meal): Meal {
  const { savedMealRefId: _savedMealRefId, ...persistable } = meal;
  return persistable;
}

function resolveCanonicalMealId(meal: Meal): string {
  const savedTemplateId =
    meal.source === "saved" && meal.savedMealRefId ? meal.savedMealRefId : null;
  const candidates = [meal.cloudId, meal.mealId].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    if (candidate !== savedTemplateId) {
      return candidate;
    }
  }

  return uuidv4();
}

function resolveMealTimestamp(
  timestamp: string | null | undefined,
  nowISO: string,
): string {
  if (!timestamp) return nowISO;
  return Number.isNaN(new Date(timestamp).getTime()) ? nowISO : timestamp;
}

function withCanonicalMealFields(params: {
  uid: string;
  meal: Meal;
  nowISO: string;
}): Meal {
  const { meal, nowISO, uid } = params;
  const cloudId = resolveCanonicalMealId(meal);
  const timestamp = resolveMealTimestamp(meal.timestamp, nowISO);
  const timingMetadata = deriveMealTimingMetadata(timestamp);
  const dayKey =
    formatMealDayKey(new Date(timestamp)) ??
    formatMealDayKey(new Date(nowISO));

  return {
    ...omitDraftOnlyFields(meal),
    userUid: uid,
    cloudId,
    mealId:
      meal.mealId && meal.mealId !== meal.savedMealRefId
        ? meal.mealId
        : cloudId,
    timestamp,
    dayKey: dayKey ?? nowISO.slice(0, 10),
    loggedAtLocalMin: timingMetadata.loggedAtLocalMin,
    tzOffsetMin: timingMetadata.tzOffsetMin,
    type: meal.type || "other",
    name: meal.name,
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
    createdAt: meal.createdAt ?? nowISO,
    updatedAt: nowISO,
    syncState: "pending",
    deleted: false,
    source: meal.source ?? "manual",
    inputMethod:
      meal.inputMethod ??
      (meal.source === "manual" || meal.source === null
        ? "manual"
        : meal.source === "saved"
          ? "manual"
          : null),
    totals: computeTotals(meal),
  };
}

async function maybeSaveTemplate(params: {
  uid: string;
  meal: Meal;
  savedTemplate: SavedMealTemplateSave;
}): Promise<void> {
  const { uid, meal, savedTemplate } = params;
  if (savedTemplate.mode === "none") return;

  const templateId =
    savedTemplate.mode === "update"
      ? savedTemplate.templateId
      : meal.mealId || meal.cloudId;
  if (!templateId) return;

  const localPhoto = isLocalUri(meal.photoUrl) ? meal.photoUrl : null;
  await upsertMyMealWithPhoto(
    uid,
    {
      ...meal,
      userUid: uid,
      mealId: templateId,
      cloudId: templateId,
      source: "saved",
      inputMethod: meal.inputMethod ?? "manual",
    },
    localPhoto,
  );
}

export async function saveMealTransaction(
  input: SaveMealTransactionInput,
): Promise<SaveMealTransactionResult> {
  requirePlanningEnabledForMeal(input.meal);

  const nowISO = input.nowISO ?? new Date().toISOString();
  const operation = input.operation ?? "create";
  const meal = withCanonicalMealFields({
    uid: input.uid,
    meal: input.meal,
    nowISO,
  });

  const maybeUri = meal.photoUrl;
  if (isLocalUri(maybeUri)) {
    meal.photoLocalPath = maybeUri;
    await insertOrUpdateImage(
      input.uid,
      meal.cloudId!,
      meal.photoLocalPath,
      "pending",
    );
  }

  await upsertMealLocal(meal);
  input.onLocalCommitted?.(meal);
  emit(operation === "update" ? "meal:updated" : "meal:added", {
    uid: input.uid,
    meal,
  });
  await enqueueUpsert(input.uid, meal);
  if (operation === "create") {
    void trackMealLogged(meal);
  }

  await maybeSaveTemplate({
    uid: input.uid,
    meal,
    savedTemplate: input.savedTemplate ?? { mode: "none" },
  });

  return { meal };
}
