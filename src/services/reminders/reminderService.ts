import { get } from "@/services/core/apiClient";
import { withV2 } from "@/services/core/apiVersioning";
import { createServiceError } from "@/services/contracts/serviceError";
import { isRecord } from "@/services/contracts/guards";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { trackSmartReminderDecisionFailed } from "@/services/telemetry/telemetryInstrumentation";
import { debugScope } from "@/utils/debug";
import { resolveE2EReminderDecision } from "@/services/e2e/fixtures";
import {
  NOOP_REMINDER_REASON_CODES,
  REMINDER_DECISION_TYPES,
  REMINDER_KINDS,
  REMINDER_REASON_CODES,
  SEND_REMINDER_REASON_CODES,
  SUPPRESS_REMINDER_REASON_CODES,
} from "@/services/reminders/reminderTypes";
import type {
  NoopReminderReasonCode,
  ReminderDecision,
  ReminderDecisionResult,
  ReminderDecisionResultStatus,
  ReminderDecisionType,
  ReminderKind,
  ReminderReasonCode,
  SendReminderReasonCode,
  SuppressReminderReasonCode,
} from "@/services/reminders/reminderTypes";

const log = debugScope("ReminderService");
const REMINDER_ENDPOINT = withV2("/users/me/reminders/decision");
const REMINDER_SERVICE_SOURCE = "ReminderService";
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function isSmartRemindersEnabled(): boolean {
  return getRuntimeConfig().smartRemindersEnabled;
}

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentReminderDecisionDayKey(
  now: Date = new Date(),
): string {
  return toDayKey(now);
}

function normalizeDayKey(dayKey?: string | null): string {
  const normalized = dayKey?.trim();
  return normalized || getCurrentReminderDecisionDayKey();
}

export function getDeviceTzOffsetMin(): number {
  return -new Date().getTimezoneOffset();
}

function buildEndpoint(dayKey: string, tzOffsetMin: number): string {
  return `${REMINDER_ENDPOINT}?day=${encodeURIComponent(dayKey)}&tzOffsetMin=${tzOffsetMin}`;
}

function isReminderDecisionType(value: unknown): value is ReminderDecisionType {
  return (
    typeof value === "string" &&
    REMINDER_DECISION_TYPES.includes(value as ReminderDecisionType)
  );
}

function isReminderKind(value: unknown): value is ReminderKind {
  return (
    typeof value === "string" && REMINDER_KINDS.includes(value as ReminderKind)
  );
}

function isReminderReasonCode(value: unknown): value is ReminderReasonCode {
  return (
    typeof value === "string" &&
    REMINDER_REASON_CODES.includes(value as ReminderReasonCode)
  );
}

function isSendReminderReasonCode(
  value: ReminderReasonCode,
): value is SendReminderReasonCode {
  return SEND_REMINDER_REASON_CODES.includes(value as SendReminderReasonCode);
}

function isSuppressReminderReasonCode(
  value: ReminderReasonCode,
): value is SuppressReminderReasonCode {
  return SUPPRESS_REMINDER_REASON_CODES.includes(
    value as SuppressReminderReasonCode,
  );
}

function isNoopReminderReasonCode(
  value: ReminderReasonCode,
): value is NoopReminderReasonCode {
  return NOOP_REMINDER_REASON_CODES.includes(value as NoopReminderReasonCode);
}

function areSendReminderReasonCodes(
  value: ReminderReasonCode[],
): value is SendReminderReasonCode[] {
  return value.every(isSendReminderReasonCode);
}

function areSuppressReminderReasonCodes(
  value: ReminderReasonCode[],
): value is SuppressReminderReasonCode[] {
  return value.every(isSuppressReminderReasonCode);
}

function areNoopReminderReasonCodes(
  value: ReminderReasonCode[],
): value is NoopReminderReasonCode[] {
  return value.every(isNoopReminderReasonCode);
}

function isCanonicalDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP_RE.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === `${value.slice(0, -1)}.000Z`
  );
}

function toStrictReasonCodes(value: unknown): ReminderReasonCode[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  if (!value.every((item) => isReminderReasonCode(item))) {
    return null;
  }

  return [...value];
}

function createInvalidReminderPayloadError(
  reason: string,
  payload?: unknown,
): Error {
  return createServiceError({
    code: "reminder/invalid-contract-payload",
    source: REMINDER_SERVICE_SOURCE,
    retryable: false,
    message: reason,
    cause: payload,
  });
}

function emitSmartReminderDecisionFailureTelemetry(
  failureReason: "invalid_payload" | "service_unavailable",
): void {
  void trackSmartReminderDecisionFailed({ failureReason }).catch((error) => {
    log.warn("smart reminder decision failure telemetry failed", {
      failureReason,
      error,
    });
  });
}

