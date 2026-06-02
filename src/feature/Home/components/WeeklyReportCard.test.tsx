import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import WeeklyReportCard from "@/feature/Home/components/WeeklyReportCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import enHome from "@/locales/en/home.json";
import plHome from "@/locales/pl/home.json";
import type { WeeklyReport } from "@/services/weeklyReport/weeklyReportTypes";

const translations: Record<string, string> = {
  "weeklyReport.eyebrow": "Weekly report",
  "weeklyReport.openCta": "Open weekly report",
  "weeklyReport.closedWeekPill": "Closed week",
  "weeklyReport.temporarilyUnavailablePill": "Temporarily unavailable",
  "weeklyReport.needsMoreSignalPill": "Needs more signal",
  "weeklyReport.unavailablePill": "Unavailable",
  "weeklyReport.preparingPill": "Preparing",
  "weeklyReport.cardRetryingPill": "Checking",
  "weeklyReport.cardRetryingTitle": "Checking the report",
  "weeklyReport.cardRetryingBody": "This should only take a moment.",
  "weeklyReport.cardRetryingCta": "Checking again",
  "weeklyReport.reflectionReadyFallback": "Your weekly reflection is ready.",
  "weeklyReport.cardInsightTitle.consistency": "Keep the rhythm",
  "weeklyReport.cardInsightTitle.loggingCoverage": "Fill in the gaps",
  "weeklyReport.cardInsightTitle.startOfDayPattern": "Start days steadier",
  "weeklyReport.cardInsightTitle.dayCompletionPattern": "Close days fully",
  "weeklyReport.cardInsightTitle.weekendDrift": "Watch the weekend",
  "weeklyReport.cardInsightTitle.improvingTrend": "Momentum is building",
  "weeklyReport.cardTitleInsufficient": "This closed week needs a little more signal.",
  "weeklyReport.cardTitleUnavailable": "Couldn't load the report",
  "weeklyReport.cardBodyReady": "Open the closed-week read.",
  "weeklyReport.cardBodyInsufficient": "A fuller closed week usually unlocks this naturally.",
  "weeklyReport.cardBodyUnavailable": "Try again in a moment.",
  "weeklyReport.tryAgain": "Try again",
  "weeklyReport.accessibilityRefresh": "Refresh weekly report",
  "weeklyReport.loadingTitle": "Composing your weekly reflection",
  "weeklyReport.loadingReadingClosed": "Reading the last closed week first.",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, options?: { defaultValue?: string }) =>
      translations[key] ?? options?.defaultValue ?? key,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name, rotation }: { name: string; rotation?: string }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{`icon:${name}:${rotation ?? "none"}`}</Text>;
  },
}));

function createReport(overrides?: Partial<WeeklyReport>): WeeklyReport {
  return {
    status: "ready",
    period: { startDay: "2026-05-25", endDay: "2026-05-31" },
    summary: "Ready summary.",
    insights: [],
    priorities: [],
    ...overrides,
  };
}

describe("WeeklyReportCard", () => {
  it("renders ready reports with localized insight headlines instead of raw backend titles", () => {
    const onPress = jest.fn();
    const rawBackendTitle = "Regular logging";
    const { getByText, queryByText, getByTestId } = renderWithTheme(
      <WeeklyReportCard
        loading={false}
        report={createReport({
          summary: "Longer generated weekly summary.",
          insights: [
            {
              type: "consistency",
              importance: "high",
              tone: "positive",
              title: rawBackendTitle,
              body: "Most meals were logged close to your usual rhythm.",
              reasonCodes: ["consistent_logging"],
            },
          ],
        })}
        action="open"
        onPress={onPress}
      />,
    );

    expect(queryByText("Closed week")).toBeNull();
    expect(getByText("Keep the rhythm")).toBeTruthy();
    expect(queryByText(rawBackendTitle)).toBeNull();
    expect(queryByText("Longer generated weekly summary.")).toBeNull();
    expect(getByText("Open weekly report")).toBeTruthy();
    expect(getByText("icon:chevron:180deg")).toBeTruthy();

    fireEvent.press(getByTestId("weekly-report-card"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses a bounded localized fallback when no mapped insight type exists", () => {
    const { getByText, queryByText } = renderWithTheme(
      <WeeklyReportCard
        loading={false}
        report={createReport()}
        action="open"
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Your weekly reflection is ready.")).toBeTruthy();
    expect(queryByText("Ready summary.")).toBeNull();
  });

  it("renders unavailable reports as retry actions without an open-report CTA", () => {
    const onPress = jest.fn();
    const { getByText, queryByText, getByTestId } = renderWithTheme(
      <WeeklyReportCard
        loading={false}
        report={createReport({
          status: "not_available",
          summary: null,
        })}
        action="retry"
        onPress={onPress}
      />,
    );

    expect(getByText("Temporarily unavailable")).toBeTruthy();
    expect(getByText("Couldn't load the report")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
    expect(queryByText("Open weekly report")).toBeNull();
    expect(getByText("icon:refresh:none")).toBeTruthy();

    fireEvent.press(getByTestId("weekly-report-card"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps the unavailable card visible with a stable retrying state", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(
      <WeeklyReportCard
        loading
        report={createReport({
          status: "not_available",
          summary: null,
        })}
        action="retry"
        onPress={onPress}
      />,
    );

    expect(getByText("Checking")).toBeTruthy();
    expect(getByText("Checking the report")).toBeTruthy();
    expect(getByText("This should only take a moment.")).toBeTruthy();
    expect(getByText("Checking again")).toBeTruthy();
    expect(getByTestId("weekly-report-card-loading-indicator")).toBeTruthy();

    fireEvent.press(getByTestId("weekly-report-card"));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps unavailable Home-card locale copy aligned with retry semantics", () => {
    expect(enHome.weeklyReport.cardBodyUnavailable).not.toMatch(/\bopen\b/i);
    expect(plHome.weeklyReport.cardBodyUnavailable).not.toMatch(/\botw[oó]rz\b/i);
    expect(enHome.weeklyReport.temporarilyUnavailablePill).toBe(
      "Temporarily unavailable",
    );
    expect(plHome.weeklyReport.temporarilyUnavailablePill).toBe(
      "Chwilowo niedostępny",
    );
    expect(enHome.weeklyReport.cardTitleUnavailable).toBe(
      "Couldn't load the report",
    );
    expect(plHome.weeklyReport.cardTitleUnavailable).toBe(
      "Nie udało się załadować raportu",
    );
    expect(enHome.weeklyReport.tryAgain).toBe("Try again");
    expect(plHome.weeklyReport.tryAgain).toBe("Spróbuj ponownie");
  });
});
