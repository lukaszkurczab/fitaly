import { describe, expect, it, jest } from "@jest/globals";
import { StatisticsTrendCard } from "@/feature/Statistics/components/StatisticsTrendCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => {
  const translations: Record<string, string> = {
    "statistics:chips.calories": "kcal",
    "statistics:chips.protein": "Protein",
    "statistics:chips.carbs": "Carbs",
    "statistics:chips.fat": "Fat",
    "statistics:trend.chartTitle.kcal": "Calorie trend",
    "statistics:trend.chartTitle.fat": "Fat trend",
    "statistics:trend.legend.kcal": "Average kcal",
    "statistics:trend.legend.fat": "Fat",
    "statistics:trend.legend.target": "Goal",
  };

  return {
    useTranslation: () => ({
      t: (key: string) => translations[key] ?? key,
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

jest.mock("@/feature/Statistics/components/StatisticsTrendChart", () => ({
  StatisticsTrendChart: ({ targetValue }: { targetValue?: number | null }) => {
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, `target:${String(targetValue ?? "")}`);
  },
}));

describe("StatisticsTrendCard", () => {
  it("passes the calorie target to the chart for kcal", () => {
    const { getByText } = renderWithTheme(
      <StatisticsTrendCard
        metric="kcal"
        labels={["Mon", "Tue"]}
        series={[1200, 1400]}
        calorieTarget={2200}
        macroTargets={{ proteinGrams: 120, carbsGrams: 250, fatGrams: 70 }}
        onChangeMetric={jest.fn()}
      />,
    );

    expect(getByText("target:2200")).toBeTruthy();
    expect(getByText("Goal")).toBeTruthy();
  });

  it("passes the selected macro target to the chart for macro metrics", () => {
    const { getByText } = renderWithTheme(
      <StatisticsTrendCard
        metric="fat"
        labels={["Mon", "Tue"]}
        series={[0, 12]}
        calorieTarget={2200}
        macroTargets={{ proteinGrams: 120, carbsGrams: 250, fatGrams: 70 }}
        onChangeMetric={jest.fn()}
      />,
    );

    expect(getByText("target:70")).toBeTruthy();
    expect(getByText("Goal")).toBeTruthy();
  });
});
