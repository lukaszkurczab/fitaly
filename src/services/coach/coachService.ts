import AsyncStorage from "@react-native-async-storage/async-storage";
import { get } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { createServiceError } from "@/services/contracts/serviceError";
import {
  asBoolean,
  asNumber,
  asString,
  isRecord,
} from "@/services/contracts/guards";
import { debugScope } from "@/utils/debug";
import {
  getCoachInsightValidUntil,
  isCanonicalCoachInsightId,
  isCanonicalCoachValidUntil,
  isCoachActionType,
  isCoachDayKey,
  isCoachEmptyReason,
  isCoachInsightType,
  isCoachSource,
} from "@/services/coach/coachContract";
import type {
  CoachInsight,
  CoachMeta,
  CoachResponse,
  CoachResult,
  CoachResultStatus,
} from "@/services/coach/coachTypes";

const log = debugScope("CoachService");
const COACH_ENDPOINT = withV2("/users/me/coach");
const COACH_SERVICE_SOURCE = "CoachService";

export const COACH_STORAGE_KEY_PREFIX = "coach:last:v1";

const memoryCacheByKey = new Map<string, CoachResponse>();
const inFlightByKey = new Map<string, { promise: Promise<CoachResult> }>();
const cacheGenerationByKey = new Map<string, number>();

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentCoachDayKey(now: Date = new Date()): string {
  return toDayKey(now);
}

function normalizeDayKey(dayKey?: string | null): string {
  const normalized = dayKey?.trim();
  return normalized || getCurrentCoachDayKey();
}

function createComputedAt(): string {
  return new Date().toISOString();
}

function createCacheKey(uid: string, dayKey: string): string {
  return `${uid}:${dayKey}`;
}

function createStorageKey(uid: string, dayKey: string): string {
  return `${COACH_STORAGE_KEY_PREFIX}:${uid}:${dayKey}`;
}

function createStorageKeyPrefix(uid: string): string {
  return `${COACH_STORAGE_KEY_PREFIX}:${uid}:`;
}

function getCacheGeneration(cacheKey: string): number {
  return cacheGenerationByKey.get(cacheKey) ?? 0;
}

function bumpCacheGeneration(cacheKey: string): void {
  cacheGenerationByKey.set(cacheKey, getCacheGeneration(cacheKey) + 1);
}

function isCacheGenerationCurrent(cacheKey: string, generation: number): boolean {
  return getCacheGeneration(cacheKey) === generation;
}

function buildEndpoint(dayKey: string): string {
  return `${COACH_ENDPOINT}?day=${encodeURIComponent(dayKey)}`;
}

function toStrictString(value: unknown): string | null {
  const normalized = asString(value)?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function toStrictStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map((item) => toStrictString(item));
  if (items.some((item) => item === null)) {
    return null;
  }

  return items as string[];
}

function createInvalidCoachPayloadError(reason: string, payload?: unknown): Error {
  return createServiceError({
    code: "coach/invalid-contract-payload",
    source: COACH_SERVICE_SOURCE,
    retryable: false,
    message: reason,
    cause: payload,
  });
}

function normalizeCoachInsight(
  value: unknown,
  options: { dayKey: string },
): CoachInsight | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  if (!isCoachInsightType(type)) {
    return null;
  }

  const id = toStrictString(value.id);
  if (!id || !isCanonicalCoachInsightId(id, options.dayKey, type)) {
    return null;
  }

  const priority = asNumber(value.priority);
  if (priority === undefined || priority < 0) {
    return null;
  }

  const title = toStrictString(value.title);
  const body = toStrictString(value.body);
  if (!title || !body) {
    return null;
  }

  const actionType = value.actionType;
  if (!isCoachActionType(actionType)) {
    return null;
  }

  const actionLabel =
    value.actionLabel === null || value.actionLabel === undefined
      ? null
      : toStrictString(value.actionLabel);
  if (value.actionLabel !== null && value.actionLabel !== undefined && !actionLabel) {
    return null;
  }
  if ((actionType === "none" && actionLabel !== null) || (actionType !== "none" && actionLabel === null)) {
    return null;
  }

  const reasonCodes = toStrictStringArray(value.reasonCodes);
  if (reasonCodes === null) {
    return null;
  }

  if (!isCoachSource(value.source)) {
    return null;
  }

  if (!isCanonicalCoachValidUntil(value.validUntil, options.dayKey)) {
    return null;
  }

  const confidence = asNumber(value.confidence);
  const isPositive = asBoolean(value.isPositive);
  if (
    confidence === undefined ||
    confidence < 0 ||
    confidence > 1 ||
    isPositive === undefined
  ) {
    return null;
  }

  return {
    id,
    type,
    priority,
    title,
    body,
    actionLabel,
    actionType,
    reasonCodes,
    source: "rules",
    validUntil: getCoachInsightValidUntil(options.dayKey),
    confidence,
    isPositive,
  };
}

