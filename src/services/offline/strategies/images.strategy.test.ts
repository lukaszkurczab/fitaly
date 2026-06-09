import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockGetPendingUploads = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockMarkUploaded = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockProcessAndUpload = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEnqueueUpsert = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRunSync = jest.fn<(...args: unknown[]) => void>();
const mockGetAllSync = jest.fn<(...args: unknown[]) => unknown[]>();
const mockGetDB = jest.fn(() => ({
  runSync: mockRunSync,
  getAllSync: mockGetAllSync,
}));
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
  child: jest.fn(),
};
mockLogger.child.mockReturnValue(mockLogger);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: (...args: []) => mockNetInfoFetch(...args),
  },
}));

jest.mock("@/services/meals/mealService.images", () => ({
  processAndUpload: (...args: unknown[]) => mockProcessAndUpload(...args),
}));

jest.mock("@/services/offline/images.repo", () => ({
  getPendingUploads: (...args: unknown[]) => mockGetPendingUploads(...args),
  markUploaded: (...args: unknown[]) => mockMarkUploaded(...args),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueUpsert: (...args: unknown[]) => mockEnqueueUpsert(...args),
}));

jest.mock("@/services/offline/db", () => ({
  getDB: () => mockGetDB(),
}));

jest.mock("@/utils/debug", () => ({
  Sync: mockLogger,
}));

const pendingImageRow = {
  image_id: "meal-cloud-1",
  user_uid: "user-1",
  local_path: "file:///local-meal-photo.jpg",
  cloud_url: null,
  status: "pending",
  updated_at: "2026-06-09T08:00:00.000Z",
};

const matchingMealRow = {
  cloud_id: "meal-cloud-1",
  meal_id: "meal-cloud-1",
  user_uid: "user-1",
  timestamp: "2026-06-09T08:15:00.000Z",
  day_key: "2026-06-09",
  logged_at_local_min: 615,
  tz_offset_min: 120,
  type: "lunch",
  name: "Lunch",
  ingredients: JSON.stringify([
    {
      id: "ingredient-1",
      name: "Rice",
      amount: 100,
      kcal: 130,
      protein: 3,
      carbs: 28,
      fat: 1,
    },
  ]),
  photo_local_path: "file:///local-meal-photo.jpg",
  photo_url: "https://cdn.example/meal-photo.jpg",
  image_local: "file:///local-meal-photo.jpg",
  image_id: "remote-image-1",
  totals_kcal: 130,
  totals_protein: 3,
  totals_carbs: 28,
  totals_fat: 1,
  deleted: 0,
  created_at: "2026-06-09T08:10:00.000Z",
  updated_at: "2026-06-09T08:10:00.000Z",
  last_synced_at: 0,
  sync_state: "pending",
  source: "manual",
  input_method: "manual",
  ai_meta: null,
  notes: "kept local until remote attach",
  tags: JSON.stringify(["photo"]),
};

function loadProcessImageUploads(): (uid: string) => Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/services/offline/strategies/images.strategy").processImageUploads;
}

