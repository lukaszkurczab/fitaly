import { describe, expect, it, jest } from "@jest/globals";
import { MacroTargetsRow } from "@/feature/Home/components/MacroTargetsRow";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === "string") return options;
      return options?.defaultValue ?? key;
    },
  }),
}));

describe("MacroTargetsRow", () => {
  it("renders nothing when all targets are zero", () => {
    const { toJSON } = renderWithTheme(
      <MacroTargetsRow
        macroTargets={{
          proteinGrams: 0,
          fatGrams: 0,
          carbsGrams: 0,
          proteinKcal: 0,
          fatKcal: 0,
          carbsKcal: 0,
        }}
        consumed={{ protein: 10, fat: 10, carbs: 10 }}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders grouped macro values and labels", () => {
    const { getByText } = renderWithTheme(
      <MacroTargetsRow
        macroTargets={{
          proteinGrams: 150,
          fatGrams: 60,
          carbsGrams: 220,
          proteinKcal: 600,
          fatKcal: 540,
          carbsKcal: 880,
        }}
        consumed={{ protein: 80, fat: 30, carbs: 110 }}
      />,
    );

    expect(getByText("80 / 150g")).toBeTruthy();
    expect(getByText("110 / 220g")).toBeTruthy();
    expect(getByText("30 / 60g")).toBeTruthy();
    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("Carbs")).toBeTruthy();
    expect(getByText("Fat")).toBeTruthy();
  });

  it("keeps the standard macro presentation on an empty day", () => {
    const { getByText, getAllByText } = renderWithTheme(
      <MacroTargetsRow
        macroTargets={{
          proteinGrams: 150,
          fatGrams: 60,
          carbsGrams: 220,
          proteinKcal: 600,
          fatKcal: 540,
          carbsKcal: 880,
        }}
        consumed={{ protein: 0, fat: 0, carbs: 0 }}
      />,
    );

    expect(getByText("0 / 150g")).toBeTruthy();
    expect(getByText("0 / 220g")).toBeTruthy();
    expect(getByText("0 / 60g")).toBeTruthy();
    expect(getAllByText("0%")).toHaveLength(3);
  });
});
