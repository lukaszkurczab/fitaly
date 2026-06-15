import NetInfo from "@react-native-community/netinfo";
import { Sync } from "@/utils/debug";
import { isOfflineNetState } from "@/services/core/networkState";
import { isE2EModeEnabled } from "@/services/e2e/config";
import {
  createServiceError,
  normalizeServiceError,
  type ServiceError,
} from "@/services/contracts/serviceError";
import type { QueueKind } from "./types";
import type { SyncStrategy } from "./sync.strategy";
import { runPushQueue, type PushQueueResult } from "./sync.push";
import { getQueuedOpsCount } from "./queue.repo";
import { getPendingUploads } from "./images.repo";
import { mealsStrategy } from "./strategies/meals.strategy";
import { myMealsStrategy } from "./strategies/myMeals.strategy";
import { chatStrategy } from "./strategies/chat.strategy";
import { smartMemoryStrategy } from "./strategies/smartMemory.strategy";
import { userProfileStrategy } from "./strategies/userProfile.strategy";
import {
  imagesStrategy,
  processImageUploads as processImageUploadsStrategy,
} from "./strategies/images.strategy";
import {
  getLastChatPullTs,
  getLastSmartMemoryPullTs,
  getLastMyMealsPullTs,
  getLastPullTs,
  getLastPullCheckTs,
  setLastChatPullTs,
  setLastSmartMemoryPullTs,
  setLastMyMealsPullTs,
  setLastPullTs,
  setLastPullCheckTs,
} from "./sync.storage";

const log = Sync;
const PUSH_BATCH_SIZE = 25;
const RECONNECT_DEBOUNCE_MS = 1200;
const RECONNECT_THROTTLE_MS = 15_000;
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;
const CHAT_STALE_MS = 10 * 60 * 1000;

function logRuntimeFailure(event: string, payload: unknown): void {
  if (isE2EModeEnabled()) {
    log.log(event, payload);
    return;
  }

  log.error(event, payload);
}

export type SyncDomain =
  | "meals"
  | "myMeals"
  | "chat"
  | "smartMemory"
  | "images"
  | "userProfile";
export type SyncReason =
  | "startup"
  | "reconnect"
  | "manual"
  | "local-change"
  | "retry"
  | string;

export type SyncFailure = {
  phase: "push" | "pull" | "images";
  domain?: SyncDomain;
  code: string;
  message: string;
  retryable: boolean;
};

export type SyncRunResult = {
  uid: string;
  reason: SyncReason;
  ok: boolean;
  pushed: PushQueueResult | null;
  pulled: Partial<Record<SyncDomain, number>>;
  skipped: Partial<Record<SyncDomain | "push", string>>;
  failures: SyncFailure[];
};

type DomainConfig = {
  strategy: SyncStrategy;
  queueKinds: QueueKind[];
  staleAfterMs?: number;
  requiredOnStartup?: boolean;
  getLastPullMarker?: (uid: string) => Promise<string | number | null>;
};

const pushStrategies: SyncStrategy[] = [
  mealsStrategy,
  myMealsStrategy,
  chatStrategy,
  smartMemoryStrategy,
  userProfileStrategy,
  imagesStrategy,
];

const domainConfigs: Record<Exclude<SyncDomain, "images" | "userProfile">, DomainConfig> = {
  meals: {
    strategy: mealsStrategy,
    queueKinds: ["upsert", "delete"],
    requiredOnStartup: true,
    getLastPullMarker: getLastPullTs,
  },
  myMeals: {
    strategy: myMealsStrategy,
    queueKinds: ["upsert_mymeal", "delete_mymeal"],
    staleAfterMs: DEFAULT_STALE_MS,
    getLastPullMarker: getLastMyMealsPullTs,
  },
  chat: {
    strategy: chatStrategy,
    queueKinds: [],
    staleAfterMs: CHAT_STALE_MS,
    getLastPullMarker: getLastChatPullTs,
  },
  smartMemory: {
    strategy: smartMemoryStrategy,
    queueKinds: [
      "smart_memory_candidate_upsert",
      "smart_memory_item_edit",
      "smart_memory_item_mute",
      "smart_memory_item_restore",
      "smart_memory_item_delete",
      "smart_memory_item_source_deleted",
      "smart_memory_settings_disable",
      "smart_memory_settings_enable",
    ],
    staleAfterMs: DEFAULT_STALE_MS,
    getLastPullMarker: getLastSmartMemoryPullTs,
  },
};

let netUnsub: null | (() => void) = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let runningCount = 0;
let runtimeToken = 0;
let activeRuntimeUid: string | null = null;
let lastReconnectRunAt = 0;

