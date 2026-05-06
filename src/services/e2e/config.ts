import Constants from "expo-constants";
import type { UserData } from "@/types";

type E2EExtra = {
  e2e?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as E2EExtra;

const E2E_ENABLED = extra.e2e === true;

export function isE2EModeEnabled(): boolean {
  return E2E_ENABLED;
}

export function buildE2EProfileSeed(uid: string, email: string): Partial<UserData> {
  const nowIso = new Date().toISOString();
  return {
    uid,
    email,
    username: "e2e-user",
    profile: {
      language: "en",
      nutritionProfile: {
        unitsSystem: "metric",
        age: "30",
        sex: "female",
        height: "170",
        heightInch: "",
        weight: "65",
        preferences: ["balanced"],
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: [],
        chronicDiseasesOther: "",
        allergies: [],
        allergiesOther: "",
        lifestyle: "",
        calorieTarget: 2200,
      },
      aiPreferences: { stylePersona: "calm_guide" },
      consents: { aiHealthDataConsentAt: nowIso },
      readiness: {
        status: "ready",
        onboardingCompletedAt: nowIso,
        readyAt: nowIso,
      },
    },
    plan: "free",
    syncState: "pending",
    createdAt: Date.parse("2025-01-01T00:00:00.000Z"),
    lastLogin: nowIso,
  };
}
