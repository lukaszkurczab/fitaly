import { v4 as uuidv4 } from "uuid";
import type { Meal } from "@/types/meal";
import {
  deriveMealTimingMetadata,
  formatMealDayKey,
} from "@/services/meals/mealMetadata";

export function buildSavedMealDraft(params: {
  picked: Meal;
  uid: string;
  mealId?: string;
  createdAt?: string | null;
}): Meal {
  const { picked, uid, mealId = uuidv4(), createdAt } = params;
  const now = new Date().toISOString();
  const timestamp = now;
  const timing = deriveMealTimingMetadata(timestamp);
  const savedMealRefId = picked.cloudId || picked.mealId || null;

  return {
    mealId,
    cloudId: undefined,
    savedMealRefId,
    userUid: uid,
    name: picked.name ?? null,
    photoLocalPath: picked.photoLocalPath ?? picked.localPhotoUrl ?? null,
    localPhotoUrl: picked.localPhotoUrl ?? picked.photoLocalPath ?? null,
    photoUrl:
      picked.photoLocalPath ??
      picked.localPhotoUrl ??
      picked.photoUrl ??
      null,
    imageId: picked.imageId ?? null,
    ingredients: Array.isArray(picked.ingredients)
      ? picked.ingredients.map((ingredient) => ({
          ...ingredient,
          id: ingredient.id || uuidv4(),
        }))
      : [],
    createdAt: createdAt && createdAt.trim().length > 0 ? createdAt : now,
    updatedAt: now,
    syncState: "pending",
    tags: Array.isArray(picked.tags) ? [...picked.tags] : [],
    deleted: false,
    notes: picked.notes ?? null,
    type: picked.type || "other",
    timestamp,
    dayKey: formatMealDayKey(new Date(timestamp)),
    loggedAtLocalMin: timing.loggedAtLocalMin,
    tzOffsetMin: timing.tzOffsetMin,
    source: "saved",
    inputMethod: "manual",
    aiMeta: null,
    totals: picked.totals ? { ...picked.totals } : undefined,
  };
}
