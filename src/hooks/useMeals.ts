import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import NetInfo from "@react-native-community/netinfo";
import type { Meal } from "@/types/meal";
import { getPendingMealsLocal } from "@/services/offline/meals.repo";
import { debugScope } from "@/utils/debug";
import { emit } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import { requestSync } from "@/services/offline/sync.engine";
import { upsertMyMealWithPhoto } from "@/services/meals/myMealService";
import { formatMealDayKey } from "@/services/meals/mealMetadata";
import {
  saveMealTransaction,
  type SavedMealTemplateSave,
} from "@/services/meals/mealSaveTransaction";
import {
  getLocalMealsSnapshot,
  refreshLocalMeals,
  subscribeLocalMeals,
  upsertLocalMealSnapshot,
} from "@/services/meals/localMealsStore";
import { deleteMealTransaction } from "@/services/meals/mealDeleteTransaction";

const SYNC_DEBOUNCE_MS = 1200;

function omitDraftOnlyFields(meal: Meal): Meal {
  const { savedMealRefId: _savedMealRefId, ...persistable } = meal;
  return persistable;
}

function isLocalUri(u?: string | null): u is string {
  if (!u || typeof u !== "string") return false;
  return u.startsWith("file://") || u.startsWith("content://");
}

const log = debugScope("Hook:useMeals");

