import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockRunSync = jest.fn<(...args: unknown[]) => { changes: number }>();
const mockGetFirstSync = jest.fn<(...args: unknown[]) => unknown>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    getFirstSync: mockGetFirstSync,
  }),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: [string, unknown?]) => mockEmit(...args),
}));

function loadImagesRepo(): typeof import("@/services/offline/images.repo") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/services/offline/images.repo");
}

describe("images repo failed upload recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-09T09:00:00.000Z"));
    mockRunSync.mockReturnValue({ changes: 1 });
    mockGetFirstSync.mockReturnValue({ count: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks a pending image row failed without replacing its local identity", async () => {
    const { markUploadFailed } = loadImagesRepo();

    await expect(
      markUploadFailed({
        uid: "user-1",
        imageId: "local-image-1",
      }),
    ).resolves.toBe(true);

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("SET status='failed', cloud_url=NULL"),
      ["2026-06-09T09:00:00.000Z", "user-1", "local-image-1"],
    );
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE user_uid=? AND image_id=? AND status='pending'",
      ),
      expect.any(Array),
    );
    expect(mockEmit).toHaveBeenCalledWith("image:upload:failed", {
      uid: "user-1",
      imageId: "local-image-1",
    });
  });

  it("does not emit a failed event when no pending image row changed", async () => {
    mockRunSync.mockReturnValueOnce({ changes: 0 });
    const { markUploadFailed } = loadImagesRepo();

    await expect(
      markUploadFailed({
        uid: "user-1",
        imageId: "already-uploaded-image",
      }),
    ).resolves.toBe(false);

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("SET status='failed', cloud_url=NULL"),
      ["2026-06-09T09:00:00.000Z", "user-1", "already-uploaded-image"],
    );
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("counts failed uploads for the active user only", async () => {
    mockGetFirstSync.mockReturnValueOnce({ count: 2 });
    const { getFailedUploadCount } = loadImagesRepo();

    await expect(getFailedUploadCount("user-1")).resolves.toBe(2);

    expect(mockGetFirstSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND status='failed'"),
      ["user-1"],
    );
  });

  it("moves failed same-user image rows back to pending and returns the retried count", async () => {
    mockRunSync.mockReturnValueOnce({ changes: 2 });
    const { retryFailedUploads } = loadImagesRepo();

    await expect(retryFailedUploads("user-1")).resolves.toBe(2);

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("SET status='pending', cloud_url=NULL"),
      ["2026-06-09T09:00:00.000Z", "user-1"],
    );
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND status='failed'"),
      expect.any(Array),
    );
    expect(mockEmit).toHaveBeenCalledWith("image:upload:retried", {
      uid: "user-1",
      count: 2,
    });
  });

  it("does not emit when no failed uploads were requeued", async () => {
    mockRunSync.mockReturnValueOnce({ changes: 0 });
    const { retryFailedUploads } = loadImagesRepo();

    await expect(retryFailedUploads("user-1")).resolves.toBe(0);

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("SET status='pending', cloud_url=NULL"),
      ["2026-06-09T09:00:00.000Z", "user-1"],
    );
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
