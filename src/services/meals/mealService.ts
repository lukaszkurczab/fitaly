import * as FileSystem from "@/services/core/fileSystem";
import type { Meal } from "@/types/meal";
import {
  ensureLocalMealPhoto,
  localPhotoPath,
} from "./mealService.images";
import {
  getMealsPageLocalFiltered,
  type LocalHistoryFilters,
} from "@/services/offline/meals.repo";
import {
  markMealDeletedRemote,
  type MealHistoryFilters,
} from "@/services/meals/mealsRepository";
import {
  getLocalMealsSnapshot,
  subscribeLocalMeals,
} from "@/services/meals/localMealsStore";
export const FREE_WINDOW_DAYS = 30;
export type HistoryFilters = MealHistoryFilters;

export type MealsPageV2 = {
  items: Meal[];
  nextCursor: string | null;
};

function clampDateRange(
  input: HistoryFilters["dateRange"] | undefined,
  accessWindowDays?: number
): HistoryFilters["dateRange"] | undefined {
  if (!accessWindowDays || accessWindowDays <= 0) return input;
  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setDate(now.getDate() - accessWindowDays + 1);
  startWindow.setHours(0, 0, 0, 0);
  const endWindow = new Date(now);
  endWindow.setHours(23, 59, 59, 999);
  if (!input) return { start: startWindow, end: endWindow };
  const s = new Date(input.start);
  const e = new Date(input.end);
  const start = s < startWindow ? startWindow : s;
  const end = e > endWindow ? endWindow : e;
  if (start > end) return { start: new Date(0), end: new Date(0) };
  return { start, end };
}

export async function getMealsPageFiltered(
  uid: string,
  opts: {
    limit: number;
    cursor: string | null;
    filters?: HistoryFilters;
    accessWindowDays?: number;
  }
): Promise<MealsPageV2> {
  const effectiveFilters: HistoryFilters | undefined = (() => {
    const f = { ...(opts.filters || {}) };
    f.dateRange = clampDateRange(f.dateRange, opts.accessWindowDays);
    return f;
  })();

  const localFilters: LocalHistoryFilters | undefined = effectiveFilters
    ? {
        calories: effectiveFilters.calories,
        protein: effectiveFilters.protein,
        carbs: effectiveFilters.carbs,
        fat: effectiveFilters.fat,
        dateRange: effectiveFilters.dateRange
          ? {
              start: new Date(effectiveFilters.dateRange.start),
              end: new Date(effectiveFilters.dateRange.end),
            }
          : undefined,
      }
    : undefined;

  const page = await getMealsPageLocalFiltered(uid, {
    limit: opts.limit,
    cursor: opts.cursor,
    filters: localFilters,
  });

  return { items: page.items, nextCursor: page.nextCursor };
}

export function subscribeMeals(
  uid: string,
  cb: (items: Meal[]) => void
): () => void {
  return subscribeLocalMeals(uid, () => {
    cb(getLocalMealsSnapshot(uid).meals);
  });
}

export async function deleteMealInFirestore(uid: string, cloudId: string) {
  const updatedAt = new Date().toISOString();
  await markMealDeletedRemote(uid, cloudId, updatedAt, {
    clientMutationId: `direct-delete:${uid}:${cloudId}:${updatedAt}`,
  });
}

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists)
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export async function restoreMissingMealPhotos(
  uid: string,
  meals: Meal[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!uid || !Array.isArray(meals) || meals.length === 0) return out;
  const baseDir = `${FileSystem.documentDirectory}meals/${uid}`;
  await ensureDir(baseDir);

  for (const m of meals) {
    const id = String(m.cloudId || m.mealId || "").trim();
    if (!id) continue;

    const target = localPhotoPath(uid, id);
    const info = await FileSystem.getInfoAsync(target);
    if (info.exists) {
      out[id] = target;
      continue;
    }

    const local = await ensureLocalMealPhoto({
      uid,
      cloudId: m.cloudId ?? null,
      imageId: m.imageId ?? null,
      photoUrl: m.photoUrl ?? null,
    });

    if (local) out[id] = local;
  }
  return out;
}
