import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { validateEnv, warnMissingEnv } from "@/services/core/envValidation";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";

const mockGetRuntimeConfig = jest.fn<() => RuntimeConfig>();
const mockLogWarning = jest.fn<
  (message: string, context?: unknown, error?: unknown) => void
>();

function createRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: false,
    telemetryEnabled: false,
    smartRemindersEnabled: true,
    reviewMemoryExplanationEnabled: false,
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
    firebaseAuthEmulatorHost: "",
    ...overrides,
  };
}

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logWarning: (message: string, context?: unknown, error?: unknown) =>
    mockLogWarning(message, context, error),
}));

describe("envValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns valid=true when all required env vars are set", () => {
    expect(validateEnv()).toEqual({
      valid: true,
      missing: [],
    });
  });

  it("returns missing array when required env vars are missing", () => {
    mockGetRuntimeConfig.mockReturnValue(
      createRuntimeConfig({ apiBaseUrl: "", apiVersion: "" }),
    );

    expect(validateEnv()).toEqual({
      valid: false,
      missing: ["apiBaseUrl", "apiVersion"],
    });
  });

  it("calls logWarning when warnMissingEnv detects missing required vars", () => {
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({ apiVersion: "" }));

    warnMissingEnv();

    expect(mockLogWarning).toHaveBeenCalledWith("missing required runtime config", {
      missing: ["apiVersion"],
    }, undefined);
  });
});
