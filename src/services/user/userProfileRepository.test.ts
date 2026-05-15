import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpload = jest.fn<(...args: unknown[]) => Promise<unknown>>();

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
  consents: {
    aiHealthDataConsentAt: null,
  },
  readiness: {
    status: "needs_ai_consent",
    onboardingCompletedAt: "2026-05-05T10:00:00Z",
    readyAt: null,
  },
};

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  upload: (...args: unknown[]) => mockUpload(...args),
}));

describe("services/user/userProfileRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
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

  it("skips backend patch when payload has only non-editable local fields", async () => {
    mockPost.mockResolvedValue({ updated: true });
    mockGet.mockResolvedValue({
      profile: { uid: "u1", profile },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await mergeUserProfileRemote({
      username: "neo",
      profile: { ...profile, language: "pl" },
      avatarLocalPath: "file:///avatar.jpg",
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: { ...profile, language: "pl" },
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("posts mixed payload with canonical language field", async () => {
    mockPost.mockResolvedValue({ updated: true });
    mockGet.mockResolvedValue({
      profile: { uid: "u1", profile },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mergeUserProfileRemote } = require("@/services/user/userProfileRepository");

    await mergeUserProfileRemote({
      profile: {
        ...profile,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: {
        ...profile,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
    });
  });

  it("keeps updateUserProfileRemote on the sanitized profile patch path", async () => {
    mockPost.mockResolvedValue({ updated: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateUserProfileRemote } = require("@/services/user/userProfileRepository");

    await updateUserProfileRemote({
      profile: {
        ...profile,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
      updatedAt: "local-only",
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/profile", {
      profile: {
        ...profile,
        nutritionProfile: {
          ...profile.nutritionProfile,
          age: "31",
        },
      },
    });
  });

  it("accepts AI health data consent through the canonical backend endpoint", async () => {
    const readiness = {
      status: "ready",
      onboardingCompletedAt: "2026-04-30T10:00:00Z",
      readyAt: "2026-05-01T10:00:00Z",
    };
    mockPost.mockResolvedValue({
      updated: true,
      profile: {
        uid: "u1",
        profile: {
          ...profile,
          consents: { aiHealthDataConsentAt: "2026-05-01T10:00:00Z" },
          readiness,
        },
      },
      consent: {
        aiHealthDataConsentAt: "2026-05-01T10:00:00Z",
        readiness,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const repo = require("@/services/user/userProfileRepository");

    await expect(repo.acceptAiHealthDataConsentRemote("u1")).resolves.toMatchObject({
      updated: true,
      consent: {
        aiHealthDataConsentAt: "2026-05-01T10:00:00Z",
        readiness,
      },
    });

    expect(mockPost).toHaveBeenCalledWith("/users/me/ai-health-data-consent", {
      accepted: true,
    });
    expect(repo.getCachedUserProfile("u1")).toMatchObject({
      profile: {
        readiness,
      },
    });
  });

  it("uploads avatar through backend-owned endpoint", async () => {
    mockUpload.mockResolvedValue({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadUserAvatarRemote } = require("@/services/user/userProfileRepository");

    await expect(
      uploadUserAvatarRemote("file:///avatar.jpg"),
    ).resolves.toEqual({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:00:00.000Z",
    });
    expect(mockUpload).toHaveBeenCalledWith("/users/me/avatar", expect.any(FormData));
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