export function normalizeReminderDecision(
  value: unknown,
): ReminderDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  const dayKey = value.dayKey;
  const computedAt = value.computedAt;
  const decision = value.decision;
  const kind = value.kind;
  const reasonCodes = toStrictReasonCodes(value.reasonCodes);
  const confidence =
    typeof value.confidence === "number" ? value.confidence : undefined;
  const validUntil = value.validUntil;

  if (
    !isCanonicalDayKey(dayKey) ||
    !isCanonicalUtcTimestamp(computedAt) ||
    !isReminderDecisionType(decision) ||
    reasonCodes === null ||
    confidence === undefined ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !isCanonicalUtcTimestamp(validUntil)
  ) {
    return null;
  }

  if (decision === "send") {
    const scheduledAtUtc = value.scheduledAtUtc;

    if (
      !isReminderKind(kind) ||
      !isCanonicalUtcTimestamp(scheduledAtUtc) ||
      !areSendReminderReasonCodes(reasonCodes)
    ) {
      return null;
    }

    if (scheduledAtUtc < computedAt || scheduledAtUtc > validUntil) {
      return null;
    }

    return {
      dayKey,
      computedAt,
      decision: "send",
      kind,
      reasonCodes,
      scheduledAtUtc,
      confidence,
      validUntil,
    };
  }

  if (decision === "suppress") {
    if (
      kind !== null ||
      value.scheduledAtUtc !== null ||
      !areSuppressReminderReasonCodes(reasonCodes)
    ) {
      return null;
    }

    return {
      dayKey,
      computedAt,
      decision: "suppress",
      kind: null,
      reasonCodes,
      scheduledAtUtc: null,
      confidence,
      validUntil,
    };
  }

  if (
    kind !== null ||
    value.scheduledAtUtc !== null ||
    !areNoopReminderReasonCodes(reasonCodes)
  ) {
    return null;
  }

  return {
    dayKey,
    computedAt,
    decision: "noop",
    kind: null,
    reasonCodes,
    scheduledAtUtc: null,
    confidence,
    validUntil,
  };
}

function buildReminderDecisionResult(input: {
  decision: ReminderDecision | null;
  source: ReminderDecisionResult["source"];
  status: ReminderDecisionResultStatus;
  enabled: boolean;
  error: unknown | null;
}): ReminderDecisionResult {
  return input;
}

function buildFallbackResult(input: {
  source: ReminderDecisionResult["source"];
  status: ReminderDecisionResultStatus;
  enabled: boolean;
  error: unknown | null;
}): ReminderDecisionResult {
  return buildReminderDecisionResult({
    decision: null,
    source: input.source,
    status: input.status,
    enabled: input.enabled,
    error: input.error,
  });
}

export async function getReminderDecision(
  uid: string | null | undefined,
  options?: { dayKey?: string | null; productReady?: boolean },
): Promise<ReminderDecisionResult> {
  const dayKey = normalizeDayKey(options?.dayKey);
  const e2eResult = resolveE2EReminderDecision(uid, dayKey);
  if (e2eResult) return e2eResult;

  const enabled = isSmartRemindersEnabled();

  if (!enabled) {
    return buildFallbackResult({
      source: "disabled",
      status: "disabled",
      enabled: false,
      error: null,
    });
  }

  if (options?.productReady === false) {
    return buildFallbackResult({
      source: "fallback",
      status: "profile_not_ready",
      enabled,
      error: null,
    });
  }

  if (!uid) {
    return buildFallbackResult({
      source: "fallback",
      status: "no_user",
      enabled,
      error: null,
    });
  }

  const tzOffsetMin = getDeviceTzOffsetMin();

  try {
    const payload = await get<unknown>(buildEndpoint(dayKey, tzOffsetMin), {
      timeout: 15_000,
    });
    const normalized = normalizeReminderDecision(payload);
    if (!normalized) {
      emitSmartReminderDecisionFailureTelemetry("invalid_payload");
      throw createInvalidReminderPayloadError(
        "Invalid reminder decision contract payload",
        payload,
      );
    }

    return buildReminderDecisionResult({
      decision: normalized,
      source: "remote",
      status: "live_success",
      enabled,
      error: null,
    });
  } catch (error) {
    log.warn("getReminderDecision backend error", { uid, dayKey, error });
    const isInvalidPayload =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: unknown }).code ===
        "reminder/invalid-contract-payload";

    if (!isInvalidPayload) {
      emitSmartReminderDecisionFailureTelemetry("service_unavailable");
    }

    return buildFallbackResult({
      source: "fallback",
      status: isInvalidPayload ? "invalid_payload" : "service_unavailable",
      enabled,
      error,
    });
  }
}
