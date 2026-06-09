import type { Meal } from "./meal";
import type { ChatMessage } from "./chatMessage";
import type {
  ActivityLevel,
  AiPersona,
  Allergy,
  ChronicDisease,
  Goal,
  Preference,
  Sex,
  UnitsSystem,
} from "./onboarding";

export type UserPlan = "free" | "premium";
export type SyncState = "synced" | "pending" | "conflict";
export type UserLanguage = "en" | "pl";
export type ReadinessStatus = "needs_profile" | "needs_ai_consent" | "ready";
export type AiConsentStatus = "not_granted" | "granted" | "revoked";

export type UserReadiness = {
  status: ReadinessStatus;
  onboardingCompletedAt: string | null;
  readyAt: string | null;
};

export type UserNutritionProfile = {
  unitsSystem: UnitsSystem;
  age: string;
  sex: Sex;
  height: string;
  heightInch: string;
  weight: string;
  preferences: Preference[];
  activityLevel: ActivityLevel | "";
  goal: Goal | "";
  chronicDiseases: ChronicDisease[];
  chronicDiseasesOther: string;
  allergies: Allergy[];
  allergiesOther: string;
  lifestyle: string;
  calorieTarget: number | null;
};

export type UserAiPreferences = {
  stylePersona: AiPersona;
};

export type UserAiConsent = {
  status: AiConsentStatus;
  grantedAt: string | null;
  revokedAt: string | null;
};

export type UserProfile = {
  language: UserLanguage;
  nutritionProfile: UserNutritionProfile;
  aiPreferences: UserAiPreferences;
  aiConsent: UserAiConsent;
  readiness: UserReadiness;
};

export interface UserData {
  uid: string;
  email: string;
  username: string;
  plan: UserPlan;
  createdAt: number;
  lastLogin: string;
  profile: UserProfile;
  syncState: SyncState;
  lastSyncedAt?: string;
  avatarUrl?: string;
  avatarLocalPath?: string;
  avatarlastSyncedAt?: string;
}

export type ExportedUserData = {
  profile: UserData;
  meals: Meal[];
  myMeals?: Meal[];
  chatMessages: ChatMessage[];
  notifications?: Record<string, unknown>[];
  notificationPrefs?: Record<string, unknown>;
  feedback?: Record<string, unknown>[];
};
