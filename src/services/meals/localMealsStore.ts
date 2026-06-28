import type { Meal } from "@/types/meal";
import { on } from "@/services/core/events";
import {
  getAllMealsLocal,
  getMealByCloudIdLocal,
} from "@/services/offline/meals.repo";
import {
  getMealDayKey,
  getMealSortTimestamp,
  isMealInDayKeyRange,
  normalizeMealDayKey,
} from "@/services/meals/mealMetadata";

type LocalMealEvent = {
  uid?: string;
  cloudId?: string;
  mealId?: string;
};

export type LocalMealsSnapshot = {
  meals: Meal[];
  loading: boolean;
  version: number;
};

type Listener = () => void;

const EMPTY_SNAPSHOT: LocalMealsSnapshot = {
  meals: [],
  loading: false,
  version: 0,
};

function mealIdentity(meal: Meal): string {
  return meal.cloudId || "";
}

function mealEventId(event?: LocalMealEvent): string {
  return String(event?.cloudId || "");
}

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function lastSyncedValue(value: number | null | undefined): number {
  return value ?? 0;
}

function isLocalPhotoUri(value?: string | null): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("file://") || value.startsWith("content://"))
  );
}

function localPhotoValue(meal: Meal): string | null {
  return (
    meal.photoLocalPath ??
    meal.localPhotoUrl ??
    (isLocalPhotoUri(meal.photoUrl) ? meal.photoUrl : null) ??
    null
  );
}

function mealListValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function areMealSnapshotsEqual(left: Meal, right: Meal): boolean {
  return (
    mealIdentity(left) === mealIdentity(right) &&
    left.userUid === right.userUid &&
    nullable(left.mealId) === nullable(right.mealId) &&
    nullable(left.cloudId) === nullable(right.cloudId) &&
    left.timestamp === right.timestamp &&
    nullable(left.dayKey) === nullable(right.dayKey) &&
    nullable(left.loggedAtLocalMin) === nullable(right.loggedAtLocalMin) &&
    nullable(left.tzOffsetMin) === nullable(right.tzOffsetMin) &&
    left.type === right.type &&
    nullable(left.name) === nullable(right.name) &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    lastSyncedValue(left.lastSyncedAt) === lastSyncedValue(right.lastSyncedAt) &&
    left.syncState === right.syncState &&
    nullable(left.source) === nullable(right.source) &&
    nullable(left.inputMethod) === nullable(right.inputMethod) &&
    nullable(left.imageId) === nullable(right.imageId) &&
    nullable(left.photoUrl) === nullable(right.photoUrl) &&
    nullable(localPhotoValue(left)) === nullable(localPhotoValue(right)) &&
    nullable(left.notes) === nullable(right.notes) &&
    Boolean(left.deleted) === Boolean(right.deleted) &&
    mealListValue(left.ingredients) === mealListValue(right.ingredients) &&
    mealListValue(left.totals) === mealListValue(right.totals) &&
    mealListValue(left.tags) === mealListValue(right.tags) &&
    mealListValue(left.aiMeta) === mealListValue(right.aiMeta) &&
    mealListValue(left.planningSource) === mealListValue(right.planningSource)
  );
}

function sortMealsDesc(meals: Meal[]): Meal[] {
  return [...meals].sort(
    (left, right) => getMealSortTimestamp(right) - getMealSortTimestamp(left),
  );
}

async function loadAllMealsFromRepo(uid: string): Promise<Meal[]> {
  return getAllMealsLocal(uid);
}

class LocalMealsReadModel {
  private byId = new Map<string, Meal>();
  private listeners = new Set<Listener>();
  private unsubs: Array<() => void> = [];
  private loading = false;
  private version = 0;
  private loadToken = 0;
  private snapshotCache: LocalMealsSnapshot = EMPTY_SNAPSHOT;

