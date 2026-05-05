import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import CoachInsightCard from "@/feature/Home/components/CoachInsightCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { CoachInsight } from "@/services/coach/coachTypes";

const mockTrackCoachInsightViewed = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();
const mockTrackCoachInsightTapped = jest.fn<
  (input: Record<string, unknown>) => Promise<void>
>();

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackCoachInsightViewed: (input: Record<string, unknown>) =>
    mockTrackCoachInsightViewed(input),
  trackCoachInsightTapped: (input: Record<string, unknown>) =>
    mockTrackCoachInsightTapped(input),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | { defaultValue?: string },
    ) => {
      const translations: Record<string, string> = {
        "coachInsight.defaultEyebrow": "Coach insight",
        "coachInsight.showWhy": "Why this insight",
        "coachInsight.hideWhy": "Hide why",
        "coachInsight.whyTitle": "Why am I seeing this?",
        "coachInsight.cta.log_next_meal": "Log next meal",
        "coachInsight.items.under_logging.title": "Logging has been light lately",
        "coachInsight.items.under_logging.body": "There have been fewer fully logged days recently. Logging your next meal will give you a clearer picture.",
        "coachInsight.items.under_logging.whyBody": "This insight is based on recent logging consistency and how many recent days had enough meal data to interpret.",
        "coachInsight.items.stable.title": "No major pattern stands out",
        "coachInsight.items.stable.body": "There isn’t one clear issue driving today’s view. You can review your history or go deeper in chat.",
      };
      if (key in translations) {
        return translations[key];
      }
      if (typeof fallback === "string") {
        return fallback;
      }
      return fallback?.defaultValue ?? key;
    },
  }),
}));

function createInsight(overrides?: Partial<CoachInsight>): CoachInsight {
  return {
    id: "2026-03-18:under_logging",
    type: "under_logging",
    priority: 100,
    title: "Logging looks too light to coach well",
    body: "Log your next meal so today is easier to interpret and adjust.",
    actionLabel: "Log next meal",
    actionType: "log_next_meal",
    reasonCodes: ["valid_logging_days_7_low", "missing_nutrition_meals_today"],
    source: "rules",
    validUntil: "2026-03-18T23:59:59Z",
    confidence: 0.92,
    isPositive: false,
    ...overrides,
  };
}

describe("CoachInsightCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackCoachInsightViewed.mockResolvedValue(undefined);
    mockTrackCoachInsightTapped.mockResolvedValue(undefined);
  });

  it("renders the insight and triggers CTA", () => {
    const onPressCta = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(
      <CoachInsightCard
        insight={createInsight()}
        onPressCta={onPressCta}
        ctaTargetScreen="MealAddMethod"
      />,
    );

    expect(getByText("Coach insight")).toBeTruthy();
    expect(getByText("Logging has been light lately")).toBeTruthy();
    expect(getByText("There have been fewer fully logged days recently. Logging your next meal will give you a clearer picture.")).toBeTruthy();
    expect(getByText("Log next meal")).toBeTruthy();
    expect(mockTrackCoachInsightViewed).toHaveBeenCalledWith({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });

    fireEvent.press(getByTestId("coach-insight-cta"));
    expect(mockTrackCoachInsightTapped).toHaveBeenCalledWith({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });
    expect(onPressCta).toHaveBeenCalledTimes(1);
  });

  it("expands the why section with reason copy", () => {
    const { getByText, queryByText } = renderWithTheme(
      <CoachInsightCard insight={createInsight()} />,
    );

    expect(queryByText("Why am I seeing this?")).toBeNull();

    fireEvent.press(getByText("Why this insight"));

    expect(getByText("Why am I seeing this?")).toBeTruthy();
    expect(getByText("This insight is based on recent logging consistency and how many recent days had enough meal data to interpret.")).toBeTruthy();
  });

  it("hides the CTA when the insight has no action", () => {
    const { queryByTestId, getByText } = renderWithTheme(
      <CoachInsightCard
        insight={createInsight({
          type: "stable",
          actionType: "none",
          actionLabel: null,
        })}
      />,
    );

    expect(getByText("Coach insight")).toBeTruthy();
    expect(getByText("No major pattern stands out")).toBeTruthy();
    expect(getByText("There isn’t one clear issue driving today’s view. You can review your history or go deeper in chat.")).toBeTruthy();
    expect(queryByTestId("coach-insight-cta")).toBeNull();
  });

  it("renders card on mount", () => {
    renderWithTheme(
      <CoachInsightCard insight={createInsight()} freshness="degraded" />,
    );

    expect(mockTrackCoachInsightViewed).toHaveBeenCalledWith({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "degraded",
    });
  });
});
