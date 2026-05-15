type Primitive = string | number | boolean | null;

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 20_000;
const MAX_CONTEXT_VALUE_STRING_LENGTH = 300;
const MAX_CONTEXT_JSON_LENGTH = 8_000;
const MAX_SENTRY_STRING_LENGTH = 1_000;

const SAFE_CONTEXT_KEYS = new Set([
  "action",
  "beforeCreatedAt",
  "buildProfile",
  "code",
  "endpoint",
  "environment",
  "feature",
  "lang",
  "messageId",
  "networkState",
  "opId",
  "operation",
  "phase",
  "platform",
  "reason",
  "requestId",
  "retryable",
  "screen",
  "source",
  "status",
  "statusCode",
  "surface",
  "threadId",
  "uid",
  "userUid",
]);

const SENSITIVE_KEY_MARKERS = [
  "authorization",
  "cookie",
  "content",
  "email",
  "message",
  "password",
  "prompt",
  "stack",
  "text",
  "token",
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(authorization|cookie|token|password)\s*[:=]\s*[^\s,;]+/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasSensitiveMarker(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEY_MARKERS.some((marker) => lowered.includes(marker));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[redacted]");
}

function toSafePrimitive(value: unknown, maxStringLength: number): Primitive | undefined {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return truncate(redactSensitiveText(value), maxStringLength);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

export function sanitizeLogMessage(message: string): string {
  return truncate(redactSensitiveText(String(message || "")), MAX_MESSAGE_LENGTH);
}

export function sanitizeErrorStack(error?: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) {
    return undefined;
  }
  return truncate(redactSensitiveText(error.stack), MAX_STACK_LENGTH);
}

export function sanitizeLogContext(
  context?: unknown,
): Record<string, Primitive> | undefined {
  if (!isRecord(context)) {
    return undefined;
  }

  const sanitized: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (hasSensitiveMarker(key)) continue;
    const primitiveValue = toSafePrimitive(value, MAX_CONTEXT_VALUE_STRING_LENGTH);
    if (primitiveValue === undefined) continue;
    sanitized[key] = primitiveValue;
  }

  if (Object.keys(sanitized).length === 0) {
    return undefined;
  }

  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_CONTEXT_JSON_LENGTH) {
    return undefined;
  }

  return sanitized;
}

function sanitizeSentryValue(value: unknown, depth = 0): unknown {
  if (depth >= 3) {
    return undefined;
  }

  const primitive = toSafePrimitive(value, MAX_SENTRY_STRING_LENGTH);
  if (primitive !== undefined) {
    return primitive;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeSentryValue(item, depth + 1))
      .filter((item) => item !== undefined);
    return sanitizedArray.length > 0 ? sanitizedArray.slice(0, 40) : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const sanitizedRecord: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (hasSensitiveMarker(key)) continue;
    const sanitizedEntry = sanitizeSentryValue(entry, depth + 1);
    if (sanitizedEntry !== undefined) {
      sanitizedRecord[key] = sanitizedEntry;
    }
  }

  return Object.keys(sanitizedRecord).length > 0 ? sanitizedRecord : undefined;
}

export function sanitizeSentryEvent<T>(event: T): T {
  if (!isRecord(event)) {
    return event;
  }

  const sanitized = { ...event } as Record<string, unknown>;
  delete sanitized.user;

  if (typeof sanitized.message === "string") {
    sanitized.message = truncate(
      redactSensitiveText(sanitized.message),
      MAX_SENTRY_STRING_LENGTH,
    );
  }

  if (isRecord(sanitized.request)) {
    const request = { ...sanitized.request };
    delete request.data;
    delete request.cookies;
    delete request.headers;
    if (typeof request.url === "string") {
      request.url = truncate(
        redactSensitiveText(request.url),
        MAX_SENTRY_STRING_LENGTH,
      );
    }
    sanitized.request = request;
  }

  const sanitizedExtra = sanitizeSentryValue(sanitized.extra);
  sanitized.extra = sanitizedExtra ?? undefined;

  const sanitizedTags = sanitizeSentryValue(sanitized.tags);
  sanitized.tags = sanitizedTags ?? undefined;

  const sanitizedContexts = sanitizeSentryValue(sanitized.contexts);
  sanitized.contexts = sanitizedContexts ?? undefined;

  const breadcrumbs = sanitizeSentryValue(sanitized.breadcrumbs);
  sanitized.breadcrumbs = breadcrumbs ?? undefined;

  if (isRecord(sanitized.exception)) {
    const exception = { ...sanitized.exception };
    if (Array.isArray(exception.values)) {
      exception.values = exception.values.map((item: unknown) => {
        if (!isRecord(item)) {
          return item;
        }
        const next = { ...item };
        if (typeof next.value === "string") {
          next.value = truncate(
            redactSensitiveText(next.value),
            MAX_SENTRY_STRING_LENGTH,
          );
        }
        return next;
      });
    }
    sanitized.exception = exception;
  }

  return sanitized as T;
}
