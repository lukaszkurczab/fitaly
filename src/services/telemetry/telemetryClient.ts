import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import * as Localization from "expo-localization";
import { Platform } from "react-native";
import { v4 as uuidv4 } from "uuid";
import * as apiClient from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import {
  TELEMETRY_EVENT_NAMES,
  TELEMETRY_SCHEMA_VERSION,
} from "@/services/telemetry/telemetryTypes";
import type {
  TelemetryActor,
  TelemetryBatchPayload,
  TelemetryEventName,
  TelemetryEvent,
  TelemetryProps,
} from "@/services/telemetry/telemetryTypes";

type BufferedTelemetryState = {
  sessionId: string;
  events: BufferedTelemetryEvent[];
};

type BufferedTelemetryEvent = Partial<TelemetryEvent> &
  Pick<TelemetryEvent, "eventId" | "name" | "ts"> & {
    props?: TelemetryProps;
  };

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_RETRY_BASE_MS = 2_000;
const DEFAULT_RETRY_MAX_MS = 60_000;
const TELEMETRY_ENDPOINT = withV2("/telemetry/events/batch");

export const TELEMETRY_BUFFER_STORAGE_KEY = "telemetry:buffer:v1";
export const TELEMETRY_ANONYMOUS_ID_STORAGE_KEY = "telemetry:anonymousId:v1";

let flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS;
let maxBatchSize = DEFAULT_MAX_BATCH_SIZE;
let retryBaseMs = DEFAULT_RETRY_BASE_MS;
let retryMaxMs = DEFAULT_RETRY_MAX_MS;

let initialized = false;
let initPromise: Promise<void> | null = null;
let flushPromise: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let activeFlushAbortController: AbortController | null = null;
let runtimeGeneration = 0;
let resetRuntimePromise: Promise<void> | null = null;
let sessionId = "";
let anonymousId = "";
let currentUserId: string | null = null;
let queue: TelemetryEvent[] = [];
let queuedEventIds = new Set<string>();
let retryAttempt = 0;
let nextAllowedFlushAt = 0;
function isTelemetryEnabled(): boolean {
  return getRuntimeConfig().telemetryEnabled;
}

function nextId(prefix: string): string {
  return `${prefix}_${uuidv4()}`;
}

function createSessionId(): string {
  return nextId("sess");
}

function createEventId(): string {
  return nextId("evt");
}

function createAnonymousId(): string {
  return nextId("anon");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readErrorText(error: Record<string, unknown>): string {
  const message = typeof error.message === "string" ? error.message : "";
  const details = error.details;
  if (isRecord(details)) {
    const detail = typeof details.detail === "string" ? details.detail : "";
    const errorText = typeof details.error === "string" ? details.error : "";
    return `${message} ${detail} ${errorText}`.toLowerCase();
  }

  return message.toLowerCase();
}

function isTelemetryDisabledResponse(error: Record<string, unknown>): boolean {
  return (
    error.status === 503 &&
    readErrorText(error).includes("telemetry ingestion is disabled")
  );
}

function shouldDropFailedBatch(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  if (isTelemetryDisabledResponse(error)) {
    return true;
  }

  return (
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  );
}

function isAbortedTelemetryRequest(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.code === "api/aborted" || error.name === "AbortError")
  );
}

function isTelemetryEvent(value: unknown): value is BufferedTelemetryEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.eventId !== "string" || typeof value.name !== "string") {
    return false;
  }

  if (
    !(TELEMETRY_EVENT_NAMES as readonly string[]).includes(value.name)
  ) {
    return false;
  }

  if (typeof value.ts !== "string") {
    return false;
  }

  if (value.props === undefined) {
    return true;
  }

  return isRecord(value.props);
}

function isV2TelemetryEvent(value: unknown): value is TelemetryEvent {
  if (!isTelemetryEvent(value)) {
    return false;
  }

  return (
    value.schemaVersion === TELEMETRY_SCHEMA_VERSION &&
    typeof value.occurredAt === "string" &&
    typeof value.sessionId === "string" &&
    isRecord(value.actor) &&
    (typeof value.actor.userId === "string" ||
      typeof value.actor.anonymousId === "string") &&
    typeof value.platform === "string" &&
    typeof value.appVersion === "string" &&
    typeof value.timezone === "string"
  );
}

function getCurrentActor(): TelemetryActor {
  const normalizedUserId = currentUserId?.trim();
  if (normalizedUserId) {
    return { userId: normalizedUserId };
  }

  return { anonymousId: anonymousId || createAnonymousId() };
}

