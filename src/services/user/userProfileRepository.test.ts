import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { UserAiConsent } from "@/types";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpload = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockResolveE2EAiConsentGrant = jest.fn<
  (
    uid: string,
    currentAiConsent: UserAiConsent | null | undefined,
  ) => { aiConsent: UserAiConsent } | { error: Error } | null
>();
const mockResolveE2EAiConsentRevoke = jest.fn<
  (
    uid: string,
    currentAiConsent: UserAiConsent | null | undefined,
  ) => { aiConsent: UserAiConsent } | { error: Error } | null
>();

let mockE2EEnabled = false;

const profile = {
  language: "pl",
  nutritionProfile: {
    unitsSystem: "metric",
    age: "30",
    sex: "female",
    height: "170",
    heightInch: "",
    weight: "70",
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
  aiPreferences: {
    stylePersona: "calm_guide",
  },
  aiConsent: {
    status: "not_granted",
    grantedAt: null,
    revokedAt: null,
  },
  readiness: {
    status: "needs_ai_consent",
    onboardingCompletedAt: "2026-05-05T10:00:00Z",
    readyAt: null,
  },
};

const editableProfilePatch = {
  language: profile.language,
  nutritionProfile: profile.nutritionProfile,
  aiPreferences: profile.aiPreferences,
};
const profileMutationOptions = { clientMutationId: "profile-mutation-1" };

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  upload: (...args: unknown[]) => mockUpload(...args),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("@/services/e2e/fixtures", () => ({
  resolveE2EAiConsentGrant: (
    uid: string,
    currentAiConsent: UserAiConsent | null | undefined,
  ) => mockResolveE2EAiConsentGrant(uid, currentAiConsent),
  resolveE2EAiConsentRevoke: (
    uid: string,
    currentAiConsent: UserAiConsent | null | undefined,
  ) => mockResolveE2EAiConsentRevoke(uid, currentAiConsent),
}));

describe("services/user/userProfileRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockE2EEnabled = false;
    mockResolveE2EAiConsentGrant.mockReturnValue(null);
    mockResolveE2EAiConsentRevoke.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns null when backend returns no profile", async () => {
    mockGet.mockResolvedValue({ profile: null });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchUserProfileRemote } = require("@/services/user/userProfileRepository");

    await expect(fetchUserProfileRemote()).resolves.toBeNull();
  });

  it("returns cached profile immediately without fetching in subscription", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo" });

    const received: unknown[] = [];
    repo.subscribeToUserProfile({ uid: "u1", onData: (d: unknown) => received.push(d) });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ uid: "u1", username: "neo" });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("calls onData(null) when cache holds null for the uid", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u-null", null);

    const received: unknown[] = [];
    repo.subscribeToUserProfile({ uid: "u-null", onData: (d: unknown) => received.push(d) });

    expect(received).toEqual([null]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not fetch from subscribeToUserProfile when cache is empty", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    const received: unknown[] = [];
    repo.subscribeToUserProfile({ uid: "u-missing", onData: (d: unknown) => received.push(d) });

    expect(received).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("fetches current user profile from backend-owned endpoint", async () => {
    mockGet.mockResolvedValue({
      profile: { uid: "u1", username: "neo", profile },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchUserProfileRemote } = require("@/services/user/userProfileRepository");

    await expect(fetchUserProfileRemote()).resolves.toEqual({
      uid: "u1",
      username: "neo",
      profile,
    });
    expect(mockGet).toHaveBeenCalledWith("/users/me/profile");
  });

  it("dedupes concurrent profile fetches for the same session key", async () => {
    let resolveProfile!: (value: unknown) => void;
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchUserProfileRemote } = require("@/services/user/userProfileRepository");

    const first = fetchUserProfileRemote("u1");
    const second = fetchUserProfileRemote("u1");

    expect(mockGet).toHaveBeenCalledTimes(1);
    resolveProfile({
      profile: { uid: "u1", username: "neo" },
    });

    await expect(first).resolves.toEqual({ uid: "u1", username: "neo" });
    await expect(second).resolves.toEqual({ uid: "u1", username: "neo" });
  });

  it("does not share in-flight profile response across different session keys", async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    mockGet
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchUserProfileRemote } = require("@/services/user/userProfileRepository");

    const userA = fetchUserProfileRemote("user-a");
    const userB = fetchUserProfileRemote("user-b");

    expect(mockGet).toHaveBeenCalledTimes(2);

    resolveSecond({
      profile: { uid: "user-b", username: "trinity" },
    });
    resolveFirst({
      profile: { uid: "user-a", username: "neo" },
    });

    await expect(userB).resolves.toEqual({
      uid: "user-b",
      username: "trinity",
    });
    await expect(userA).resolves.toEqual({ uid: "user-a", username: "neo" });
  });

  it("clears in-memory profile cache for a uid", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo" });
    repo.emitUserProfileChanged("u2", { uid: "u2", username: "trinity" });

    repo.clearCachedUserProfile("u1");

    const receivedU1: unknown[] = [];
    const receivedU2: unknown[] = [];
    repo.subscribeToUserProfile({
      uid: "u1",
      onData: (d: unknown) => receivedU1.push(d),
    });
    repo.subscribeToUserProfile({
      uid: "u2",
      onData: (d: unknown) => receivedU2.push(d),
    });

    expect(receivedU1).toEqual([]);
    expect(receivedU2).toEqual([{ uid: "u2", username: "trinity" }]);
  });

  it("exposes cached profile values for direct readers", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    expect(repo.getCachedUserProfile("u1")).toBeUndefined();
    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo" });
    expect(repo.getCachedUserProfile("u1")).toEqual({ uid: "u1", username: "neo" });
    repo.clearCachedUserProfile("u1");
    expect(repo.getCachedUserProfile("u1")).toBeUndefined();
  });

  it("posts full cached profile payloads without backend-owned nested fields", async () => {
    mockPost.mockResolvedValue({ updated: true });
    mockGet.mockResolvedValue({
      profile: { uid: "u1", profile },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await mergeUserProfileRemote(
      {
        username: "neo",
        profile: { ...profile, language: "pl" },
        avatarLocalPath: "file:///avatar.jpg",
      },
      profileMutationOptions,
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: editableProfilePatch,
      clientMutationId: "profile-mutation-1",
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips backend patch when nested profile payload has only backend-owned fields", async () => {
    mockPost.mockResolvedValue({ updated: true });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await mergeUserProfileRemote(
      {
        profile: {
          aiConsent: profile.aiConsent,
          readiness: profile.readiness,
        },
      },
      profileMutationOptions,
    );

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("posts mixed payload with canonical language field", async () => {
    mockPost.mockResolvedValue({ updated: true });
    mockGet.mockResolvedValue({
      profile: { uid: "u1", profile },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await mergeUserProfileRemote(
      {
        profile: {
          ...profile,
          nutritionProfile: {
            ...profile.nutritionProfile,
            age: "31",
          },
        },
      },
      profileMutationOptions,
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: {
        ...editableProfilePatch,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
      clientMutationId: "profile-mutation-1",
    });
  });

  it("rejects profile writes without a caller-owned mutation id", async () => {
    mockPost.mockResolvedValue({ updated: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await expect(
      mergeUserProfileRemote({
        profile: {
          language: "pl",
        },
      }),
    ).rejects.toThrow("profile/client-mutation-id-required");

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps updateUserProfileRemote on the sanitized profile patch path", async () => {
    mockPost.mockResolvedValue({ updated: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateUserProfileRemote } = require("@/services/user/userProfileRepository");

    await updateUserProfileRemote(
      {
        profile: {
          ...profile,
          nutritionProfile: {
            ...profile.nutritionProfile,
            age: "31",
          },
        },
        updatedAt: "local-only",
      },
      profileMutationOptions,
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: {
        ...editableProfilePatch,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
      clientMutationId: "profile-mutation-1",
    });
  });

  it("grants AI consent through the canonical backend endpoint and patches cached consent", async () => {
    const aiConsent = {
      status: "granted",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: null,
    };
    mockPost.mockResolvedValue({
      aiConsent,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo", profile });
    await expect(repo.grantAiConsentRemote("u1")).resolves.toEqual({
      aiConsent,
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/ai-consent/grant");
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: {
        aiConsent,
        readiness: profile.readiness,
      },
    });
  });

  it("applies E2E AI consent seed to an existing uid-scoped cached profile only", async () => {
    mockE2EEnabled = true;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { emit } = require("@/services/core/events");
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: "2026-05-02T10:00:00.000Z",
    };

    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo", profile });
    repo.emitUserProfileChanged("u2", { uid: "u2", username: "trinity", profile });

    emit("e2e:aiConsentSeeded", {
      uid: "u1",
      aiConsent: revokedAiConsent,
    });

    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      uid: "u1",
      profile: {
        aiConsent: revokedAiConsent,
        readiness: profile.readiness,
      },
    });
    expect(repo.getCachedUserProfile("u2")).toMatchObject({
      uid: "u2",
      profile: { aiConsent: profile.aiConsent },
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not create a hidden profile when E2E AI consent seed has no cached profile", async () => {
    mockE2EEnabled = true;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { emit } = require("@/services/core/events");

    emit("e2e:aiConsentSeeded", {
      uid: "missing-user",
      aiConsent: {
        status: "granted",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: null,
      },
    });

    expect(repo.getCachedUserProfile("missing-user")).toBeUndefined();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("uses E2E AI consent grant success without calling the backend endpoint", async () => {
    mockE2EEnabled = true;
    const grantedAiConsent: UserAiConsent = {
      status: "granted",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: null,
    };
    mockResolveE2EAiConsentGrant.mockReturnValue({
      aiConsent: grantedAiConsent,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u1", { uid: "u1", username: "neo", profile });
    await expect(repo.grantAiConsentRemote("u1")).resolves.toEqual({
      aiConsent: grantedAiConsent,
    });

    expect(mockResolveE2EAiConsentGrant).toHaveBeenCalledWith(
      "u1",
      profile.aiConsent,
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: { aiConsent: grantedAiConsent },
    });
  });

  it("publishes revoke local-inactive consent through the shared profile cache without backend calls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeProfile = {
      uid: "u1",
      email: "neo@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1710000000000,
      lastLogin: "2026-05-01T10:00:00Z",
      syncState: "synced",
      avatarUrl: "https://cdn/avatar.jpg",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    };
    const received: unknown[] = [];

    repo.emitUserProfileChanged("u1", activeProfile);
    repo.subscribeToUserProfile({
      uid: "u1",
      onData: (data: unknown) => received.push(data),
    });

    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");

    expect(localInactiveAiConsent).toEqual({
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: expect.any(String),
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual({
      ...activeProfile,
      profile: {
        ...activeProfile.profile,
        aiConsent: localInactiveAiConsent,
      },
    });
    expect(repo.getCachedUserProfile("u1")).toEqual(received[1]);
  });

  it("overlays local revoke guard over a later active-granted profile fetch while preserving backend fields", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeProfile = {
      uid: "u1",
      email: "neo@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1710000000000,
      lastLogin: "2026-05-01T10:00:00Z",
      syncState: "synced",
      avatarUrl: "https://cdn/avatar-old.jpg",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    };
    const backendProfile = {
      ...activeProfile,
      username: "trinity",
      plan: "premium",
      avatarUrl: "https://cdn/avatar-new.jpg",
      profile: {
        ...activeProfile.profile,
        language: "en",
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    };
    const received: unknown[] = [];

    repo.emitUserProfileChanged("u1", activeProfile);
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");
    repo.subscribeToUserProfile({
      uid: "u1",
      onData: (data: unknown) => received.push(data),
    });
    mockGet.mockResolvedValue({ profile: backendProfile });

    await expect(repo.fetchUserProfileRemote("u1")).resolves.toEqual({
      ...backendProfile,
      profile: {
        ...backendProfile.profile,
        aiConsent: localInactiveAiConsent,
      },
    });

    expect(mockGet).toHaveBeenCalledWith("/users/me/profile");
    expect(mockPost).not.toHaveBeenCalledWith(
      "/users/me/profile",
      expect.anything(),
    );
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual({
      ...backendProfile,
      profile: {
        ...backendProfile.profile,
        aiConsent: localInactiveAiConsent,
      },
    });
    expect(repo.getCachedUserProfile("u1")).toEqual(received[1]);
  });

  it("clears local revoke guard on backend-inactive profile evidence and allows grant afterward", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const inactiveBackendEvidence = [
      {
        uid: "u-not-granted",
        aiConsent: {
          status: "not_granted",
          grantedAt: null,
          revokedAt: null,
        },
      },
      {
        uid: "u-revoked",
        aiConsent: {
          status: "revoked",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: "2026-05-02T10:00:00Z",
        },
      },
      {
        uid: "u-inactive-granted",
        aiConsent: {
          status: "granted",
          grantedAt: null,
          revokedAt: null,
        },
      },
    ];

    for (const { uid, aiConsent } of inactiveBackendEvidence) {
      const activeProfile = {
        uid,
        email: `${uid}@example.com`,
        username: "neo",
        plan: "free",
        createdAt: 1710000000000,
        lastLogin: "2026-05-01T10:00:00Z",
        syncState: "synced",
        profile: {
          ...profile,
          aiConsent: {
            status: "granted",
            grantedAt: "2026-05-01T10:00:00Z",
            revokedAt: null,
          },
        },
      };
      const backendProfile = {
        ...activeProfile,
        username: `backend-${uid}`,
        profile: {
          ...activeProfile.profile,
          aiConsent,
        },
      };
      const grantedAiConsent = {
        status: "granted",
        grantedAt: "2026-05-03T10:00:00Z",
        revokedAt: null,
      };
      const received: unknown[] = [];

      repo.emitUserProfileChanged(uid, activeProfile);
      repo.publishAiConsentRevokeLocalInactive(uid);
      repo.subscribeToUserProfile({
        uid,
        onData: (data: unknown) => received.push(data),
      });

      mockGet.mockResolvedValueOnce({ profile: backendProfile });
      await expect(repo.fetchUserProfileRemote(uid)).resolves.toEqual(
        backendProfile,
      );
      expect(repo.getAiConsentLocalRevokeGuard(uid)).toBeNull();
      expect(received[received.length - 1]).toEqual(backendProfile);

      mockPost.mockResolvedValueOnce({ aiConsent: grantedAiConsent });
      await expect(repo.grantAiConsentRemote(uid)).resolves.toEqual({
        aiConsent: grantedAiConsent,
      });
      expect(mockPost).toHaveBeenLastCalledWith("/users/me/ai-consent/grant");
    }
  });

  it("keeps shared cached consent inactive when backend revoke fails after the local patch", async () => {
    mockPost.mockRejectedValue(new Error("revoke failed"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeProfile = {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    };

    repo.emitUserProfileChanged("u1", activeProfile);
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");
    await expect(repo.revokeAiConsentRemote("u1")).rejects.toThrow(
      "revoke failed",
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/ai-consent/revoke");
    expect(mockPost).not.toHaveBeenCalledWith(
      "/users/me/profile",
      expect.anything(),
    );
    expect(repo.getCachedUserProfile("u1")).toEqual({
      ...activeProfile,
      profile: {
        ...activeProfile.profile,
        aiConsent: localInactiveAiConsent,
      },
    });
  });

  it("keeps revoke guard through failed revoke and clears it after successful backend revoke", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeAiConsent = {
      status: "granted",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: null,
    };
    const activeProfile = {
      uid: "u1",
      email: "neo@example.com",
      username: "neo",
      plan: "free",
      createdAt: 1710000000000,
      lastLogin: "2026-05-01T10:00:00Z",
      syncState: "synced",
      profile: {
        ...profile,
        aiConsent: activeAiConsent,
      },
    };
    const refreshedActiveProfile = {
      ...activeProfile,
      username: "fresh-from-backend",
      profile: {
        ...activeProfile.profile,
        language: "en",
      },
    };
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: "2026-05-02T10:00:00Z",
    };

    repo.emitUserProfileChanged("u1", activeProfile);
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");
    mockPost.mockRejectedValueOnce(new Error("revoke failed"));
    await expect(repo.revokeAiConsentRemote("u1")).rejects.toThrow(
      "revoke failed",
    );

    mockGet.mockResolvedValueOnce({ profile: refreshedActiveProfile });
    await expect(repo.fetchUserProfileRemote("u1")).resolves.toEqual({
      ...refreshedActiveProfile,
      profile: {
        ...refreshedActiveProfile.profile,
        aiConsent: localInactiveAiConsent,
      },
    });

    mockPost.mockResolvedValueOnce({ aiConsent: revokedAiConsent });
    await expect(repo.revokeAiConsentRemote("u1")).resolves.toEqual({
      aiConsent: revokedAiConsent,
    });
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: { aiConsent: revokedAiConsent },
    });

    mockGet.mockResolvedValueOnce({
      profile: {
        ...refreshedActiveProfile,
        username: "after-success",
      },
    });
    await expect(repo.fetchUserProfileRemote("u1")).resolves.toEqual({
      ...refreshedActiveProfile,
      username: "after-success",
    });
    expect(mockPost).not.toHaveBeenCalledWith(
      "/users/me/profile",
      expect.anything(),
    );
  });

  it("keeps the local revoke guard through E2E failureOnce and clears it after retry success", async () => {
    mockE2EEnabled = true;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeAiConsent = {
      status: "granted",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: null,
    };
    const activeProfile = {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        aiConsent: activeAiConsent,
      },
    };
    const e2eRevokedAiConsent: UserAiConsent = {
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: "2026-05-02T10:00:00.000Z",
    };

    repo.emitUserProfileChanged("u1", activeProfile);
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");
    mockResolveE2EAiConsentRevoke
      .mockReturnValueOnce({ error: new Error("e2e revoke failed once") })
      .mockReturnValueOnce({ aiConsent: e2eRevokedAiConsent });

    await expect(repo.revokeAiConsentRemote("u1")).rejects.toThrow(
      "e2e revoke failed once",
    );
    expect(repo.getAiConsentLocalRevokeGuard("u1")).toEqual(
      localInactiveAiConsent,
    );
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: { aiConsent: localInactiveAiConsent },
    });

    await expect(repo.revokeAiConsentRemote("u1")).resolves.toEqual({
      aiConsent: e2eRevokedAiConsent,
    });

    expect(mockResolveE2EAiConsentRevoke).toHaveBeenNthCalledWith(
      1,
      "u1",
      localInactiveAiConsent,
    );
    expect(mockResolveE2EAiConsentRevoke).toHaveBeenNthCalledWith(
      2,
      "u1",
      localInactiveAiConsent,
    );
    expect(repo.getAiConsentLocalRevokeGuard("u1")).toBeNull();
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: { aiConsent: e2eRevokedAiConsent },
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("exposes the uid-scoped local revoke guard without backend calls or new state", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    const activeProfile = {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    };

    expect(repo.getAiConsentLocalRevokeGuard("u1")).toBeNull();
    expect(repo.getAiConsentLocalRevokeGuard("u2")).toBeNull();

    repo.emitUserProfileChanged("u1", activeProfile);
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");
    const expectedGuard = { ...localInactiveAiConsent };
    const exposedGuard = repo.getAiConsentLocalRevokeGuard("u1");

    expect(exposedGuard).toEqual(expectedGuard);
    if (exposedGuard) {
      exposedGuard.status = "granted";
      exposedGuard.revokedAt = null;
    }
    expect(localInactiveAiConsent).toEqual(expectedGuard);
    expect(repo.getAiConsentLocalRevokeGuard("u1")).toEqual(expectedGuard);
    expect(repo.getAiConsentLocalRevokeGuard("u2")).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not publish or post grant while a local revoke guard is active", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");
    repo.emitUserProfileChanged("u1", {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    });
    const localInactiveAiConsent =
      repo.publishAiConsentRevokeLocalInactive("u1");

    await expect(repo.grantAiConsentRemote("u1")).rejects.toThrow(
      "ai-consent/revoke-pending",
    );

    expect(mockPost).not.toHaveBeenCalled();
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: { aiConsent: localInactiveAiConsent },
    });
  });

  it("revokes AI consent through the canonical backend endpoint and preserves cached profile fields", async () => {
    const revokedAiConsent = {
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00Z",
      revokedAt: "2026-05-02T10:00:00Z",
    };
    mockPost.mockResolvedValue({
      aiConsent: revokedAiConsent,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    repo.emitUserProfileChanged("u1", {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        aiConsent: {
          status: "granted",
          grantedAt: "2026-05-01T10:00:00Z",
          revokedAt: null,
        },
      },
    });
    await expect(repo.revokeAiConsentRemote("u1")).resolves.toEqual({
      aiConsent: revokedAiConsent,
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/ai-consent/revoke");
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      username: "neo",
      profile: {
        aiConsent: revokedAiConsent,
        readiness: profile.readiness,
      },
    });
  });

  it("uploads avatar through backend-owned endpoint", async () => {
    mockUpload.mockResolvedValue({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
      avatarRef: { storagePath: "avatars/u1/avatar.abc123" },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadUserAvatarRemote } = require("@/services/user/userProfileRepository");
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    await expect(
      uploadUserAvatarRemote("file:///avatar.jpg", {
        clientMutationId: " avatar-mutation-1 ",
      }),
    ).resolves.toEqual({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
      avatarRef: { storagePath: "avatars/u1/avatar.abc123" },
    });
    expect(mockUpload).toHaveBeenCalledWith("/users/me/avatar", expect.any(FormData));
    expect(appendSpy).toHaveBeenCalledWith(
      "clientMutationId",
      "avatar-mutation-1",
    );
    appendSpy.mockRestore();
  });

  it("requires explicit client mutation identity for avatar uploads", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadUserAvatarRemote } = require("@/services/user/userProfileRepository");

    await expect(
      uploadUserAvatarRemote("file:///avatar.jpg", { clientMutationId: "   " }),
    ).rejects.toThrow("profile/client-mutation-id-required");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("initializes onboarding through the backend-owned endpoint", async () => {
    const initializedProfile = { uid: "u1", username: "neo" };
    mockPost.mockResolvedValue({
      username: "neo",
      profile: initializedProfile,
      updated: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    await expect(
      repo.initializeUserOnboardingRemote({ username: "neo", language: "pl" }),
    ).resolves.toEqual({
      username: "neo",
      profile: initializedProfile,
      updated: true,
    });
    expect(mockPost).toHaveBeenCalledWith("/users/me/onboarding", {
      username: "neo",
      language: "pl",
    });
    expect(repo.getCachedUserProfile("u1")).toEqual(initializedProfile);
  });

  it("completes onboarding through server-first endpoint and caches response profile", async () => {
    const completedProfile = {
      uid: "u1",
      username: "neo",
      profile: {
        ...profile,
        readiness: {
          status: "needs_ai_consent",
          onboardingCompletedAt: "2026-05-05T10:00:00Z",
          readyAt: null,
        },
      },
    };
    const payload = {
      unitsSystem: "metric",
      age: "30",
      sex: "female",
      height: "170",
      heightInch: "",
      weight: "70",
      preferences: ["balanced"],
      activityLevel: "moderate",
      goal: "maintain",
      calorieAdjustment: null,
      chronicDiseases: [],
      chronicDiseasesOther: "",
      allergies: [],
      allergiesOther: "",
      lifestyle: "",
      aiPersona: "calm_guide",
    };
    mockPost.mockResolvedValue({
      profile: completedProfile,
      updated: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    await expect(repo.completeUserOnboardingRemote(payload)).resolves.toEqual({
      profile: completedProfile,
      updated: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/onboarding/complete",
      payload,
    );
    expect(repo.getCachedUserProfile("u1")).toEqual(completedProfile);
  });
});
