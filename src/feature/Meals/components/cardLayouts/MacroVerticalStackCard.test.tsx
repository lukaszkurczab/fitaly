import { describe, expect, it, jest } from "@jest/globals";
import MacroVerticalStackCard from "@/feature/Meals/components/cardLayouts/MacroVerticalStackCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { MacroCardProps } from "@/feature/Meals/components/CardOverlay";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      (
        {
          "meals:meal": "Meal",
          "meals:protein": "Protein",
          "meals:carbs": "Carbs",
          "meals:fat": "Fat",
        } as Record<string, string>
      )[key] ??
      options?.defaultValue ??
      key,
  }),
}));

const baseProps: MacroCardProps = {
  protein: 30,
  carbs: 40,
  fat: 20,
  kcal: 510,
  textColor: "#111111",
  bgColor: "#eeeeee",
  macroColors: {
    protein: "#00f",
    carbs: "#0f0",
    fat: "#f00",
  },
  showKcal: true,
  showMacros: true,
};

describe("MacroVerticalStackCard", () => {
  it("renders kcal and all macro rows", () => {
    const { getByText } = renderWithTheme(
      <MacroVerticalStackCard {...baseProps} />,
    );

    expect(getByText("510 kcal")).toBeTruthy();
    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("Carbs")).toBeTruthy();
    expect(getByText("Fat")).toBeTruthy();
    expect(getByText("30g")).toBeTruthy();
    expect(getByText("40g")).toBeTruthy();
    expect(getByText("20g")).toBeTruthy();
  });
});
