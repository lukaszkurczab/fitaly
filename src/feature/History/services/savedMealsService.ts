import * as FileSystem from "@/services/core/fileSystem";
import type { Meal, MealType } from "@/types/meal";
import { emit } from "@/services/core/events";
import {
  enqueueMyMealDelete,
  enqueueMyMealUpsert,
} from "@/services/offline/queue.repo";
import {
  fetchMyMealsPage,
  subscribeToMyMealsFirstPage,
  type MyMealsCursor,
} from "@/services/meals/myMealsRepository";
import {
  markDeletedMyMealLocal,
  upsertMyMealLocal,
} from "@/services/offline/myMeals.repo";
import { syncMyMeals } from "@/services/meals/myMealService";

type ToastEvent = { key: string; ns?: string };
export type SavedMealsCursor = MyMealsCursor;

export type SavedMealsPage = {
  items: Meal[];
  lastDoc: SavedMealsCursor;
  hasMore: boolean;
};

async function normalizeSavedMealPhotos(meals: Meal[]): Promise<Meal[]> {
  const normalized: Meal[] = [];

  for (const meal of meals) {
    const localUri =
      meal.photoLocalPath ??
      (meal.photoUrl?.startsWith("file://") ? meal.photoUrl : null);

    if (!localUri) {
      normalized.push(meal);
      continue;
    }

    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) {
        normalized.push({
          ...meal,
          photoLocalPath: localUri,
          photoUrl: meal.photoUrl ?? localUri,
        });
        continue;
      }
    } catch {
      // Ignore and clear stale local path below.
    }

    const sanitized = {
      ...meal,
      photoUrl: meal.photoUrl?.startsWith("file://") ? null : meal.photoUrl ?? null,
      photoLocalPath: null,
    };
    await upsertMyMealLocal(sanitized);
    normalized.push(sanitized);
  }

  return normalized;
}

export function subscribeSavedMealsFirstPage(params: {
  uid: string;
  pageSize: number;
  onData: (page: SavedMealsPage) => void | Promise<void>;
  onError: () => void;
}): () => void {
  return subscribeToMyMealsFirstPage({
    uid: params.uid,
    pageSize: params.pageSize,
    onData: async (page) => {
      try {
        const normalized = await normalizeSavedMealPhotos(
          page.items.filter((meal) => !meal.deleted),
        );
        await params.onData({
          items: normalized,
          lastDoc: page.lastDoc,
          hasMore: page.hasMore,
        });
      } catch {
        params.onError();
      }
    },
    onError: params.onError,
  });
}

export async function fetchSavedMealsPage(params: {
  uid: string;
  pageSize: number;
  lastDoc: Exclude<SavedMealsCursor, null>;
}): Promise<SavedMealsPage> {
  const page = await fetchMyMealsPage({
    uid: params.uid,
    pageSize: params.pageSize,
    lastDoc: params.lastDoc,
  });
  const normalized = await normalizeSavedMealPhotos(
    page.items.filter((meal) => !meal.deleted),
  );

  return {
    items: normalized,
    lastDoc: page.lastDoc,
    hasMore: page.hasMore,
  };
}

export async function deleteSavedMeal(params: {
  uid: string;
  cloudId: string;
  isOnline: boolean;
  nowISO?: string;
}): Promise<"deleted" | "queued"> {
  const nowISO = params.nowISO ?? new Date().toISOString();
  await markDeletedMyMealLocal(params.cloudId, nowISO);
  await enqueueMyMealDelete(params.uid, params.cloudId, nowISO);

  if (!params.isOnline) {
    emit<ToastEvent>("ui:toast", {
      key: "toast.savedMealDeleteQueued",
      ns: "common",
    });
    return "queued";
  }

  try {
    await syncMyMeals(params.uid);
    return "deleted";
  } catch {
    return "queued";
  }
}

export async function updateSavedMeal(params: {
  uid: string;
  cloudId: string;
  meal: Meal;
  name: string;
  type: MealType;
  timestampISO: string;
  createdAtISO: string;
  nowISO?: string;
}): Promise<void> {
  const nowISO = params.nowISO ?? new Date().toISOString();

  const payload: Meal = {
    ...params.meal,
    userUid: params.uid,
    mealId: params.cloudId,
    cloudId: params.cloudId,
    name: params.name,
    type: params.type,
    timestamp: params.timestampISO,
    createdAt: params.createdAtISO,
    updatedAt: nowISO,
    syncState: "pending",
    source: "saved",
  };

  await upsertMyMealLocal(payload);
  await enqueueMyMealUpsert(params.uid, payload);
  await syncMyMeals(params.uid);
}
