import { beforeEach, describe, expect, it, jest } from "@jest/globals";
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
});
