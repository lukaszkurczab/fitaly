import NetInfo from "@react-native-community/netinfo";
import type { Meal } from "@/types/meal";
import { Sync } from "@/utils/debug";
import { isOfflineNetState } from "@/services/core/networkState";
import { normalizeServiceError } from "@/services/contracts/serviceError";
import { processAndUpload } from "@/services/meals/mealService.images";
import {
  getPendingUploads,
  markUploaded,
  markUploadFailed,
} from "../images.repo";
import { enqueueUpsert } from "../queue.repo";
import { getDB } from "../db";
import type { MealRow } from "../types";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

const log = Sync;

function toSyncError(error: unknown) {
  return normalizeServiceError(error, {
    code: "sync/unknown",
    source: "SyncEngine",
    retryable: true,
  });
}

function toMealSource(value: string | null): Meal["source"] {
  return value === "ai" || value === "manual" || value === "saved" ? value : null;
}

function toMealType(value: string): Meal["type"] {
  return value === "breakfast" ||
    value === "lunch" ||
    value === "dinner" ||
    value === "snack" ||
    value === "other"
    ? value
    : "other";
}

function nowISO() {
  return new Date().toISOString();
}

function safeParseJSON(s: unknown) {
  try {
    if (typeof s !== "string") return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export const imagesStrategy: SyncStrategy = {
  async pull(_uid: string): Promise<number> {
    return 0;
  },
  async handlePushOp(_uid: string, _op: QueueOp): Promise<boolean> {
    return false;
  },
};

export async function processImageUploads(uid: string): Promise<void> {
  const upLog = log.child("upload");
  const net = await NetInfo.fetch();
  upLog.log("start", { uid, isConnected: net.isConnected });
  if (isOfflineNetState(net)) {
    upLog.log("skip:offline");
    return;
  }

  upLog.time("exec");
  const pending = await getPendingUploads(uid);
  upLog.log("pending", { count: pending.length });
  if (!pending.length) {
    upLog.timeEnd("exec");
    upLog.log("none");
    return;
  }

  const sql = getDB();
  let ok = 0;
  let fail = 0;

  for (const row of pending) {
    try {
      upLog.log("process", {
        image_id: row.image_id,
        local_path: row.local_path,
      });
      const up = await processAndUpload(uid, row.local_path);

      const now = nowISO();
      sql.runSync(
        `UPDATE meals
         SET photo_url=?, image_id=?, updated_at=?
         WHERE user_uid=? AND image_local=?`,
        [up.cloudUrl, up.imageId, now, uid, row.local_path]
      );

      const meals = sql.getAllSync(
        `SELECT * FROM meals WHERE user_uid=? AND image_local=?`,
        [uid, row.local_path]
      ) as MealRow[];

      if (!meals.length) {
        upLog.warn("upload:meal_attach_missing", {
          image_id: row.image_id,
          local_path: row.local_path,
          remote_image_id: up.imageId,
          cloud_url: up.cloudUrl,
        });
        throw new Error(
          "uploaded image has no matching local meals for image_local"
        );
      }

      for (const m of meals) {
        const tags = safeParseJSON(m.tags) ?? [];
        const ingredients = safeParseJSON(m.ingredients);
        const normalized: Meal = {
          userUid: m.user_uid,
          mealId: m.meal_id,
          cloudId: m.cloud_id ?? undefined,
          timestamp: m.timestamp,
          type: toMealType(m.type),
          name: m.name,
          ingredients: Array.isArray(ingredients)
            ? (ingredients as Meal["ingredients"])
            : [],
          createdAt: m.created_at ?? m.timestamp ?? now,
          updatedAt: now,
          syncState: "pending",
          source: toMealSource(m.source) ?? "manual",
          imageId: up.imageId,
          photoUrl: up.cloudUrl,
          notes: m.notes,
          tags,
          deleted: Number(m.deleted ?? 0) === 1,
          totals: {
            kcal: m.totals_kcal || 0,
            protein: m.totals_protein || 0,
            carbs: m.totals_carbs || 0,
            fat: m.totals_fat || 0,
          },
        };

        await enqueueUpsert(uid, normalized);
        upLog.log("meal_enqueued", m.cloud_id);
      }

      await markUploaded(row.image_id, up.cloudUrl);
      ok++;
    } catch (e: unknown) {
      fail++;
      const err = toSyncError(e);
      const payload = {
        image_id: row.image_id,
        code: err.code,
        message: err.message,
        retryable: err.retryable,
      };
      if (err.retryable) {
        upLog.warn("upload:retryable_fail", payload);
      } else {
        upLog.error("upload:fail", payload);
      }
      try {
        await markUploadFailed({
          uid,
          imageId: row.image_id,
        });
      } catch (markError) {
        const markErr = toSyncError(markError);
        upLog.error("upload:mark_failed_error", {
          image_id: row.image_id,
          code: markErr.code,
          message: markErr.message,
          retryable: markErr.retryable,
        });
      }
    }
  }

  upLog.timeEnd("exec");
  upLog.log("done", { ok, fail, pending: pending.length });
}
