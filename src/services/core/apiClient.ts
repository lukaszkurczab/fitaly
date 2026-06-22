import { getApp } from "@react-native-firebase/app";
import { getAuth, getIdToken } from "@react-native-firebase/auth";
import { v4 as uuidv4 } from "uuid";
import { createServiceError } from "@/services/contracts/serviceError";
import { asString, isRecord } from "@/services/contracts/guards";
import { withVersion } from "@/services/core/apiVersioning";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { getE2EAuthToken } from "@/services/e2e/authToken";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const AUTH_TOKEN_TIMEOUT_MS = 10_000;
const API_CLIENT_SOURCE = "ApiClient";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;

export type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type RetryMode = "none" | "idempotent";

export type RequestOptions = {
  timeout?: number;
  signal?: AbortSignal;
  retryMode?: RetryMode;
};

export type ApiClientError = Error & {
  code: string;
  source: string;
  retryable: boolean;
  status?: number;
  details?: unknown;
  requestId?: string;
  url?: string;
  method?: RequestMethod;
};

function getApiBaseUrl(): string {
  const baseUrl = getRuntimeConfig().apiBaseUrl.trim();

  if (!baseUrl) {
    throw createServiceError({
      code: "api/misconfigured",
      source: API_CLIENT_SOURCE,
      retryable: false,
      message: "Missing API base URL in runtime config",
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    throw createServiceError({
      code: "api/misconfigured",
      source: API_CLIENT_SOURCE,
      retryable: false,
      message: "Invalid API base URL",
      cause: error,
    });
  }

  const hostname = parsed.hostname.toLowerCase();
  const isDevHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "10.0.2.2" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (parsed.protocol !== "https:" && !isDevHost) {
    throw createServiceError({
      code: "api/misconfigured",
      source: API_CLIENT_SOURCE,
      retryable: false,
      message: "API base URL must use HTTPS outside local development hosts",
    });
  }

  return parsed.toString().replace(/\/+$/, "");
}

function buildRequestUrl(path: string): string {
  const versionedPath = withVersion(path);
  return `${getApiBaseUrl()}${versionedPath}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFirebaseNoCurrentUserError(error: unknown): boolean {
  const code = isRecord(error) ? asString(error.code) : undefined;
  if (code === "auth/no-current-user") {
    return true;
  }

  return (
    error instanceof Error &&
    error.message.includes("[auth/no-current-user]")
  );
}

async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth(getApp());
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return getE2EAuthToken();
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      getIdToken(currentUser, forceRefresh),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            createServiceError({
              code: "auth/token-timeout",
              source: API_CLIENT_SOURCE,
              retryable: true,
              message: `Firebase auth token timed out after ${AUTH_TOKEN_TIMEOUT_MS}ms`,
            }),
          );
        }, AUTH_TOKEN_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (isFirebaseNoCurrentUserError(error)) {
      return getE2EAuthToken();
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getAuthorizationHeader(): Promise<Record<string, string>> {
  const token = await getAuthToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  const contentType = response.headers?.get?.("content-type")?.toLowerCase() || "";
  const isJsonContentType =
    contentType.includes("application/json") || contentType.includes("+json");

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    // Some endpoints may return non-JSON payloads (e.g. text/plain) even on success.
    if (!isJsonContentType) {
      return rawBody;
    }

    throw createServiceError({
      code: "api/invalid-json",
      source: API_CLIENT_SOURCE,
      retryable: false,
      message: "API response is not valid JSON",
      cause: error,
    });
  }
}

function normalizeTimeoutMs(timeout: number | undefined): number {
  if (!Number.isFinite(timeout)) return DEFAULT_TIMEOUT_MS;
  const normalized = Math.floor(Number(timeout));
  if (normalized <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(normalized, MAX_TIMEOUT_MS);
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  return (
    asString(payload.message) ||
    asString(payload.detail) ||
    asString(payload.error) ||
    fallback
  );
}

function readResponseRequestId(response: Response, payload: unknown): string | undefined {
  const headerRequestId =
    response.headers?.get?.("x-railway-request-id") ||
    response.headers?.get?.("x-request-id");
  if (headerRequestId) {
    return headerRequestId;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  return asString(payload.request_id) || asString(payload.requestId);
}

function createApiClientError(params: {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
  details?: unknown;
  requestId?: string;
  url: string;
  method: RequestMethod;
  cause?: unknown;
}): ApiClientError {
  const error = createServiceError({
    code: params.code,
    source: API_CLIENT_SOURCE,
    retryable: params.retryable,
    message: params.message,
    cause: params.cause,
  }) as ApiClientError;

  if (params.status !== undefined) {
    error.status = params.status;
  }

  error.details = params.details;
  error.requestId = params.requestId;
  error.url = params.url;
  error.method = params.method;

  return error;
}

type PerformRequestParams = {
  url: string;
  method: RequestMethod;
  timeoutMs: number;
  headers: Record<string, string>;
  body?: BodyInit;
  signal?: AbortSignal;
};

function createTimeoutPromise(params: {
  controller: AbortController;
  timeoutMs: number;
  url: string;
  method: RequestMethod;
  onTimeoutId: (timeoutId: ReturnType<typeof setTimeout>) => void;
  onTimeout: () => void;
}): Promise<never> {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      params.onTimeout();
      params.controller.abort();
      reject(
        createApiClientError({
          code: "api/timeout",
          message: `Request timed out after ${params.timeoutMs}ms`,
          retryable: true,
          url: params.url,
          method: params.method,
        })
      );
    }, params.timeoutMs);

    params.onTimeoutId(timeoutId);
  });
}

async function performRequest<T = unknown>({
  url,
  method,
  timeoutMs,
  headers,
  body,
  signal,
}: PerformRequestParams): Promise<T> {
  if (signal?.aborted) {
    throw createApiClientError({
      code: "api/aborted",
      message: "Request was aborted",
      retryable: false,
      url,
      method,
    });
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  let abortedByCaller = false;
  const onCallerAbort = () => {
    abortedByCaller = true;
    controller.abort();
  };

  try {
    signal?.addEventListener("abort", onCallerAbort);
    const responsePromise = fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
    });

    const response = await Promise.race([
      responsePromise,
      createTimeoutPromise({
        controller,
        timeoutMs,
        url,
        method,
        onTimeoutId: (nextTimeoutId) => {
          timeoutId = nextTimeoutId;
        },
        onTimeout: () => {
          timedOut = true;
        },
      }),
    ]);
    const payload = await parseJsonResponse(response);
    const requestId = readResponseRequestId(response, payload);

    if (!response.ok) {
      throw createApiClientError({
        code: response.status === 429 ? "api/rate-limited" : "api/http-error",
        message: readErrorMessage(
          payload,
          `API request failed with status ${response.status}`
        ),
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
        details: payload,
        requestId,
        url,
        method,
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw createApiClientError({
          code: "api/timeout",
          message: `Request timed out after ${timeoutMs}ms`,
          retryable: true,
          url,
          method,
          cause: error,
        });
      }

      if (abortedByCaller || signal?.aborted) {
        throw createApiClientError({
          code: "api/aborted",
          message: "Request was aborted",
          retryable: false,
          url,
          method,
          cause: error,
        });
      }

      throw createApiClientError({
        code: "api/timeout",
        message: `Request timed out after ${timeoutMs}ms`,
        retryable: true,
        url,
        method,
        cause: error,
      });
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

async function withRetry<T>(
  executor: (attempt: number) => Promise<T>,
  options?: { retryMode?: RetryMode },
): Promise<T> {
  let lastError: unknown;
  const retryMode = options?.retryMode ?? "idempotent";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executor(attempt);
    } catch (error) {
      lastError = error;
      const apiError = error as Partial<ApiClientError>;

      // On first 401: force-refresh the Firebase token and retry once.
      // getIdToken(user, true) refreshes the cached token so the next
      // getAuthorizationHeader() call picks up the new value automatically.
      if (apiError?.status === 401 && attempt === 0) {
        try {
          await getAuthToken(/* forceRefresh= */ true);
        } catch {
          break;
        }
        continue;
      }

      // Retry transient errors (5xx, 429, network timeout) with
      // exponential back-off: 1 s, 2 s.
      if (
        retryMode === "idempotent" &&
        apiError?.retryable === true &&
        attempt < MAX_RETRIES
      ) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      break;
    }
  }

  throw lastError;
}

export async function request<T = unknown>(
  method: RequestMethod,
  url: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  const fullUrl = buildRequestUrl(url);
  const timeoutMs = normalizeTimeoutMs(options?.timeout);
  const body =
    method === "POST" || method === "PATCH" ? JSON.stringify(data) : undefined;
  // Keep the same key for all retry attempts in one logical request.
  const idempotencyKey =
    method === "POST" || method === "PATCH" ? uuidv4() : undefined;
  const retryMode = options?.retryMode ?? (method === "GET" ? "idempotent" : "none");

  return withRetry(async () => {
    const authHeader = await getAuthorizationHeader();
    return performRequest<T>({
      url: fullUrl,
      method,
      timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeader,
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body,
      signal: options?.signal,
    });
  }, { retryMode });
}

export async function upload<T = unknown>(
  url: string,
  data: FormData,
  options?: RequestOptions,
): Promise<T> {
  const fullUrl = buildRequestUrl(url);
  const timeoutMs = normalizeTimeoutMs(options?.timeout);
  const retryMode = options?.retryMode ?? "none";

  return withRetry(async () => {
    const authHeader = await getAuthorizationHeader();
    return performRequest<T>({
      url: fullUrl,
      method: "POST",
      timeoutMs,
      headers: {
        Accept: "application/json",
        ...authHeader,
      },
      body: data,
      signal: options?.signal,
    });
  }, { retryMode });
}

export function get<T = unknown>(
  url: string,
  options?: RequestOptions
): Promise<T> {
  return request<T>("GET", url, undefined, options);
}

export function post<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  return request<T>("POST", url, data, options);
}

export function patch<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  return request<T>("PATCH", url, data, options);
}
