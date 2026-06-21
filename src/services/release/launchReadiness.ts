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

function getUrlHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isPlaceholderProductionLegalUrl(value: string): boolean {
  const hostname = getUrlHostname(value);
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "example.com" ||
    hostname.endsWith(".example.com")
  );
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

function appendProductionNewDomainFlagIssues(
  issues: string[],
  config: ReturnType<typeof getRuntimeConfigFromExtra>,
): void {
  const productionOffFlags: Array<[boolean, string]> = [
    [config.foodLibraryEnabled, "EXPO_PUBLIC_ENABLE_FOOD_LIBRARY"],
    [config.smartMemoryEnabled, "EXPO_PUBLIC_ENABLE_SMART_MEMORY"],
    [config.knownPatternsEnabled, "EXPO_PUBLIC_ENABLE_KNOWN_PATTERNS"],
    [config.recipeCatalogEnabled, "EXPO_PUBLIC_ENABLE_RECIPE_CATALOG"],
    [config.planningEnabled, "EXPO_PUBLIC_ENABLE_PLANNING"],
    [config.homeNextActionEnabled, "EXPO_PUBLIC_ENABLE_HOME_NEXT_ACTION"],
    [
      config.reviewMemoryExplanationEnabled,
      "EXPO_PUBLIC_ENABLE_REVIEW_MEMORY_EXPLANATION",
    ],
  ];

  for (const [enabled, flagName] of productionOffFlags) {
    if (enabled) {
      issues.push(
        `${flagName} must be false in production until its feature gate passes.`,
      );
    }
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
  const sentryDsn = config.sentryDsn;
  const sentryEnvironment = config.sentryEnvironment.toLowerCase();

  if (!apiBaseUrl) {
    issues.push("Missing EXPO_PUBLIC_API_BASE_URL in production build.");
  } else if (!isHttpsUrl(apiBaseUrl)) {
    issues.push("EXPO_PUBLIC_API_BASE_URL must start with https:// in production build.");
  }

  if (!isHttpUrl(termsUrl)) {
    issues.push("Missing or invalid TERMS_URL in production build.");
  } else if (isPlaceholderProductionLegalUrl(termsUrl)) {
    issues.push("TERMS_URL cannot use localhost or example.com in production build.");
  }
  if (!isHttpUrl(privacyUrl)) {
    issues.push("Missing or invalid PRIVACY_URL in production build.");
  } else if (isPlaceholderProductionLegalUrl(privacyUrl)) {
    issues.push("PRIVACY_URL cannot use localhost or example.com in production build.");
  }
  if (config.billingDisabled) {
    issues.push("Billing must be enabled in production build.");
  }
  appendProductionNewDomainFlagIssues(issues, config);
  appendRevenueCatIssues(issues, config, platform);
  if (sentryEnvironment !== PRODUCTION_BUILD_PROFILE) {
    issues.push("SENTRY_ENVIRONMENT must equal production in production build.");
  }
  if (!sentryDsn) {
    issues.push("Missing SENTRY_DSN in production build.");
  }

  return issues.length > 0 ? issues.join("\n") : null;
}

export function getLaunchReadinessIssue(): string | null {
  return getLaunchReadinessIssueFromExtra(readExtra());
}