const uidSyncLocks = new Map<string, Promise<void>>();
const inFlightPulls = new Map<string, Promise<number>>();
const inFlightPushes = new Map<string, Promise<PushQueueResult>>();
const inFlightRequests = new Map<string, Promise<void>>();
const inFlightReconciles = new Map<string, Promise<SyncRunResult>>();

function toSyncError(error: unknown): ServiceError {
  return normalizeServiceError(error, {
    code: "sync/unknown",
    source: "SyncEngine",
    retryable: true,
  });
}

function pushFailedError(result: PushQueueResult): ServiceError {
  return createServiceError({
    code: "sync/push-failed",
    source: "SyncEngine",
    retryable: true,
    message: `Push queue completed with ${result.failed} failed operation(s)`,
  });
}

async function withUidSyncLock<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const previous = uidSyncLocks.get(uid) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  uidSyncLocks.set(uid, next);

  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (uidSyncLocks.get(uid) === next) uidSyncLocks.delete(uid);
  }
}

function createPullKey(uid: string, domain: SyncDomain): string {
  return `${uid}:${domain}`;
}

function createRequestKey(params: {
  uid: string;
  domain: SyncDomain;
  reason: SyncReason;
  pullAfterPush?: boolean;
}): string {
  return [
    params.uid,
    params.domain,
    params.reason,
    params.pullAfterPush === false ? "push-only" : "push-pull",
  ].join(":");
}

function emptyResult(uid: string, reason: SyncReason): SyncRunResult {
  return {
    uid,
    reason,
    ok: true,
    pushed: null,
    pulled: {},
    skipped: {},
    failures: [],
  };
}

async function isOnline(): Promise<boolean> {
  const net = await NetInfo.fetch();
  return !isOfflineNetState(net);
}

function recordFailure(
  result: SyncRunResult,
  phase: SyncFailure["phase"],
  error: unknown,
  domain?: SyncDomain,
) {
  const err = toSyncError(error);
  result.failures.push({
    phase,
    domain,
    code: err.code,
    message: err.message,
    retryable: err.retryable,
  });
  result.ok = false;
}

async function runPushOnce(uid: string): Promise<PushQueueResult> {
  const existing = inFlightPushes.get(uid);
  if (existing) return existing;

  const task = withUidSyncLock(uid, () =>
    runPushQueue(uid, PUSH_BATCH_SIZE, pushStrategies),
  ).finally(() => {
    if (inFlightPushes.get(uid) === task) {
      inFlightPushes.delete(uid);
    }
  });
  inFlightPushes.set(uid, task);
  return task;
}

export async function pushQueue(uid: string): Promise<PushQueueResult> {
  return runPushOnce(uid);
}

async function runPull(uid: string, domain: SyncDomain): Promise<number> {
  if (domain === "images" || domain === "userProfile") return 0;
  const config = domainConfigs[domain];
  const key = createPullKey(uid, domain);
  const existing = inFlightPulls.get(key);
  if (existing) return existing;

  const task = withUidSyncLock(uid, async () => {
    const pulled = await config.strategy.pull(uid);
    await setLastPullCheckTs(uid, domain, new Date(Date.now()).toISOString());
    return pulled;
  }).finally(() => {
    if (inFlightPulls.get(key) === task) {
      inFlightPulls.delete(key);
    }
  });
  inFlightPulls.set(key, task);
  return task;
}

async function hasDomainDirtyQueue(uid: string, domain: SyncDomain): Promise<boolean> {
  if (domain === "images") {
    return (await getPendingUploads(uid)).length > 0;
  }
  if (domain === "userProfile") {
    return (
      (await getQueuedOpsCount(uid, {
        kinds: ["update_user_profile", "upload_user_avatar"],
      })) > 0
    );
  }
  const queueKinds = domainConfigs[domain].queueKinds;
  if (queueKinds.length === 0) return false;
  return (await getQueuedOpsCount(uid, { kinds: queueKinds })) > 0;
}

async function hasAnyQueuedOps(uid: string): Promise<boolean> {
  return (await getQueuedOpsCount(uid)) > 0;
}

