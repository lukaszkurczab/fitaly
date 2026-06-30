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
        foodLibraryEnabled: "true",
        smartMemoryEnabled: true,
        knownPatternsEnabled: "true",
        recipeCatalogEnabled: "true",
        planningEnabled: "true",
        homeNextActionEnabled: "true",
        reviewMemoryExplanationEnabled: "true",
        billingDisabled: "true",
        sentryEnvironment: "production",
        sentryRelease: " fitaly@1.0.1 ",
        sentryDist: " 71 ",
        firebaseProjectId: " demo-fitaly-local ",
        firebaseAuthEmulatorHost: " http://127.0.0.1:9099 ",
      }),
    ).toMatchObject({
      apiBaseUrl: "https://api.example.com",
      apiVersion: "v2",
      backendLoggingEnabled: true,
      telemetryEnabled: true,
      smartRemindersEnabled: false,
      foodLibraryEnabled: true,
      smartMemoryEnabled: true,
      knownPatternsEnabled: true,
      recipeCatalogEnabled: true,
      planningEnabled: true,
      homeNextActionEnabled: true,
      reviewMemoryExplanationEnabled: true,
      billingDisabled: true,
      sentryEnvironment: "production",
      sentryRelease: "fitaly@1.0.1",
      sentryDist: "71",
      firebaseProjectId: "demo-fitaly-local",
      firebaseAuthEmulatorHost: "http://127.0.0.1:9099",
    });
  });

  it("applies stable defaults for missing boolean flags", () => {
    expect(getRuntimeConfigFromExtra({})).toMatchObject({
      backendLoggingEnabled: false,
      telemetryEnabled: false,
      smartRemindersEnabled: true,
      foodLibraryEnabled: false,
      smartMemoryEnabled: false,
      knownPatternsEnabled: false,
      recipeCatalogEnabled: false,
      planningEnabled: false,
      homeNextActionEnabled: false,
      reviewMemoryExplanationEnabled: false,
      billingDisabled: false,
      apiVersion: "v1",
      sentryEnvironment: "development",
      sentryRelease: "",
      sentryDist: "",
      firebaseProjectId: "",
      firebaseAuthEmulatorHost: "",
    });
  });

  it("feeds production launch readiness via billingDisabled", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: true,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
      }),
    ).toContain("Billing must be enabled in production build.");
  });
});
