import { describe, expect, it } from "@jest/globals";
import { getLaunchReadinessIssueFromExtra } from "@/services/release/launchReadiness";
import { getRuntimeConfigFromExtra } from "@/services/core/runtimeConfig";

describe("runtimeConfig", () => {
  it("parses canonical boolean flags from expo extra", () => {
    expect(
      getRuntimeConfigFromExtra({
        apiBaseUrl: " https://api.example.com ",
        apiVersion: " v2 ",
        backendLoggingEnabled: "true",
        telemetryEnabled: true,
        smartRemindersEnabled: "false",
        reviewMemoryExplanationEnabled: "true",
        billingDisabled: "true",
        sentryEnvironment: "production",
      }),
    ).toMatchObject({
      apiBaseUrl: "https://api.example.com",
      apiVersion: "v2",
      backendLoggingEnabled: true,
      telemetryEnabled: true,
      smartRemindersEnabled: false,
      reviewMemoryExplanationEnabled: true,
      billingDisabled: true,
      sentryEnvironment: "production",
    });
  });

  it("applies stable defaults for missing boolean flags", () => {
    expect(getRuntimeConfigFromExtra({})).toMatchObject({
      backendLoggingEnabled: false,
      telemetryEnabled: false,
      smartRemindersEnabled: true,
      reviewMemoryExplanationEnabled: false,
      billingDisabled: false,
      apiVersion: "v1",
      sentryEnvironment: "development",
    });
  });

  it("feeds production launch readiness via billingDisabled", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: true,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      }),
    ).toContain("Billing must be enabled in production build.");
  });
});
