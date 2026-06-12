import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockDeleteAsync = jest.fn<
  (path: string, options?: { idempotent?: boolean }) => Promise<void>
>();
const mockExecSync = jest.fn<(sql: string) => void>();
const mockRunSync = jest.fn<(...args: unknown[]) => void>();
const mockGetFirstSync = jest.fn<(...args: unknown[]) => unknown>();

jest.mock("@/services/core/fileSystem", () => ({
  deleteAsync: (...args: [string, { idempotent?: boolean }?]) =>
    mockDeleteAsync(...args),
}));

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    execSync: mockExecSync,
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
  }),
}));

const uploadedImageRow = {
  image_id: "local-image-1",
  user_uid: "user-1",
  local_path: "file:///local-meal-photo.jpg",
  cloud_url: "https://cdn.example/meal-photo.jpg",
  status: "uploaded",
  updated_at: "2026-06-09T09:00:00.000Z",
};

const eligibleMealRow = {
  cloud_id: "meal-1",
  image_local: "file:///local-meal-photo.jpg",
  image_id: "remote-image-1",
  photo_url: null,
};

function loadCleanupConfirmedLoggedMealPhoto(): (params: {
  uid: string;
  cloudId: string;
  confirmedImageId: string;
  confirmedPhotoUrl?: string | null;
}) => Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/services/offline/images.repo").cleanupConfirmedLoggedMealPhoto;
}

describe("cleanupConfirmedLoggedMealPhoto", () => {
  beforeEach(() => {
    mockDeleteAsync.mockReset();
    mockExecSync.mockReset();
    mockRunSync.mockReset();
    mockGetFirstSync.mockReset();
    mockDeleteAsync.mockResolvedValue(undefined);
    mockGetFirstSync
      .mockReturnValueOnce(eligibleMealRow)
      .mockReturnValueOnce(uploadedImageRow);
  });

  it("clears local DB references before deleting an eligible uploaded file path", async () => {
    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: true,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
    });
    expect(mockGetFirstSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM meals"),
      ["user-1", "meal-1"],
    );
    expect(mockGetFirstSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM images"),
      ["user-1", "file:///local-meal-photo.jpg"],
    );
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      "file:///local-meal-photo.jpg",
      { idempotent: true },
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockRunSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET image_local=NULL"),
      ["user-1", "meal-1", "file:///local-meal-photo.jpg", "remote-image-1"],
    );
    expect(mockRunSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DELETE FROM images"),
      ["user-1", "file:///local-meal-photo.jpg", "local-image-1"],
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(mockRunSync.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteAsync.mock.invocationCallOrder[0],
    );
    expect(mockRunSync.mock.invocationCallOrder[1]).toBeLessThan(
      mockDeleteAsync.mock.invocationCallOrder[0],
    );
  });

  it("does not delete the file when clearing DB references fails", async () => {
    mockRunSync.mockImplementationOnce(() => {
      throw new Error("sqlite locked");
    });

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "db-clear-failed",
      message: "sqlite locked",
    });
    expect(mockExecSync).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockExecSync).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it("retains pending or non-uploaded image rows", async () => {
    mockGetFirstSync
      .mockReset()
      .mockReturnValueOnce(eligibleMealRow)
      .mockReturnValueOnce({ ...uploadedImageRow, status: "pending" });

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "image-row-not-uploaded",
    });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it("retains file paths until local meal metadata matches the confirmed image id", async () => {
    mockGetFirstSync
      .mockReset()
      .mockReturnValueOnce({
        ...eligibleMealRow,
        image_id: "different-remote-image",
        photo_url: "https://cdn.example/meal-photo.jpg",
      });

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "confirmed-image-mismatch",
    });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it("retains file paths when confirmed photo URL does not match local metadata", async () => {
    mockGetFirstSync
      .mockReset()
      .mockReturnValueOnce({
        ...eligibleMealRow,
        photo_url: "https://cdn.example/different-meal-photo.jpg",
      })
      .mockReturnValueOnce(uploadedImageRow);

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
      confirmedPhotoUrl: "https://cdn.example/meal-photo.jpg",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "confirmed-photo-url-mismatch",
    });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it("retains content URI source paths even when upload evidence exists", async () => {
    mockGetFirstSync
      .mockReset()
      .mockReturnValueOnce({
        ...eligibleMealRow,
        image_local: "content://provider/photo/1",
      })
      .mockReturnValueOnce({
        ...uploadedImageRow,
        local_path: "content://provider/photo/1",
      });

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "content://provider/photo/1",
      reason: "content-uri-retained",
    });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it("restores DB references when local file deletion fails after DB clear", async () => {
    mockDeleteAsync.mockRejectedValueOnce(new Error("permission denied"));

    const cleanupConfirmedLoggedMealPhoto = loadCleanupConfirmedLoggedMealPhoto();

    const result = await cleanupConfirmedLoggedMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      confirmedImageId: "remote-image-1",
    });

    expect(result).toEqual({
      cleaned: false,
      cloudId: "meal-1",
      localPath: "file:///local-meal-photo.jpg",
      reason: "delete-failed",
      message: "permission denied",
    });
    expect(mockExecSync).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockRunSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET image_local=NULL"),
      ["user-1", "meal-1", "file:///local-meal-photo.jpg", "remote-image-1"],
    );
    expect(mockRunSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DELETE FROM images"),
      ["user-1", "file:///local-meal-photo.jpg", "local-image-1"],
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      "file:///local-meal-photo.jpg",
      { idempotent: true },
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(3, "BEGIN");
    expect(mockRunSync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SET image_local=?"),
      ["file:///local-meal-photo.jpg", "user-1", "meal-1", "remote-image-1"],
    );
    expect(mockRunSync).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO images"),
      [
        "local-image-1",
        "user-1",
        "file:///local-meal-photo.jpg",
        "uploaded",
        "https://cdn.example/meal-photo.jpg",
        "2026-06-09T09:00:00.000Z",
      ],
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(4, "COMMIT");
  });
});