function markerTime(marker: string | number | null): number {
  if (typeof marker === "number") return marker;
  if (!marker) return 0;
  const primary = marker.split("|")[0];
  const parsed = Date.parse(primary);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function isDomainStale(uid: string, domain: SyncDomain): Promise<boolean> {
  if (domain === "images" || domain === "userProfile") return false;
  const config = domainConfigs[domain];
  const lastCheckMarker = await getLastPullCheckTs(uid, domain);
  const lastCheckTs = markerTime(lastCheckMarker);
  if (lastCheckTs > 0) {
    return Date.now() - lastCheckTs > (config.staleAfterMs ?? DEFAULT_STALE_MS);
  }
  const marker = await config.getLastPullMarker?.(uid);
  const ts = markerTime(marker ?? null);
  if (ts <= 0) return true;
  return Date.now() - ts > (config.staleAfterMs ?? DEFAULT_STALE_MS);
}

async function shouldPullDomain(
  uid: string,
  domain: Exclude<SyncDomain, "images" | "userProfile">,
  reason: "startup" | "reconnect" | "manual",
): Promise<boolean> {
  const config = domainConfigs[domain];
  if (reason === "manual") return true;
  if (reason === "startup" && config.requiredOnStartup) return true;
  return (await hasDomainDirtyQueue(uid, domain)) || (await isDomainStale(uid, domain));
}

async function maybeProcessImages(
  uid: string,
  result: SyncRunResult,
  force: boolean,
): Promise<void> {
  const dirty = force || (await hasDomainDirtyQueue(uid, "images"));
  if (!dirty) {
    result.skipped.images = "clean";
    return;
  }
  try {
    await withUidSyncLock(uid, () => processImageUploadsStrategy(uid));
  } catch (error) {
    recordFailure(result, "images", error, "images");
  }
}

async function runReconcile(
  uid: string,
  reason: "startup" | "reconnect" | "manual",
): Promise<SyncRunResult> {
  const key = `${uid}:${reason}`;
  const existing = inFlightReconciles.get(key);
  if (existing) return existing;

  const task = (async () => {
    runningCount++;
    const result = emptyResult(uid, reason);
    const runLog = log.child(`reconcile:${reason}`);
    runLog.log("start", { uid });

    try {
      if (!(await isOnline())) {
        result.skipped.push = "offline";
        result.skipped.meals = "offline";
        result.skipped.myMeals = "offline";
        result.skipped.chat = "offline";
        result.skipped.smartMemory = "offline";
        result.skipped.images = "offline";
        runLog.log("skip:offline", { uid });
        return result;
      }

      const skipRemotePulls = isE2EModeEnabled();
      const domainsSelectedBeforePush = new Set<Exclude<SyncDomain, "images" | "userProfile">>();
      if (!skipRemotePulls) {
        for (const domain of ["meals", "myMeals", "chat", "smartMemory"] as const) {
          if (await shouldPullDomain(uid, domain, reason)) {
            domainsSelectedBeforePush.add(domain);
          }
        }
      }

      if (skipRemotePulls) {
        result.skipped.images = "e2e";
      } else {
        await maybeProcessImages(uid, result, reason === "manual");
      }

      if (await hasAnyQueuedOps(uid)) {
        try {
          result.pushed = await runPushOnce(uid);
          if (result.pushed.failed > 0) {
            recordFailure(result, "push", pushFailedError(result.pushed));
          }
        } catch (error) {
          recordFailure(result, "push", error);
        }
      } else {
        result.skipped.push = "clean";
      }

      if (skipRemotePulls) {
        result.skipped.meals = "e2e";
        result.skipped.myMeals = "e2e";
        result.skipped.chat = "e2e";
        result.skipped.smartMemory = "e2e";
        runLog.log("skip:remote-pull:e2e", { uid });
        return result;
      }

      for (const domain of ["meals", "myMeals", "chat", "smartMemory"] as const) {
        const shouldPull =
          domainsSelectedBeforePush.has(domain) ||
          (await shouldPullDomain(uid, domain, reason));
        if (!shouldPull) {
          result.skipped[domain] = "clean";
          continue;
        }
        try {
          result.pulled[domain] = await runPull(uid, domain);
        } catch (error) {
          recordFailure(result, "pull", error, domain);
        }
      }

      runLog.log("done", {
        ok: result.ok,
        failures: result.failures.length,
        pulled: result.pulled,
        skipped: result.skipped,
      });
      return result;
    } finally {
      runningCount = Math.max(0, runningCount - 1);
    }
  })().finally(() => {
    if (inFlightReconciles.get(key) === task) {
      inFlightReconciles.delete(key);
    }
  });

  inFlightReconciles.set(key, task);
  return task;
}

export async function requestSync(params: {
  uid: string;
  domain: SyncDomain;
  reason: SyncReason;
  pullAfterPush?: boolean;
}): Promise<void> {
  if (!params.uid) return;
  const key = createRequestKey(params);
  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const task = (async () => {
    runningCount++;
    const requestLog = log.child("request");
    requestLog.log("start", params);
    try {
      if (!(await isOnline())) {
        requestLog.log("skip:offline", params);
        return;
      }

      if (params.domain === "images") {
        await withUidSyncLock(params.uid, () => processImageUploadsStrategy(params.uid));
        return;
      }

      const pushed = await runPushOnce(params.uid);
      if (pushed.failed > 0) {
        throw pushFailedError(pushed);
      }

      if (params.pullAfterPush !== false) {
        await runPull(params.uid, params.domain);
      }
      requestLog.log("done", params);
    } finally {
      runningCount = Math.max(0, runningCount - 1);
    }
  })().finally(() => {
    if (inFlightRequests.get(key) === task) {
      inFlightRequests.delete(key);
    }
  });

  inFlightRequests.set(key, task);
  return task;
}

export function runStartupReconcile(uid: string): Promise<SyncRunResult> {
  return runReconcile(uid, "startup");
}

export function runReconnectReconcile(uid: string): Promise<SyncRunResult> {
  return runReconcile(uid, "reconnect");
}

export function runManualReconcile(uid: string): Promise<SyncRunResult> {
  return runReconcile(uid, "manual");
}

function scheduleReconnect(uid: string) {
  if (reconnectTimer) return;
  const now = Date.now();
  const waitMs =
    now - lastReconnectRunAt < RECONNECT_THROTTLE_MS
      ? RECONNECT_THROTTLE_MS - (now - lastReconnectRunAt)
      : RECONNECT_DEBOUNCE_MS;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (activeRuntimeUid !== uid) return;
    lastReconnectRunAt = Date.now();
    void runReconnectReconcile(uid)
      .then((result) => {
        if (!result.ok) {
          logRuntimeFailure("reconnect:failed", {
            uid,
            failures: result.failures,
          });
        }
      })
      .catch((error) => {
        const err = toSyncError(error);
        logRuntimeFailure("reconnect:error", {
          uid,
          code: err.code,
          message: err.message,
          retryable: err.retryable,
        });
      });
  }, waitMs);
}

