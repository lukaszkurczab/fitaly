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
      avatarRef: { storagePath: "avatars/user-1/avatar.abc123" },
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
    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith(
      "file://avatar.jpg",
      { clientMutationId: "avatar-mutation-1" },
    );
    expect(mockEmit).toHaveBeenCalledWith("user:avatar:synced", {
      uid: "user-1",
      avatarUrl: "https://cdn/avatar.jpg",
      avatarLocalPath: "file://avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:11:00.000Z",
      avatarRef: { storagePath: "avatars/user-1/avatar.abc123" },
      updatedAt: "2026-03-03T12:10:00.000Z",
    });
  });

  it("propagates avatar upload failure without emitting synced state", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");
    const uploadError = new Error("upload rejected");
    mockUploadUserAvatarRemote.mockRejectedValueOnce(uploadError);

    await expect(
      userProfileStrategy.handlePushOp("user-1", {
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
      }),
    ).rejects.toBe(uploadError);

    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith(
      "file://avatar.jpg",
      { clientMutationId: "avatar-mutation-1" },
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "user:avatar:synced",
      expect.anything(),
    );
  });

  it("emits avatar sync metadata only after a successful retry of the same queued upload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");
    const uploadError = new Error("first upload rejected");
    const queuedAvatarOp = {
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
    };
    mockUploadUserAvatarRemote
      .mockRejectedValueOnce(uploadError)
      .mockResolvedValueOnce({
        avatarUrl: "https://cdn/retry-avatar.jpg",
        avatarlastSyncedAt: "2026-03-03T12:15:00.000Z",
        avatarRef: { storagePath: "avatars/user-1/avatar.retry123" },
      });

    await expect(
      userProfileStrategy.handlePushOp("user-1", queuedAvatarOp),
    ).rejects.toBe(uploadError);

    expect(mockUploadUserAvatarRemote).toHaveBeenCalledWith(
      "file://avatar.jpg",
      { clientMutationId: "avatar-mutation-1" },
    );
    expect(mockEmit).not.toHaveBeenCalledWith(
      "user:avatar:synced",
      expect.anything(),
    );

    const handled = await userProfileStrategy.handlePushOp(
      "user-1",
      queuedAvatarOp,
    );

    expect(handled).toBe(true);
    expect(mockUploadUserAvatarRemote).toHaveBeenCalledTimes(2);
    expect(mockUploadUserAvatarRemote).toHaveBeenLastCalledWith(
      "file://avatar.jpg",
      { clientMutationId: "avatar-mutation-1" },
    );
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith("user:avatar:synced", {
      uid: "user-1",
      avatarUrl: "https://cdn/retry-avatar.jpg",
      avatarLocalPath: "file://avatar.jpg",
      avatarlastSyncedAt: "2026-03-03T12:15:00.000Z",
      avatarRef: { storagePath: "avatars/user-1/avatar.retry123" },
      updatedAt: "2026-03-03T12:10:00.000Z",
    });
  });

  it("has no pull behavior", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { userProfileStrategy } = require("@/services/offline/strategies/userProfile.strategy");
    await expect(userProfileStrategy.pull("user-1")).resolves.toBe(0);
  });
});