function getRequestId(props?: TelemetryProps): string | undefined {
  const requestId = props?.requestId;
  if (typeof requestId !== "string") {
    return undefined;
  }

  const normalized = requestId.trim();
  return normalized || undefined;
}

function normalizeBufferedState(value: unknown): BufferedTelemetryState | null {
  if (!isRecord(value)) {
    return null;
  }

  const restoredSessionId =
    typeof value.sessionId === "string" && value.sessionId.trim()
      ? value.sessionId.trim()
      : createSessionId();
  const restoredEvents = Array.isArray(value.events)
    ? value.events.filter(isTelemetryEvent)
    : [];

  const dedupedEvents: BufferedTelemetryEvent[] = [];
  const seenIds = new Set<string>();

  for (const event of restoredEvents) {
    if (seenIds.has(event.eventId)) {
      continue;
    }

    seenIds.add(event.eventId);
    dedupedEvents.push(event);
  }

  return {
    sessionId: restoredSessionId,
    events: dedupedEvents,
  };
}

function getAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" && version.trim() ? version.trim() : "unknown";
}

function getBuildNumber(): string | null {
  const nativeBuildVersion = Constants.nativeBuildVersion;
  if (typeof nativeBuildVersion === "string" && nativeBuildVersion.trim()) {
    return nativeBuildVersion.trim();
  }

  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === "object") {
    const build =
      Platform.OS === "ios"
        ? (extra as Record<string, unknown>).iosBuildNumber
        : (extra as Record<string, unknown>).androidVersionCode;
    if (typeof build === "string" && build.trim()) {
      return build.trim();
    }
    if (typeof build === "number" && Number.isFinite(build)) {
      return String(build);
    }
  }

  return null;
}

function getLocale(): string {
  const locales = Localization.getLocales?.() || [];
  const primaryLocale = locales[0];
  return primaryLocale?.languageTag?.trim() || "unknown";
}

function getTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function getTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof timezone === "string" && timezone.trim()
    ? timezone.trim()
    : "unknown";
}

function enrichEventContext(event: BufferedTelemetryEvent): TelemetryEvent {
  if (isV2TelemetryEvent(event)) {
    return event;
  }

  const ts = event.ts || new Date().toISOString();
  return {
    ...event,
    ts,
    occurredAt: ts,
    sessionId: event.sessionId || sessionId || createSessionId(),
    actor: event.actor || { anonymousId: anonymousId || createAnonymousId() },
    platform: event.platform || Platform.OS,
    appVersion: event.appVersion || getAppVersion(),
    build: event.build ?? getBuildNumber(),
    locale: event.locale ?? getLocale(),
    timezone: event.timezone || getTimezone(),
    tzOffsetMin: event.tzOffsetMin ?? getTimezoneOffsetMinutes(),
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    requestId: event.requestId || getRequestId(event.props),
  };
}

function buildBatchPayload(events: TelemetryEvent[]): TelemetryBatchPayload {
  return {
    sessionId: sessionId || createSessionId(),
    app: {
      platform: Platform.OS,
      appVersion: getAppVersion(),
      build: getBuildNumber(),
    },
    device: {
      locale: getLocale(),
      tzOffsetMin: getTimezoneOffsetMinutes(),
    },
    events,
  };
}

function createGenerationSnapshot(): number {
  return runtimeGeneration;
}

function isCurrentGeneration(generation: number): boolean {
  return generation === runtimeGeneration;
}

function waitForTelemetryReset(): Promise<void> {
  return resetRuntimePromise ?? Promise.resolve();
}

async function waitForTelemetryResetBarrier(): Promise<void> {
  await waitForTelemetryReset();

  const activeResetPromise = resetRuntimePromise;
  if (activeResetPromise) {
    await activeResetPromise;
  }
}

