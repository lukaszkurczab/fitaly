import {
  createServiceError,
  getErrorStatus,
  isServiceError,
} from "@/services/contracts/serviceError";
import { asString, isRecord } from "@/services/contracts/guards";

const AI_CONSENT_SCOPE = "global_ai_health_data";
const AI_MEAL_ANALYSIS_DISABLED_CODE = "AI_MEAL_ANALYSIS_DISABLED";
const AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT_CODE =
  "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT";
const AI_PROVIDER_UNAVAILABLE_CODE = "AI_CHAT_PROVIDER_UNAVAILABLE";
const AI_PROVIDER_TIMEOUT_CODE = "AI_CHAT_TIMEOUT";

function getCanonicalErrorDetail(error: unknown): Record<string, unknown> | null {
  if (!isRecord(error)) return null;

  const details = isRecord(error.details) ? error.details : null;
  if (details) {
    return isRecord(details.detail) ? details.detail : details;
  }

  return isRecord(error.detail) ? error.detail : null;
}

export function toAiContractError(
  error: unknown,
  source: string,
) {
  const status = getErrorStatus(error);
  const detail = getCanonicalErrorDetail(error);

  if (status === 401) {
    return createServiceError({
      code: "auth/required",
      source,
      retryable: false,
      message: "Authentication required",
      cause: error,
    });
  }

  if (
    status === 403 &&
    detail?.code === "AI_CONSENT_REQUIRED" &&
    isRecord(detail.aiConsent) &&
    detail.aiConsent.required === true &&
    detail.aiConsent.scope === AI_CONSENT_SCOPE
  ) {
    return createServiceError({
      code: "ai/consent-required",
      source,
      retryable: false,
      message: asString(detail.message) ?? "AI consent required",
      cause: error,
    });
  }

  if (status === 503 && detail?.code === AI_MEAL_ANALYSIS_DISABLED_CODE) {
    return createServiceError({
      code: "ai/meal-analysis-disabled",
      source,
      retryable: false,
      message: asString(detail.message) ?? "Meal analysis AI is temporarily disabled.",
      cause: error,
    });
  }

  if (
    status === 409 &&
    detail?.code === AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT_CODE
  ) {
    return createServiceError({
      code: "ai/meal-analysis-idempotency-conflict",
      source,
      retryable: false,
      message:
        asString(detail.message) ??
        "Meal analysis request is already in progress or completed.",
      cause: error,
    });
  }

  if (status === 503 && detail?.code === AI_PROVIDER_UNAVAILABLE_CODE) {
    return createServiceError({
      code: "ai/unavailable",
      source,
      retryable: true,
      message: asString(detail.message) ?? "AI provider is temporarily unavailable.",
      cause: error,
    });
  }

  if (status === 504 && detail?.code === AI_PROVIDER_TIMEOUT_CODE) {
    return createServiceError({
      code: "api/timeout",
      source,
      retryable: true,
      message:
        asString(detail.message) ??
        "AI provider timed out before a response was generated.",
      cause: error,
    });
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    (isServiceError(error) && error.code === "api/timeout")
  ) {
    return createServiceError({
      code: "ai/unavailable",
      source,
      retryable: true,
      message: "AI service unavailable",
      cause: error,
    });
  }

  return null;
}
