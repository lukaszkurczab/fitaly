import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import { buildSavedMealDraft } from "@/feature/Meals/utils/buildSavedMealDraft";

const mockUuid = jest.fn<() => string>();

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

const savedTemplate = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "template-meal-id",
  cloudId: "template-cloud-id",
  savedMealRefId: null,
  timestamp: "2026-01-10T12:00:00.000Z",
  dayKey: "2026-01-10",
  loggedAtLocalMin: 780,
  tzOffsetMin: 60,
  type: "lunch",
  name: "Chicken pasta",
  ingredients: [
    {
      id: "i1",
      name: "Chicken",
      amount: 120,
      kcal: 180,
      protein: 30,
      fat: 4,
      carbs: 0,
    },
  ],
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
  syncState: "synced",
  source: "saved",
  inputMethod: "manual",
  ...overrides,
});

describe("buildSavedMealDraft", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-20T08:30:00.000Z"));
    mockUuid.mockReturnValue("draft-meal-id");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("creates a new saved-meal log draft without inheriting template timestamp or dayKey", () => {
    const draft = buildSavedMealDraft({
      picked: savedTemplate(),
      uid: "user-1",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        mealId: "draft-meal-id",
        cloudId: undefined,
        savedMealRefId: "template-cloud-id",
        source: "saved",
        inputMethod: "manual",
        timestamp: "2026-03-20T08:30:00.000Z",
        dayKey: "2026-03-20",
      }),
    );
    expect(draft.timestamp).not.toBe("2026-01-10T12:00:00.000Z");
    expect(draft.dayKey).not.toBe("2026-01-10");
  });

  it("uses the template mealId as savedMealRefId when cloudId is not available", () => {
    const draft = buildSavedMealDraft({
      picked: savedTemplate({ cloudId: undefined }),
      uid: "user-1",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        mealId: "draft-meal-id",
        cloudId: undefined,
        savedMealRefId: "template-meal-id",
      }),
    );
  });

  it("carries review content and media while assigning ids only to missing ingredients", () => {
    mockUuid
      .mockImplementationOnce(() => "draft-meal-id")
      .mockImplementationOnce(() => "ingredient-generated-id");

    const picked = savedTemplate({
      type: "dinner",
      name: "Salmon bowl",
      notes: "Add lemon after reheating",
      photoLocalPath: "file:///templates/salmon-local.jpg",
      localPhotoUrl: "file:///templates/salmon-cache.jpg",
      photoUrl: "https://cdn.example.com/templates/salmon.jpg",
      imageId: "template-image-id",
      ingredients: [
        {
          id: "stable-ingredient-id",
          name: "Salmon",
          amount: 140,
          kcal: 280,
          protein: 32,
          fat: 14,
          carbs: 0,
        },
        {
          id: "",
          name: "Rice",
          amount: 180,
          kcal: 230,
          protein: 5,
          fat: 1,
          carbs: 50,
        },
      ],
      totals: {
        kcal: 510,
        protein: 37,
        fat: 15,
        carbs: 50,
      },
    });

    const draft = buildSavedMealDraft({
      picked,
      uid: "user-1",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        mealId: "draft-meal-id",
        name: "Salmon bowl",
        notes: "Add lemon after reheating",
        type: "dinner",
        photoLocalPath: "file:///templates/salmon-local.jpg",
        localPhotoUrl: "file:///templates/salmon-cache.jpg",
        photoUrl: "file:///templates/salmon-local.jpg",
        imageId: "template-image-id",
        totals: {
          kcal: 510,
          protein: 37,
          fat: 15,
          carbs: 50,
        },
      }),
    );
    expect(draft.ingredients).toEqual([
      {
        id: "stable-ingredient-id",
        name: "Salmon",
        amount: 140,
        kcal: 280,
        protein: 32,
        fat: 14,
        carbs: 0,
      },
      {
        id: "ingredient-generated-id",
        name: "Rice",
        amount: 180,
        kcal: 230,
        protein: 5,
        fat: 1,
        carbs: 50,
      },
    ]);
    expect(draft.ingredients[0]).not.toBe(picked.ingredients[0]);
    expect(draft.totals).not.toBe(picked.totals);
  });
});
