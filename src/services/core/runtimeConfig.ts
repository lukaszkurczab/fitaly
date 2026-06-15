import Constants from "expo-constants";

const DEFAULT_API_VERSION = "v1";
const DEFAULT_SENTRY_ENVIRONMENT = "development";

export type RuntimeConfig = {
  apiBaseUrl: string;
  apiVersion: string;
  backendLoggingEnabled: boolean;
  telemetryEnabled: boolean;
  smartRemindersEnabled: boolean;
  reviewMemoryExplanationEnabled: boolean;
  billingDisabled: boolean;
  buildProfile: string;
  termsUrl: string;
  privacyUrl: string;
  sentryDsn: string;
  sentryEnvironment: string;
  sentryOrganization: string;
  sentryProject: string;
  revenuecatIosKey: string;
  revenuecatAndroidKey: string;
  firebaseAuthEmulatorHost: string;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaultValue;
    }
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return defaultValue;
}

export function getRuntimeConfigFromExtra(extra: unknown): RuntimeConfig {
  const record =
    extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {};

  return {
    apiBaseUrl: normalizeString(record.apiBaseUrl),
    apiVersion: normalizeString(record.apiVersion) || DEFAULT_API_VERSION,
    backendLoggingEnabled: normalizeBoolean(record.backendLoggingEnabled, false),
    telemetryEnabled: normalizeBoolean(record.telemetryEnabled, false),
    smartRemindersEnabled: normalizeBoolean(record.smartRemindersEnabled, true),
    reviewMemoryExplanationEnabled: normalizeBoolean(
      record.reviewMemoryExplanationEnabled,
      false,
    ),
    billingDisabled: normalizeBoolean(record.billingDisabled, false),
    buildProfile: normalizeString(record.buildProfile),
    termsUrl: normalizeString(record.termsUrl),
    privacyUrl: normalizeString(record.privacyUrl),
    sentryDsn: normalizeString(record.sentryDsn),
    sentryEnvironment:
      normalizeString(record.sentryEnvironment) || DEFAULT_SENTRY_ENVIRONMENT,
    sentryOrganization: normalizeString(record.sentryOrganization),
    sentryProject: normalizeString(record.sentryProject),
    revenuecatIosKey: normalizeString(record.revenuecatIosKey),
    revenuecatAndroidKey: normalizeString(record.revenuecatAndroidKey),
    firebaseAuthEmulatorHost: normalizeString(record.firebaseAuthEmulatorHost),
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return getRuntimeConfigFromExtra(Constants.expoConfig?.extra);
}