async function persistQueueForGeneration(generation: number): Promise<void> {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const state: BufferedTelemetryState = {
    sessionId,
    events: queue,
  };

  try {
    if (!isCurrentGeneration(generation)) {
      return;
    }

    if (state.events.length === 0) {
      await AsyncStorage.removeItem(TELEMETRY_BUFFER_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(
        TELEMETRY_BUFFER_STORAGE_KEY,
        JSON.stringify(state),
      );
    }

    if (!isCurrentGeneration(generation)) {
      await AsyncStorage.removeItem(TELEMETRY_BUFFER_STORAGE_KEY);
    }
  } catch {
    // Telemetry buffering is best-effort.
  }
}

async function restoreQueue(generation: number): Promise<void> {
  try {
    const storedAnonymousId = await AsyncStorage.getItem(
      TELEMETRY_ANONYMOUS_ID_STORAGE_KEY,
    );
    if (!isCurrentGeneration(generation)) {
      return;
    }
    anonymousId =
      storedAnonymousId && storedAnonymousId.trim()
        ? storedAnonymousId.trim()
        : createAnonymousId();
    if (!isCurrentGeneration(generation)) {
      return;
    }
    await AsyncStorage.setItem(TELEMETRY_ANONYMOUS_ID_STORAGE_KEY, anonymousId);

    if (!isCurrentGeneration(generation)) {
      return;
    }
    const raw = await AsyncStorage.getItem(TELEMETRY_BUFFER_STORAGE_KEY);
    if (!isCurrentGeneration(generation)) {
      return;
    }
    if (!raw) {
      sessionId = createSessionId();
      queue = [];
      queuedEventIds = new Set<string>();
      return;
    }

    const parsed = JSON.parse(raw) as unknown;
    const restored = normalizeBufferedState(parsed);
    sessionId = restored?.sessionId || createSessionId();
    queue = (restored?.events || []).map(enrichEventContext);
    queuedEventIds = new Set(queue.map((event) => event.eventId));
  } catch {
    if (!isCurrentGeneration(generation)) {
      return;
    }
    sessionId = createSessionId();
    anonymousId = anonymousId || createAnonymousId();
    queue = [];
    queuedEventIds = new Set<string>();
  }
}

function startFlushLoop(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
  }

  flushTimer = setInterval(() => {
    void flush();
  }, flushIntervalMs);
}

function invalidateTelemetryRuntimeState(): void {
  runtimeGeneration += 1;
  initialized = false;
  initPromise = null;
  flushPromise = null;
  if (activeFlushAbortController) {
    activeFlushAbortController.abort();
  }
  activeFlushAbortController = null;
}

function resetTelemetryRuntimeState(): void {
  invalidateTelemetryRuntimeState();
  sessionId = "";
  anonymousId = "";
  currentUserId = null;
  queue = [];
  queuedEventIds = new Set<string>();
  retryAttempt = 0;
  nextAllowedFlushAt = 0;
}

function scheduleRetry(): void {
  retryAttempt += 1;
  const delay = Math.min(
    retryMaxMs,
    retryBaseMs * 2 ** Math.max(0, retryAttempt - 1),
  );
  nextAllowedFlushAt = Date.now() + delay;
}

function resetRetryState(): void {
  retryAttempt = 0;
  nextAllowedFlushAt = 0;
}

function enqueueEvent(event: TelemetryEvent): boolean {
  if (queuedEventIds.has(event.eventId)) {
    return false;
  }

  queuedEventIds.add(event.eventId);
  queue.push(event);
  return true;
}

function dropBatch(events: TelemetryEvent[]): void {
  const eventIds = new Set(events.map((event) => event.eventId));
  queue = queue.filter((event) => !eventIds.has(event.eventId));
  queuedEventIds = new Set(queue.map((event) => event.eventId));
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) {
      return false;
    }
    if (state.isInternetReachable === false) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function initTelemetryClient(): Promise<void> {
  if (!isTelemetryEnabled()) {
    return;
  }

  await waitForTelemetryResetBarrier();
  if (initialized) {
    return;
  }

  if (!initPromise) {
    const generation = createGenerationSnapshot();
    const currentInitPromise = (async () => {
      await restoreQueue(generation);
      if (!isCurrentGeneration(generation)) {
        return;
      }
      startFlushLoop();
      initialized = true;
      void flush();
    })();

    const trackedInitPromise = currentInitPromise.finally(() => {
      if (initPromise === trackedInitPromise) {
        initPromise = null;
      }
    });
    initPromise = trackedInitPromise;
  }

  await initPromise;
}

async function ensureInitialized(): Promise<void> {
  if (initialized) {
    return;
  }

  await initTelemetryClient();
}

export async function track(
  name: TelemetryEventName,
  props?: TelemetryProps,
): Promise<void> {
  if (!isTelemetryEnabled()) {
    return;
  }

  await waitForTelemetryResetBarrier();
  const generation = createGenerationSnapshot();
  await ensureInitialized();
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const requestId = getRequestId(props);
  const event: TelemetryEvent = {
    eventId: createEventId(),
    name,
    ts: occurredAt,
    occurredAt,
    sessionId: sessionId || createSessionId(),
    actor: getCurrentActor(),
    platform: Platform.OS,
    appVersion: getAppVersion(),
    build: getBuildNumber(),
    locale: getLocale(),
    timezone: getTimezone(),
    tzOffsetMin: getTimezoneOffsetMinutes(),
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    ...(requestId ? { requestId } : {}),
    ...(props && Object.keys(props).length > 0 ? { props } : {}),
  };

  if (!enqueueEvent(event)) {
    return;
  }

  await persistQueueForGeneration(generation);

  if (!isCurrentGeneration(generation)) {
    return;
  }

  if (queue.length >= maxBatchSize) {
    await flush();
  }
}

