import type {
  UserAiPreferences,
  UserAiConsent,
  UserNutritionProfile,
  UserProfile,
  ReadinessStatus,
  AiConsentStatus,
  Sex,
  UserData,
  UserReadiness,
} from "@/types";
import {
  asNumber,
  asString,
  asStringArray,
  isRecord,
} from "@/services/contracts/guards";
import {
  PROFILE_ACTIVITY_LEVELS,
  PROFILE_AI_PERSONAS,
  PROFILE_ALLERGIES,
  PROFILE_DISEASES,
  PROFILE_GOALS,
  PROFILE_LANGUAGES,
  PROFILE_PREFERENCES,
  PROFILE_SEX,
  PROFILE_SYNC_STATES,
  PROFILE_UNITS,
} from "./profileContract";

const PLANS = ["free", "premium"] as const;
const READINESS_STATUSES = [
  "needs_profile",
  "needs_ai_consent",
  "ready",
] as const satisfies readonly ReadinessStatus[];
const AI_CONSENT_STATUSES = [
  "not_granted",
  "granted",
  "revoked",
] as const satisfies readonly AiConsentStatus[];

function pickEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof raw === "string" && allowed.includes(raw as T)
    ? (raw as T)
    : fallback;
}

function pickNullableSex(raw: unknown): Sex {
  if (raw == null) return null;
  return pickEnum(raw, PROFILE_SEX, "female");
}

function pickEnumArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  const input = asStringArray(raw);
  return input.filter((item): item is T => allowed.includes(item as T));
}

function parseAvatarRef(raw: unknown): UserData["avatarRef"] {
  if (!isRecord(raw)) return undefined;
  const storagePath = asString(raw.storagePath);
  return storagePath ? { storagePath } : undefined;
}

function parseReadiness(raw: unknown): UserReadiness {
  if (!isRecord(raw)) {
    return {
      status: "needs_profile",
      onboardingCompletedAt: null,
      readyAt: null,
    };
  }
  return {
    status: pickEnum(raw.status, READINESS_STATUSES, "needs_profile"),
    onboardingCompletedAt: asString(raw.onboardingCompletedAt) ?? null,
    readyAt: asString(raw.readyAt) ?? null,
  };
}

function parseNutritionProfile(raw: unknown): UserNutritionProfile {
  const payload = isRecord(raw) ? raw : {};
  const calorieTargetRaw = payload.calorieTarget;
  const calorieTarget =
    calorieTargetRaw === null ? null : (asNumber(calorieTargetRaw) ?? 0);

  return {
    unitsSystem: pickEnum(payload.unitsSystem, PROFILE_UNITS, "metric"),
    age: asString(payload.age) ?? "",
    sex: pickNullableSex(payload.sex),
    height: asString(payload.height) ?? "",
    heightInch: asString(payload.heightInch) ?? "",
    weight: asString(payload.weight) ?? "",
    preferences: pickEnumArray(payload.preferences, PROFILE_PREFERENCES),
    activityLevel: pickEnum(payload.activityLevel, PROFILE_ACTIVITY_LEVELS, "moderate"),
    goal: pickEnum(payload.goal, PROFILE_GOALS, "maintain"),
    chronicDiseases: pickEnumArray(payload.chronicDiseases, PROFILE_DISEASES),
    chronicDiseasesOther: asString(payload.chronicDiseasesOther) ?? "",
    allergies: pickEnumArray(payload.allergies, PROFILE_ALLERGIES),
    allergiesOther: asString(payload.allergiesOther) ?? "",
    lifestyle: asString(payload.lifestyle) ?? "",
    calorieTarget,
  };
}

function parseAiPreferences(raw: unknown): UserAiPreferences {
  const payload = isRecord(raw) ? raw : {};
  return {
    stylePersona: pickEnum(
      payload.stylePersona,
      PROFILE_AI_PERSONAS,
      "calm_guide",
    ),
  };
}

function parseAiConsent(raw: unknown): UserAiConsent {
  const payload = isRecord(raw) ? raw : {};
  return {
    status: pickEnum(payload.status, AI_CONSENT_STATUSES, "not_granted"),
    grantedAt: asString(payload.grantedAt) ?? null,
    revokedAt: asString(payload.revokedAt) ?? null,
  };
}

export function parseUserProfile(raw: unknown): UserProfile {
  const payload = isRecord(raw) ? raw : {};
  return {
    language: pickEnum(payload.language, PROFILE_LANGUAGES, "en"),
    nutritionProfile: parseNutritionProfile(payload.nutritionProfile),
    aiPreferences: parseAiPreferences(payload.aiPreferences),
    aiConsent: parseAiConsent(payload.aiConsent),
    readiness: parseReadiness(payload.readiness),
  };
}

export function parseUserData(payload: unknown): UserData | null {
  if (!isRecord(payload)) return null;

  const uid = asString(payload.uid);
  const email = asString(payload.email);
  const username = asString(payload.username);
  if (!uid || !email || !username) return null;

  const createdAt = asNumber(payload.createdAt) ?? Date.now();
  const lastLogin = asString(payload.lastLogin) ?? new Date().toISOString();

  const data: UserData = {
    uid,
    email,
    username,
    plan: pickEnum(payload.plan, PLANS, "free"),
    createdAt,
    lastLogin,
    profile: parseUserProfile(payload.profile),
    syncState: pickEnum(payload.syncState, PROFILE_SYNC_STATES, "pending"),
    lastSyncedAt: asString(payload.lastSyncedAt),
    avatarUrl: asString(payload.avatarUrl),
    avatarLocalPath: asString(payload.avatarLocalPath),
    avatarlastSyncedAt: asString(payload.avatarlastSyncedAt),
    avatarRef: parseAvatarRef(payload.avatarRef),
  };

  return data;
}
