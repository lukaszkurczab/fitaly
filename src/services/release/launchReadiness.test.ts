import { describe, expect, it } from "@jest/globals";
import Constants from "expo-constants";
import {
  getLaunchReadinessIssue,
  getLaunchReadinessIssueFromExtra,
} from "@/services/release/launchReadiness";

describe("launchReadiness", () => {
  it("does not block non-production builds", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "preview",
        apiBaseUrl: "",
        billingDisabled: true,
        termsUrl: "",
        privacyUrl: "",
        sentryEnvironment: "development",
      }),
    ).toBeNull();
  });

  it("passes production builds with required launch configuration", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      }),
    ).toBeNull();
  });

  it("blocks production runtime when a C2 new-domain flag resolves enabled", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
        smartMemoryEnabled: true,
      }),
    ).toContain(
      "EXPO_PUBLIC_ENABLE_SMART_MEMORY must be false in production until its feature gate passes.",
    );
  });

  it("requires only the iOS RevenueCat key for an iOS production runtime", () => {
    expect(
      getLaunchReadinessIssueFromExtra(
        {
          buildProfile: "production",
          apiBaseUrl: "https://api.example.com",
          billingDisabled: false,
          sentryEnvironment: "production",
          termsUrl: "https://fitaly.app/terms",
          privacyUrl: "https://fitaly.app/privacy",
          sentryDsn: "https://public@sentry.io/1",
          revenuecatIosKey: "",
          revenuecatAndroidKey: "goog_android_key",
        },
        "ios",
      ),
    ).toContain("Missing RevenueCat iOS API key in production build.");

    expect(
      getLaunchReadinessIssueFromExtra(
        {
          buildProfile: "production",
          apiBaseUrl: "https://api.example.com",
          billingDisabled: false,
          sentryEnvironment: "production",
          termsUrl: "https://fitaly.app/terms",
          privacyUrl: "https://fitaly.app/privacy",
          sentryDsn: "https://public@sentry.io/1",
          revenuecatIosKey: "appl_ios_key",
          revenuecatAndroidKey: "",
        },
        "ios",
      ),
    ).toBeNull();
  });

  it("requires only the Android RevenueCat key for an Android production runtime", () => {
    expect(
      getLaunchReadinessIssueFromExtra(
        {
          buildProfile: "production",
          apiBaseUrl: "https://api.example.com",
          billingDisabled: false,
          sentryEnvironment: "production",
          termsUrl: "https://fitaly.app/terms",
          privacyUrl: "https://fitaly.app/privacy",
          sentryDsn: "https://public@sentry.io/1",
          revenuecatIosKey: "appl_ios_key",
          revenuecatAndroidKey: "",
        },
        "android",
      ),
    ).toContain("Missing RevenueCat Android API key in production build.");

    expect(
      getLaunchReadinessIssueFromExtra(
        {
          buildProfile: "production",
          apiBaseUrl: "https://api.example.com",
          billingDisabled: false,
          sentryEnvironment: "production",
          termsUrl: "https://fitaly.app/terms",
          privacyUrl: "https://fitaly.app/privacy",
          sentryDsn: "https://public@sentry.io/1",
          revenuecatIosKey: "",
          revenuecatAndroidKey: "goog_android_key",
        },
        "android",
      ),
    ).toBeNull();
  });

  it("requires both RevenueCat keys when production platform is not store-specific", () => {
    expect(
      getLaunchReadinessIssueFromExtra(
        {
          buildProfile: "production",
          apiBaseUrl: "https://api.example.com",
          billingDisabled: false,
          sentryEnvironment: "production",
          termsUrl: "https://fitaly.app/terms",
          privacyUrl: "https://fitaly.app/privacy",
          sentryDsn: "https://public@sentry.io/1",
        },
        "web",
      ),
    ).toEqual(
      [
        "Missing RevenueCat iOS API key in production build.",
        "Missing RevenueCat Android API key in production build.",
      ].join("\n"),
    );
  });

  it.each([
    {
      name: "missing API URL",
      extra: {
        buildProfile: "production",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue: "Missing EXPO_PUBLIC_API_BASE_URL in production build.",
    },
    {
      name: "http API URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "http://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue:
        "EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.",
    },
    {
      name: "localhost API URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "http://localhost:8000",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue:
        "EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.",
    },
    {
      name: "disabled billing",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: true,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        sentryDsn: "https://public@sentry.io/1",
        privacyUrl: "https://fitaly.app/privacy",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue: "Billing must be enabled in production build.",
    },
    {
      name: "missing Terms URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue: "Missing or invalid TERMS_URL in production build.",
    },
    {
      name: "missing Privacy URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue: "Missing or invalid PRIVACY_URL in production build.",
    },
    {
      name: "non-production sentry environment",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "smoke",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue:
        "SENTRY_ENVIRONMENT must equal production in production build.",
    },
    {
      name: "example.com Terms URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue:
        "TERMS_URL cannot use localhost or example.com in production build.",
    },
    {
      name: "localhost Privacy URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "http://localhost:3000/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue:
        "PRIVACY_URL cannot use localhost or example.com in production build.",
    },
    {
      name: "missing Sentry DSN",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
      expectedIssue: "Missing SENTRY_DSN in production build.",
    },
  ])("blocks production builds with $name", ({ extra, expectedIssue }) => {
    expect(getLaunchReadinessIssueFromExtra(extra)).toContain(expectedIssue);
  });

  it("reports multiple production issues together", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "",
        billingDisabled: true,
        sentryEnvironment: "development",
      }),
    ).toBe(
      [
        "Missing EXPO_PUBLIC_API_BASE_URL in production build.",
        "Missing or invalid TERMS_URL in production build.",
        "Missing or invalid PRIVACY_URL in production build.",
        "Billing must be enabled in production build.",
        "Missing RevenueCat iOS API key in production build.",
        "SENTRY_ENVIRONMENT must equal production in production build.",
        "Missing SENTRY_DSN in production build.",
      ].join("\n"),
    );
  });

  it("reads values from expo constants in getLaunchReadinessIssue", () => {
    const originalExpoConfig = Constants.expoConfig;
    const originalExtra = originalExpoConfig?.extra;

    Constants.expoConfig = {
      ...(originalExpoConfig ?? {}),
      name: originalExpoConfig?.name ?? "Fitaly",
      slug: originalExpoConfig?.slug ?? "fitaly",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        billingDisabled: false,
        sentryEnvironment: "production",
        termsUrl: "https://fitaly.app/terms",
        privacyUrl: "https://fitaly.app/privacy",
        sentryDsn: "https://public@sentry.io/1",
        revenuecatIosKey: "appl_ios_key",
        revenuecatAndroidKey: "goog_android_key",
      },
    };

    expect(getLaunchReadinessIssue()).toBeNull();

    Constants.expoConfig = {
      ...(originalExpoConfig ?? {}),
      name: originalExpoConfig?.name ?? "Fitaly",
      slug: originalExpoConfig?.slug ?? "fitaly",
      extra: originalExtra ?? {},
    };
  });
});