function normalizeCoachMeta(value: unknown): CoachMeta | null {
  const payload = isRecord(value) ? value : {};
  const available = asBoolean(payload.available);
  const isDegraded = asBoolean(payload.isDegraded);
  const emptyReason = payload.emptyReason;

  if (
    available !== true ||
    isDegraded === undefined ||
    !(
      emptyReason === null ||
      emptyReason === undefined ||
      isCoachEmptyReason(emptyReason)
    )
  ) {
    return null;
  }

  return {
    available,
    emptyReason:
      emptyReason === null || emptyReason === undefined ? null : emptyReason,
    isDegraded,
  };
}

export function createFallbackCoachResponse(dayKey?: string | null): CoachResponse {
  return {
    dayKey: normalizeDayKey(dayKey),
    computedAt: createComputedAt(),
    source: "rules",
    insights: [],
    topInsight: null,
    meta: {
      available: false,
      emptyReason: null,
      isDegraded: false,
    },
  };
}

export function normalizeCoachResponse(
  value: unknown,
  _fallbackDayKey?: string | null,
): CoachResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const dayKey = toStrictString(value.dayKey);
  const computedAt = toStrictString(value.computedAt);
  if (!dayKey || !isCoachDayKey(dayKey) || !computedAt || !isCoachSource(value.source)) {
    return null;
  }

  if (!Array.isArray(value.insights) || value.insights.length > 3) {
    return null;
  }

  const insights = value.insights.map((item) =>
    normalizeCoachInsight(item, { dayKey }),
  );
  if (insights.some((item) => item === null)) {
    return null;
  }

  const topInsight =
    value.topInsight === null
      ? null
      : normalizeCoachInsight(value.topInsight, { dayKey });
  if (value.topInsight !== null && topInsight === null) {
    return null;
  }

  const meta = normalizeCoachMeta(value.meta);
  if (!meta || !meta.available) {
    return null;
  }

  const normalizedInsights = insights as CoachInsight[];
  if (normalizedInsights.length === 0) {
    if (topInsight !== null) {
      return null;
    }
    if (meta.emptyReason === null) {
      return null;
    }
  } else {
    if (!topInsight || topInsight.id !== normalizedInsights[0]?.id || meta.emptyReason !== null) {
      return null;
    }
  }

  return {
    dayKey,
    computedAt,
    source: "rules",
    insights: normalizedInsights,
    topInsight,
    meta,
  };
}

async function persistCoach(uid: string, dayKey: string, coach: CoachResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(createStorageKey(uid, dayKey), JSON.stringify(coach));
  } catch {
    // Ignore storage write failures for best-effort cache.
  }
}

async function readPersistedCoach(
  uid: string,
  dayKey: string,
): Promise<CoachResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(createStorageKey(uid, dayKey));
    if (!raw) {
      return null;
    }
    return normalizeCoachResponse(JSON.parse(raw) as unknown, dayKey);
  } catch {
    return null;
  }
}

function buildCoachResult(input: {
  coach: CoachResponse;
  source: CoachResult["source"];
  status: CoachResultStatus;
  enabled: boolean;
  isStale: boolean;
  error: unknown | null;
}): CoachResult {
  return input;
}

function buildFallbackResult(input: {
  dayKey: string;
  source: CoachResult["source"];
  status: CoachResultStatus;
  enabled: boolean;
  error: unknown | null;
}): CoachResult {
  return buildCoachResult({
    coach: createFallbackCoachResponse(input.dayKey),
    source: input.source,
    status: input.status,
    enabled: input.enabled,
    isStale: true,
    error: input.error,
  });
}

async function buildCachedCoachResult(params: {
  uid: string;
  dayKey: string;
  error: unknown;
  status: Extract<CoachResultStatus, "stale_cache" | "invalid_payload">;
  generation?: number;
}): Promise<CoachResult | null> {
  const cacheKey = createCacheKey(params.uid, params.dayKey);
  const memory = memoryCacheByKey.get(cacheKey);
  if (memory) {
    return buildCoachResult({
      coach: memory,
      source: "memory",
      status: params.status,
      enabled: true,
      isStale: true,
      error: params.error,
    });
  }

  const persisted = await readPersistedCoach(params.uid, params.dayKey);
  if (persisted) {
    if (
      params.generation === undefined ||
      isCacheGenerationCurrent(cacheKey, params.generation)
    ) {
      memoryCacheByKey.set(cacheKey, persisted);
    }
    return buildCoachResult({
      coach: persisted,
      source: "storage",
      status: params.status,
      enabled: true,
      isStale: true,
      error: params.error,
    });
  }

  return null;
}

