import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ensureLocalMealPhoto,
  processAndUpload,
} from "@/services/meals/mealService.images";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockManipulateAsync = jest.fn<(...args: unknown[]) => Promise<{ uri: string }>>();
const mockGetInfoAsync = jest.fn<(...args: unknown[]) => Promise<{ exists: boolean }>>();
const mockMakeDirectoryAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockCopyAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDownloadAsync = jest.fn<(...args: unknown[]) => Promise<{ status: number }>>();
const mockUpload = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUuid = jest.fn<() => string>();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: (...args: []) => mockNetInfoFetch(...args),
  },
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("@/services/core/fileSystem", () => ({
  documentDirectory: "file:///docs/",
  cacheDirectory: "file:///cache/",
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
}));

jest.mock("@/services/core/apiClient", () => ({
  upload: (...args: unknown[]) => mockUpload(...args),
  get: (...args: unknown[]) => mockGet(...args),
}));

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

describe("services/mealService.images", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockManipulateAsync
      .mockResolvedValueOnce({ uri: "file:///cloud.jpg" })
      .mockResolvedValueOnce({ uri: "file:///ai.jpg" });
    mockGetInfoAsync.mockResolvedValue({ exists: true });
    mockMakeDirectoryAsync.mockResolvedValue();
    mockCopyAsync.mockResolvedValue();
    mockDeleteAsync.mockResolvedValue();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockUpload.mockResolvedValue({
      imageId: "image-1",
      storagePath: "meals/user-1/image-1.jpg",
      photoUrl: "https://cdn/meal.jpg",
    });
    mockGet.mockResolvedValue({
      imageId: "image-1",
      storagePath: "meals/user-1/image-1.jpg",
      photoUrl: "https://cdn/meal.jpg",
    });
    mockUuid.mockReturnValue("uuid-1");
  });

  it("uploads compressed meal photo through backend", async () => {
    const result = await processAndUpload("user-1", "file:///raw.jpg");

    expect(mockUpload).toHaveBeenCalledWith(
      "/users/me/meals/photo",
      expect.any(FormData),
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "file:///ai.jpg",
      to: "file:///cache/ai/uuid-1.jpg",
    });
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(1, "file:///cloud.jpg", {
      idempotent: true,
    });
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(2, "file:///ai.jpg", {
      idempotent: true,
    });
    expect(result).toEqual({
      imageId: "image-1",
      cloudUrl: "https://cdn/meal.jpg",
      aiLocalUri: "file:///cache/ai/uuid-1.jpg",
    });
  });

  it("does not delete the source image when manipulator returns original URI", async () => {
    mockManipulateAsync
      .mockResolvedValueOnce({ uri: "file:///raw.jpg" })
      .mockResolvedValueOnce({ uri: "file:///raw.jpg" });

    await processAndUpload("user-1", "file:///raw.jpg");

    expect(mockDeleteAsync).not.toHaveBeenCalledWith("file:///raw.jpg", {
      idempotent: true,
    });
  });

  it("resolves missing local meal photo through backend and downloads it", async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true });

    const result = await ensureLocalMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      imageId: "image-1",
      photoUrl: null,
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/users/me/meals/photo-url?mealId=meal-1&imageId=image-1",
    );
    expect(mockDownloadAsync).toHaveBeenCalledWith(
      "https://cdn/meal.jpg",
      "file:///docs/meals/user-1/meal-1.jpg",
    );
    expect(result).toBe("file:///docs/meals/user-1/meal-1.jpg");
  });

  it("falls back to fresh API URL when stored photoUrl returns HTTP error", async () => {
    // Use distinct IDs to avoid collision with CLOUD_URL_CACHE populated by other tests.
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })  // ensureDirFor dir check
      .mockResolvedValueOnce({ exists: false }) // target file not cached
      .mockResolvedValueOnce({ exists: true });  // target file after fresh-URL download

    mockDownloadAsync
      .mockResolvedValueOnce({ status: 403 }) // stale signed URL → HTTP error
      .mockResolvedValueOnce({ status: 200 }); // fresh URL from API → success

    mockGet.mockResolvedValue({
      imageId: "image-2",
      storagePath: "meals/user-1/image-2.jpg",
      photoUrl: "https://cdn/fresh.jpg",
    });

    const result = await ensureLocalMealPhoto({
      uid: "user-1",
      cloudId: "meal-2",
      imageId: "image-2",
      photoUrl: "https://cdn/stale-signed.jpg",
    });

    expect(mockDownloadAsync).toHaveBeenNthCalledWith(
      1,
      "https://cdn/stale-signed.jpg",
      "file:///docs/meals/user-1/meal-2.jpg",
    );
    expect(mockGet).toHaveBeenCalledWith(
      "/users/me/meals/photo-url?mealId=meal-2&imageId=image-2",
    );
    expect(mockDownloadAsync).toHaveBeenNthCalledWith(
      2,
      "https://cdn/fresh.jpg",
      "file:///docs/meals/user-1/meal-2.jpg",
    );
    expect(result).toBe("file:///docs/meals/user-1/meal-2.jpg");
  });

  it("uses stored photoUrl directly when it returns HTTP 200", async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })  // ensureDirFor
      .mockResolvedValueOnce({ exists: false }) // file not cached
      .mockResolvedValueOnce({ exists: true });  // after successful download

    const result = await ensureLocalMealPhoto({
      uid: "user-1",
      cloudId: "meal-1",
      imageId: "image-1",
      photoUrl: "https://cdn/photo.jpg",
    });

    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsync).toHaveBeenCalledWith(
      "https://cdn/photo.jpg",
      "file:///docs/meals/user-1/meal-1.jpg",
    );
    expect(mockGet).not.toHaveBeenCalled();
    expect(result).toBe("file:///docs/meals/user-1/meal-1.jpg");
  });
});
