import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { StyleSheet } from "react-native";
import IngredientListSection from "@/feature/Meals/screens/MealAdd/components/IngredientListSection";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

describe("IngredientListSection", () => {
  it("renders add ingredient with a single visual plus", () => {
    const onOpenIngredientEditor = jest.fn();
    const { getAllByText, getByTestId, getByText } = renderWithTheme(
      <IngredientListSection
        ingredients={[
          {
            id: "ing-1",
            name: "Rice",
            amount: 100,
            unit: "g",
            protein: 2,
            carbs: 28,
            fat: 0,
            kcal: 130,
          },
        ]}
        onOpenIngredientEditor={onOpenIngredientEditor}
      />,
    );

    expect(getAllByText("+")).toHaveLength(1);
    expect(getByText("Add ingredient")).toBeTruthy();
    expect(getByText("100 g")).toBeTruthy();
    expect(getByText("130 kcal | P 2 g | C 28 g | F 0 g")).toBeTruthy();

    const addButton = getByTestId("ingredient-add-button");
    const addButtonStyle =
      typeof addButton.props.style === "function"
        ? addButton.props.style({ pressed: false })
        : addButton.props.style;

    expect(StyleSheet.flatten(addButtonStyle).minHeight).toBeGreaterThanOrEqual(44);
    expect(addButton.props.hitSlop).toBeGreaterThan(0);

    fireEvent.press(addButton);
    expect(onOpenIngredientEditor).toHaveBeenCalledWith(null);
  });
});
