import Constants from "expo-constants";
import { Platform } from "react-native";
import { getRuntimeConfigFromExtra } from "@/services/core/runtimeConfig";

const PRODUCTION_BUILD_PROFILE = "production";

type AppExtra = Parameters<typeof getRuntimeConfigFromExtra>[0];
type LaunchReadinessPlatform = typeof Platform.OS;

function readExtra(): AppExtra {
  return Constants.expoConfig?.extra ?? {};
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function isHttpsUrl(value: string): boolean {
  return value.startsWith("https://");
}

function isProductionBuild(buildProfile: string): boolean {
  return buildProfile.toLowerCase() === PRODUCTION_BUILD_PROFILE;
}

function appendRevenueCatIssues(
  issues: string[],
  config: ReturnType<typeof getRuntimeConfigFromExtra>,
  platform: LaunchReadinessPlatform,
): void {
  if (platform === "ios") {
    if (!config.revenuecatIosKey) {
      issues.push("Missing RevenueCat iOS API key in production build.");
    }
    return;
  }

  if (platform === "android") {
    if (!config.revenuecatAndroidKey) {
      issues.push("Missing RevenueCat Android API key in production build.");
    }
    return;
  }

  // Unknown/non-store runtime platform cannot prove the target store build,
  // so production readiness requires both store keys.
  if (!config.revenuecatIosKey) {
    issues.push("Missing RevenueCat iOS API key in production build.");
  }
  if (!config.revenuecatAndroidKey) {
    issues.push("Missing RevenueCat Android API key in production build.");
  }
}

export function getLaunchReadinessIssueFromExtra(
  extra: AppExtra,
  platform: LaunchReadinessPlatform = Platform.OS,
): string | null {
  const config = getRuntimeConfigFromExtra(extra);

  if (!isProductionBuild(config.buildProfile)) {
    return null;
  }

  const issues: string[] = [];
  const apiBaseUrl = config.apiBaseUrl;
  const termsUrl = config.termsUrl;
  const privacyUrl = config.privacyUrl;
  const sentryEnvironment = config.sentryEnvironment.toLowerCase();

  if (!apiBaseUrl) {
    issues.push("Missing EXPO_PUBLIC_API_BASE_URL in production build.");
  } else if (!isHttpsUrl(apiBaseUrl)) {
    issues.push("EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.");
  }

  if (!isHttpUrl(termsUrl)) {
    issues.push("Missing or invalid TERMS_URL in production build.");
  }
  if (!isHttpUrl(privacyUrl)) {
    issues.push("Missing or invalid PRIVACY_URL in production build.");
  }
  if (config.billingDisabled) {
    issues.push("Billing must be enabled in production build.");
  }
  appendRevenueCatIssues(issues, config, platform);
  if (sentryEnvironment !== PRODUCTION_BUILD_PROFILE) {
    issues.push("SENTRY_ENVIRONMENT must equal production in production build.");
  }

  return issues.length > 0 ? issues.join("\n") : null;
}

export function getLaunchReadinessIssue(): string | null {
  return getLaunchReadinessIssueFromExtra(readExtra());
}
