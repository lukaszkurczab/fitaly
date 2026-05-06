import { on } from "@/services/core/events";
import { refreshStreakFromBackend } from "@/services/gamification/streakService";
import { reconcileAll } from "@/services/notifications/engine";
import { debugScope } from "@/utils/debug";

type MealChangeEvent = {
  uid?: string;
  cloudId?: string;
};

type MealSideEffectKind = "notifications" | "streak";

type MealSideEffectState = {
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  pendingAfterInFlight: boolean;
};

const MEAL_SIDE_EFFECTS_DEBOUNCE_MS = 1_500;

const log = debugScope("MealSideEffectsRuntime");

let initialized = false;
let currentUid: string | null = null;
let unsubs: Array<() => void> = [];
const effectState: Record<MealSideEffectKind, MealSideEffectState> = {
  notifications: {
    timer: null,
    inFlight: false,
    pendingAfterInFlight: false,
  },
  streak: {
    timer: null,
    inFlight: false,
    pendingAfterInFlight: false,
  },
};

function clearPendingTimer(kind: MealSideEffectKind): void {
  const state = effectState[kind];
  if (!state.timer) {
    return;
  }

  clearTimeout(state.timer);
  state.timer = null;
}

function clearAllPendingTimers(): void {
  clearPendingTimer("notifications");
  clearPendingTimer("streak");
}

function resetEffectState(): void {
  clearAllPendingTimers();
  for (const state of Object.values(effectState)) {
    state.inFlight = false;
    state.pendingAfterInFlight = false;
  }
}

function isCurrentUserEvent(event?: MealChangeEvent): boolean {
  return (
    typeof event?.uid === "string" &&
    event.uid.length > 0 &&
    event.uid === currentUid
  );
}

function scheduleSideEffect(kind: MealSideEffectKind, reason: string): void {
  if (!currentUid || !initialized) {
    return;
  }

  const state = effectState[kind];

  if (state.inFlight) {
    state.pendingAfterInFlight = true;
    return;
  }

  clearPendingTimer(kind);
  log.log("meal side effects scheduled", {
    uid: currentUid,
    kind,
    reason,
    delayMs: MEAL_SIDE_EFFECTS_DEBOUNCE_MS,
  });
  state.timer = setTimeout(() => {
    state.timer = null;
    void runSideEffect(kind, reason);
  }, MEAL_SIDE_EFFECTS_DEBOUNCE_MS);
}

function handleMealChange(
  kind: MealSideEffectKind,
  reason: string,
  event?: MealChangeEvent,
): void {
  if (!isCurrentUserEvent(event)) {
    return;
  }

  scheduleSideEffect(kind, reason);
}

async function runSideEffect(
  kind: MealSideEffectKind,
  reason: string,
): Promise<void> {
  const uid = currentUid;
  const state = effectState[kind];
  if (!uid || state.inFlight) {
    return;
  }

  state.inFlight = true;
  state.pendingAfterInFlight = false;

  try {
    log.log("meal side effects start", { uid, kind, reason });
    if (kind === "streak") {
      try {
        await refreshStreakFromBackend(uid, { refreshBadges: true });
      } catch (error) {
        log.warn("meal side effect streak refresh failed", {
          uid,
          kind,
          reason,
          error,
        });
      }

      log.log("meal side effects done", { uid, kind, reason });
      return;
    }

    try {
      await reconcileAll(uid);
    } catch (error) {
      log.warn("meal side effect notification reconcile failed", {
        uid,
        kind,
        reason,
        error,
      });
    }
    log.log("meal side effects done", { uid, kind, reason });
  } finally {
    state.inFlight = false;
    if (state.pendingAfterInFlight && currentUid) {
      state.pendingAfterInFlight = false;
      scheduleSideEffect(kind, "pending_after_in_flight");
    }
  }
}

export function initMealSideEffectsRuntime(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  unsubs = [
    on<MealChangeEvent>("meal:local:upserted", (event) => {
      handleMealChange("notifications", "meal_local_upserted", event);
    }),
    on<MealChangeEvent>("meal:local:deleted", (event) => {
      handleMealChange("notifications", "meal_local_deleted", event);
    }),
    on<MealChangeEvent>("meal:pushed", (event) => {
      handleMealChange("streak", "meal_pushed", event);
    }),
    on<MealChangeEvent>("meal:synced", (event) => {
      handleMealChange("streak", "meal_synced", event);
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
  for (const state of Object.values(effectState)) {
    state.pendingAfterInFlight = false;
  }
  clearAllPendingTimers();
}

export function stopMealSideEffectsRuntime(): void {
  resetEffectState();
  for (const unsubscribe of unsubs) {
    unsubscribe();
  }
  unsubs = [];
  initialized = false;
  currentUid = null;
}

export function __resetMealSideEffectsRuntimeForTests(): void {
  stopMealSideEffectsRuntime();
}
