import Constants from "expo-constants";

const PRODUCTION_BUILD_PROFILE = "production";

type AppExtra = {
  apiBaseUrl?: unknown;
  buildProfile?: unknown;
  disableBilling?: unknown;
  termsUrl?: unknown;
  privacyUrl?: unknown;
  sentryEnvironment?: unknown;
};

function readExtra(): AppExtra {
  return (Constants.expoConfig?.extra ?? {}) as AppExtra;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function isHttpsUrl(value: string): boolean {
  return value.startsWith("https://");
}

function isProductionBuild(extra: AppExtra): boolean {
  return (
    normalizeString(extra.buildProfile).toLowerCase() === PRODUCTION_BUILD_PROFILE
  );
}

export function getLaunchReadinessIssueFromExtra(extra: AppExtra): string | null {
  if (!isProductionBuild(extra)) {
    return null;
  }

  const issues: string[] = [];
  const apiBaseUrl = normalizeString(extra.apiBaseUrl);
  const termsUrl = normalizeString(extra.termsUrl);
  const privacyUrl = normalizeString(extra.privacyUrl);
  const sentryEnvironment = normalizeString(extra.sentryEnvironment).toLowerCase();

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
  if (extra.disableBilling === true) {
    issues.push("Billing must be enabled in production build.");
  }
  if (sentryEnvironment !== PRODUCTION_BUILD_PROFILE) {
    issues.push("SENTRY_ENVIRONMENT must equal production in production build.");
  }

  return issues.length > 0 ? issues.join("\n") : null;
}

export function getLaunchReadinessIssue(): string | null {
  return getLaunchReadinessIssueFromExtra(readExtra());
}
