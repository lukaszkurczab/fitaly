import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";

const mockSentryCaptureException = jest.fn();
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
});
