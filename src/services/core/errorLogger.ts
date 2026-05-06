import * as Sentry from "@sentry/react-native";
import * as apiClient from "@/services/core/apiClient";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
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
  Sentry.captureException(err, {
    extra: toExtraContext(context),
  });
  sendToBackend(sanitizedMessage, context, error);
}

export function captureMessage(message: string, extra?: ExtraContext): void {
  Sentry.captureMessage(message, { extra });
}
