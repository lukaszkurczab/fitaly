import { isRecord } from "@/services/contracts/guards";
import {
  getErrorStatus,
  isServiceError,
} from "@/services/contracts/serviceError";

export type AiChatBackendErrorCode =
  | "AI_CHAT_DISABLED"
  | "AI_CREDITS_EXHAUSTED"
  | "AI_CONSENT_REQUIRED"
  | "AI_CHAT_PROVIDER_UNAVAILABLE"
  | "AI_CHAT_TIMEOUT"
  | "AI_CHAT_CONTEXT_UNAVAILABLE"
  | "AI_CHAT_IDEMPOTENCY_CONFLICT"
  | "AI_CHAT_INTERNAL_ERROR";

export type AiMealBackendErrorCode =
  | "AI_MEAL_ANALYSIS_DISABLED"
  | "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT";

export type AiBackendErrorCode =
  | AiChatBackendErrorCode
  | AiMealBackendErrorCode;

export type AiUxErrorType =
  | "offline"
  | "auth"
  | "limit"
  | AiBackendErrorCode
  | "unknown";

const AI_BACKEND_ERROR_CODES = new Set<AiBackendErrorCode>([
  "AI_CHAT_DISABLED",
  "AI_CREDITS_EXHAUSTED",
  "AI_CONSENT_REQUIRED",
  "AI_CHAT_PROVIDER_UNAVAILABLE",
  "AI_CHAT_TIMEOUT",
  "AI_CHAT_CONTEXT_UNAVAILABLE",
  "AI_CHAT_IDEMPOTENCY_CONFLICT",
  "AI_CHAT_INTERNAL_ERROR",
  "AI_MEAL_ANALYSIS_DISABLED",
  "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT",
]);

function hasTimeoutInCauseChain(error: unknown): boolean {
  let cursor: unknown = error;

  for (let i = 0; i < 4; i += 1) {
    if (!cursor) return false;
    if (isServiceError(cursor) && cursor.code === "api/timeout") return true;
    if (!isRecord(cursor) || !("cause" in cursor)) return false;
    cursor = cursor.cause;
  }

  return false;
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch")
  );
}

function getAiChatDetailCodeValue(error: unknown): string | null {
  if (!isRecord(error)) return null;

  const details = isRecord(error.details) ? error.details : null;
  const detail = details
    ? isRecord(details.detail)
      ? details.detail
      : details
    : isRecord(error.detail)
      ? error.detail
      : error;
  const code = typeof detail.code === "string" ? detail.code : null;
  return code;
}

function getAiBackendDetailCode(error: unknown): AiBackendErrorCode | null {
  const code = getAiChatDetailCodeValue(error);
  if (!code || !AI_BACKEND_ERROR_CODES.has(code as AiBackendErrorCode)) {
    return null;
  }
  return code as AiBackendErrorCode;
}

export function getAiUxErrorType(error: unknown): AiUxErrorType {
  if (isServiceError(error)) {
    if (error.code === "offline") return "offline";
    if (error.code === "api/timeout") return "AI_CHAT_TIMEOUT";
    if (error.code === "auth/required") return "auth";
    if (error.code === "ai/consent-required") return "AI_CONSENT_REQUIRED";
    if (error.code === "ai/meal-analysis-disabled") {
      return "AI_MEAL_ANALYSIS_DISABLED";
    }
    if (error.code === "ai/meal-analysis-idempotency-conflict") {
      return "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT";
    }
    if (error.code === "ai/disabled") return "AI_CHAT_DISABLED";
    if (error.code === "api/rate-limited") {
      return "limit";
    }
    if (error.code === "ai/unavailable") {
      return hasTimeoutInCauseChain(error)
        ? "AI_CHAT_TIMEOUT"
        : "AI_CHAT_PROVIDER_UNAVAILABLE";
    }
  }

  const detailCode = getAiBackendDetailCode(error);
  if (detailCode) return detailCode;

  const status = getErrorStatus(error);
  if (status === 401) return "auth";
  if (status === 402) return "AI_CREDITS_EXHAUSTED";
  if (status === 409) return "AI_CHAT_IDEMPOTENCY_CONFLICT";
  if (status === 429) return "limit";
  if (status === 504) return "AI_CHAT_TIMEOUT";
  if (status === 500) return "AI_CHAT_INTERNAL_ERROR";
  if (status === 502 || status === 503) return "AI_CHAT_PROVIDER_UNAVAILABLE";

  if (isNetworkFailure(error)) return "offline";

  return "unknown";
}
