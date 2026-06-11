import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpload = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  upload: (...args: unknown[]) => mockUpload(...args),
}));

describe("myMealsRepository mutation identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({});
    mockPost.mockResolvedValue({});
    mockUpload.mockResolvedValue({});
  });

  it("preserves backend saved meal imageRef storagePath during remote parse", async () => {
    mockGet.mockResolvedValue({
      items: [
        {
          id: "saved-1",
          loggedAt: "2026-03-03T12:00:00.000Z",
          type: "lunch",
          name: "Saved lunch",
          ingredients: [],
          createdAt: "2026-03-03T12:00:00.000Z",
          updatedAt: "2026-03-03T12:30:00.000Z",
          source: "saved",
          imageRef: {
            imageId: "image-1",
            storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
            downloadUrl: "https://cdn/saved.jpg",
          },
          totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
        },
      ],
      nextCursor: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchMyMealChangesRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    const result = await fetchMyMealChangesRemote({
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        cloudId: "saved-1",
        imageId: "image-1",
        photoUrl: "https://cdn/saved.jpg",
        imageRef: {
          imageId: "image-1",
          storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/saved.jpg",
        },
      }),
    );
  });

  it("sends clientMutationId in saved meal upsert body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateMyMealRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await updateMyMealRemote(
      "user-1",
      "saved-1",
      {
        cloudId: "saved-1",
        mealId: "saved-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        source: "saved",
        deleted: false,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      "mutation-saved-upsert-1",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/my-meals",
      expect.objectContaining({
        id: "saved-1",
        source: "saved",
        clientMutationId: "mutation-saved-upsert-1",
      }),
    );
  });

  it("preserves explicit saved meal imageRef storagePath when user-scoped", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateMyMealRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await updateMyMealRemote(
      "user-1",
      "saved-1",
      {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        source: "saved",
        imageRef: {
          imageId: "image-1",
          storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/saved.jpg",
        },
        deleted: false,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      "mutation-saved-upsert-image-1",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/my-meals",
      expect.objectContaining({
        imageRef: {
          imageId: "image-1",
          storagePath: "myMeals/user-1/saved-1-uploaded-image-1.jpg",
          downloadUrl: "https://cdn/saved.jpg",
        },
      }),
    );
  });

  it("does not synthesize saved meal imageRef storagePath from imageId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateMyMealRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await updateMyMealRemote(
      "user-1",
      "saved-1",
      {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "user-1",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        source: "saved",
        imageId: "image-1",
        photoUrl: "https://cdn/saved.jpg",
        deleted: false,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      "mutation-saved-upsert-image-no-storage-path",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/my-meals",
      expect.objectContaining({
        imageRef: {
          imageId: "image-1",
          downloadUrl: "https://cdn/saved.jpg",
        },
      }),
    );
    expect(JSON.stringify(mockPost.mock.calls[0]?.[1])).not.toContain(
      "myMeals/user-1/image-1.jpg",
    );
  });

  it("does not synthesize unknown saved meal imageRef storagePath", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateMyMealRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await updateMyMealRemote(
      "",
      "saved-1",
      {
        cloudId: "saved-1",
        mealId: "saved-1",
        userUid: "",
        timestamp: "2026-03-03T12:00:00.000Z",
        type: "lunch",
        ingredients: [],
        createdAt: "2026-03-03T12:00:00.000Z",
        updatedAt: "2026-03-03T12:30:00.000Z",
        source: "saved",
        imageId: "image-1",
        photoUrl: "https://cdn/saved.jpg",
        deleted: false,
        totals: { kcal: 200, protein: 30, carbs: 0, fat: 5 },
      },
      "mutation-saved-upsert-image-missing-owner",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/users/me/my-meals",
      expect.objectContaining({
        imageRef: {
          imageId: "image-1",
          downloadUrl: "https://cdn/saved.jpg",
        },
      }),
    );
    expect(JSON.stringify(mockPost.mock.calls[0]?.[1])).not.toContain("unknown");
  });

  it("sends clientMutationId in saved meal delete body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { markMyMealDeletedRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    await markMyMealDeletedRemote(
      "user-1",
      "saved-1",
      "2026-03-03T12:30:00.000Z",
      { clientMutationId: "mutation-saved-delete-1" },
    );

    expect(mockPost).toHaveBeenCalledWith("/users/me/my-meals/saved-1/delete", {
      updatedAt: "2026-03-03T12:30:00.000Z",
      clientMutationId: "mutation-saved-delete-1",
    });
  });

  it("exposes saved meal photo upload storagePath with legacy return fields", async () => {
    mockUpload.mockResolvedValue({
      mealId: "saved-1",
      imageId: "image-1",
      storagePath: "myMeals/user-1/saved-1-image-1.jpg",
      photoUrl: "https://cdn/saved-1.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadMyMealPhotoRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    const result = await uploadMyMealPhotoRemote("user-1", "saved-1", "file:///saved.jpg");

    expect(mockUpload).toHaveBeenCalledWith(
      "/users/me/my-meals/saved-1/photo",
      expect.any(FormData),
    );
    expect(result).toEqual({
      imageId: "image-1",
      photoUrl: "https://cdn/saved-1.jpg",
      storagePath: "myMeals/user-1/saved-1-image-1.jpg",
    });
  });

  it("keeps saved meal photo upload return compatible when storagePath is missing", async () => {
    mockUpload.mockResolvedValue({
      mealId: "saved-1",
      imageId: "image-1",
      photoUrl: "https://cdn/saved-1.jpg",
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadMyMealPhotoRemote } = require("@/services/meals/myMealsRepository") as
      typeof import("@/services/meals/myMealsRepository");

    const result = await uploadMyMealPhotoRemote("user-1", "saved-1", "file:///saved.jpg");

    expect(result).toEqual({
      imageId: "image-1",
      photoUrl: "https://cdn/saved-1.jpg",
    });
  });
});
