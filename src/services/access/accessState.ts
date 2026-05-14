import {
  parseCreditsFromResponse,
  type AiCreditsStatus,
} from "@/services/ai/contracts";
import { asBoolean, asNumber, asString, isRecord } from "@/services/contracts/guards";

export type AccessTier = "free" | "premium" | "unknown";
export type AccessEntitlementStatus = "active" | "inactive" | "degraded" | "unknown";
export type AccessFeatureKey =
  | "aiChat"
  | "photoAnalysis"
  | "textMealAnalysis"
  | "weeklyReport"
  | "fullHistory"
  | "cloudBackup";
export type AccessFeatureStatus = "enabled" | "disabled" | "unknown";
export type AccessFeatureReason =
  | "insufficient_credits"
  | "requires_premium"
  | "degraded"
  | "feature_disabled";

export type AccessFeatureState = {
  enabled: boolean;
  status: AccessFeatureStatus;
  reason: AccessFeatureReason | null;
  requiredCredits: number | null;
  remainingCredits: number | null;
};

export type AccessFeatures = Record<AccessFeatureKey, AccessFeatureState>;

export type AccessState = {
  tier: AccessTier;
  entitlementStatus: AccessEntitlementStatus;
  credits: AiCreditsStatus | null;
  features: AccessFeatures;
  refreshedAt: string;
};

const FEATURE_KEYS: AccessFeatureKey[] = [
  "aiChat",
  "photoAnalysis",
  "textMealAnalysis",
  "weeklyReport",
  "fullHistory",
  "cloudBackup",
];

function isValidDateString(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function parseFeatureReason(value: unknown): AccessFeatureReason | null {
  const raw = asString(value);
  if (
    raw === "insufficient_credits" ||
    raw === "requires_premium" ||
    raw === "degraded" ||
    raw === "feature_disabled"
  ) {
    return raw;
  }
  return null;
}

function parseFeatureState(value: unknown): AccessFeatureState | null {
  if (!isRecord(value)) return null;

  const enabled = asBoolean(value.enabled);
  const status = asString(value.status);
  if (
    enabled === undefined ||
    (status !== "enabled" && status !== "disabled" && status !== "unknown")
  ) {
    return null;
  }

  return {
    enabled,
    status,
    reason: parseFeatureReason(value.reason),
    requiredCredits: asNumber(value.requiredCredits) ?? null,
    remainingCredits: asNumber(value.remainingCredits) ?? null,
  };
}

function parseFeatures(value: unknown): AccessFeatures | null {
  if (!isRecord(value)) return null;
  const parsed = {} as AccessFeatures;
  for (const key of FEATURE_KEYS) {
    const feature = parseFeatureState(value[key]);
    if (!feature) return null;
    parsed[key] = feature;
  }
  return parsed;
}

export function parseAccessState(value: unknown): AccessState | null {
  if (!isRecord(value)) return null;

  const tier = asString(value.tier);
  const entitlementStatus = asString(value.entitlementStatus);
  const refreshedAt = asString(value.refreshedAt);
  const features = parseFeatures(value.features);
  const credits = value.credits === null ? null : parseCreditsFromResponse(value.credits);

  if (
    (tier !== "free" && tier !== "premium" && tier !== "unknown") ||
    (
      entitlementStatus !== "active" &&
      entitlementStatus !== "inactive" &&
      entitlementStatus !== "degraded" &&
      entitlementStatus !== "unknown"
    ) ||
    !refreshedAt ||
    !isValidDateString(refreshedAt) ||
    !features ||
    (value.credits !== null && !credits)
  ) {
    return null;
  }

  return {
    tier,
    entitlementStatus,
    credits,
    features,
    refreshedAt,
  };
}

function degradedFeature(): AccessFeatureState {
  return {
    enabled: false,
    status: "unknown",
    reason: "degraded",
    requiredCredits: null,
    remainingCredits: null,
  };
}

export function buildDegradedAccessState(
  refreshedAt: string = new Date().toISOString(),
): AccessState {
  const feature = degradedFeature();
  return {
    tier: "unknown",
    entitlementStatus: "degraded",
    credits: null,
    features: {
      aiChat: { ...feature },
      photoAnalysis: { ...feature },
      textMealAnalysis: { ...feature },
      weeklyReport: { ...feature },
      fullHistory: { ...feature },
      cloudBackup: { ...feature },
    },
    refreshedAt,
  };
}

export function hasConfirmedPremiumAccess(
  accessState: AccessState | null,
): boolean {
  return (
    accessState?.tier === "premium"
    && accessState.entitlementStatus === "active"
    && accessState.credits?.tier === "premium"
  );
}

export function getAccessFeature(
  accessState: AccessState | null,
  feature: AccessFeatureKey,
): AccessFeatureState | null {
  return accessState?.features[feature] ?? null;
}
