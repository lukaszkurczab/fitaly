import { getDB } from "./db";
import type { Meal, MealImageRef } from "@/types/meal";
import type { MealRow } from "./types";
import { emit } from "@/services/core/events";
import {
  normalizeMealInputMethod,
  parseMealAiMeta,
  serializeMealAiMeta,
} from "@/services/meals/mealMetadata";

function toEpochMs(value?: string | null): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeMealSyncState(value: Meal["syncState"]): Meal["syncState"] {
  if (value === "synced") return "synced";
  if (value === "failed") return "failed";
  if (value === "conflict") return "conflict";
  return "pending";
}

function toDayKey(value?: string | null): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MEAL_TYPES: Meal["type"][] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
];

function parseMealType(value: string | null): Meal["type"] {
  if (value && MEAL_TYPES.includes(value as Meal["type"])) {
    return value as Meal["type"];
  }
  return "other";
}

function parseMealSource(value: string | null): Meal["source"] {
  if (value === "ai" || value === "manual" || value === "saved") return value;
  return "saved";
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function parseIngredients(raw: string | null): Meal["ingredients"] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Meal["ingredients"]) : [];
  } catch {
    return [];
  }
}

function parseMealSyncState(raw: string | null | undefined): Meal["syncState"] {
  if (
    raw === "synced" ||
    raw === "pending" ||
    raw === "conflict" ||
    raw === "failed"
  ) {
    return raw;
  }
  return "pending";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseImageRef(
  raw: string | null | undefined,
  uid: string,
): MealImageRef | null {
  if (!raw) return null;
  try {
    const parsed = asRecord(JSON.parse(raw) as unknown);
    if (!parsed) return null;
    const imageId = typeof parsed.imageId === "string" ? parsed.imageId.trim() : "";
    if (!imageId) return null;
    const parsedStoragePath =
      typeof parsed.storagePath === "string" && parsed.storagePath.trim()
        ? parsed.storagePath.trim()
        : null;
    const storagePath = isUserScopedSavedMealStoragePath(parsedStoragePath, uid)
      ? parsedStoragePath
      : null;
    const downloadUrl =
      typeof parsed.downloadUrl === "string" && parsed.downloadUrl.trim()
        ? parsed.downloadUrl.trim()
        : null;
    return {
      imageId,
      ...(storagePath ? { storagePath } : {}),
      downloadUrl,
    };
  } catch {
    return null;
  }
}

function isUserScopedSavedMealStoragePath(
  storagePath: string | null | undefined,
  uid: string,
): storagePath is string {
  return Boolean(storagePath && uid && storagePath.startsWith(`myMeals/${uid}/`));
}

function normalizeImageRef(meal: Meal): MealImageRef | null {
  const incomingImageId =
    typeof meal.imageRef?.imageId === "string" && meal.imageRef.imageId.trim()
      ? meal.imageRef.imageId.trim()
      : null;
  const legacyImageId =
    typeof meal.imageId === "string" && meal.imageId.trim()
      ? meal.imageId.trim()
      : null;
  const imageId = incomingImageId ?? legacyImageId;
  if (!imageId) return null;

  const storagePath = isUserScopedSavedMealStoragePath(
    meal.imageRef?.storagePath,
    meal.userUid,
  )
    ? meal.imageRef.storagePath
    : null;
  const downloadUrl =
    typeof meal.imageRef?.downloadUrl === "string" && meal.imageRef.downloadUrl.trim()
      ? meal.imageRef.downloadUrl.trim()
      : typeof meal.photoUrl === "string" &&
          /^https?:\/\//i.test(meal.photoUrl) &&
          meal.photoUrl.trim()
        ? meal.photoUrl.trim()
        : null;

  return {
    imageId,
    ...(storagePath ? { storagePath } : {}),
    downloadUrl,
  };
}

function serializeImageRef(meal: Meal): string | null {
  const imageRef = normalizeImageRef(meal);
  return imageRef ? JSON.stringify(imageRef) : null;
}

function rowToMeal(row: MealRow): Meal {
  const localPath = row.image_local ?? null;
  const imageRef = parseImageRef(row.image_ref, row.user_uid);
  const imageId = imageRef?.imageId ?? row.image_id ?? null;
  return {
    userUid: row.user_uid,
    mealId: row.meal_id,
    timestamp: row.timestamp,
    dayKey: toDayKey(row.day_key ?? row.timestamp),
    loggedAtLocalMin:
      typeof row.logged_at_local_min === "number"
        ? Number(row.logged_at_local_min)
        : null,
    tzOffsetMin:
      typeof row.tz_offset_min === "number" ? Number(row.tz_offset_min) : null,
    type: parseMealType(row.type),
    name: row.name,
    ingredients: parseIngredients(row.ingredients),
    createdAt: row.created_at ?? row.timestamp ?? row.updated_at,
    updatedAt: row.updated_at,
    lastSyncedAt: Number(row.last_synced_at ?? 0),
    syncState: parseMealSyncState(row.sync_state),
    source: parseMealSource(row.source),
    inputMethod: normalizeMealInputMethod(row.input_method),
    aiMeta: parseMealAiMeta(row.ai_meta),
    imageRef,
    imageId,
    photoUrl: imageRef?.downloadUrl ?? row.photo_url ?? null,
    photoLocalPath: localPath,
    localPhotoUrl: localPath,
    notes: row.notes ?? null,
    tags: parseTags(row.tags),
    deleted: Number(row.deleted ?? 0) === 1,
    cloudId: row.cloud_id ?? undefined,
    totals: {
      kcal: Number(row.totals_kcal ?? 0),
      protein: Number(row.totals_protein ?? 0),
      carbs: Number(row.totals_carbs ?? 0),
      fat: Number(row.totals_fat ?? 0),
    },
  };
}

export async function upsertMyMealLocal(meal: Meal): Promise<void> {
  const db = getDB();
  const cloudId = meal.cloudId ?? meal.mealId;
  const tags = JSON.stringify(meal.tags || []);
  const ingredients = JSON.stringify(
    Array.isArray(meal.ingredients) ? meal.ingredients : []
  );
  const aiMeta = serializeMealAiMeta(meal.aiMeta);
  const imageRef = serializeImageRef(meal);
  const createdAt = meal.createdAt ?? meal.timestamp ?? meal.updatedAt;
  const syncState = normalizeMealSyncState(meal.syncState);
  const lastSyncedAt = syncState === "synced" ? toEpochMs(meal.updatedAt) : 0;
  const localPath = meal.photoLocalPath ?? (meal.photoUrl?.startsWith("file:") ? meal.photoUrl : null);

  db.runSync(
    `INSERT INTO my_meals (
      cloud_id, meal_id, user_uid, timestamp, day_key, logged_at_local_min, tz_offset_min, type, name,
      ingredients,
      photo_url, image_local, image_id, image_ref,
      totals_kcal, totals_protein, totals_carbs, totals_fat,
      deleted, created_at, updated_at, last_synced_at, sync_state, source, input_method, ai_meta, notes, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cloud_id) DO UPDATE SET
      meal_id=excluded.meal_id,
      timestamp=excluded.timestamp,
      day_key=excluded.day_key,
      logged_at_local_min=excluded.logged_at_local_min,
      tz_offset_min=excluded.tz_offset_min,
      type=excluded.type,
      name=excluded.name,
      ingredients=excluded.ingredients,
      photo_url=COALESCE(excluded.photo_url, photo_url),
      image_local=COALESCE(excluded.image_local, image_local),
      image_id=COALESCE(excluded.image_id, image_id),
      image_ref=excluded.image_ref,
      totals_kcal=excluded.totals_kcal,
      totals_protein=excluded.totals_protein,
      totals_carbs=excluded.totals_carbs,
      totals_fat=excluded.totals_fat,
      deleted=excluded.deleted,
      created_at=COALESCE(excluded.created_at, created_at),
      updated_at=excluded.updated_at,
      last_synced_at=CASE
        WHEN excluded.sync_state='synced' THEN excluded.last_synced_at
        ELSE my_meals.last_synced_at
      END,
      sync_state=excluded.sync_state,
      source=excluded.source,
      input_method=excluded.input_method,
      ai_meta=excluded.ai_meta,
      notes=excluded.notes,
      tags=excluded.tags`,
    [
      cloudId,
      meal.mealId,
      meal.userUid,
      meal.timestamp,
      toDayKey(meal.dayKey ?? meal.timestamp),
      meal.loggedAtLocalMin ?? null,
      meal.tzOffsetMin ?? null,
      meal.type,
      meal.name ?? null,
      ingredients,
      localPath ? null : meal.photoUrl ?? null,
      localPath,
      meal.imageId ?? null,
      imageRef,
      meal.totals?.kcal ?? 0,
      meal.totals?.protein ?? 0,
      meal.totals?.carbs ?? 0,
      meal.totals?.fat ?? 0,
      meal.deleted ? 1 : 0,
      createdAt,
      meal.updatedAt,
      lastSyncedAt,
      syncState,
      meal.source ?? "saved",
      normalizeMealInputMethod(meal.inputMethod),
      aiMeta,
      meal.notes ?? null,
      tags,
    ],
  );
  emit("mymeal:local:upserted", { cloudId, ts: meal.updatedAt });
}

export async function getMyMealsPageLocal(params: {
  uid: string;
  limit: number;
  cursor?: string | null;
}): Promise<{ items: Meal[]; nextCursor: string | null; hasMore: boolean }> {
  const db = getDB();
  const offset = Math.max(Number(params.cursor || 0), 0);
  const rows = db.getAllSync(
    `SELECT * FROM my_meals
     WHERE user_uid=? AND deleted=0
     ORDER BY name COLLATE NOCASE ASC, cloud_id ASC
     LIMIT ? OFFSET ?`,
    [params.uid, params.limit, offset],
  ) as MealRow[];
  const items = rows.map(rowToMeal);
  const nextOffset = offset + items.length;
  const nextCursor = items.length === params.limit ? String(nextOffset) : null;
  return {
    items,
    nextCursor,
    hasMore: nextCursor !== null,
  };
}

export async function getAllMyMealsLocal(uid: string): Promise<Meal[]> {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT * FROM my_meals
     WHERE user_uid=? AND deleted=0
     ORDER BY name COLLATE NOCASE ASC, cloud_id ASC`,
    [uid],
  ) as MealRow[];
  return rows.map(rowToMeal);
}

export async function markDeletedMyMealLocal(
  cloudId: string,
  updatedAt: string,
): Promise<void> {
  const db = getDB();
  db.runSync(
    `UPDATE my_meals
     SET deleted=1, updated_at=?, sync_state='pending'
     WHERE cloud_id=?`,
    [updatedAt, cloudId],
  );
  emit("mymeal:local:deleted", { cloudId, ts: updatedAt });
}

export async function setMyMealSyncStateLocal(params: {
  uid: string;
  cloudId: string;
  syncState: Meal["syncState"];
  updatedAt?: string;
}): Promise<void> {
  if (!params.uid || !params.cloudId) return;
  const db = getDB();
  const syncState = normalizeMealSyncState(params.syncState);
  if (syncState === "synced") {
    db.runSync(
      `UPDATE my_meals
       SET sync_state=?, last_synced_at=?
       WHERE user_uid=? AND cloud_id=?`,
      [
        syncState,
        toEpochMs(params.updatedAt ?? new Date().toISOString()),
        params.uid,
        params.cloudId,
      ],
    );
  } else {
    db.runSync(
      `UPDATE my_meals
       SET sync_state=?
       WHERE user_uid=? AND cloud_id=?`,
      [syncState, params.uid, params.cloudId],
    );
  }
  emit("mymeal:local:upserted", {
    cloudId: params.cloudId,
    ts: params.updatedAt ?? new Date().toISOString(),
  });
}

export async function getMyMealByCloudIdLocal(
  uid: string,
  cloudId: string,
): Promise<Meal | null> {
  const db = getDB();
  const row = db.getFirstSync(
    `SELECT * FROM my_meals WHERE user_uid=? AND cloud_id=? LIMIT 1`,
    [uid, cloudId],
  ) as MealRow | undefined;
  return row ? rowToMeal(row) : null;
}