export function startSyncLoop(uid: string) {
  if (!uid) return;
  stopSyncLoop();
  activeRuntimeUid = uid;
  const token = ++runtimeToken;
  let lastObservedOnline: boolean | null = null;

  netUnsub = NetInfo.addEventListener((state) => {
    log.log("net:event", { isConnected: state.isConnected });
    if (token !== runtimeToken || activeRuntimeUid !== uid) return;
    const isOnlineState = !isOfflineNetState(state);
    if (lastObservedOnline === null) {
      lastObservedOnline = isOnlineState;
      return;
    }
    const wasOnline = lastObservedOnline;
    lastObservedOnline = isOnlineState;
    if (!wasOnline && isOnlineState) {
      scheduleReconnect(uid);
    }
  });

  log.log("runtime:started", { uid });
  void runStartupReconcile(uid)
    .then((result) => {
      if (!result.ok) {
        logRuntimeFailure("startup:failed", {
          uid,
          failures: result.failures,
        });
      }
    })
    .catch((error) => {
      const err = toSyncError(error);
      logRuntimeFailure("startup:error", {
        uid,
        code: err.code,
        message: err.message,
        retryable: err.retryable,
      });
    });
}

export function stopSyncLoop() {
  runtimeToken += 1;
  activeRuntimeUid = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    log.log("reconnect:timer_cleared");
  }
  if (netUnsub) {
    netUnsub();
    netUnsub = null;
    log.log("net:unsubscribed");
  }
}

export function getSyncStatus(): { running: boolean; hasTimer: boolean } {
  return { running: runningCount > 0, hasTimer: netUnsub !== null || reconnectTimer !== null };
}

export async function pullChanges(uid: string): Promise<void> {
  await runPull(uid, "meals");
}

export async function pullMyMealChanges(uid: string): Promise<void> {
  await runPull(uid, "myMeals");
}

export async function pullChatChanges(uid: string): Promise<void> {
  await runPull(uid, "chat");
}

export async function pullSmartMemoryChanges(uid: string): Promise<void> {
  await runPull(uid, "smartMemory");
}

export async function processImageUploads(uid: string): Promise<void> {
  await withUidSyncLock(uid, async () => {
    await processImageUploadsStrategy(uid);
  });
}

export {
  setLastPullTs,
  getLastPullTs,
  setLastMyMealsPullTs,
  getLastMyMealsPullTs,
  setLastChatPullTs,
  getLastChatPullTs,
  setLastSmartMemoryPullTs,
  getLastSmartMemoryPullTs,
  setLastPullCheckTs,
  getLastPullCheckTs,
};
