import * as Sentry from "@sentry/react-native";
import * as apiClient from "@/services/core/apiClient";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { asString, isRecord } from "@/services/contracts/guards";
import {
  sanitizeErrorStack,
  sanitizeLogContext,
  sanitizeLogMessage,
} from "@/services/core/loggingPrivacy";

type ExtraContext = Record<string, unknown>;
type LogContext = unknown;
type LogError = unknown;

const LOG_SOURCE = "mobile";
const LOGS_ENDPOINT = "/logs/error";
const NON_EXCEPTION_API_ERROR_CODES = new Set([
  "api/offline",
  "api/dev-local-misconfig",
  "api/backend-unavailable",
  "api/network-error",
]);

function isBackendLoggingEnabled(): boolean {
  return getRuntimeConfig().backendLoggingEnabled;
}

function toExtraContext(
  context?: LogContext,
): ExtraContext | undefined {
  const sanitized = sanitizeLogContext(context);
  if (!sanitized) {
    return undefined;
  }
  return sanitized;
}

function shouldCaptureInSentry(error: LogError): boolean {
  if (!isRecord(error)) {
    return true;
  }

  const source = asString(error.source);
  const code = asString(error.code);
  if (source === "ApiClient" && code && NON_EXCEPTION_API_ERROR_CODES.has(code)) {
    return false;
  }

  return true;
}

function sendToBackend(message: string, context?: LogContext, error?: LogError) {
  if (!isBackendLoggingEnabled()) {
    return;
  }

  const sanitizedMessage = sanitizeLogMessage(message);
  const sanitizedContext = sanitizeLogContext(context);
  const sanitizedStack = sanitizeErrorStack(error);

  try {
    void apiClient
      .post(LOGS_ENDPOINT, {
        source: LOG_SOURCE,
        message: sanitizedMessage,
        stack: sanitizedStack,
        context: sanitizedContext,
      })
      .catch(() => {
        // Logger failures must never cascade into app errors.
      });
  } catch {
    // Logger failures must never cascade into app errors.
  }
}

export function logInfo(message: string, context?: LogContext, error?: LogError) {
  if (__DEV__) console.log(message, context, error);
  sendToBackend(message, context, error);
}

export function logWarning(
  message: string,
  context?: LogContext,
  error?: LogError
) {
  if (__DEV__) console.warn(message, context, error);
  sendToBackend(message, context, error);
}

export function logError(message: string, context?: LogContext, error?: LogError) {
  if (__DEV__) console.error(message, context, error);
  sendToBackend(message, context, error);
}

export function captureException(
  message: string,
  context?: LogContext,
  error?: LogError
) {
  const sanitizedMessage = sanitizeLogMessage(message);
  const err = error instanceof Error ? error : new Error(sanitizedMessage);
  if (shouldCaptureInSentry(error)) {
    Sentry.captureException(err, {
      extra: toExtraContext(context),
    });
  }
  sendToBackend(sanitizedMessage, context, error);
}

export function captureMessage(message: string, extra?: ExtraContext): void {
  Sentry.captureMessage(sanitizeLogMessage(message), {
    extra: toExtraContext(extra),
  });
}
