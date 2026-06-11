import NetInfo from "@react-native-community/netinfo";
import type { Meal } from "@/types/meal";
import { Sync } from "@/utils/debug";
import { emit } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  buildMyMealUpdatedCursor,
  fetchMyMealChangesRemote,
  markMyMealDeletedRemote,
  updateMyMealRemote,
  uploadMyMealPhotoRemote,
} from "@/services/meals/myMealsRepository";
import {
  createServiceError,
  normalizeServiceError,
} from "@/services/contracts/serviceError";
import {
  getMyMealByCloudIdLocal,
  setMyMealSyncStateLocal,
  upsertMyMealLocal,
} from "../myMeals.repo";
import { resolveMealConflict } from "../conflict";
import { getLastMyMealsPullTs, setLastMyMealsPullTs } from "../sync.storage";
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

function isLocalUri(value?: string | null): value is string {
  if (!value || typeof value !== "string") return false;
  return value.startsWith("file:") || value.startsWith("content:");
}

function isUserScopedSavedMealStoragePath(
  storagePath: string | null | undefined,
  uid: string,
): storagePath is string {
  return Boolean(storagePath && uid && storagePath.startsWith(`myMeals/${uid}/`));
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

export const myMealsStrategy: SyncStrategy = {
  async pull(uid: string): Promise<number> {
    const pullLog = log.child("pull:mymeals");
    const net = await NetInfo.fetch();
    pullLog.log("start", { uid, isConnected: net.isConnected });
    if (isOfflineNetState(net)) {
      pullLog.log("skip:offline");
      return 0;
    }

    const last = normalizeChangesCursor(await getLastMyMealsPullTs(uid));
    let latestCursor = last;
    let total = 0;

    await forEachCursorPage({
      initialCursor: last,
      fetchPage: async (cursor) => {
        const page = await fetchMyMealChangesRemote({
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
            const remoteMeal: Meal = {
              ...meal,
              source: "saved",
              photoLocalPath: meal.photoLocalPath ?? null,
            };
            const existingLocal = meal.cloudId
              ? await getMyMealByCloudIdLocal(uid, meal.cloudId)
              : null;
            const resolution = existingLocal
              ? resolveMealConflict(existingLocal, remoteMeal)
              : {
                  resolved: remoteMeal,
                  discarded: null,
                  isAmbiguous: false,
                  decision: "remote-wins" as const,
                  reason: "remote-newer" as const,
                };
            const { resolved } = resolution;

            if (resolution.decision === "remote-wins") {
              await upsertMyMealLocal({
                ...resolved,
                source: "saved",
                syncState: "synced",
                photoLocalPath: resolved.photoLocalPath ?? null,
              });
              emit("mymeal:synced", {
                uid,
                cloudId: resolved.cloudId ?? meal.cloudId,
                updatedAt: resolved.updatedAt,
              });
            } else if (resolution.decision === "conflict") {
              await upsertMyMealLocal({
                ...resolved,
                source: "saved",
                syncState: "conflict",
                photoLocalPath: resolved.photoLocalPath ?? null,
              });
            }

            if (
              existingLocal &&
              resolution.decision === "conflict" &&
              resolution.isAmbiguous
            ) {
              emit("mymeal:conflict:ambiguous", {
                uid,
                cloudId: resolved.cloudId ?? meal.cloudId,
                localUpdatedAt: existingLocal.updatedAt,
                remoteUpdatedAt: meal.updatedAt,
                reason: resolution.reason,
              });
            }
            total++;
            latestCursor = buildMyMealUpdatedCursor(meal);
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

    if (latestCursor && latestCursor !== last) {
      await setLastMyMealsPullTs(uid, latestCursor);
      pullLog.log("set_last_ts", { latestCursor });
    }
    pullLog.log("done", { items: total, last_ts: latestCursor });
    return total;
  },

  async handlePushOp(uid: string, op: QueueOp): Promise<boolean> {
    const pushLog = log.child("push");
    if (op.kind === "upsert_mymeal") {
      const payload = toMealPayload(op.payload);
      const docId = payload?.mealId || payload?.cloudId;
      if (!docId) {
        throw syncEngineError("sync/mymeal-missing-id", {
          message: "Missing meal identifier for myMeal upsert op",
          retryable: false,
        });
      }
      const localPhotoPath =
        (typeof payload?.photoLocalPath === "string" && payload.photoLocalPath) ||
        (typeof payload?.photoUrl === "string" && isLocalUri(payload.photoUrl)
          ? payload.photoUrl
          : null);
      let imageId: string | null =
        typeof payload?.imageId === "string" ? payload.imageId : null;
      let photoUrl: string | null =
        typeof payload?.photoUrl === "string" && !isLocalUri(payload.photoUrl)
          ? payload.photoUrl
          : null;
      let uploadedStoragePath: string | null = null;

      if (localPhotoPath) {
        const uploaded = await uploadMyMealPhotoRemote(uid, docId, localPhotoPath);
        imageId = uploaded.imageId;
        photoUrl = uploaded.photoUrl;
        uploadedStoragePath = isUserScopedSavedMealStoragePath(
          uploaded.storagePath,
          uid,
        )
          ? uploaded.storagePath
          : null;
      }

      await updateMyMealRemote(
        uid,
        docId,
        {
          ...payload,
          mealId: docId,
          cloudId: docId,
          source: "saved",
          updatedAt: payload?.updatedAt || nowISO(),
          imageId,
          photoUrl,
          ...(localPhotoPath && imageId
            ? {
                imageRef: {
                  imageId,
                  ...(uploadedStoragePath
                    ? { storagePath: uploadedStoragePath }
                    : {}),
                  downloadUrl: photoUrl,
                },
              }
            : {}),
        },
        op.client_mutation_id,
      );
      await upsertMyMealLocal({
        userUid: String(payload?.userUid || uid),
        mealId: docId,
        cloudId: docId,
        timestamp: String(payload?.timestamp || payload?.updatedAt || nowISO()),
        type: toMealType(String(payload?.type || "other")),
        name: typeof payload?.name === "string" ? payload.name : null,
        ingredients: Array.isArray(payload?.ingredients) ? payload.ingredients : [],
        createdAt: String(
          payload?.createdAt || payload?.timestamp || payload?.updatedAt || nowISO()
        ),
        updatedAt: String(payload?.updatedAt || nowISO()),
        syncState: "synced",
        source: "saved",
        imageId,
        photoUrl: localPhotoPath || photoUrl,
        photoLocalPath: localPhotoPath,
        notes: typeof payload?.notes === "string" ? payload.notes : null,
        tags: Array.isArray(payload?.tags) ? payload.tags : [],
        deleted: Boolean(payload?.deleted),
        totals:
          payload?.totals && typeof payload.totals === "object"
            ? payload.totals
            : { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      });
      await setMyMealSyncStateLocal({
        uid,
        cloudId: docId,
        syncState: "synced",
        updatedAt: String(payload?.updatedAt || op.updated_at || nowISO()),
      });
      pushLog.log("mymeal:upsert", docId);
      emit("mymeal:synced", { uid, cloudId: docId });
      return true;
    }

    if (op.kind === "delete_mymeal") {
      await markMyMealDeletedRemote(uid, op.cloud_id, op.updated_at, {
        clientMutationId: op.client_mutation_id,
      });
      pushLog.log("mymeal:delete", op.cloud_id);
      emit("mymeal:synced", { uid, cloudId: op.cloud_id });
      return true;
    }

    return false;
  },
};
