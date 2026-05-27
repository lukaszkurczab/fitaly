import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import { TodaysMealsList } from "@/feature/Home/components/TodaysMealsList";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
    i18n: { language: "en" },
  }),
}));


const buildMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "u1",
  mealId: "m1",
  timestamp: "2026-01-01T10:00:00.000Z",
  type: "lunch",
  name: "Meal A",
  ingredients: [],
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  ...overrides,
});

describe("TodaysMealsList", () => {
  it("renders meals, computes kcal and handles row presses", () => {
    const onOpenMeal = jest.fn<(meal: Meal) => void>();
    const onViewHistory = jest.fn();
    const mealWithIngredients = buildMeal({
      mealId: "m1",
      name: "Chicken",
      ingredients: [
        { id: "i1", name: "A", amount: 1, kcal: 100, protein: 0, fat: 0, carbs: 0 },
        { id: "i2", name: "B", amount: 1, kcal: 50, protein: 0, fat: 0, carbs: 0 },
      ],
      totals: { kcal: 999, protein: 0, fat: 0, carbs: 0 },
    });
    const mealWithTotals = buildMeal({
      mealId: "m2",
      name: "Omelette",
      ingredients: [],
      totals: { kcal: 320, protein: 0, fat: 0, carbs: 0 },
    });
    const screen = renderWithTheme(
      <TodaysMealsList
        meals={[mealWithIngredients, mealWithTotals]}
        onOpenMeal={onOpenMeal}
      />,
    );

    expect(screen.queryByText("translated:home:viewHistory →")).toBeNull();
    expect(screen.getByText("Chicken")).toBeTruthy();
    expect(screen.getByText(/150 kcal/)).toBeTruthy();
    expect(screen.queryByText("A, B")).toBeNull();
    expect(screen.getByText("Omelette")).toBeTruthy();
    expect(screen.getByText(/320 kcal/)).toBeTruthy();

    fireEvent.press(screen.getByText("Chicken"));
    expect(onOpenMeal).toHaveBeenCalledWith(mealWithIngredients);

    expect(onViewHistory).not.toHaveBeenCalled();
  });

  it("uses translated fallback meal name", () => {
    const { getByText } = renderWithTheme(
      <TodaysMealsList
        meals={[buildMeal({ name: "", totals: { kcal: 123, protein: 0, fat: 0, carbs: 0 } })]}
      />,
    );

    expect(getByText("translated:home:meal")).toBeTruthy();
  });
});