  constructor(
    private readonly uid: string,
    private readonly onIdle: (uid: string, store: LocalMealsReadModel) => void,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.start();
    listener();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  snapshot(): LocalMealsSnapshot {
    if (
      this.snapshotCache.version === this.version &&
      this.snapshotCache.loading === this.loading
    ) {
      return this.snapshotCache;
    }

    this.snapshotCache = {
      meals: sortMealsDesc(Array.from(this.byId.values())),
      loading: this.loading,
      version: this.version,
    };
    return this.snapshotCache;
  }

  async refresh(): Promise<void> {
    const token = ++this.loadToken;
    this.loading = true;
    this.publish();

    try {
      const meals = await loadAllMealsFromRepo(this.uid);
      if (token !== this.loadToken) return;

      this.byId = new Map(
        meals
          .filter((meal) => !meal.deleted && !!meal.cloudId)
          .map((meal) => [mealIdentity(meal), meal]),
      );
      this.version += 1;
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.publish();
      }
    }
  }

  async applyLocalMealEvent(event?: LocalMealEvent): Promise<void> {
    if (!this.matchesUid(event)) return;

    const cloudId = mealEventId(event);
    if (!cloudId) {
      await this.refresh();
      return;
    }

    const meal = await getMealByCloudIdLocal(this.uid, cloudId);
    if (!meal || meal.deleted) {
      this.removeById(cloudId);
      return;
    }

    this.upsert(meal);
  }

  applyLocalDeleteEvent(event?: LocalMealEvent): void {
    if (!this.matchesUid(event)) return;

    const cloudId = mealEventId(event);
    if (cloudId) {
      this.removeById(cloudId);
      return;
    }

    void this.refresh();
  }

  removeById(id: string): void {
    if (this.removeByIdSilently(id)) {
      this.version += 1;
      this.publish();
    }
  }

  upsertLocal(meal: Meal): void {
    this.upsert(meal);
  }

  resetForTests(): void {
    this.stop();
  }

  clearRuntime(): void {
    this.stopEventSubscriptions();
    this.byId.clear();
    this.loading = false;
    this.loadToken += 1;
    this.version += 1;
    this.snapshotCache = EMPTY_SNAPSHOT;
    this.publish();
  }

