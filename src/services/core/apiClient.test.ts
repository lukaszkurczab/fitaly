import { afterEach } from "@jest/globals";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";
const mockGetApp = jest.fn();
const mockGetAuth = jest.fn();
const mockGetIdToken = jest.fn<Promise<string>, unknown[]>();
const mockGetRuntimeConfig = jest.fn<RuntimeConfig, []>();

function createRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: false,
    telemetryEnabled: false,
    smartRemindersEnabled: true,
    billingDisabled: false,
    buildProfile: "",
    privacyUrl: "",
    termsUrl: "",
    revenuecatAndroidKey: "",
    revenuecatIosKey: "",
    sentryDsn: "",
    sentryEnvironment: "development",
    sentryOrganization: "",
    sentryProject: "",
    ...overrides,
  };
}

jest.mock("@react-native-firebase/app", () => ({
  getApp: (...args: unknown[]) => mockGetApp(...args),
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

describe("apiClient", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockGetApp.mockReturnValue({ name: "app" });
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig());
    mockGetIdToken.mockResolvedValue("token-123");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds Firebase bearer token when current user exists", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: { uid: "u1" },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // Use require after resetting modules so API_VERSION is recomputed from mocks.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    await get("/ai/credits");

    expect(mockGetIdToken).toHaveBeenCalledTimes(1);
    expect(mockGetIdToken).toHaveBeenCalledWith({ uid: "u1" }, false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/ai/credits",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });

  it("force-refreshes Firebase token and retries once after first 401", async () => {
    const currentUser = { uid: "u1" };
    mockGetAuth.mockReturnValue({
      currentUser,
    });
    mockGetIdToken
      .mockResolvedValueOnce("stale-token")
      .mockResolvedValueOnce("fresh-token")
      .mockResolvedValueOnce("fresh-token");

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: "expired token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    await expect(get("/users/me/profile")).resolves.toEqual({ ok: true });

    expect(mockGetIdToken).toHaveBeenNthCalledWith(1, currentUser, false);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(2, currentUser, true);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(3, currentUser, false);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer fresh-token");
  });

  it("omits Authorization header when no current user exists", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    await get("/health");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/health",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    );
  });

  it("keeps multipart uploads authenticated without forcing JSON content type", async () => {
    mockGetIdToken.mockResolvedValue("token-456");
    mockGetAuth.mockReturnValue({
      currentUser: { uid: "u1" },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const formData = new FormData();
    formData.append("file", "payload");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { upload } = require("@/services/core/apiClient");

    await upload("/users/me/avatar", formData);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/users/me/avatar",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token-456",
        }),
        body: formData,
      }),
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });

  it("does not retry multipart uploads for transient server failures by default", async () => {
    jest.useFakeTimers();
    mockGetIdToken.mockResolvedValue("token-456");
    mockGetAuth.mockReturnValue({
      currentUser: { uid: "u1" },
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: "Database error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const formData = new FormData();
    formData.append("file", "payload");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { upload } = require("@/services/core/apiClient");

    await expect(upload("/users/me/meals/photo", formData)).rejects.toMatchObject({
      code: "api/http-error",
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries multipart uploads only when explicitly marked idempotent", async () => {
    jest.useFakeTimers();
    mockGetIdToken.mockResolvedValue("token-456");
    mockGetAuth.mockReturnValue({
      currentUser: { uid: "u1" },
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: "Database error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const formData = new FormData();
    formData.append("file", "payload");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { upload } = require("@/services/core/apiClient");

    const pending = upload("/users/me/chat-safe-upload", formData, {
      retryMode: "idempotent",
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST requests for transient server failures by default", async () => {
    jest.useFakeTimers();
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: "Database error" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { post } = require("@/services/core/apiClient");

    await expect(post("/users/me/delete", { confirmed: true })).rejects.toMatchObject({
      code: "api/http-error",
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds upstream request id to HTTP errors", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-railway-request-id"
            ? "railway-request-1"
            : null,
      },
      text: async () =>
        JSON.stringify({
          status: "error",
          code: 502,
          message: "Application failed to respond",
          request_id: "body-request-1",
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    await expect(get("/users/me/profile")).rejects.toMatchObject({
      code: "api/http-error",
      status: 502,
      requestId: "railway-request-1",
    });
  });

  it("retries idempotent POST requests and reuses one idempotency key", async () => {
    jest.useFakeTimers();
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: "temporary failure" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { post } = require("@/services/core/apiClient");

    const pending = post(
      "/api/v2/ai/chat/runs",
      { message: "hello" },
      { retryMode: "idempotent" },
    );
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["X-Idempotency-Key"]).toBeTruthy();
    expect(secondHeaders["X-Idempotency-Key"]).toBe(firstHeaders["X-Idempotency-Key"]);
  });

  it("returns api/timeout when request exceeds timeout", async () => {
    jest.useFakeTimers();
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockReturnValue(new Promise(() => {}));
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    const pending = get("/health", { timeout: 5 });
    const captured = pending.catch((error: unknown) => error);
    // Advance through all retry attempts:
    // attempt 0: 5ms timeout → sleep(1000ms) → attempt 1: 5ms timeout → sleep(2000ms) → attempt 2: 5ms timeout → throws
    await jest.advanceTimersByTimeAsync(3100);

    await expect(captured).resolves.toMatchObject({
      code: "api/timeout",
      source: "ApiClient",
      retryable: true,
    });
  });

  it("returns api/aborted when caller aborts via AbortSignal", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");

    const controller = new AbortController();
    const pending = get("/health", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "api/aborted",
      source: "ApiClient",
      retryable: false,
    });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("rejects insecure non-local API base URLs", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });
    mockGetRuntimeConfig.mockReturnValue(
      createRuntimeConfig({ apiBaseUrl: "http://api.example.com" }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");
    await expect(get("/health")).rejects.toMatchObject({
      code: "api/misconfigured",
      source: "ApiClient",
    });
  });

  it("returns raw text for non-json responses", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: null,
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "text/plain",
      },
      text: async () => "pong",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { get } = require("@/services/core/apiClient");
    await expect(get("/health")).resolves.toBe("pong");
  });
});
