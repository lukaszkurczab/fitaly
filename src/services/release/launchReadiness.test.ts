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
        disableBilling: true,
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
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      }),
    ).toBeNull();
  });

  it.each([
    {
      name: "missing API URL",
      extra: {
        buildProfile: "production",
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue: "Missing EXPO_PUBLIC_API_BASE_URL in production build.",
    },
    {
      name: "http API URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "http://api.example.com",
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue:
        "EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.",
    },
    {
      name: "localhost API URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "http://localhost:8000",
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue:
        "EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.",
    },
    {
      name: "disabled billing",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        disableBilling: true,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue: "Billing must be enabled in production build.",
    },
    {
      name: "missing Terms URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        disableBilling: false,
        sentryEnvironment: "production",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue: "Missing or invalid TERMS_URL in production build.",
    },
    {
      name: "missing Privacy URL",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
      },
      expectedIssue: "Missing or invalid PRIVACY_URL in production build.",
    },
    {
      name: "non-production sentry environment",
      extra: {
        buildProfile: "production",
        apiBaseUrl: "https://api.example.com",
        disableBilling: false,
        sentryEnvironment: "smoke",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      },
      expectedIssue:
        "SENTRY_ENVIRONMENT must equal production in production build.",
    },
  ])("blocks production builds with $name", ({ extra, expectedIssue }) => {
    expect(getLaunchReadinessIssueFromExtra(extra)).toContain(expectedIssue);
  });

  it("reports multiple production issues together", () => {
    expect(
      getLaunchReadinessIssueFromExtra({
        buildProfile: "production",
        apiBaseUrl: "",
        disableBilling: true,
        sentryEnvironment: "development",
      }),
    ).toBe(
      [
        "Missing EXPO_PUBLIC_API_BASE_URL in production build.",
        "Missing or invalid TERMS_URL in production build.",
        "Missing or invalid PRIVACY_URL in production build.",
        "Billing must be enabled in production build.",
        "SENTRY_ENVIRONMENT must equal production in production build.",
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
        disableBilling: false,
        sentryEnvironment: "production",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
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
