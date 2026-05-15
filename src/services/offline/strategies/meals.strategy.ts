import NetInfo from "@react-native-community/netinfo";
import type { Meal } from "@/types/meal";
import { Sync } from "@/utils/debug";
import { emit } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  buildMealUpdatedCursor,
  fetchMealChangesRemote,
  markMealDeletedRemote,
  saveMealRemote,
} from "@/services/meals/mealsRepository";
import {
  createServiceError,
  normalizeServiceError,
} from "@/services/contracts/serviceError";
import {
  getMealByCloudIdLocal,
  setMealSyncStateLocal,
  upsertMealLocal,
} from "../meals.repo";
import { resolveMealConflict } from "../conflict";
import { getLastPullTs, setLastPullTs } from "../sync.storage";
import type { QueueOp, SyncStrategy } from "../sync.strategy";

const log = Sync;

const PULL_PAGE_SIZE = 100;

type MealPayload = Partial<Meal> & { cloudId?: string | null; mealId?: string | null };

type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

function syncEngineError(
  code: string,
  options?: { message?: string; retryable?: boolean; cause?: unknown }
) {
  return createServiceError({
    code,
    source: "SyncEngine",
    retryable: options?.retryable ?? true,
    message: options?.message,
    cause: options?.cause,
  });
}

function toSyncError(error: unknown) {
  return normalizeServiceError(error, {
    code: "sync/unknown",
    source: "SyncEngine",
    retryable: true,
  });
}

function toMealPayload(payload: unknown): MealPayload | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as MealPayload;
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

function normalizeChangesCursor(cursor: string | null): string | null {
  const normalized = cursor?.trim();
  return normalized && normalized.includes("|") ? normalized : null;
}

async function forEachCursorPage<T>(params: {
  initialCursor: string | null;
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>;
  onPageItems: (items: T[]) => Promise<void>;
}): Promise<void> {
  let cursor = params.initialCursor;

  for (;;) {
    const page = await params.fetchPage(cursor);
    if (!page.items.length) break;
    await params.onPageItems(page.items);

    cursor = page.nextCursor || cursor;
    if (!page.nextCursor) break;
  }
}

export const mealsStrategy: SyncStrategy = {
  async pull(uid: string): Promise<number> {
    const pullLog = log.child("pull");
    const net = await NetInfo.fetch();
    pullLog.log("start", { uid, isConnected: net.isConnected });
    if (isOfflineNetState(net)) {
      pullLog.log("skip:offline");
      return 0;
    }

    pullLog.time("exec");

    const last = normalizeChangesCursor(await getLastPullTs(uid));
    let latestCursor = last;
    let total = 0;
    pullLog.log("since", { last });

    await forEachCursorPage({
      initialCursor: last,
      fetchPage: async (cursor) => {
        const page = await fetchMealChangesRemote({
          uid,
          pageSize: PULL_PAGE_SIZE,
          cursor,
        });
        pullLog.log("page", { size: page.items.length });
        return { items: page.items, nextCursor: page.nextCursor };
      },
      onPageItems: async (items) => {
        for (const meal of items) {
          try {
            const existingLocal = meal.cloudId
              ? await getMealByCloudIdLocal(uid, meal.cloudId)
              : null;
            const resolution = existingLocal
              ? resolveMealConflict(existingLocal, meal)
              : {
                  resolved: meal,
                  discarded: null,
                  isAmbiguous: false,
                  decision: "remote-wins" as const,
                  reason: "remote-newer" as const,
                };
            const { resolved } = resolution;

            if (resolution.decision === "remote-wins") {
              await upsertMealLocal({ ...resolved, syncState: "synced" });
              emit("meal:synced", {
                uid,
                cloudId: resolved.cloudId ?? meal.cloudId,
                updatedAt: resolved.updatedAt,
              });
            } else if (resolution.decision === "conflict") {
              await upsertMealLocal({ ...resolved, syncState: "conflict" });
            }

            if (
              existingLocal &&
              resolution.decision === "conflict" &&
              resolution.isAmbiguous
            ) {
              emit("meal:conflict:ambiguous", {
                uid,
                cloudId: resolved.cloudId,
                localUpdatedAt: existingLocal.updatedAt,
                remoteUpdatedAt: meal.updatedAt,
                reason: resolution.reason,
              });
            }
            total++;
            latestCursor = buildMealUpdatedCursor(meal);
            pullLog.log("local_upsert:ok", {
              id: meal.cloudId,
              updatedAt: meal.updatedAt,
              decision: resolution.decision,
              reason: resolution.reason,
            });
          } catch (e: unknown) {
            const err = toSyncError(e);
            pullLog.error("local_upsert:fail", {
              id: meal.cloudId,
              code: err.code,
              message: err.message,
              retryable: err.retryable,
            });
          }
        }
      },
    });

    if (latestCursor !== last) {
      await setLastPullTs(uid, latestCursor);
      pullLog.log("set_last_ts", { latestCursor });
    }
    pullLog.timeEnd("exec");
    pullLog.log("done", { items: total, last_ts: latestCursor });
    return total;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    const pushLog = log.child("push");
    if (op.kind === "upsert") {
      const payload = toMealPayload(op.payload);
      const id = payload?.cloudId || payload?.mealId;
      if (!payload || !id) {
        throw syncEngineError("sync/upsert-missing-id", {
          message: "Missing payload or meal identifier for upsert op",
          retryable: false,
        });
      }
      await saveMealRemote({
        uid,
        meal: {
          ...(payload as Meal),
          cloudId: id,
          mealId: String(payload.mealId || id),
          userUid: String(payload.userUid || uid),
          timestamp: String(payload.timestamp || payload.updatedAt || nowISO()),
          type: toMealType(String(payload.type || "other")),
          name: payload.name ?? null,
          ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [],
          createdAt: String(
            payload.createdAt || payload.timestamp || payload.updatedAt || nowISO()
          ),
          updatedAt: String(payload.updatedAt || nowISO()),
          syncState: "pending",
          source: toMealSource(typeof payload.source === "string" ? payload.source : null),
          imageId: payload.imageId ?? null,
          photoUrl: payload.photoUrl ?? null,
          notes: payload.notes ?? null,
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          deleted: Boolean(payload.deleted),
          totals:
            payload.totals && typeof payload.totals === "object"
              ? payload.totals
              : { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        },
      });
      await setMealSyncStateLocal({
        uid,
        cloudId: id,
        syncState: "synced",
        updatedAt: String(payload?.updatedAt || op.updated_at || nowISO()),
      });
      pushLog.log("upsert:ok", id);
      emit("meal:pushed", { uid, cloudId: id });
      return true;
    }

    if (op.kind === "delete") {
      await markMealDeletedRemote(uid, op.cloud_id, op.updated_at);
      pushLog.log("delete:ok", op.cloud_id);
      emit("meal:pushed", { uid, cloudId: op.cloud_id });
      return true;
    }

    return false;
  },
};
