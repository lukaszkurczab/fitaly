import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";

const mockRunSync = jest.fn<(...args: unknown[]) => void>();
const mockGetAllSync = jest.fn<(...args: unknown[]) => unknown[]>();
const mockGetFirstSync = jest.fn<(...args: unknown[]) => unknown>();

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    getAllSync: mockGetAllSync,
    getFirstSync: mockGetFirstSync,
  }),
}));

jest.mock("@/services/core/events", () => ({
  emit: jest.fn(),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "saved-1",
  cloudId: "saved-1",
  timestamp: "2026-03-03T12:00:00.000Z",
  type: "lunch",
  name: "Saved lunch",
  ingredients: [],
  createdAt: "2026-03-03T12:00:00.000Z",
  updatedAt: "2026-03-03T12:30:00.000Z",
  syncState: "synced",
  source: "saved",
  imageId: null,
  photoUrl: null,
  notes: null,
  tags: [],
  deleted: false,
  totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
  ...overrides,
});

describe("myMeals.repo imageRef persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists canonical saved meal imageRef storagePath during local upsert", async () => {
    const { upsertMyMealLocal } =
      jest.requireActual<typeof import("@/services/offline/myMeals.repo")>(
        "@/services/offline/myMeals.repo",
      );

    await upsertMyMealLocal(
      baseMeal({
        imageRef: {
          imageId: "image-1",
          storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/saved.jpg",
        },
        imageId: "image-1",
        photoUrl: "https://cdn/saved.jpg",
      }),
    );

    const params = mockRunSync.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain(
      JSON.stringify({
        imageId: "image-1",
        storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
        downloadUrl: "https://cdn/saved.jpg",
      }),
    );
  });

  it("does not persist fabricated storagePath for legacy-only local upserts", async () => {
    const { upsertMyMealLocal } =
      jest.requireActual<typeof import("@/services/offline/myMeals.repo")>(
        "@/services/offline/myMeals.repo",
      );

    await upsertMyMealLocal(
      baseMeal({
        imageId: "image-1",
        photoUrl: "https://cdn/saved.jpg",
      }),
    );

    const params = mockRunSync.mock.calls[0]?.[1] as unknown[];
    const serializedImageRef = params.find(
      (value): value is string =>
        typeof value === "string" && value.includes("\"imageId\":\"image-1\""),
    );
    expect(serializedImageRef).toBe(
      JSON.stringify({
        imageId: "image-1",
        downloadUrl: "https://cdn/saved.jpg",
      }),
    );
    expect(serializedImageRef).not.toContain("storagePath");
    expect(serializedImageRef).not.toContain("myMeals/user-1/image-1.jpg");
  });

  it("round-trips persisted imageRef storagePath from local reads", async () => {
    mockGetFirstSync.mockReturnValue({
      cloud_id: "saved-1",
      meal_id: "saved-1",
      user_uid: "user-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      day_key: "2026-03-03",
      logged_at_local_min: null,
      tz_offset_min: null,
      type: "lunch",
      name: "Saved lunch",
      ingredients: "[]",
      photo_local_path: null,
      photo_url: "https://cdn/saved.jpg",
      image_local: null,
      image_id: "image-1",
      image_ref: JSON.stringify({
        imageId: "image-1",
        storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
        downloadUrl: "https://cdn/saved.jpg",
      }),
      totals_kcal: 200,
      totals_protein: 30,
      totals_carbs: 0,
      totals_fat: 5,
      deleted: 0,
      created_at: "2026-03-03T12:00:00.000Z",
      updated_at: "2026-03-03T12:30:00.000Z",
      last_synced_at: 0,
      sync_state: "synced",
      source: "saved",
      input_method: null,
      ai_meta: null,
      notes: null,
      tags: "[]",
    });
    const { getMyMealByCloudIdLocal } =
      jest.requireActual<typeof import("@/services/offline/myMeals.repo")>(
        "@/services/offline/myMeals.repo",
      );

    const meal = await getMyMealByCloudIdLocal("user-1", "saved-1");

    expect(meal?.imageRef).toEqual({
      imageId: "image-1",
      storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
      downloadUrl: "https://cdn/saved.jpg",
    });
    expect(meal?.imageId).toBe("image-1");
    expect(meal?.photoUrl).toBe("https://cdn/saved.jpg");
  });

  it("omits foreign persisted imageRef storagePath from local reads", async () => {
    mockGetFirstSync.mockReturnValue({
      cloud_id: "saved-1",
      meal_id: "saved-1",
      user_uid: "user-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      day_key: "2026-03-03",
      logged_at_local_min: null,
      tz_offset_min: null,
      type: "lunch",
      name: "Saved lunch",
      ingredients: "[]",
      photo_local_path: null,
      photo_url: "https://cdn/fallback.jpg",
      image_local: null,
      image_id: "legacy-image-1",
      image_ref: JSON.stringify({
        imageId: "image-1",
        storagePath: "myMeals/other-user/saved-1-uploaded-image-1.jpg",
        downloadUrl: "https://cdn/saved.jpg",
      }),
      totals_kcal: 200,
      totals_protein: 30,
      totals_carbs: 0,
      totals_fat: 5,
      deleted: 0,
      created_at: "2026-03-03T12:00:00.000Z",
      updated_at: "2026-03-03T12:30:00.000Z",
      last_synced_at: 0,
      sync_state: "synced",
      source: "saved",
      input_method: null,
      ai_meta: null,
      notes: null,
      tags: "[]",
    });
    const { getMyMealByCloudIdLocal } =
      jest.requireActual<typeof import("@/services/offline/myMeals.repo")>(
        "@/services/offline/myMeals.repo",
      );

    const meal = await getMyMealByCloudIdLocal("user-1", "saved-1");

    expect(meal?.imageRef).toEqual({
      imageId: "image-1",
      downloadUrl: "https://cdn/saved.jpg",
    });
    expect(meal?.imageId).toBe("image-1");
    expect(meal?.photoUrl).toBe("https://cdn/saved.jpg");
    expect(JSON.stringify(meal)).not.toContain("myMeals/other-user/");
  });

  it("does not fabricate imageRef storagePath for legacy-only rows", async () => {
    mockGetFirstSync.mockReturnValue({
      cloud_id: "saved-1",
      meal_id: "saved-1",
      user_uid: "user-1",
      timestamp: "2026-03-03T12:00:00.000Z",
      day_key: "2026-03-03",
      logged_at_local_min: null,
      tz_offset_min: null,
      type: "lunch",
      name: "Saved lunch",
      ingredients: "[]",
      photo_local_path: null,
      photo_url: "https://cdn/saved.jpg",
      image_local: null,
      image_id: "image-1",
      image_ref: null,
      totals_kcal: 200,
      totals_protein: 30,
      totals_carbs: 0,
      totals_fat: 5,
      deleted: 0,
      created_at: "2026-03-03T12:00:00.000Z",
      updated_at: "2026-03-03T12:30:00.000Z",
      last_synced_at: 0,
      sync_state: "synced",
      source: "saved",
      input_method: null,
      ai_meta: null,
      notes: null,
      tags: "[]",
    });
    const { getMyMealByCloudIdLocal } =
      jest.requireActual<typeof import("@/services/offline/myMeals.repo")>(
        "@/services/offline/myMeals.repo",
      );

    const meal = await getMyMealByCloudIdLocal("user-1", "saved-1");

    expect(meal?.imageRef).toBeNull();
    expect(meal?.imageId).toBe("image-1");
    expect(meal?.photoUrl).toBe("https://cdn/saved.jpg");
    expect(JSON.stringify(meal)).not.toContain("myMeals/user-1/image-1.jpg");
  });
});
