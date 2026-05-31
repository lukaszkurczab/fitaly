import { describe, expect, it, jest } from "@jest/globals";
import { StatisticsSummaryCard } from "@/feature/Statistics/components/StatisticsSummaryCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("react-i18next", () => {
  const translations: Record<string, string> = {
    "statistics:summary.title.7d": "This week",
    "statistics:summary.average": "Daily average",
    "statistics:summary.progressValue": "{{percent}}% of goal",
    "statistics:summary.targetValue": "Goal {{value}} {{unit}}",
    "statistics:summary.goalLabel": "goal",
    "statistics:summary.loggedDays": "{{logged}}/{{total}} days with meals",
    "statistics:summary.daysLabel": "Days with meals",
    "statistics:summary.daysValue": "{{logged}} of {{total}}",
    "statistics:summary.comparison.7d": "Previous week",
    "statistics:summary.comparisonUnavailable": "No data",
    "common:kcal": "kcal",
  };

  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string | number>) =>
        (translations[key] ?? key)
          .replace("{{percent}}", String(options?.percent ?? ""))
          .replace("{{value}}", String(options?.value ?? ""))
          .replace("{{unit}}", String(options?.unit ?? ""))
          .replace("{{logged}}", String(options?.logged ?? ""))
          .replace("{{total}}", String(options?.total ?? "")),
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

jest.mock("react-native-svg", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native");

  const makeSvgMock = (displayName: string, testID: string) => {
    const SvgMock = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement(MockView, { ...props, testID }, children);
    SvgMock.displayName = displayName;
    return SvgMock;
  };

  return {
    __esModule: true,
    Svg: makeSvgMock("Svg", "svg-root"),
    Circle: makeSvgMock("Circle", "svg-circle"),
  };
});

describe("StatisticsSummaryCard", () => {
  it("renders goal progress and previous-range comparison", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <StatisticsSummaryCard
        activeRange="7d"
        avgKcal={1567}
        calorieTarget={2200}
        calorieGoalProgress={71}
        loggedDaysCount={5}
        rangeDaysCount={7}
        comparison={{
          previousRange: {
            startDayKey: "2026-03-05",
            endDayKey: "2026-03-11",
          },
          previousAverages: null,
          kcalAverageDelta: 167,
          kcalAverageDeltaPercent: 12,
          hasPreviousEntries: true,
        }}
      />,
    );

    expect(getByTestId("statistics-summary-card")).toBeTruthy();
    expect(getByText("This week")).toBeTruthy();
    expect(getByText("1567")).toBeTruthy();
    expect(getByTestId("statistics-summary-ring")).toBeTruthy();
    expect(getByText("71%")).toBeTruthy();
    expect(getByText("goal")).toBeTruthy();
    expect(getByText("5/7 days with meals")).toBeTruthy();
    expect(getByText("Previous week")).toBeTruthy();
    expect(getByText("+12%")).toBeTruthy();
  });
});
