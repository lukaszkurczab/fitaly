import type {
  ReadinessStatus,
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

export function parseUserData(payload: unknown): UserData | null {
  if (!isRecord(payload)) return null;

  const uid = asString(payload.uid);
  const email = asString(payload.email);
  const username = asString(payload.username);
  if (!uid || !email || !username) return null;

  const createdAt = asNumber(payload.createdAt) ?? Date.now();
  const lastLogin = asString(payload.lastLogin) ?? new Date().toISOString();

  const calorieTargetRaw = payload.calorieTarget;
  const calorieTarget =
    calorieTargetRaw === null ? null : (asNumber(calorieTargetRaw) ?? 0);

  const data: UserData = {
    uid,
    email,
    username,
    plan: pickEnum(payload.plan, PLANS, "free"),
    createdAt,
    lastLogin,
    unitsSystem: pickEnum(payload.unitsSystem, PROFILE_UNITS, "metric"),
    age: asString(payload.age) ?? "",
    sex: pickNullableSex(payload.sex),
    height: asString(payload.height) ?? "",
    heightInch: asString(payload.heightInch),
    weight: asString(payload.weight) ?? "",
    preferences: pickEnumArray(payload.preferences, PROFILE_PREFERENCES),
    activityLevel: pickEnum(payload.activityLevel, PROFILE_ACTIVITY_LEVELS, "moderate"),
    goal: pickEnum(payload.goal, PROFILE_GOALS, "maintain"),
    calorieDeficit: asNumber(payload.calorieDeficit),
    calorieSurplus: asNumber(payload.calorieSurplus),
    chronicDiseases: pickEnumArray(payload.chronicDiseases, PROFILE_DISEASES),
    chronicDiseasesOther: asString(payload.chronicDiseasesOther) ?? "",
    allergies: pickEnumArray(payload.allergies, PROFILE_ALLERGIES),
    allergiesOther: asString(payload.allergiesOther) ?? "",
    lifestyle: asString(payload.lifestyle) ?? "",
    aiPersona: pickEnum(payload.aiPersona, PROFILE_AI_PERSONAS, "calm_guide"),
    readiness: parseReadiness(payload.readiness),
    calorieTarget,
    syncState: pickEnum(payload.syncState, PROFILE_SYNC_STATES, "pending"),
    lastSyncedAt: asString(payload.lastSyncedAt),
    avatarUrl: asString(payload.avatarUrl),
    avatarLocalPath: asString(payload.avatarLocalPath),
    avatarlastSyncedAt: asString(payload.avatarlastSyncedAt),
    language: pickEnum(payload.language, PROFILE_LANGUAGES, "en"),
  };

  return data;
}
