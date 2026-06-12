import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";

const mockSentryCaptureException = jest.fn();
const mockSentryCaptureMessage = jest.fn();
const mockApiPost = jest.fn();
const mockGetRuntimeConfig = jest.fn<() => RuntimeConfig>();

function createRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: true,
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

jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
}));

jest.mock("@/services/core/apiClient", () => ({
  post: (...args: unknown[]) => mockApiPost(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

describe("errorLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockApiPost.mockImplementation(() => Promise.resolve(undefined));
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig());
  });

  it("sends only sanitized payload to backend logs endpoint", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logError } = require("@/services/core/errorLogger");
    const error = new Error("boom");
    error.stack = "user@example.com token=abc123";

    logError("failed user@example.com", {
      userUid: "user-1",
      feature: "chat",
      message: "raw user content",
      extra: "drop-me",
    }, error);

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      "/logs/error",
      expect.objectContaining({
        source: "mobile",
        context: {
          userUid: "user-1",
          feature: "chat",
        },
      }),
    );
    const payload = mockApiPost.mock.calls[0]?.[1] as {
      message: string;
      stack?: string;
      context?: Record<string, unknown>;
    };
    expect(payload.message).toContain("[redacted-email]");
    expect(payload.stack).toContain("[redacted-email]");
    expect(payload.stack).toContain("token=[redacted]");
    expect(payload.context?.message).toBeUndefined();
  });

  it("forwards sanitized context to sentry extra", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureException } = require("@/services/core/errorLogger");
    captureException("boom", {
      userUid: "user-1",
      threadId: "thread-1",
      endpoint: "/users/me/profile",
      requestId: "railway-request-1",
      text: "should-not-pass",
    });

    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
    const sentryOptions = mockSentryCaptureException.mock.calls[0]?.[1] as {
      extra?: Record<string, unknown>;
    };
    expect(sentryOptions.extra).toEqual({
      userUid: "user-1",
      threadId: "thread-1",
      endpoint: "/users/me/profile",
      requestId: "railway-request-1",
    });
  });

  it("sanitizes captureMessage text and extra before sentry capture", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureMessage } = require("@/services/core/errorLogger");

    captureMessage(
      "message: raw user text; email=user@example.com path=meals/user-1/image.jpg /api/v1/meals?token=secret",
      {
        userUid: "user-1",
        feature: "chat",
        endpoint: "/api/v1/chat?token=secret",
        prompt: "raw prompt",
        unsafe: "drop-me",
        token: "drop-me-too",
      },
    );

    expect(mockSentryCaptureMessage).toHaveBeenCalledTimes(1);
    const [message, options] = mockSentryCaptureMessage.mock.calls[0] as [
      string,
      { extra?: Record<string, unknown> },
    ];

    expect(message).toContain("message=[redacted-content]");
    expect(message).toContain("[redacted-email]");
    expect(message).toContain("[redacted-storage-path]");
    expect(message).toContain("/api/v1/meals?[redacted-query]");
    expect(message).not.toContain("raw user text");
    expect(message).not.toContain("user@example.com");
    expect(message).not.toContain("meals/user-1/image.jpg");
    expect(message).not.toContain("token=secret");
    expect(options.extra).toEqual({
      userUid: "user-1",
      feature: "chat",
      endpoint: "/api/v1/chat?[redacted-query]",
    });
  });
});
