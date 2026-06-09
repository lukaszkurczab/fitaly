import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockUpdateUserProfileRemote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUploadUserAvatarRemote = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEmit = jest.fn();

jest.mock("@/services/user/userProfileRepository", () => ({
  updateUserProfileRemote: (...args: unknown[]) => mockUpdateUserProfileRemote(...args),
  uploadUserAvatarRemote: (...args: unknown[]) => mockUploadUserAvatarRemote(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

describe("user profile strategy", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUpdateUserProfileRemote.mockResolvedValue();
    mockUploadUserAvatarRemote.mockResolvedValue({
      avatarUrl: "https://cdn/avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:11:00.000Z",
    });
  });

  it("handles queued profile updates", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");

    const handled = await userProfileStrategy.handlePushOp("user-1", {
      id: 40,
      client_mutation_id: "profile-mutation-1",
      cloud_id: "user_profile",
      user_uid: "user-1",
      kind: "update_user_profile",
      payload: {
        age: "31",
        calorieTarget: 2300,
      },
      updated_at: "2026-03-03T12:50:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockUpdateUserProfileRemote).toHaveBeenCalledWith(
      {
        age: "31",
        calorieTarget: 2300,
      },
      { clientMutationId: "profile-mutation-1" },
    );
  });

  it("handles queued avatar uploads", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");

    const handled = await userProfileStrategy.handlePushOp("user-1", {
      id: 4,
      client_mutation_id: "avatar-mutation-1",
      cloud_id: "profile_avatar",
      user_uid: "user-1",
      kind: "upload_user_avatar",
      payload: {
        localPath: "file://avatar.jpg",
        updatedAt: "2026-03-03T12:10:00.000Z",
      },
      updated_at: "2026-03-03T12:10:00.000Z",
      attempts: 0,
    });

    expect(handled).toBe(true);
    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith("file://avatar.jpg");
  });

  it("has no pull behavior", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");
    await expect(userProfileStrategy.pull("user-1")).resolves.toBe(0);
  });
});
