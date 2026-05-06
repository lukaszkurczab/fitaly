import { on } from "@/services/core/events";
import { refreshStreakFromBackend } from "@/services/gamification/streakService";
import { reconcileAll } from "@/services/notifications/engine";
import { debugScope } from "@/utils/debug";

type MealChangeEvent = {
  uid?: string;
  cloudId?: string;
};

const MEAL_SIDE_EFFECTS_DEBOUNCE_MS = 1_500;

const log = debugScope("MealSideEffectsRuntime");

let initialized = false;
let currentUid: string | null = null;
let unsubs: Array<() => void> = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let pendingAfterInFlight = false;

function clearPendingTimer(): void {
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  timer = null;
}

function isCurrentUserEvent(event?: MealChangeEvent): boolean {
  return (
    typeof event?.uid === "string" &&
    event.uid.length > 0 &&
    event.uid === currentUid
  );
}

function scheduleSideEffects(reason: string): void {
  if (!currentUid || !initialized) {
    return;
  }

  if (inFlight) {
    pendingAfterInFlight = true;
    return;
  }

  clearPendingTimer();
  log.log("meal side effects scheduled", {
    uid: currentUid,
    reason,
    delayMs: MEAL_SIDE_EFFECTS_DEBOUNCE_MS,
  });
  timer = setTimeout(() => {
    timer = null;
    void runSideEffects(reason);
  }, MEAL_SIDE_EFFECTS_DEBOUNCE_MS);
}

function handleMealChange(reason: string, event?: MealChangeEvent): void {
  if (!isCurrentUserEvent(event)) {
    return;
  }

  scheduleSideEffects(reason);
}

async function runSideEffects(reason: string): Promise<void> {
  const uid = currentUid;
  if (!uid || inFlight) {
    return;
  }

  inFlight = true;
  pendingAfterInFlight = false;

  try {
    log.log("meal side effects start", { uid, reason });
    try {
      await refreshStreakFromBackend(uid, { refreshBadges: true });
    } catch (error) {
      log.warn("meal side effect streak refresh failed", { uid, reason, error });
    }

    if (currentUid !== uid) {
      return;
    }

    try {
      await reconcileAll(uid);
    } catch (error) {
      log.warn("meal side effect notification reconcile failed", {
        uid,
        reason,
        error,
      });
    }
    log.log("meal side effects done", { uid, reason });
  } finally {
    inFlight = false;
    if (pendingAfterInFlight && currentUid) {
      pendingAfterInFlight = false;
      scheduleSideEffects("pending_after_in_flight");
    }
  }
}

export function initMealSideEffectsRuntime(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  unsubs = [
    on<MealChangeEvent>("meal:pushed", (event) => {
      handleMealChange("meal_pushed", event);
    }),
    on<MealChangeEvent>("meal:synced", (event) => {
      handleMealChange("meal_synced", event);
    }),
  ];
  log.log("meal side effects runtime initialized");
}

export function setMealSideEffectsRuntimeUid(uid: string | null): void {
  const normalizedUid = uid?.trim() || null;
  if (normalizedUid === currentUid) {
    return;
  }

  currentUid = normalizedUid;
  pendingAfterInFlight = false;
  clearPendingTimer();
}

export function stopMealSideEffectsRuntime(): void {
  clearPendingTimer();
  for (const unsubscribe of unsubs) {
    unsubscribe();
  }
  unsubs = [];
  initialized = false;
  currentUid = null;
  inFlight = false;
  pendingAfterInFlight = false;
}

export function __resetMealSideEffectsRuntimeForTests(): void {
  stopMealSideEffectsRuntime();
}