describe("processImageUploads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-09T09:00:00.000Z"));
    mockLogger.child.mockReturnValue(mockLogger);
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockGetPendingUploads.mockResolvedValue([pendingImageRow]);
    mockMarkUploaded.mockResolvedValue();
    mockProcessAndUpload.mockResolvedValue({
      imageId: "remote-image-1",
      cloudUrl: "https://cdn.example/meal-photo.jpg",
      aiLocalUri: "file:///cache/ai/meal-photo.jpg",
    });
    mockEnqueueUpsert.mockResolvedValue();
    mockGetAllSync.mockReturnValue([matchingMealRow]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("leaves a failed pending logged-meal image retryable without mutating meal state", async () => {
    mockProcessAndUpload.mockRejectedValueOnce(new Error("temporary upload outage"));

    await loadProcessImageUploads()("user-1");

    expect(mockGetPendingUploads).toHaveBeenCalledWith("user-1");
    expect(mockProcessAndUpload).toHaveBeenCalledWith(
      "user-1",
      pendingImageRow.local_path,
    );
    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockGetAllSync).not.toHaveBeenCalled();
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();
  });

  it("can retry the same pending local image row after restart and attach remote metadata", async () => {
    mockGetPendingUploads
      .mockResolvedValueOnce([pendingImageRow])
      .mockResolvedValueOnce([pendingImageRow]);
    mockProcessAndUpload
      .mockRejectedValueOnce(new Error("first attempt failed"))
      .mockResolvedValueOnce({
        imageId: "remote-image-1",
        cloudUrl: "https://cdn.example/meal-photo.jpg",
        aiLocalUri: "file:///cache/ai/meal-photo.jpg",
      });

    const processImageUploads = loadProcessImageUploads();

    await processImageUploads("user-1");

    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();

    await processImageUploads("user-1");

    expect(mockGetPendingUploads).toHaveBeenNthCalledWith(1, "user-1");
    expect(mockGetPendingUploads).toHaveBeenNthCalledWith(2, "user-1");
    expect(mockProcessAndUpload).toHaveBeenNthCalledWith(
      2,
      "user-1",
      pendingImageRow.local_path,
    );
    expect(mockMarkUploaded).toHaveBeenCalledWith(
      pendingImageRow.image_id,
      "https://cdn.example/meal-photo.jpg",
    );
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND image_local=?"),
      [
        "https://cdn.example/meal-photo.jpg",
        "remote-image-1",
        "2026-06-09T09:00:00.000Z",
        "user-1",
        pendingImageRow.local_path,
      ],
    );
    expect(mockGetAllSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND image_local=?"),
      ["user-1", pendingImageRow.local_path],
    );
    expect(mockEnqueueUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        userUid: "user-1",
        mealId: "meal-cloud-1",
        cloudId: "meal-cloud-1",
        imageId: "remote-image-1",
        photoUrl: "https://cdn.example/meal-photo.jpg",
        updatedAt: "2026-06-09T09:00:00.000Z",
        syncState: "pending",
        source: "manual",
        notes: "kept local until remote attach",
        tags: ["photo"],
      }),
    );
  });

  it("does not mark uploaded when local meal metadata update fails after binary upload", async () => {
    mockRunSync.mockImplementationOnce(() => {
      throw new Error("sqlite update failed");
    });

    await loadProcessImageUploads()("user-1");

    expect(mockProcessAndUpload).toHaveBeenCalledWith(
      "user-1",
      pendingImageRow.local_path,
    );
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("SET photo_url=?, image_id=?, updated_at=?"),
      [
        "https://cdn.example/meal-photo.jpg",
        "remote-image-1",
        "2026-06-09T09:00:00.000Z",
        "user-1",
        pendingImageRow.local_path,
      ],
    );
    expect(mockGetAllSync).not.toHaveBeenCalled();
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();
    expect(mockMarkUploaded).not.toHaveBeenCalled();
  });

  it("does not mark uploaded when matching meal selection fails after binary upload", async () => {
    mockGetAllSync.mockImplementationOnce(() => {
      throw new Error("sqlite select failed");
    });

    await loadProcessImageUploads()("user-1");

    expect(mockRunSync).toHaveBeenCalled();
    expect(mockGetAllSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND image_local=?"),
      ["user-1", pendingImageRow.local_path],
    );
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();
    expect(mockMarkUploaded).not.toHaveBeenCalled();
  });

  it("does not mark uploaded when no local meals still match image_local", async () => {
    mockGetAllSync.mockReturnValueOnce([]);

    await loadProcessImageUploads()("user-1");

    expect(mockRunSync).toHaveBeenCalled();
    expect(mockGetAllSync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_uid=? AND image_local=?"),
      ["user-1", pendingImageRow.local_path],
    );
    expect(mockEnqueueUpsert).not.toHaveBeenCalled();
    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith("upload:meal_attach_missing", {
      image_id: pendingImageRow.image_id,
      local_path: pendingImageRow.local_path,
      remote_image_id: "remote-image-1",
      cloud_url: "https://cdn.example/meal-photo.jpg",
    });
  });

  it("does not mark uploaded when enqueueing a matching meal upsert fails", async () => {
    mockEnqueueUpsert.mockRejectedValueOnce(new Error("queue write failed"));

    await loadProcessImageUploads()("user-1");

    expect(mockRunSync).toHaveBeenCalled();
    expect(mockGetAllSync).toHaveBeenCalled();
    expect(mockEnqueueUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        imageId: "remote-image-1",
        photoUrl: "https://cdn.example/meal-photo.jpg",
      }),
    );
    expect(mockMarkUploaded).not.toHaveBeenCalled();
  });

  it("marks uploaded only after metadata update, meal selection, and all upserts are enqueued", async () => {
    const secondMealRow = {
      ...matchingMealRow,
      cloud_id: "meal-cloud-2",
      meal_id: "meal-cloud-2",
      name: "Second lunch",
    };
    mockGetAllSync.mockReturnValueOnce([matchingMealRow, secondMealRow]);

    await loadProcessImageUploads()("user-1");

    expect(mockEnqueueUpsert).toHaveBeenCalledTimes(2);
    expect(mockMarkUploaded).toHaveBeenCalledWith(
      pendingImageRow.image_id,
      "https://cdn.example/meal-photo.jpg",
    );

    const updateOrder = mockRunSync.mock.invocationCallOrder[0];
    const selectOrder = mockGetAllSync.mock.invocationCallOrder[0];
    const firstEnqueueOrder = mockEnqueueUpsert.mock.invocationCallOrder[0];
    const secondEnqueueOrder = mockEnqueueUpsert.mock.invocationCallOrder[1];
    const markUploadedOrder = mockMarkUploaded.mock.invocationCallOrder[0];

    expect(updateOrder).toBeLessThan(selectOrder);
    expect(selectOrder).toBeLessThan(firstEnqueueOrder);
    expect(firstEnqueueOrder).toBeLessThan(secondEnqueueOrder);
    expect(secondEnqueueOrder).toBeLessThan(markUploadedOrder);
  });
});
