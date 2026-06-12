import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { UserData } from "@/types";
import {
  changeUsernameService,
  changeEmailService,
  changePasswordService,
  deleteAccountService,
  exportUserData,
  fetchUserFromCloud,
  getUserLocal,
  initializeUserOnboardingProfile,
  updateUserLanguageInFirestore,
  uploadAndSaveAvatar,
  upsertUserLocal,
} from "@/services/user/profile";

const mockFetchUserProfileRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockInitializeUserOnboardingRemote = jest.fn<
  (...args: unknown[]) => Promise<unknown>
>();
const mockMergeUserProfileRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUploadUserAvatarRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockClaimUsername = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockResetUserRuntime = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockEmailCredential = jest.fn<(...args: unknown[]) => unknown>();
const mockReauthenticateWithCredential = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockUpdatePassword = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetAuth = jest.fn<(...args: unknown[]) => { currentUser: unknown }>();
const mockCurrentUserDelete = jest.fn<() => Promise<void>>();

jest.mock("@/services/user/userProfileRepository", () => ({
  fetchUserProfileRemote: (...args: unknown[]) => mockFetchUserProfileRemote(...args),
  initializeUserOnboardingRemote: (...args: unknown[]) =>
    mockInitializeUserOnboardingRemote(...args),
  mergeUserProfileRemote: (...args: unknown[]) => mockMergeUserProfileRemote(...args),
  uploadUserAvatarRemote: (...args: unknown[]) => mockUploadUserAvatarRemote(...args),
}));

jest.mock("@/services/user/usernameService", () => ({
  claimUsername: (...args: unknown[]) => mockClaimUsername(...args),
}));

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("@/services/session/resetUserRuntime", () => ({
  resetUserRuntime: (...args: unknown[]) => mockResetUserRuntime(...args),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  EmailAuthProvider: { credential: (...args: unknown[]) => mockEmailCredential(...args) },
  reauthenticateWithCredential: (...args: unknown[]) =>
    mockReauthenticateWithCredential(...args),
  verifyBeforeUpdateEmail: jest.fn(),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
}));

