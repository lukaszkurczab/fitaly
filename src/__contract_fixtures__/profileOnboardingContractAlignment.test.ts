import * as fs from "fs";
import * as path from "path";

import { INITIAL_FORM } from "@/feature/Onboarding/constants";
import {
  PROFILE_ACTIVITY_LEVELS,
  PROFILE_AI_PERSONAS,
  PROFILE_AI_PERSONA_FIELDS,
  PROFILE_AI_PERSONA_NORMALIZATION_EXAMPLES,
  PROFILE_AI_PERSONA_STYLE_LABELS,
  PROFILE_AI_STYLE_FIELDS,
  PROFILE_ALLERGIES,
  PROFILE_DISEASES,
  PROFILE_EDITABLE_REMOTE_FIELDS,
  PROFILE_GOALS,
  PROFILE_LANGUAGES,
  PROFILE_LANGUAGE_NORMALIZATION_EXAMPLES,
  PROFILE_NUTRITION_FIELDS,
  PROFILE_NUTRITION_SEMANTICS,
  PROFILE_ONBOARDING_DEFAULTS,
  PROFILE_ONBOARDING_DOCUMENT_FIELDS,
  PROFILE_ONBOARDING_REQUEST_OPTIONAL_FIELDS,
  PROFILE_ONBOARDING_REQUEST_REQUIRED_FIELDS,
  PROFILE_PREFERENCES,
  PROFILE_READINESS_FIELDS,
  PROFILE_SEX,
  PROFILE_UNITS,
} from "@/services/user/profileContract";
import { parseUserData } from "@/services/user/profile.dto";
import { sanitizeUserProfilePatch } from "@/services/user/profilePatch";
import type { UserData } from "@/types";

const FIXTURES_DIR = path.join(__dirname);

type ProfileContractFixture = {
  contractVersion: number;
  onboardingRequest: {
    requiredFields: string[];
    optionalFields: string[];
  };
  onboardingProfile: {
    fields: string[];
    defaults: Record<string, unknown>;
  };
  profilePatch: {
    editableFields: string[];
  };
  criticalFieldGroups: Record<string, string[]>;
  enums: Record<string, string[]>;
  semantics: {
    language: {
      default: string;
      normalizedExamples: Record<string, string>;
    };
    readiness: {
      field: string;
      default: {
        status: string;
        onboardingCompletedAt: null;
        readyAt: null;
      };
      statuses: string[];
    };
    aiPersona: {
      default: string;
      styleProfileLabels: Record<string, string>;
    };
    nutrition: {
      defaultGoal: string;
      defaultCalorieTarget: number;
    };
  };
  backendNormalizationExamples: {
    aiPersona: Record<string, string>;
  };
};

function loadFixture<T = unknown>(name: string): T {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(raw) as T;
}

