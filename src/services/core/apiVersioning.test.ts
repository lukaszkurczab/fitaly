import type { RuntimeConfig } from "@/services/core/runtimeConfig";

const mockGetRuntimeConfig = jest.fn<() => RuntimeConfig>();

function createRuntimeConfig(apiVersion = "v1"): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion,
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
  };
}

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

function loadApiVersioning(apiVersion = "v1") {
  jest.resetModules();
  mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig(apiVersion));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/services/core/apiVersioning") as typeof import("@/services/core/apiVersioning");
}

describe("apiVersioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefixes unversioned paths with the default API version", () => {
    const { withVersion } = loadApiVersioning("v1");

    expect(withVersion("/health")).toBe("/api/v1/health");
  });

  it("passes through explicit v1 paths without re-prefixing", () => {
    const { withVersion } = loadApiVersioning("v1");

    expect(withVersion("/api/v1/health")).toBe("/api/v1/health");
  });

  it("passes through explicit v2 paths without forcing the default version", () => {
    const { withVersion } = loadApiVersioning("v1");

    expect(withVersion("/api/v2/telemetry/events/batch")).toBe(
      "/api/v2/telemetry/events/batch"
    );
  });

  it("builds explicit v2 paths with withV2", () => {
    const { withV2 } = loadApiVersioning("v1");

    expect(withV2("/telemetry/events/batch")).toBe("/api/v2/telemetry/events/batch");
    expect(withV2("/users/me/state")).toBe("/api/v2/users/me/state");
  });

  it("replaces explicit v1 prefixes when building v2 paths", () => {
    const { withV2 } = loadApiVersioning("v1");

    expect(withV2("/api/v1/users/me/state")).toBe("/api/v2/users/me/state");
    expect(withV2("/api/v1")).toBe("/api/v2");
  });

  it("normalizes whitespace and missing leading slash", () => {
    const { withVersion, withV2 } = loadApiVersioning("v1");

    expect(withVersion("  health  ")).toBe("/api/v1/health");
    expect(withV2("  telemetry/events/batch  ")).toBe("/api/v2/telemetry/events/batch");
  });

  it("normalizes empty paths to the API root", () => {
    const { withVersion, withV2 } = loadApiVersioning("v1");

    expect(withVersion("   ")).toBe("/api/v1/");
    expect(withV2("   ")).toBe("/api/v2/");
  });
});