export function useMeals(userUid: string | null) {
  const [snapshot, setSnapshot] = useState(() => getLocalMealsSnapshot(userUid));
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef(false);
  const syncRequestedRef = useRef(false);
  const lastOfflineToastAtRef = useRef(0);
  const meals = snapshot.meals;
  const loading = snapshot.loading;

  const emitOfflineQueuedToast = useCallback(() => {
    const now = Date.now();
    if (now - lastOfflineToastAtRef.current < 8000) return;
    lastOfflineToastAtRef.current = now;
    emit("ui:toast", {
      key: "toast.savedLocallySyncLater",
      ns: "common",
    });
  }, []);

  const flushQueuedSync = useCallback(async () => {
    /* istanbul ignore next -- syncMeals/scheduler guard missing uid */
    if (!userUid) return;
    if (syncInFlightRef.current) {
      syncRequestedRef.current = true;
      return;
    }
    /* istanbul ignore next -- scheduler always marks request before flush */
    if (!syncRequestedRef.current) return;

    syncInFlightRef.current = true;
    syncRequestedRef.current = false;
    try {
      log.log("sync flush start", { uid: userUid });
      await requestSync({
        uid: userUid,
        domain: "meals",
        reason: "local-change",
        pullAfterPush: false,
      });
      log.log("sync flush done", { uid: userUid });
    } catch (error: unknown) {
      log.warn("sync flush failed", error);
    } finally {
      syncInFlightRef.current = false;
      if (syncRequestedRef.current && !syncTimerRef.current) {
        syncTimerRef.current = setTimeout(() => {
          syncTimerRef.current = null;
          void flushQueuedSync();
        }, SYNC_DEBOUNCE_MS);
      }
    }
  }, [userUid]);

  const scheduleQueuedSync = useCallback(
    (reason: "add" | "update" | "delete" | "duplicate") => {
      /* istanbul ignore next -- mutating actions guard missing uid */
      if (!userUid) return;
      syncRequestedRef.current = true;
      void (async () => {
        const net = await NetInfo.fetch();
        if (isOfflineNetState(net)) {
          emitOfflineQueuedToast();
          return;
        }
      })();
      if (syncTimerRef.current) {
        log.log("sync already scheduled", { uid: userUid, reason });
        return;
      }
      log.log("sync scheduled", {
        uid: userUid,
        reason,
        delayMs: SYNC_DEBOUNCE_MS,
      });
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        void flushQueuedSync();
      }, SYNC_DEBOUNCE_MS);
    },
    [emitOfflineQueuedToast, flushQueuedSync, userUid],
  );

  useEffect(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    syncInFlightRef.current = false;
    syncRequestedRef.current = false;
  }, [userUid]);

  useEffect(() => {
    setSnapshot(getLocalMealsSnapshot(userUid));
    return subscribeLocalMeals(userUid, () => {
      setSnapshot(getLocalMealsSnapshot(userUid));
    });
  }, [userUid]);

  useEffect(
    () => () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    },
    [],
  );

  const loadNextPage = useCallback(async () => {
    await refreshLocalMeals(userUid);
  }, [userUid]);

  const getMeals = useCallback(async () => {
    await refreshLocalMeals(userUid);
  }, [userUid]);

  const addMeal = useCallback(
    async (meal: Omit<Meal, "updatedAt" | "deleted">) => {
      if (!userUid) return;
      const { meal: savedMeal } = await saveMealTransaction({
        uid: userUid,
        meal: meal as Meal,
      });
      upsertLocalMealSnapshot(userUid, savedMeal);

      scheduleQueuedSync("add");
      emit("ui:toast", { key: "toast.mealAdded", ns: "common" });
    },
    [userUid, scheduleQueuedSync],
  );

  const saveMeal = useCallback(
    async (params: {
      meal: Meal;
      savedTemplate?: SavedMealTemplateSave;
    }): Promise<Meal | null> => {
      if (!userUid) return null;
      const { meal: savedMeal } = await saveMealTransaction({
        uid: userUid,
        meal: params.meal,
        savedTemplate: params.savedTemplate,
      });
      upsertLocalMealSnapshot(userUid, savedMeal);

      scheduleQueuedSync("add");
      emit("ui:toast", { key: "toast.mealAdded", ns: "common" });
      return savedMeal;
    },
    [scheduleQueuedSync, userUid],
  );

  const createSavedMealTemplate = useCallback(
    async (meal: Meal) => {
      if (!userUid) return;
      const now = new Date().toISOString();
      const persistableMeal = omitDraftOnlyFields(meal);
      const docId = persistableMeal.mealId || persistableMeal.cloudId || uuidv4();
      const localPhoto = isLocalUri(persistableMeal.photoUrl)
        ? persistableMeal.photoUrl
        : null;
      const toSave: Meal = {
        ...persistableMeal,
        userUid,
        mealId: docId,
        cloudId: docId,
        source: "saved",
        inputMethod: persistableMeal.inputMethod ?? "manual",
        updatedAt: now,
      };
      await upsertMyMealWithPhoto(userUid, toSave, localPhoto);
    },
    [userUid],
  );

  const updateSavedMealTemplate = useCallback(
    async (templateId: string, meal: Meal) => {
      if (!userUid || !templateId) return;
      const now = new Date().toISOString();
      const persistableMeal = omitDraftOnlyFields(meal);
      const localPhoto = isLocalUri(persistableMeal.photoUrl)
        ? persistableMeal.photoUrl
        : null;
      const toSave: Meal = {
        ...persistableMeal,
        userUid,
        mealId: templateId,
        cloudId: templateId,
        source: "saved",
        inputMethod: persistableMeal.inputMethod ?? "manual",
        updatedAt: now,
      };
      await upsertMyMealWithPhoto(userUid, toSave, localPhoto);
    },
    [userUid],
  );

  const updateMeal = useCallback(
    async (meal: Meal) => {
      if (!userUid) return;
      await saveMealTransaction({
        uid: userUid,
        meal,
        operation: "update",
        onLocalCommitted: (savedMeal) => {
          upsertLocalMealSnapshot(userUid, savedMeal);
        },
      });

      scheduleQueuedSync("update");
    },
    [userUid, scheduleQueuedSync],
  );

  const deleteMeal = useCallback(
    async (mealCloudId: string) => {
      if (!userUid || !mealCloudId) return;
      await deleteMealTransaction({
        uid: userUid,
        cloudId: mealCloudId,
      });

      scheduleQueuedSync("delete");
    },
    [userUid, scheduleQueuedSync],
  );

  const duplicateMeal = useCallback(
    async (original: Meal, dateOverride?: string) => {
      if (!userUid) return;
      const now = new Date().toISOString();
      const newCloudId = uuidv4();
      const newMealId = uuidv4();

      const copy: Meal = {
        ...original,
        userUid,
        cloudId: newCloudId,
        mealId: newMealId,
        timestamp: dateOverride || now,
        dayKey: formatMealDayKey(new Date(dateOverride || now)) ?? now.slice(0, 10),
        createdAt: now,
        updatedAt: now,
        syncState: "pending",
        deleted: false,
      };
      const { meal: savedCopy } = await saveMealTransaction({
        uid: userUid,
        meal: copy,
        nowISO: now,
      });
      upsertLocalMealSnapshot(userUid, savedCopy);

      scheduleQueuedSync("duplicate");
      emit("ui:toast", { key: "toast.mealAdded", ns: "common" });
    },
    [userUid, scheduleQueuedSync],
  );

  const syncMeals = useCallback(async () => {
    if (!userUid) return;
    syncRequestedRef.current = true;
    await flushQueuedSync();
  }, [flushQueuedSync, userUid]);
  const getUnsyncedMeals = useCallback(async () => {
    if (!userUid) return [] as Meal[];
    return getPendingMealsLocal(userUid);
  }, [userUid]);

  return useMemo(
    () => ({
      meals,
      loading,
      getMeals,
      loadNextPage,
      addMeal,
      saveMeal,
      createSavedMealTemplate,
      updateSavedMealTemplate,
      updateMeal,
      deleteMeal,
      duplicateMeal,
      syncMeals,
      getUnsyncedMeals,
    }),
    [
      meals,
      loading,
      getMeals,
      loadNextPage,
      addMeal,
      saveMeal,
      createSavedMealTemplate,
      updateSavedMealTemplate,
      updateMeal,
      deleteMeal,
      duplicateMeal,
      syncMeals,
      getUnsyncedMeals,
    ],
  );
}
