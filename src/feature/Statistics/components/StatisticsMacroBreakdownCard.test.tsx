import { describe, expect, it, jest } from "@jest/globals";
import { StatisticsMacroBreakdownCard } from "@/feature/Statistics/components/StatisticsMacroBreakdownCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => {
  const translations: Record<string, string> = {
    "statistics:macroBreakdownTitle": "Macronutrients",
    "statistics:macroBreakdownDescription":
      "Average from days with meals against your target.",
    "statistics:tiles.protein": "Protein",
    "statistics:tiles.carbs": "Carbs",
    "statistics:tiles.fat": "Fat",
    "statistics:macro.target": "Goal: {{value}} {{unit}}",
    "statistics:macro.share": "{{percent}}% share",
    "common:gram": "g",
  };

  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string | number>) =>
        (translations[key] ?? key)
          .replace("{{value}}", String(options?.value ?? ""))
          .replace("{{unit}}", String(options?.unit ?? ""))
          .replace("{{percent}}", String(options?.percent ?? "")),
    }),
  };
});

jest.mock("@/components/AppIcon", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => createElement(Text, null, name),
  };
});

describe("StatisticsMacroBreakdownCard", () => {
  it("shows macro targets with precise daily progress rows", () => {
    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <StatisticsMacroBreakdownCard
        protein={20}
        carbs={49}
        fat={12}
        targets={{ proteinGrams: 80, carbsGrams: 100, fatGrams: 60 }}
      />,
    );

    expect(getByTestId("statistics-macro-breakdown-card")).toBeTruthy();
    expect(getByTestId("statistics-macro-row-protein")).toBeTruthy();
    expect(getByTestId("statistics-macro-row-carbs")).toBeTruthy();
    expect(getByTestId("statistics-macro-row-fat")).toBeTruthy();

    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("25%")).toBeTruthy();
    expect(getByText("20 g")).toBeTruthy();
    expect(getByText("Goal: 80 g")).toBeTruthy();

    expect(getByText("Carbs")).toBeTruthy();
    expect(getByText("49%")).toBeTruthy();
    expect(getByText("49 g")).toBeTruthy();
    expect(getByText("Goal: 100 g")).toBeTruthy();

    expect(getByText("Fat")).toBeTruthy();
    expect(getByText("20%")).toBeTruthy();
    expect(getByText("12 g")).toBeTruthy();
    expect(getByText("Goal: 60 g")).toBeTruthy();

    expect(queryByText("25% - 20 g")).toBeNull();
  });
});