jest.mock("@/services/core/fileSystem", () => ({
  documentDirectory: "file:///docs/",
  createDownloadResumable: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("react-native-zip-archive", () => ({
  zip: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "profile-uuid-1"),
}));

describe("user/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-03T12:00:00.000Z"));
    mockInitializeUserOnboardingRemote.mockResolvedValue(undefined);
    mockMergeUserProfileRemote.mockResolvedValue(undefined);
    mockUploadUserAvatarRemote.mockResolvedValue({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
      avatarRef: { storagePath: "avatars/u1/avatar.abc123" },
    });
    mockClaimUsername.mockResolvedValue("neo");
    mockGet.mockResolvedValue({
      profile: { uid: "u1", username: "neo" },
      meals: [{ id: "meal-1" }],
      myMeals: [{ id: "saved-1" }],
      chatMessages: [{ id: "chat-1" }],
      chatMemory: [{ id: "memory-1" }],
      aiRuns: [{ id: "run-1" }],
      notifications: [{ id: "notif-1" }],
      notificationPrefs: { motivationEnabled: true },
      feedback: [{ id: "feedback-1" }],
      mealMutationDedupe: [
        { clientMutationId: "profile-mutation-1", kind: "profile_update" },
      ],
      telemetryEvents: [{ eventId: "telemetry-1", name: "meal_logged" }],
    });
    mockPost.mockResolvedValue(undefined);
    mockResetUserRuntime.mockResolvedValue(undefined);
    mockEmailCredential.mockReturnValue({ providerId: "password" });
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
    mockGetAuth.mockReturnValue({
      currentUser: {
        email: "u1@example.com",
        delete: mockCurrentUserDelete,
      },
    });
    mockCurrentUserDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("parses repository payload for local and cloud fetches", async () => {
    mockFetchUserProfileRemote.mockResolvedValue({
      uid: "u1",
      email: "u1@example.com",
      username: "neo",
    });

    await expect(getUserLocal()).resolves.toMatchObject({
      uid: "u1",
      email: "u1@example.com",
      username: "neo",
      plan: "free",
      profile: {
        language: "en",
      },
    });

    await expect(fetchUserFromCloud()).resolves.toMatchObject({
      uid: "u1",
      email: "u1@example.com",
      username: "neo",
    });
    expect(mockFetchUserProfileRemote).toHaveBeenCalledTimes(2);
    expect(mockFetchUserProfileRemote).toHaveBeenNthCalledWith(1);
    expect(mockFetchUserProfileRemote).toHaveBeenNthCalledWith(2);
  });

  it("returns null when profile repository has no local or cloud data", async () => {
    mockFetchUserProfileRemote.mockResolvedValue(null);

    await expect(getUserLocal()).resolves.toBeNull();
    await expect(fetchUserFromCloud()).resolves.toBeNull();

    expect(mockFetchUserProfileRemote).toHaveBeenCalledTimes(2);
  });

  it("delegates profile writes to repository helpers", async () => {
    const profile: UserData = {
      uid: "u1",
      email: "u1@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1,
      lastLogin: "2026-03-03T12:00:00.000Z",
      profile: {
        language: "en",
        nutritionProfile: {
          unitsSystem: "metric",
          age: "",
          sex: "female",
          height: "",
          heightInch: "",
          weight: "",
          preferences: [],
          activityLevel: "moderate",
          goal: "maintain",
          chronicDiseases: [],
          chronicDiseasesOther: "",
          allergies: [],
          allergiesOther: "",
          lifestyle: "",
          calorieTarget: 0,
        },
        aiPreferences: {
          stylePersona: "calm_guide",
        },
        aiConsent: {
          status: "not_granted",
          grantedAt: null,
          revokedAt: null,
        },
        readiness: {
          status: "needs_profile",
          onboardingCompletedAt: null,
          readyAt: null,
        },
      },
      syncState: "pending",
      lastSyncedAt: "",
      avatarUrl: "",
      avatarLocalPath: "",
      avatarlastSyncedAt: "",
    };

    await upsertUserLocal(profile);
    mockFetchUserProfileRemote.mockResolvedValue(profile);
    await updateUserLanguageInFirestore("pl");

    expect(mockMergeUserProfileRemote).toHaveBeenNthCalledWith(
      1,
      profile,
      { clientMutationId: "profile-direct:upsert:u1:profile-uuid-1" },
    );
    expect(mockMergeUserProfileRemote).toHaveBeenNthCalledWith(
      2,
      {
        profile: {
          ...profile.profile,
          language: "pl",
        },
      },
      { clientMutationId: "profile-direct:language:u1:profile-uuid-1" },
    );
  });

  it("skips language update when the profile payload is missing", async () => {
    mockFetchUserProfileRemote.mockResolvedValue({ uid: "u1" });

    await updateUserLanguageInFirestore("pl");

    expect(mockMergeUserProfileRemote).not.toHaveBeenCalled();
  });

  it("uploads avatar via repository and persists synced metadata", async () => {
    const result = await uploadAndSaveAvatar({
      uid: "u1",
      localUri: "file:///avatar.jpg",
    });

    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith(
      "file:///avatar.jpg",
      { clientMutationId: "profile-direct:avatar:u1:profile-uuid-1" },
    );
    expect(result).toEqual({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file:///avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
      avatarRef: { storagePath: "avatars/u1/avatar.abc123" },
    });
  });

  it("fetches export payload from backend", async () => {
    await expect(exportUserData()).resolves.toEqual({
      profile: { uid: "u1", username: "neo" },
      meals: [{ id: "meal-1" }],
      myMeals: [{ id: "saved-1" }],
      chatMessages: [{ id: "chat-1" }],
      chatMemory: [{ id: "memory-1" }],
      aiRuns: [{ id: "run-1" }],
      notifications: [{ id: "notif-1" }],
      notificationPrefs: { motivationEnabled: true },
      feedback: [{ id: "feedback-1" }],
      mealMutationDedupe: [
        { clientMutationId: "profile-mutation-1", kind: "profile_update" },
      ],
      telemetryEvents: [{ eventId: "telemetry-1", name: "meal_logged" }],
    });

    expect(mockGet).toHaveBeenCalledWith("/users/me/export");
  });

  it("reauthenticates and delegates username claim to backend service", async () => {
    await changeUsernameService({
      uid: "u1",
      newUsername: "Morpheus",
      password: "Strong1!",
    });

    expect(mockEmailCredential).toHaveBeenCalledWith(
      "u1@example.com",
      "Strong1!",
    );
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
      expect.objectContaining({ email: "u1@example.com" }),
      { providerId: "password" },
    );
    expect(mockClaimUsername).toHaveBeenCalledWith("Morpheus", "u1");
  });

  it("rejects account credential changes when auth has no current user", async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      changePasswordService({
        currentPassword: "OldStrong1!",
        newPassword: "NewStrong1!",
      }),
    ).rejects.toMatchObject({
      code: "auth/not-logged-in",
      source: "UserProfileService",
      retryable: false,
    });

    expect(mockEmailCredential).not.toHaveBeenCalled();
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it("reauthenticates and updates the current user's password", async () => {
    await changePasswordService({
      currentPassword: "OldStrong1!",
      newPassword: "NewStrong1!",
    });

    expect(mockEmailCredential).toHaveBeenCalledWith(
      "u1@example.com",
      "OldStrong1!",
    );
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
      expect.objectContaining({ email: "u1@example.com" }),
      { providerId: "password" },
    );
    expect(mockUpdatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: "u1@example.com" }),
      "NewStrong1!",
    );
  });

  it("persists emailPending through backend after verify-before-update flow", async () => {
    await changeEmailService({
      newEmail: "new@example.com",
      password: "Strong1!",
    });

    expect(mockEmailCredential).toHaveBeenCalledWith(
      "u1@example.com",
      "Strong1!",
    );
    expect(mockReauthenticateWithCredential).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/email-pending",
      { email: "new@example.com" },
    );
  });

  it("reauthenticates, calls backend cascade, and deletes auth user", async () => {
    await deleteAccountService({
      uid: "u1",
      password: "Strong1!",
    });

    expect(mockReauthenticateWithCredential).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockCurrentUserDelete).toHaveBeenCalledWith();
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
  });

  it("initializes onboarding profile through backend-owned endpoint", async () => {
    await initializeUserOnboardingProfile(
      " neo ",
      "pl-PL",
    );
    await initializeUserOnboardingProfile(" trinity ", "en-US");
    await initializeUserOnboardingProfile(" smith ");

    expect(mockInitializeUserOnboardingRemote).toHaveBeenNthCalledWith(1, {
      username: "neo",
      language: "pl",
    });
    expect(mockInitializeUserOnboardingRemote).toHaveBeenNthCalledWith(2, {
      username: "trinity",
      language: "en",
    });
    expect(mockInitializeUserOnboardingRemote).toHaveBeenNthCalledWith(3, {
      username: "smith",
      language: "en",
    });
    expect(mockMergeUserProfileRemote).not.toHaveBeenCalled();
  });
});
