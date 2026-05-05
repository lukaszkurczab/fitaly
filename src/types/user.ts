import type { FormData } from "./onboarding";
import type { Meal } from "./meal";
import type { ChatMessage } from "./chatMessage";

export type UserPlan = "free" | "premium";
export type SyncState = "synced" | "pending" | "conflict";
export type UserLanguage = "en" | "pl";

export interface UserData extends FormData {
  uid: string;
  email: string;
  username: string;
  plan: UserPlan;
  createdAt: number;
  lastLogin: string;
  surveyComplited: boolean;
  surveyCompletedAt?: string;
  syncState: SyncState;
  lastSyncedAt?: string;
  avatarUrl?: string;
  avatarLocalPath?: string;
  avatarlastSyncedAt?: string;
  language: UserLanguage;
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
