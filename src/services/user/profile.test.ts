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
const mockLogError = jest.fn<(...args: unknown[]) => void>();
const mockResetUserRuntime = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockEmailCredential = jest.fn<(...args: unknown[]) => unknown>();
const mockReauthenticateWithCredential = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockSignOut = jest.fn<(...args: unknown[]) => Promise<void>>();
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

jest.mock("@/services/core/errorLogger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
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
  signOut: (...args: unknown[]) => mockSignOut(...args),
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
      mealEffectOutbox: [
        {
          eventId: "meal-effect-1",
          kind: "meal_saved.streak_sync",
          status: "pending",
        },
      ],
      ingredientProducts: [
        { id: "ingredient-product-1", recordScope: "user_scoped" },
      ],
      smartMemoryItems: [{ id: "memory-item-1" }],
      smartMemoryCandidates: [{ id: "memory-candidate-1" }],
      smartMemorySettings: [{ id: "default", enabled: true }],
      smartMemoryTombstones: [{ id: "memory-tombstone-1" }],
      smartMemoryMutationDedupe: [{ id: "memory-mutation-1" }],
      knownPatternControls: [{ id: "known-pattern-control-1" }],
      knownPatternMutationDedupe: [{ id: "known-pattern-mutation-1" }],
      plannedMealItems: [{ id: "planned-meal-1" }],
      plannedMealMutationDedupe: [{ id: "planned-meal-mutation-1" }],
      billing: [{ id: "main", status: "active" }],
      aiCredits: [{ id: "current", billingId: "main", balance: 8 }],
      aiCreditTransactions: [{ id: "tx-1", billingId: "main", amount: -1 }],
      aiCreditIdempotency: [
        { id: "idem-1", billingId: "main", state: "deducted" },
      ],
      badges: [{ id: "streak_7", type: "streak" }],
      streak: [{ id: "main", current: 7 }],
      reminderDailyStats: [{ id: "2026-03-03", sendCount: 2 }],
      telemetryEvents: [{ eventId: "telemetry-1", name: "meal_logged" }],
      exportManifest: {
        schemaVersion: "user-export-manifest-v1",
        recordCounts: {
          profile: 1,
          meals: 1,
          myMeals: 1,
          chatMessages: 1,
          chatMemory: 1,
          aiRuns: 1,
          notifications: 1,
          notificationPrefs: 1,
          feedback: 1,
          mealMutationDedupe: 1,
          mealEffectOutbox: 1,
          ingredientProducts: 1,
          smartMemoryItems: 1,
          smartMemoryCandidates: 1,
          smartMemorySettings: 1,
          smartMemoryTombstones: 1,
          smartMemoryMutationDedupe: 1,
          knownPatternControls: 1,
          knownPatternMutationDedupe: 1,
          plannedMealItems: 1,
          plannedMealMutationDedupe: 1,
          billing: 1,
          aiCredits: 1,
          aiCreditTransactions: 1,
          aiCreditIdempotency: 1,
          badges: 1,
          streak: 1,
          reminderDailyStats: 1,
          telemetryEvents: 1,
        },
      },
    });
    mockPost.mockResolvedValue(undefined);
    mockResetUserRuntime.mockResolvedValue(undefined);
    mockEmailCredential.mockReturnValue({ providerId: "password" });
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
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
      mealEffectOutbox: [
        {
          eventId: "meal-effect-1",
          kind: "meal_saved.streak_sync",
          status: "pending",
        },
      ],
      ingredientProducts: [
        { id: "ingredient-product-1", recordScope: "user_scoped" },
      ],
      smartMemoryItems: [{ id: "memory-item-1" }],
      smartMemoryCandidates: [{ id: "memory-candidate-1" }],
      smartMemorySettings: [{ id: "default", enabled: true }],
      smartMemoryTombstones: [{ id: "memory-tombstone-1" }],
      smartMemoryMutationDedupe: [{ id: "memory-mutation-1" }],
      knownPatternControls: [{ id: "known-pattern-control-1" }],
      knownPatternMutationDedupe: [{ id: "known-pattern-mutation-1" }],
      plannedMealItems: [{ id: "planned-meal-1" }],
      plannedMealMutationDedupe: [{ id: "planned-meal-mutation-1" }],
      billing: [{ id: "main", status: "active" }],
      aiCredits: [{ id: "current", billingId: "main", balance: 8 }],
      aiCreditTransactions: [{ id: "tx-1", billingId: "main", amount: -1 }],
      aiCreditIdempotency: [
        { id: "idem-1", billingId: "main", state: "deducted" },
      ],
      badges: [{ id: "streak_7", type: "streak" }],
      streak: [{ id: "main", current: 7 }],
      reminderDailyStats: [{ id: "2026-03-03", sendCount: 2 }],
      telemetryEvents: [{ eventId: "telemetry-1", name: "meal_logged" }],
      exportManifest: {
        schemaVersion: "user-export-manifest-v1",
        recordCounts: {
          profile: 1,
          meals: 1,
          myMeals: 1,
          chatMessages: 1,
          chatMemory: 1,
          aiRuns: 1,
          notifications: 1,
          notificationPrefs: 1,
          feedback: 1,
          mealMutationDedupe: 1,
          mealEffectOutbox: 1,
          ingredientProducts: 1,
          smartMemoryItems: 1,
          smartMemoryCandidates: 1,
          smartMemorySettings: 1,
          smartMemoryTombstones: 1,
          smartMemoryMutationDedupe: 1,
          knownPatternControls: 1,
          knownPatternMutationDedupe: 1,
          plannedMealItems: 1,
          plannedMealMutationDedupe: 1,
          billing: 1,
          aiCredits: 1,
          aiCreditTransactions: 1,
          aiCreditIdempotency: 1,
          badges: 1,
          streak: 1,
          reminderDailyStats: 1,
          telemetryEvents: 1,
        },
      },
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
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
  });

  it("routes E2E-pattern emails through reauth and backend cascade before Auth delete", async () => {
    mockGetAuth.mockReturnValue({
      currentUser: {
        email: "fitaly-e2e-delete-1780522597-24090@example.com",
        delete: mockCurrentUserDelete,
      },
    });

    await deleteAccountService({
      uid: "u1",
      password: "Strong1!",
    });

    expect(mockEmailCredential).toHaveBeenCalledWith(
      "fitaly-e2e-delete-1780522597-24090@example.com",
      "Strong1!",
    );
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fitaly-e2e-delete-1780522597-24090@example.com",
      }),
      { providerId: "password" },
    );
    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockCurrentUserDelete).toHaveBeenCalledWith();
    expect(
      mockReauthenticateWithCredential.mock.invocationCallOrder[0],
    ).toBeLessThan(mockPost.mock.invocationCallOrder[0]);
    expect(mockPost.mock.invocationCallOrder[0]).toBeLessThan(
      mockCurrentUserDelete.mock.invocationCallOrder[0],
    );
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
  });

  it("clears local runtime and signs out when Firebase Auth delete fails after backend cascade", async () => {
    const deleteError = new Error("auth-delete-failed");
    mockCurrentUserDelete.mockRejectedValueOnce(deleteError);

    await expect(
      deleteAccountService({
        uid: "u1",
        password: "Strong1!",
      }),
    ).rejects.toBe(deleteError);

    expect(mockReauthenticateWithCredential).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockCurrentUserDelete).toHaveBeenCalledWith();
    expect(mockSignOut).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUser: expect.objectContaining({ email: "u1@example.com" }),
      }),
    );
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("preserves Auth delete failure when cleanup signOut also fails", async () => {
    const deleteError = new Error("auth-delete-failed");
    const signOutError = new Error("signout-failed");
    mockCurrentUserDelete.mockRejectedValueOnce(deleteError);
    mockSignOut.mockRejectedValueOnce(signOutError);

    await expect(
      deleteAccountService({
        uid: "u1",
        password: "Strong1!",
      }),
    ).rejects.toBe(deleteError);

    expect(mockSignOut).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUser: expect.objectContaining({ email: "u1@example.com" }),
      }),
    );
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
    expect(mockLogError).toHaveBeenCalledWith(
      "deleteAccount: failed signOut after Firebase Auth delete failure",
      { uid: "u1" },
      signOutError,
    );
  });

  it("preserves Auth delete failure when runtime reset also fails and logs reset failure", async () => {
    const deleteError = new Error("auth-delete-failed");
    const resetError = new Error("reset-failed");
    mockCurrentUserDelete.mockRejectedValueOnce(deleteError);
    mockResetUserRuntime.mockRejectedValueOnce(resetError);

    await expect(
      deleteAccountService({
        uid: "u1",
        password: "Strong1!",
      }),
    ).rejects.toBe(deleteError);

    expect(mockSignOut).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUser: expect.objectContaining({ email: "u1@example.com" }),
      }),
    );
    expect(mockResetUserRuntime).toHaveBeenCalledWith("u1", {
      reason: "delete_account",
    });
    expect(mockLogError).toHaveBeenCalledWith(
      "deleteAccount: failed runtime reset after account delete",
      { uid: "u1", preservingPrimaryError: true },
      resetError,
    );
  });

  it("surfaces runtime reset failure after successful backend and Auth delete", async () => {
    const resetError = new Error("reset-failed");
    mockResetUserRuntime.mockRejectedValueOnce(resetError);

    await expect(
      deleteAccountService({
        uid: "u1",
        password: "Strong1!",
      }),
    ).rejects.toBe(resetError);

    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockCurrentUserDelete).toHaveBeenCalledWith();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      "deleteAccount: failed runtime reset after account delete",
      { uid: "u1", preservingPrimaryError: false },
      resetError,
    );
  });

  it("does not delete Auth user or reset runtime when backend cascade fails", async () => {
    const backendError = new Error("backend-delete-failed");
    mockPost.mockRejectedValueOnce(backendError);

    await expect(
      deleteAccountService({
        uid: "u1",
        password: "Strong1!",
      }),
    ).rejects.toBe(backendError);

    expect(mockReauthenticateWithCredential).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith("/users/me/delete");
    expect(mockCurrentUserDelete).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockResetUserRuntime).not.toHaveBeenCalled();
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
