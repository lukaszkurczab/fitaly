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
  PROFILE_DEFAULTS,
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
import type { UserData, UserProfile } from "@/types";

const FIXTURES_DIR = path.join(__dirname);

type ProfileContractFixture = {
  contractVersion: number;
  onboardingRequest: {
    requiredFields: string[];
    optionalFields: string[];
  };
	  onboardingProfile: {
	    fields: string[];
	    defaults: {
	      profile: UserProfile;
	    };
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
      language: ["profile.language"],
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
      default: PROFILE_DEFAULTS.language,
      normalizedExamples: PROFILE_LANGUAGE_NORMALIZATION_EXAMPLES,
    });
    expect(contract.semantics.readiness).toEqual({
      field: PROFILE_READINESS_FIELDS[0],
      default: PROFILE_DEFAULTS.readiness,
      statuses: ["needs_profile", "needs_ai_consent", "ready"],
    });
    expect(contract.semantics.aiPersona).toEqual({
      default: PROFILE_DEFAULTS.aiPreferences.stylePersona,
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
	      unitsSystem:
	        contract.onboardingProfile.defaults.profile.nutritionProfile
	          .unitsSystem,
	      sex: contract.onboardingProfile.defaults.profile.nutritionProfile.sex,
	      activityLevel:
	        contract.onboardingProfile.defaults.profile.nutritionProfile
	          .activityLevel,
	      goal: contract.onboardingProfile.defaults.profile.nutritionProfile.goal,
	      aiPersona: contract.onboardingProfile.defaults.profile.aiPreferences.stylePersona,
	      calorieTarget:
	        contract.onboardingProfile.defaults.profile.nutritionProfile.calorieTarget,
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
      profile: {
        language: "pl",
        nutritionProfile: {
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
          calorieTarget: 2200,
        },
        aiPreferences: {
          stylePersona: "focused_coach",
        },
        consents: {
          aiHealthDataConsentAt: "2026-05-03T10:00:00Z",
        },
        readiness: {
          status: "ready",
          onboardingCompletedAt: "2026-05-02T10:00:00Z",
          readyAt: "2026-05-03T10:00:00Z",
        },
      },
      syncState: "pending",
      lastSyncedAt: "2026-05-02T10:00:00Z",
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file:///avatar.jpg",
      avatarlastSyncedAt: "2026-05-02T10:00:00Z",
    });

    expect(parsed).toMatchObject({
      profile: {
        language: "pl",
        nutritionProfile: {
          activityLevel: "",
          goal: "",
          preferences: ["vegan", "balanced"],
          calorieTarget: 2200,
        },
        aiPreferences: {
          stylePersona: "focused_coach",
        },
        readiness: {
          status: "ready",
          onboardingCompletedAt: "2026-05-02T10:00:00Z",
          readyAt: "2026-05-03T10:00:00Z",
        },
      },
    });
  });

  test("profile patch sanitizer excludes server-owned readiness", () => {
    const patch = sanitizeUserProfilePatch({
      profile: {
        ...PROFILE_DEFAULTS,
        language: "pl",
        aiPreferences: { stylePersona: "mediterranean_friend" },
        nutritionProfile: {
          ...PROFILE_ONBOARDING_DEFAULTS,
          goal: "increase",
          calorieTarget: 2500,
          preferences: ["mediterranean"],
        },
        readiness: {
          status: "needs_ai_consent",
          onboardingCompletedAt: "2026-05-02T10:00:00Z",
          readyAt: null,
        },
      },
    } satisfies Partial<UserData>);

    expect(patch).toEqual({
      profile: {
        ...PROFILE_DEFAULTS,
        language: "pl",
        aiPreferences: { stylePersona: "mediterranean_friend" },
        nutritionProfile: {
          ...PROFILE_ONBOARDING_DEFAULTS,
          goal: "increase",
          calorieTarget: 2500,
          preferences: ["mediterranean"],
        },
        readiness: {
          status: "needs_ai_consent",
          onboardingCompletedAt: "2026-05-02T10:00:00Z",
          readyAt: null,
        },
      },
    });
  });

  test("backend-only normalization examples are tracked locally for review", () => {
    expect(contract.backendNormalizationExamples.aiPersona).toEqual(
      PROFILE_AI_PERSONA_NORMALIZATION_EXAMPLES,
    );
  });
});