describe("Profile/onboarding contract parity", () => {
  const contract = loadFixture<ProfileContractFixture>(
    "profile_onboarding_v1.contract.json",
  );

  test("shared field lists match backend fixture", () => {
    expect(contract.onboardingRequest.requiredFields).toEqual([
      ...PROFILE_ONBOARDING_REQUEST_REQUIRED_FIELDS,
    ]);
    expect(contract.onboardingRequest.optionalFields).toEqual([
      ...PROFILE_ONBOARDING_REQUEST_OPTIONAL_FIELDS,
    ]);
    expect(contract.onboardingProfile.fields).toEqual([
      ...PROFILE_ONBOARDING_DOCUMENT_FIELDS,
    ]);
    expect(contract.profilePatch.editableFields).toEqual([
      ...PROFILE_EDITABLE_REMOTE_FIELDS,
    ]);
  });

  test("critical field groups match backend fixture", () => {
    expect(contract.criticalFieldGroups).toEqual({
      readiness: [...PROFILE_READINESS_FIELDS],
      language: ["language"],
      aiPersona: [...PROFILE_AI_PERSONA_FIELDS],
      aiStyle: [...PROFILE_AI_STYLE_FIELDS],
      nutrition: [...PROFILE_NUTRITION_FIELDS],
    });
  });

  test("enum values match backend fixture", () => {
    expect(contract.enums).toEqual({
      unitsSystem: [...PROFILE_UNITS],
      sex: [...PROFILE_SEX],
      activityLevel: [...PROFILE_ACTIVITY_LEVELS],
      goal: [...PROFILE_GOALS],
      language: [...PROFILE_LANGUAGES],
      preferences: [...PROFILE_PREFERENCES],
      chronicDiseases: [...PROFILE_DISEASES],
      allergies: [...PROFILE_ALLERGIES],
      aiPersona: [...PROFILE_AI_PERSONAS],
    });
  });

  test("shared semantics match backend fixture", () => {
    expect(contract.semantics.language).toEqual({
      default: PROFILE_ONBOARDING_DEFAULTS.language,
      normalizedExamples: PROFILE_LANGUAGE_NORMALIZATION_EXAMPLES,
    });
    expect(contract.semantics.readiness).toEqual({
      field: PROFILE_READINESS_FIELDS[0],
      default: PROFILE_ONBOARDING_DEFAULTS.readiness,
      statuses: ["needs_profile", "needs_ai_consent", "ready"],
    });
    expect(contract.semantics.aiPersona).toEqual({
      default: PROFILE_ONBOARDING_DEFAULTS.aiPersona,
      styleProfileLabels: PROFILE_AI_PERSONA_STYLE_LABELS,
    });
    expect(contract.semantics.nutrition).toEqual({
      defaultGoal: PROFILE_NUTRITION_SEMANTICS.defaultGoal,
      defaultCalorieTarget: PROFILE_NUTRITION_SEMANTICS.defaultCalorieTarget,
    });
  });

  test("onboarding defaults shared with mobile flow stay aligned", () => {
    expect({
      unitsSystem: INITIAL_FORM.unitsSystem,
      sex: INITIAL_FORM.sex,
      activityLevel: INITIAL_FORM.activityLevel,
      goal: INITIAL_FORM.goal,
      aiPersona: INITIAL_FORM.aiPersona,
      calorieTarget: INITIAL_FORM.calorieTarget,
    }).toEqual({
      unitsSystem: contract.onboardingProfile.defaults.unitsSystem,
      sex: contract.onboardingProfile.defaults.sex,
      activityLevel: contract.onboardingProfile.defaults.activityLevel,
      goal: contract.onboardingProfile.defaults.goal,
      aiPersona: contract.onboardingProfile.defaults.aiPersona,
      calorieTarget: contract.onboardingProfile.defaults.calorieTarget,
    });
  });

  test("profile parser preserves critical contract fields from backend payload", () => {
    const parsed = parseUserData({
      uid: "user-1",
      email: "user@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1,
      lastLogin: "2026-05-05T10:00:00Z",
      unitsSystem: "metric",
      age: "30",
      sex: "female",
      height: "170",
      heightInch: "",
      weight: "70",
      preferences: ["vegan", "balanced"],
      activityLevel: "",
      goal: "",
      chronicDiseases: [],
      chronicDiseasesOther: "",
      allergies: [],
      allergiesOther: "",
      lifestyle: "",
      aiPersona: "focused_coach",
      readiness: {
        status: "ready",
        onboardingCompletedAt: "2026-05-02T10:00:00Z",
        readyAt: "2026-05-03T10:00:00Z",
      },
      calorieTarget: 2200,
      syncState: "pending",
      lastSyncedAt: "2026-05-02T10:00:00Z",
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file:///avatar.jpg",
      avatarlastSyncedAt: "2026-05-02T10:00:00Z",
      language: "pl",
    });

    expect(parsed).toMatchObject({
      activityLevel: "",
      goal: "",
      readiness: {
        status: "ready",
        onboardingCompletedAt: "2026-05-02T10:00:00Z",
        readyAt: "2026-05-03T10:00:00Z",
      },
      language: "pl",
      aiPersona: "focused_coach",
      preferences: ["vegan", "balanced"],
      calorieTarget: 2200,
    });
  });

  test("profile patch sanitizer excludes server-owned readiness", () => {
    const patch = sanitizeUserProfilePatch({
      readiness: {
        status: "needs_ai_consent",
        onboardingCompletedAt: "2026-05-02T10:00:00Z",
        readyAt: null,
      },
      language: "pl",
      aiPersona: "mediterranean_friend",
      goal: "increase",
      calorieTarget: 2500,
      preferences: ["mediterranean"],
    } satisfies Partial<UserData>);

    expect(patch).toEqual({
      language: "pl",
      aiPersona: "mediterranean_friend",
      goal: "increase",
      calorieTarget: 2500,
      preferences: ["mediterranean"],
    });
  });

  test("backend-only normalization examples are tracked locally for review", () => {
    expect(contract.backendNormalizationExamples.aiPersona).toEqual(
      PROFILE_AI_PERSONA_NORMALIZATION_EXAMPLES,
    );
  });
});