export async function getCoach(
  uid: string | null | undefined,
  options?: { dayKey?: string | null; force?: boolean },
): Promise<CoachResult> {
  const dayKey = normalizeDayKey(options?.dayKey);
  const fallbackCoach = createFallbackCoachResponse(dayKey);

  if (!uid) {
    return buildCoachResult({
      coach: fallbackCoach,
      source: "fallback",
      status: "no_user",
      enabled: true,
      isStale: true,
      error: null,
    });
  }

  const cacheKey = createCacheKey(uid, dayKey);
  if (!options?.force) {
    const memory = memoryCacheByKey.get(cacheKey);
    if (memory) {
      return buildCoachResult({
        coach: memory,
        source: "memory",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      });
    }

    const existing = inFlightByKey.get(cacheKey);
    if (existing) {
      return existing.promise;
    }
  }

  const entry = {} as { promise: Promise<CoachResult> };
  const generation = getCacheGeneration(cacheKey);
  entry.promise = (async (): Promise<CoachResult> => {
    try {
      const payload = await get<unknown>(buildEndpoint(dayKey), { timeout: 15_000 });
      const normalized = normalizeCoachResponse(payload, dayKey);
      if (!normalized) {
        throw createInvalidCoachPayloadError("Invalid coach contract payload", payload);
      }

      if (isCacheGenerationCurrent(cacheKey, generation)) {
        memoryCacheByKey.set(cacheKey, normalized);
        await persistCoach(uid, dayKey, normalized);
      }

      return buildCoachResult({
        coach: normalized,
        source: "remote",
        status: "live_success",
        enabled: true,
        isStale: false,
        error: null,
      });
    } catch (error) {
      log.warn("getCoach backend error", { uid, dayKey, error });
      const isInvalidPayload =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: unknown }).code === "coach/invalid-contract-payload";

      const cached = await buildCachedCoachResult({
        uid,
        dayKey,
        error,
        status: isInvalidPayload ? "invalid_payload" : "stale_cache",
        generation,
      });
      if (cached) {
        return cached;
      }

      return buildFallbackResult({
        dayKey,
        source: "fallback",
        status: isInvalidPayload ? "invalid_payload" : "service_unavailable",
        enabled: true,
        error,
      });
    } finally {
      const current = inFlightByKey.get(cacheKey);
      if (current === entry) {
        inFlightByKey.delete(cacheKey);
      }
    }
  })();

  inFlightByKey.set(cacheKey, entry);
  return entry.promise;
}

export function refreshCoach(
  uid: string | null | undefined,
  options?: { dayKey?: string | null },
): Promise<CoachResult> {
  return getCoach(uid, { ...options, force: true });
}

export async function invalidateCoachCache(
  uid: string | null | undefined,
  options?: { dayKey?: string | null },
): Promise<void> {
  if (!uid) {
    return;
  }

  const normalizedDayKey = options?.dayKey?.trim();
  if (normalizedDayKey) {
    const cacheKey = createCacheKey(uid, normalizedDayKey);
    bumpCacheGeneration(cacheKey);
    memoryCacheByKey.delete(cacheKey);
    inFlightByKey.delete(cacheKey);
    try {
      await AsyncStorage.removeItem(createStorageKey(uid, normalizedDayKey));
    } catch {
      // Ignore cache invalidation failures for best-effort refresh behavior.
    }
    return;
  }

  for (const cacheKey of Array.from(memoryCacheByKey.keys())) {
    if (cacheKey.startsWith(`${uid}:`)) {
      bumpCacheGeneration(cacheKey);
      memoryCacheByKey.delete(cacheKey);
    }
  }
  for (const cacheKey of Array.from(inFlightByKey.keys())) {
    if (cacheKey.startsWith(`${uid}:`)) {
      bumpCacheGeneration(cacheKey);
      inFlightByKey.delete(cacheKey);
    }
  }

  try {
    const storageKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = storageKeys.filter((key) =>
      key.startsWith(createStorageKeyPrefix(uid)),
    );
    if (matchingKeys.length > 0) {
      await AsyncStorage.multiRemove(matchingKeys);
    }
  } catch {
    // Ignore cache invalidation failures for best-effort refresh behavior.
  }
}

export function __resetCoachServiceForTests(): void {
  memoryCacheByKey.clear();
  inFlightByKey.clear();
  cacheGenerationByKey.clear();
}
