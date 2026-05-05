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
  updatePassword: jest.fn(),
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
    });
    mockClaimUsername.mockResolvedValue("neo");
    mockGet.mockResolvedValue({
      profile: { uid: "u1", username: "neo" },
      meals: [{ id: "meal-1" }],
      myMeals: [{ id: "saved-1" }],
      chatMessages: [{ id: "chat-1" }],
    });
    mockPost.mockResolvedValue(undefined);
    mockResetUserRuntime.mockResolvedValue(undefined);
    mockEmailCredential.mockReturnValue({ providerId: "password" });
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
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
      language: "en",
      plan: "free",
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

  it("delegates profile writes to repository helpers", async () => {
    const profile: UserData = {
      uid: "u1",
      email: "u1@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1,
      lastLogin: "2026-03-03T12:00:00.000Z",
      readiness: {
        status: "needs_profile",
        onboardingCompletedAt: null,
        readyAt: null,
      },
      syncState: "pending",
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
      aiPersona: "calm_guide",
      calorieTarget: 0,
      lastSyncedAt: "",
      avatarUrl: "",
      avatarLocalPath: "",
      avatarlastSyncedAt: "",
      language: "en",
    };

    await upsertUserLocal(profile);
    await updateUserLanguageInFirestore("pl");

    expect(mockMergeUserProfileRemote).toHaveBeenNthCalledWith(1, profile);
    expect(mockMergeUserProfileRemote).toHaveBeenNthCalledWith(2, {
      language: "pl",
    });
  });

  it("uploads avatar via repository and persists synced metadata", async () => {
    const result = await uploadAndSaveAvatar({
      localUri: "file:///avatar.jpg",
    });

    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith("file:///avatar.jpg");
    expect(result).toEqual({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file:///avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
    });
  });

  it("fetches export payload from backend", async () => {
    await expect(exportUserData()).resolves.toEqual({
      profile: { uid: "u1", username: "neo" },
      meals: [{ id: "meal-1" }],
      myMeals: [{ id: "saved-1" }],
      chatMessages: [{ id: "chat-1" }],
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

    expect(mockInitializeUserOnboardingRemote).toHaveBeenCalledWith({
      username: "neo",
      language: "pl",
    });
    expect(mockMergeUserProfileRemote).not.toHaveBeenCalled();
  });
});
