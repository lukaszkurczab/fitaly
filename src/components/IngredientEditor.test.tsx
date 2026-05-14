import { TextInput as RNTextInput } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { IngredientEditor } from "@/components/IngredientEditor";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) =>
      options?.ns ? `${options.ns}:${key}` : key,
  }),
}));

describe("IngredientEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("commits parsed ingredient values", () => {
    const onCommit = jest.fn();
    const { UNSAFE_getAllByType, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-1",
          name: "Apple",
          amount: 100,
          unit: "g",
          protein: 1,
          carbs: 10,
          fat: 2,
          kcal: 50,
        }}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const inputs = UNSAFE_getAllByType(RNTextInput);
    fireEvent.changeText(inputs[0], "  Banana  ");
    fireEvent.changeText(inputs[1], "150");
    fireEvent.changeText(inputs[2], "2.5");
    fireEvent.changeText(inputs[3], "30");
    fireEvent.changeText(inputs[4], "0.3");
    fireEvent.changeText(inputs[5], "120");

    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-1",
      name: "Banana",
      amount: 150,
      unit: "g",
      protein: 2.5,
      carbs: 30,
      fat: 0.3,
      kcal: 120,
    });
  });

  it("does not commit when there are validation errors", () => {
    const onCommit = jest.fn();
    const { getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-1",
          name: "Apple",
          amount: 100,
          unit: "g",
          protein: 1,
          carbs: 10,
          fat: 2,
          kcal: 50,
        }}
        errors={{ name: "required" }}
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.press(getByText("common:save_changes"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("supports the sheet variant actions for adding a new ingredient", () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-2",
          name: "",
          amount: 1,
          unit: "g",
          protein: 0,
          carbs: 0,
          fat: 0,
          kcal: 0,
        }}
        variant="sheet"
        submitLabel="meals:add_ingredient"
        showDelete={false}
        onCommit={onCommit}
        onCancel={onCancel}
        onDelete={() => undefined}
      />,
    );

    fireEvent.press(getByText("common:cancel"));
    fireEvent.press(getByText("meals:add_ingredient"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(queryByText("common:remove")).toBeNull();
  });

  it("shows unit only once in sheet variant and removes fake unit affordance", () => {
    const { getAllByText, queryByDisplayValue, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-3",
          name: "Milk",
          amount: 250,
          unit: "ml",
          protein: 8,
          carbs: 12,
          fat: 5,
          kcal: 140,
        }}
        variant="sheet"
        onCommit={() => undefined}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(getAllByText("ml")).toHaveLength(1);
    expect(queryByText("meals:review_meal_edit_ingredient_unit")).toBeNull();
    expect(queryByDisplayValue("ml")).toBeNull();
    expect(queryByText("›")).toBeNull();
  });

  it("keeps unit read-only in sheet variant commit flow", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-4",
          name: "Olive oil",
          amount: 77,
          unit: "ml",
          protein: 0,
          carbs: 0,
          fat: 100,
          kcal: 884,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByDisplayValue("77"), "150.5");
    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150.5,
        unit: "ml",
      }),
    );
  });

  it("commits without asking for recalculation from save", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText, queryByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-5",
          name: "Rice",
          amount: 250,
          unit: "g",
          protein: 10,
          carbs: 70,
          fat: 2,
          kcal: 330,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.changeText(getByDisplayValue("250"), "300");
    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-5",
      name: "Rice",
      amount: 300,
      unit: "g",
      protein: 10,
      carbs: 70,
      fat: 2,
      kcal: 330,
    });
    expect(queryByText("meals:recalc_title")).toBeNull();
  });

  it("asks after amount blur and recalculates fields without committing", () => {
    const onCommit = jest.fn();
    const { getByDisplayValue, getByText } = renderWithTheme(
      <IngredientEditor
        initial={{
          id: "ing-6",
          name: "Rice",
          amount: 250,
          unit: "g",
          protein: 10,
          carbs: 70,
          fat: 2,
          kcal: 330,
        }}
        variant="sheet"
        onCommit={onCommit}
        onCancel={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const amountInput = getByDisplayValue("250");
    fireEvent.changeText(amountInput, "300");
    fireEvent(amountInput, "blur");

    expect(getByText("meals:recalc_title")).toBeTruthy();

    fireEvent.press(getByText("meals:recalc_confirm"));

    expect(onCommit).not.toHaveBeenCalled();
    expect(getByDisplayValue("12")).toBeTruthy();
    expect(getByDisplayValue("84")).toBeTruthy();
    expect(getByDisplayValue("2.4")).toBeTruthy();
    expect(getByDisplayValue("396")).toBeTruthy();

    fireEvent.press(getByText("common:save_changes"));

    expect(onCommit).toHaveBeenCalledWith({
      id: "ing-6",
      name: "Rice",
      amount: 300,
      unit: "g",
      protein: 12,
      carbs: 84,
      fat: 2.4,
      kcal: 396,
    });
  });
});