export async function flush(): Promise<void> {
  if (!isTelemetryEnabled()) {
    return;
  }

  await waitForTelemetryResetBarrier();
  const generation = createGenerationSnapshot();
  await ensureInitialized();
  if (!isCurrentGeneration(generation)) {
    return;
  }

  if (queue.length === 0) {
    return;
  }

  if (flushPromise) {
    await flushPromise;
    return;
  }

  if (Date.now() < nextAllowedFlushAt) {
    return;
  }

  const currentFlushPromise = (async () => {
    while (queue.length > 0) {
      if (!isCurrentGeneration(generation)) {
        return;
      }

      if (Date.now() < nextAllowedFlushAt) {
        return;
      }

      if (!(await isOnline())) {
        if (!isCurrentGeneration(generation)) {
          return;
        }
        scheduleRetry();
        await persistQueueForGeneration(generation);
        return;
      }

      if (!isCurrentGeneration(generation)) {
        return;
      }

      const batch = queue.slice(0, maxBatchSize);
      const controller = new AbortController();
      activeFlushAbortController = controller;

      try {
        await apiClient.post(TELEMETRY_ENDPOINT, buildBatchPayload(batch), {
          timeout: 15_000,
          retryMode: "none",
          signal: controller.signal,
        });
        if (!isCurrentGeneration(generation)) {
          return;
        }
        dropBatch(batch);
        resetRetryState();
        await persistQueueForGeneration(generation);
      } catch (error) {
        if (!isCurrentGeneration(generation) || isAbortedTelemetryRequest(error)) {
          return;
        }

        if (shouldDropFailedBatch(error)) {
          dropBatch(batch);
          resetRetryState();
          await persistQueueForGeneration(generation);
          continue;
        }

        scheduleRetry();
        await persistQueueForGeneration(generation);
        return;
      } finally {
        if (activeFlushAbortController === controller) {
          activeFlushAbortController = null;
        }
      }
    }
  })();

  const trackedFlushPromise = currentFlushPromise.finally(() => {
    if (flushPromise === trackedFlushPromise) {
      flushPromise = null;
    }
  });
  flushPromise = trackedFlushPromise;

  await flushPromise;
}

export function stopTelemetryClient(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  initialized = false;
}

export async function resetTelemetryClientRuntime(): Promise<void> {
  if (resetRuntimePromise) {
    await resetRuntimePromise;
    return;
  }

  stopTelemetryClient();

  const initWork = initPromise;
  const flushWork = flushPromise;

  const cleanupPromise = (async () => {
    invalidateTelemetryRuntimeState();
    sessionId = "";
    anonymousId = "";
    currentUserId = null;
    queue = [];
    queuedEventIds = new Set<string>();
    retryAttempt = 0;
    nextAllowedFlushAt = 0;

    try {
      await Promise.all([
        AsyncStorage.removeItem(TELEMETRY_BUFFER_STORAGE_KEY),
        AsyncStorage.removeItem(TELEMETRY_ANONYMOUS_ID_STORAGE_KEY),
      ]);
      await Promise.allSettled([initWork, flushWork]);
      await Promise.all([
        AsyncStorage.removeItem(TELEMETRY_BUFFER_STORAGE_KEY),
        AsyncStorage.removeItem(TELEMETRY_ANONYMOUS_ID_STORAGE_KEY),
      ]);
    } finally {
      resetTelemetryRuntimeState();
    }
  })();

  resetRuntimePromise = cleanupPromise.finally(() => {
    resetRuntimePromise = null;
  });

  await resetRuntimePromise;
}

export function setTelemetryUserId(userId: string | null): void {
  const normalizedUserId = userId?.trim() || null;
  currentUserId = normalizedUserId;
}

export function __resetTelemetryClientForTests(): void {
  stopTelemetryClient();
  resetTelemetryRuntimeState();
  resetRuntimePromise = null;
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS;
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE;
  retryBaseMs = DEFAULT_RETRY_BASE_MS;
  retryMaxMs = DEFAULT_RETRY_MAX_MS;
}
