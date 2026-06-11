import NetInfo from "@react-native-community/netinfo";
import type { Meal } from "@/types/meal";
import { emit } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import { Sync } from "@/utils/debug";
import {
  enqueueMyMealDelete,
  enqueueMyMealUpsert,
} from "@/services/offline/queue.repo";
import {
  markDeletedMyMealLocal,
  upsertMyMealLocal as upsertMyMealLocalRepo,
} from "@/services/offline/myMeals.repo";
import { requestSync } from "@/services/offline/sync.engine";

type MyMealDoc = Meal & {
  uploadState?: "pending" | "done";
  localPhotoUri?: string | null;
};

type MyMealSyncFailureEvent = {
  uid: string;
  cloudId: string;
  domain: "myMeals";
  reason: "local-change";
  error: unknown;
};

const isLocalPhoto = (uri?: string | null) =>
  !!uri && (uri.startsWith("file:") || uri.startsWith("content:"));
async function requestMyMealSync(uid: string): Promise<void> {
  await requestSync({
    uid,
    domain: "myMeals",
    reason: "local-change",
  });
}

export async function upsertMyMealLocal(
  userUid: string,
  meal: Meal,
): Promise<void> {
  const now = new Date().toISOString();
  const docId = meal.mealId ?? meal.cloudId!;
  const localPath = meal.photoLocalPath ?? (isLocalPhoto(meal.photoUrl) ? meal.photoUrl : null);
  const next: Meal = {
    ...meal,
    userUid,
    mealId: docId,
    cloudId: docId,
    updatedAt: now,
    createdAt: meal.createdAt ?? now,
    source: "saved",
    syncState: "pending",
    photoLocalPath: localPath,
    photoUrl: localPath ?? meal.photoUrl ?? null,
  };
  await upsertMyMealLocalRepo(next);
}

export async function upsertMyMealWithPhoto(
  userUid: string,
  meal: Meal,
  photoUri: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const docId = meal.mealId ?? meal.cloudId!;
  const effectivePhoto = photoUri ?? meal.photoLocalPath ?? meal.photoUrl ?? null;
  const next: MyMealDoc = {
    ...meal,
    userUid,
    mealId: docId,
    cloudId: docId,
    updatedAt: now,
    createdAt: meal.createdAt ?? now,
    source: "saved",
    syncState: "pending",
    photoLocalPath: isLocalPhoto(effectivePhoto) ? effectivePhoto : meal.photoLocalPath ?? null,
    photoUrl: effectivePhoto,
    uploadState: isLocalPhoto(effectivePhoto) ? "pending" : "done",
    localPhotoUri: isLocalPhoto(effectivePhoto) ? effectivePhoto : null,
  };

  await upsertMyMealLocalRepo(next);
  await enqueueMyMealUpsert(userUid, next);
  emit("mymeal:updated", { uid: userUid, cloudId: docId });

  const net = await NetInfo.fetch();
  if (!isOfflineNetState(net)) {
    void requestMyMealSync(userUid).catch((error) => {
      Sync.warn("saved meal sync request failed", {
        uid: userUid,
        cloudId: docId,
        error,
      });
      emit("mymeal:sync:failed", {
        uid: userUid,
        cloudId: docId,
        domain: "myMeals",
        reason: "local-change",
        error,
      } satisfies MyMealSyncFailureEvent);
    });
  }
}

export async function deleteMyMeal(
  userUid: string,
  cloudId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await markDeletedMyMealLocal(cloudId, now);
  await enqueueMyMealDelete(userUid, cloudId, now);

  const net = await NetInfo.fetch();
  if (!isOfflineNetState(net)) {
    await requestMyMealSync(userUid);
  }
}

export async function syncMyMeals(userUid?: string | null): Promise<void> {
  if (!userUid) return;
  await requestMyMealSync(userUid);
}
