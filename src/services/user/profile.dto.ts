import type {
  ActivityLevel,
  AiFocus,
  AiStyle,
  Allergy,
  ChronicDisease,
  Goal,
  Preference,
  Sex,
  UnitsSystem,
  UserData,
} from "@/types";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  isRecord,
} from "@/services/contracts/guards";

const UNITS = ["metric", "imperial"] as const satisfies readonly UnitsSystem[];
const SEX = ["male", "female"] as const satisfies readonly Exclude<Sex, null>[];
const GOALS = ["lose", "maintain", "increase"] as const satisfies readonly Goal[];
const ACTIVITY = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const satisfies readonly ActivityLevel[];
const PLANS = ["free", "premium"] as const;
const SYNC_STATES = ["synced", "pending", "conflict"] as const;
const LANGUAGES = ["en", "pl"] as const;
const PREFERENCES = [
  "lowCarb",
  "keto",
  "highProtein",
  "highCarb",
  "lowFat",
  "balanced",
  "vegetarian",
  "vegan",
  "pescatarian",
  "mediterranean",
  "glutenFree",
  "dairyFree",
  "paleo",
] as const satisfies readonly Preference[];
const DISEASES = [
  "none",
  "diabetes",
  "hypertension",
  "asthma",
  "other",
] as const satisfies readonly ChronicDisease[];
const ALLERGIES = [
  "none",
  "peanuts",
  "gluten",
  "lactose",
  "other",
] as const satisfies readonly Allergy[];
const AI_STYLES = [
  "none",
  "concise",
  "friendly",
  "detailed",
] as const satisfies readonly AiStyle[];
const AI_FOCUS = [
  "none",
  "mealPlanning",
  "analyzingMistakes",
  "motivation",
] as const satisfies readonly AiFocus[];

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
  return pickEnum(raw, SEX, "female");
}

function pickEnumArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  const input = asStringArray(raw);
  return input.filter((item): item is T => allowed.includes(item as T));
}

export function parseUserData(payload: unknown): UserData | null {
  if (!isRecord(payload)) return null;

  const uid = asString(payload.uid);
  const email = asString(payload.email);
  const username = asString(payload.username);
  if (!uid || !email || !username) return null;

  const createdAt = asNumber(payload.createdAt) ?? Date.now();
  const lastLogin = asString(payload.lastLogin) ?? new Date().toISOString();

  const surveyComplited = asBoolean(payload.surveyComplited) ?? false;
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
    unitsSystem: pickEnum(payload.unitsSystem, UNITS, "metric"),
    age: asString(payload.age) ?? "",
    sex: pickNullableSex(payload.sex),
    height: asString(payload.height) ?? "",
    heightInch: asString(payload.heightInch),
    weight: asString(payload.weight) ?? "",
    preferences: pickEnumArray(payload.preferences, PREFERENCES),
    activityLevel: pickEnum(payload.activityLevel, ACTIVITY, "moderate"),
    goal: pickEnum(payload.goal, GOALS, "maintain"),
    calorieDeficit: asNumber(payload.calorieDeficit),
    calorieSurplus: asNumber(payload.calorieSurplus),
    chronicDiseases: pickEnumArray(payload.chronicDiseases, DISEASES),
    chronicDiseasesOther: asString(payload.chronicDiseasesOther) ?? "",
    allergies: pickEnumArray(payload.allergies, ALLERGIES),
    allergiesOther: asString(payload.allergiesOther) ?? "",
    lifestyle: asString(payload.lifestyle) ?? "",
    aiStyle: pickEnum(payload.aiStyle, AI_STYLES, "none"),
    aiFocus: pickEnum(payload.aiFocus, AI_FOCUS, "none"),
    aiFocusOther: asString(payload.aiFocusOther) ?? "",
    aiNote: asString(payload.aiNote) ?? "",
    surveyComplited,
    calorieTarget,
    surveyCompletedAt: asString(payload.surveyCompletedAt),
    syncState: pickEnum(payload.syncState, SYNC_STATES, "pending"),
    lastSyncedAt: asString(payload.lastSyncedAt),
    avatarUrl: asString(payload.avatarUrl),
    avatarLocalPath: asString(payload.avatarLocalPath),
    avatarlastSyncedAt: asString(payload.avatarlastSyncedAt),
    language: pickEnum(payload.language, LANGUAGES, "en"),
  };

  return data;
}
