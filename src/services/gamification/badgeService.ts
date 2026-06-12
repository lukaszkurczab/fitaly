import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Badge } from "@/types/badge";
import { get, post } from "@/services/core/apiClient";
import { emit, on } from "@/services/core/events";

type BadgeListResponse = {
  items?: unknown[];
};

type BadgeChangedPayload = {
  uid?: string;
};

type BadgeSubscriber = (badges: Badge[]) => void;

type BadgeStream = {
  subscribers: Set<BadgeSubscriber>;
  latest: Badge[];
  initialized: boolean;
  dirty: boolean;
  eventUnsubscribe: (() => void) | null;
  inFlight: Promise<Badge[]> | null;
};

const premiumReconcileInFlightByUid = new Map<
  string,
  { isPremium: boolean; promise: Promise<void> }
>();
const badgeStreamsByUid = new Map<string, BadgeStream>();
const badgeListInFlightByUid = new Map<string, Promise<Badge[]>>();
const badgeRuntimeGenerationByUid = new Map<string, number>();

function badgeCacheKey(uid: string) {
  return `badge:list:${uid}`;
}

function getBadgeRuntimeGeneration(uid: string): number {
  return badgeRuntimeGenerationByUid.get(uid) ?? 0;
}

function isCurrentBadgeRuntime(uid: string, generation: number): boolean {
  return getBadgeRuntimeGeneration(uid) === generation;
}

export function clearBadgeRuntime(uid: string | null | undefined): void {
  if (!uid) return;
  badgeRuntimeGenerationByUid.set(uid, getBadgeRuntimeGeneration(uid) + 1);
  badgeListInFlightByUid.delete(uid);
  premiumReconcileInFlightByUid.delete(uid);

  const stream = badgeStreamsByUid.get(uid);
  stream?.eventUnsubscribe?.();
  badgeStreamsByUid.delete(uid);
}

function sortByUnlockedAtAsc(a: Badge, b: Badge): number {
  return a.unlockedAt - b.unlockedAt;
}

function normalizeBadge(raw: unknown): Badge | null {
  if (!raw || typeof raw !== "object") return null;
  const badge = raw as Partial<Badge>;

  if (
    typeof badge.id !== "string" ||
    typeof badge.type !== "string" ||
    typeof badge.label !== "string" ||
    (typeof badge.milestone !== "number" && typeof badge.milestone !== "string") ||
    typeof badge.icon !== "string" ||
    typeof badge.color !== "string" ||
    typeof badge.unlockedAt !== "number"
  ) {
    return null;
  }

  return {
    id: badge.id,
    type: badge.type,
    label: badge.label,
    milestone: badge.milestone,
    icon: badge.icon,
    color: badge.color,
    unlockedAt: badge.unlockedAt,
  };
}

function normalizeBadgeList(payload: unknown): Badge[] {
  const response = (payload || {}) as BadgeListResponse;
  const items = Array.isArray(response.items)
    ? response.items
        .map((item) => normalizeBadge(item))
        .filter((item): item is Badge => item !== null)
    : [];
  return items.sort(sortByUnlockedAtAsc);
}

async function readBadgeCache(uid: string): Promise<Badge[]> {
  try {
    const raw = await AsyncStorage.getItem(badgeCacheKey(uid));
    if (!raw) return [];
    return normalizeBadgeList({ items: JSON.parse(raw) });
  } catch {
    return [];
  }
}

async function writeBadgeCache(uid: string, items: Badge[]): Promise<void> {
  try {
    await AsyncStorage.setItem(badgeCacheKey(uid), JSON.stringify(items));
  } catch {
    // Ignore cache write failures for best-effort offline badge access.
  }
}

export async function listBadges(uid: string): Promise<Badge[]> {
  const existing = badgeListInFlightByUid.get(uid);
  if (existing) {
    return existing;
  }

  const generation = getBadgeRuntimeGeneration(uid);
  const request = (async () => {
    try {
      const response = await get<BadgeListResponse>("/users/me/badges");
      const items = normalizeBadgeList(response);
      if (isCurrentBadgeRuntime(uid, generation)) {
        await writeBadgeCache(uid, items);
      }
      return items;
    } catch {
      return readBadgeCache(uid);
    }
  })();

  badgeListInFlightByUid.set(uid, request);

  try {
    return await request;
  } finally {
    if (badgeListInFlightByUid.get(uid) === request) {
      badgeListInFlightByUid.delete(uid);
    }
  }
}

function getOrCreateBadgeStream(uid: string): BadgeStream {
  const existing = badgeStreamsByUid.get(uid);
  if (existing) {
    return existing;
  }

  const created: BadgeStream = {
    subscribers: new Set<BadgeSubscriber>(),
    latest: [],
    initialized: false,
    dirty: false,
    eventUnsubscribe: null,
    inFlight: null,
  };
  badgeStreamsByUid.set(uid, created);
  return created;
}

function notifyBadgeStream(stream: BadgeStream) {
  const snapshot = stream.latest;
  stream.subscribers.forEach((subscriber) => {
    subscriber(snapshot);
  });
}

async function refreshBadgeStream(
  uid: string,
  stream: BadgeStream
): Promise<Badge[]> {
  if (stream.inFlight) {
    return stream.inFlight;
  }

  const request = listBadges(uid)
    .then((items) => {
      if (badgeStreamsByUid.get(uid) !== stream) {
        return items;
      }
      stream.latest = items;
      stream.initialized = true;
      stream.dirty = false;
      notifyBadgeStream(stream);
      return items;
    })
    .finally(() => {
      if (badgeStreamsByUid.get(uid) === stream && stream.inFlight === request) {
        stream.inFlight = null;
      }
    });

  stream.inFlight = request;
  return request;
}

export function subscribeBadges(uid: string, cb: (badges: Badge[]) => void) {
  const stream = getOrCreateBadgeStream(uid);
  stream.subscribers.add(cb);

  if (stream.initialized) {
    cb(stream.latest);
  }

  if (!stream.eventUnsubscribe) {
    stream.eventUnsubscribe = on<BadgeChangedPayload>("badge:changed", (payload) => {
      if (payload?.uid && payload.uid !== uid) return;
      if (stream.subscribers.size === 0) {
        stream.dirty = true;
        return;
      }
      void refreshBadgeStream(uid, stream);
    });
  }

  if (!stream.initialized || stream.dirty) {
    void refreshBadgeStream(uid, stream);
  }

  return () => {
    stream.subscribers.delete(cb);
  };
}

export async function primeBadges(uid: string): Promise<Badge[]> {
  if (!uid) return [];
  const stream = getOrCreateBadgeStream(uid);
  return refreshBadgeStream(uid, stream);
}

export async function unlockPremiumBadgesIfEligible(
  uid: string,
  isPremium: boolean
) {
  if (!uid) return;

  const generation = getBadgeRuntimeGeneration(uid);
  const existing = premiumReconcileInFlightByUid.get(uid);
  if (existing && existing.isPremium === isPremium) {
    await existing.promise;
    return;
  }

  const request = (async () => {
    await post("/users/me/badges/premium/reconcile", {
      isPremium,
    });
    if (isCurrentBadgeRuntime(uid, generation)) {
      emit("badge:changed", { uid });
    }
  })();

  premiumReconcileInFlightByUid.set(uid, { isPremium, promise: request });

  try {
    await request;
  } finally {
    const current = premiumReconcileInFlightByUid.get(uid);
    if (current?.promise === request) {
      premiumReconcileInFlightByUid.delete(uid);
    }
  }
}