  private removeByIdSilently(id: string): boolean {
    let changed = false;
    for (const [key, meal] of this.byId.entries()) {
      if (key === id || meal.cloudId === id || meal.mealId === id) {
        this.byId.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  private removeByMealSilently(meal: Meal): boolean {
    const ids = [meal.cloudId, mealIdentity(meal)].filter(
      (id): id is string => Boolean(id),
    );
    return ids.reduce(
      (changed, id) => this.removeByIdSilently(id) || changed,
      false,
    );
  }

  private start(): void {
    if (this.unsubs.length > 0) return;

    this.unsubs = [
      on<LocalMealEvent>("meal:local:upserted", (event) => {
        void this.applyLocalMealEvent(event);
      }),
      on<LocalMealEvent>("meal:local:deleted", (event) => {
        this.applyLocalDeleteEvent(event);
      }),
      on<LocalMealEvent>("meal:synced", (event) => {
        if (!this.matchesUid(event)) return;
        if (mealEventId(event)) {
          void this.applyLocalMealEvent(event);
        } else {
          void this.refresh();
        }
      }),
      on<LocalMealEvent>("meal:pushed", (event) => {
        if (!this.matchesUid(event)) return;
        if (mealEventId(event)) {
          void this.applyLocalMealEvent(event);
        } else {
          void this.refresh();
        }
      }),
    ];

    void this.refresh();
  }

  private stop(): void {
    this.stopEventSubscriptions();
    this.byId.clear();
    this.loading = false;
    this.loadToken += 1;
    this.version += 1;
    this.snapshotCache = EMPTY_SNAPSHOT;
    if (this.listeners.size === 0) {
      this.onIdle(this.uid, this);
    }
  }

  private stopEventSubscriptions(): void {
    for (const unsubscribe of this.unsubs) {
      unsubscribe();
    }
    this.unsubs = [];
  }

  private matchesUid(event?: LocalMealEvent): boolean {
    return typeof event?.uid === "string" && event.uid === this.uid;
  }

  private upsert(meal: Meal): void {
    if (meal.userUid !== this.uid || meal.deleted || !meal.cloudId) {
      this.removeById(mealIdentity(meal));
      return;
    }

    const existing = this.findByMeal(meal);
    if (existing && areMealSnapshotsEqual(existing, meal)) {
      return;
    }

    this.removeByMealSilently(meal);
    this.byId.set(mealIdentity(meal), meal);
    this.version += 1;
    this.publish();
  }

  private findByMeal(meal: Meal): Meal | null {
    const ids = [meal.cloudId, mealIdentity(meal)].filter(
      (id): id is string => Boolean(id),
    );
    for (const candidate of this.byId.values()) {
      if (
        ids.some(
          (id) =>
            mealIdentity(candidate) === id || candidate.cloudId === id,
        )
      ) {
        return candidate;
      }
    }
    return null;
  }

  private publish(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const stores = new Map<string, LocalMealsReadModel>();

function deleteStoreIfIdle(uid: string, store: LocalMealsReadModel): void {
  if (store !== stores.get(uid)) return;
  stores.delete(uid);
}

function ensureStore(uid: string | null | undefined): LocalMealsReadModel | null {
  if (!uid) return null;
  let store = stores.get(uid);
  if (!store) {
    store = new LocalMealsReadModel(uid, deleteStoreIfIdle);
    stores.set(uid, store);
  }
  return store;
}

function peekStore(uid: string | null | undefined): LocalMealsReadModel | null {
  if (!uid) return null;
  return stores.get(uid) ?? null;
}

export function subscribeLocalMeals(
  uid: string | null | undefined,
  listener: Listener,
): () => void {
  const store = ensureStore(uid);
  if (!store) {
    listener();
    return () => undefined;
  }
  return store.subscribe(listener);
}

export function getLocalMealsSnapshot(
  uid: string | null | undefined,
): LocalMealsSnapshot {
  return peekStore(uid)?.snapshot() ?? EMPTY_SNAPSHOT;
}

export async function refreshLocalMeals(
  uid: string | null | undefined,
): Promise<void> {
  await ensureStore(uid)?.refresh();
}

export function selectLocalMealsByDayKey(
  uid: string | null | undefined,
  dayKey: string | null | undefined,
  order: "asc" | "desc" = "asc",
): Meal[] {
  const normalizedDayKey = normalizeMealDayKey(dayKey);
  if (!normalizedDayKey) return [];

  const meals =
    peekStore(uid)
      ?.snapshot()
      .meals.filter((meal) => getMealDayKey(meal) === normalizedDayKey) ?? [];

  return order === "asc" ? [...meals].reverse() : meals;
}

export function selectLocalMealsByRange(
  uid: string | null | undefined,
  range: { start: Date; end: Date },
): Meal[] {
  return (
    peekStore(uid)
      ?.snapshot()
      .meals.filter((meal) => isMealInDayKeyRange(meal, range)) ?? []
  );
}

export function selectLocalMealByCloudId(
  uid: string | null | undefined,
  cloudId: string | null | undefined,
): Meal | null {
  if (!cloudId) return null;
  return (
    peekStore(uid)
      ?.snapshot()
      .meals.find((meal) => meal.cloudId === cloudId) ??
    null
  );
}

export function upsertLocalMealSnapshot(
  uid: string | null | undefined,
  meal: Meal,
): void {
  ensureStore(uid)?.upsertLocal(meal);
}

export function removeLocalMealSnapshot(
  uid: string | null | undefined,
  cloudId: string,
): void {
  ensureStore(uid)?.removeById(cloudId);
}

export function clearLocalMealsRuntime(uid: string | null | undefined): void {
  const store = peekStore(uid);
  if (!uid || !store) return;
  store.clearRuntime();
  stores.delete(uid);
}

export function __resetLocalMealsStoreForTests(): void {
  for (const store of stores.values()) {
    store.resetForTests();
  }
  stores.clear();
}

export function __hasLocalMealsStoreForTests(
  uid: string | null | undefined,
): boolean {
  return Boolean(uid && stores.has(uid));
}
