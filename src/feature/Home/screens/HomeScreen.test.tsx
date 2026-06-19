import React from "react";
import type { ReactTestInstance } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Pressable as mockPressable,
  StyleSheet,
  Text as mockText,
  View as mockView,
} from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import HomeScreen from "@/feature/Home/screens/HomeScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockReact = React;

const mockUseMeals = jest.fn();
const mockUseUserProfileContext = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUsePremiumContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseMealAddMethodState = jest.fn();
const mockLoadDraft = jest.fn<(uid: string) => Promise<void>>();
const mockUseWeeklyReport = jest.fn();
const mockUseCoach = jest.fn();
const mockGetSyncCounts =
  jest.fn<(...args: unknown[]) => Promise<{ dead: number; pending: number }>>();
const mockGetDeadLetterOps =
  jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockRetryDeadLetterOps =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockGetFailedUploadCount =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockRetryFailedUploads =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockDiscardFailedUploads =
  jest.fn<(...args: unknown[]) => Promise<number>>();
const mockRequestSync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEmit = jest.fn<(...args: unknown[]) => void>();
const mockTrackHomeNextActionShown =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockTrackHomeNextActionStarted =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockTrackHomeNextActionDismissed =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEventHandlers = new Map<string, Set<(payload?: unknown) => void>>();
const mockFocusEffectCallbacks: Array<() => void | (() => void)> = [];

const HOME_MEAL_DEAD_LETTER_KINDS = [
  "upsert",
  "delete",
  "upsert_mymeal",
  "delete_mymeal",
];
const HOME_RECOVERY_TEST_IDS = [
  "home-dead-letter-recovery",
  "home-photo-upload-recovery",
];

function getVisibleRecoveryTestIds(
  views: ReactTestInstance[],
): string[] {
  return views
    .map((view) => view.props.testID)
    .filter(
      (testID): testID is string =>
        typeof testID === "string" &&
        HOME_RECOVERY_TEST_IDS.includes(testID),
    );
}

function emitMockEvent(eventName: string, payload?: unknown) {
  const handlers = mockEventHandlers.get(eventName);
  if (!handlers) return;
  for (const handler of Array.from(handlers)) {
    handler(payload);
  }
}

jest.mock("@/hooks/useMeals", () => ({
  useMeals: (uid: string | null | undefined) => mockUseMeals(uid),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserProfileContext(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/PremiumContext", () => ({
  usePremiumContext: () => mockUsePremiumContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@/context/MealDraftContext", () => ({
  getDraftKey: (uid: string) => `draft:${uid}`,
  getScreenKey: (uid: string) => `screen:${uid}`,
  useMealDraftContext: () => ({
    loadDraft: (uid: string) => mockLoadDraft(uid),
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusEffectCallbacks.push(callback);
  },
}));

jest.mock("@/feature/Meals/hooks/useMealAddMethodState", () => ({
  useMealAddMethodState: (params: unknown) => mockUseMealAddMethodState(params),
}));

jest.mock("@/hooks/useWeeklyReport", () => ({
  useWeeklyReport: (params: unknown) => mockUseWeeklyReport(params),
}));

jest.mock("@/hooks/useCoach", () => ({
  useCoach: (params: unknown) => mockUseCoach(params),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  getSyncCounts: (...args: unknown[]) => mockGetSyncCounts(...args),
  getDeadLetterOps: (...args: unknown[]) => mockGetDeadLetterOps(...args),
  retryDeadLetterOps: (...args: unknown[]) => mockRetryDeadLetterOps(...args),
}));

jest.mock("@/services/offline/images.repo", () => ({
  discardFailedUploads: (...args: unknown[]) =>
    mockDiscardFailedUploads(...args),
  getFailedUploadCount: (...args: unknown[]) => mockGetFailedUploadCount(...args),
  retryFailedUploads: (...args: unknown[]) => mockRetryFailedUploads(...args),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  requestSync: (...args: unknown[]) => mockRequestSync(...args),
}));

jest.mock("@/services/core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  on: (eventName: string, handler: (payload?: unknown) => void) => {
    const handlers = mockEventHandlers.get(eventName) ?? new Set();
    handlers.add(handler);
    mockEventHandlers.set(eventName, handlers);
    return () => {
      handlers.delete(handler);
    };
  },
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackHomeNextActionShown: (...args: unknown[]) =>
    mockTrackHomeNextActionShown(...args),
  trackHomeNextActionStarted: (...args: unknown[]) =>
    mockTrackHomeNextActionStarted(...args),
  trackHomeNextActionDismissed: (...args: unknown[]) =>
    mockTrackHomeNextActionDismissed(...args),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (
      key: string,
      options?:
        | string
        | {
            count?: number;
            method?: string;
            defaultValue?: string;
            name?: string;
            pending?: number;
            operation?: string;
          },
    ) => {
      if (typeof options === "string") {
        return options;
      }
      if (key === "meals:photoTitle") return "Photo";
      if (key === "meals:textTitle") return "Describe meal";
      if (key === "meals:barcodeTitle") return "Barcode";
      if (key === "meals:savedTitle") return "Saved meals";
      if (key === "home:methodSelector") return `Method: ${options?.method}`;
      if (key === "home:chooseAddMethod") return "Choose how to add";
      if (key === "home:nextAction.reviewDraft.title") {
        return "Finish reviewing your meal";
      }
      if (key === "home:nextAction.reviewDraft.description") {
        return "You have an unfinished meal ready to review.";
      }
      if (key === "home:nextAction.reviewDraft.cta") return "Continue";
      if (key === "home:nextAction.dismiss") return "Not now";
      if (key === "home:planningEntry.title") return "Plan next meals";
      if (key === "home:planningEntry.description") {
        return "Prepare 1-3 days without logging anything yet.";
      }
      if (key === "home:mealCount") {
        return options?.count === 1 ? "1 meal" : `${options?.count ?? 0} meals`;
      }
      if (key === "home:hero.greeting.morning") return `Good morning, ${options?.name}`;
      if (key === "home:hero.greeting.afternoon") return `Good afternoon, ${options?.name}`;
      if (key === "home:hero.greeting.evening") return `Good evening, ${options?.name}`;
      if (key === "home:hero.greetingGeneric.morning") return "Good morning";
      if (key === "home:hero.greetingGeneric.afternoon") return "Good afternoon";
      if (key === "home:hero.greetingGeneric.evening") return "Good evening";
      if (key === "home:hero.todayEmpty.cta") return "Log breakfast";
      if (key === "home:hero.todayEmpty.supportCopy") {
        return "Small steps each day lead to bigger changes.";
      }
      if (key === "home:hero.todayInProgress.cta") return "Log next meal";
      if (key === "home:hero.methodCta.photo") return "Take meal photo";
      if (key === "home:hero.methodCta.text") return "Describe meal";
      if (key === "home:hero.methodCta.barcode") return "Scan barcode";
      if (key === "home:hero.methodCta.saved") return "Use saved meal";
      if (key === "home:hero.methodCta.manual") return "Enter manually";
      if (key === "home:hero.methodCta.default") return "Add meal";
      if (key === "common:retry") return "Retry";
      if (key === "common:unknownError") return "Something went wrong.";
      if (key === "history.deadLetterTitle") {
        return `${options?.count ?? 0} meal changes need retry.`;
      }
      if (key === "history.deadLetterSubtitle") {
        return `Retry sends them back to sync. Pending meal changes: ${
          options?.pending ?? 0
        }.`;
      }
      if (key === "history.deadLetterSubtitleWithLast") {
        return `Retry sends them back to sync. Pending meal changes: ${
          options?.pending ?? 0
        }. Last failed: ${options?.operation}.`;
      }
      if (key === "history.photoUploadRecoveryTitle") {
        return `${options?.count ?? 0} meal photo upload needs retry.`;
      }
      if (key === "history.photoUploadRecoverySubtitle") {
        return "Your meal is saved, but the photo upload needs recovery before it can appear on synced devices.";
      }
      if (key === "history.photoUploadRetryQueued") {
        return `${options?.count ?? 0} failed photo upload queued for retry.`;
      }
      if (key === "history.photoUploadDiscardAction") return "Stop retrying";
      if (key === "history.photoUploadDiscarded") {
        return `${options?.count ?? 0} failed photo upload will no longer retry.`;
      }
      if (key === "history.deadLetterOperation.upsert") return "meal update";
      if (key === "history.deadLetterOperation.delete") return "meal delete";
      if (key === "history.deadLetterOperation.upsert_mymeal") {
        return "saved meal update";
      }
      if (key === "history.deadLetterOperation.delete_mymeal") {
        return "saved meal delete";
      }
      if (key === "home:hero.pastIncomplete.meta") return "You missed a meal log";
      if (key === "home:hero.pastIncomplete.cta") return "Add a missed meal";
      if (key === "home:hero.pastIncomplete.supportCopy") {
        return "You can still fill in what was missing.";
      }
      if (key === "home:hero.completed.title") return `Goal reached, ${options?.name}`;
      if (key === "home:hero.completed.titleGeneric") return "Goal reached";
      if (key === "home:hero.completed.cta") return "Review your day";
      if (key === "home:hero.completed.support") return "See your full breakdown for today";
      if (key === "home:viewHistory") return "See full history";
      return options?.defaultValue ?? key;
    },
  }),
}));

jest.mock("@/components", () => {
  const { createElement, Fragment } =
    jest.requireActual<typeof import("react")>("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Layout: ({ children }: { children: React.ReactNode }) =>
      createElement(Fragment, null, children),
    Modal: ({
      visible,
      title,
      primaryAction,
      secondaryAction,
    }: {
      visible: boolean;
      title?: string;
      primaryAction?: { label: string; onPress?: () => void };
      secondaryAction?: { label: string; onPress?: () => void };
    }) =>
      visible
        ? createElement(
            MockView,
            null,
            title ? createElement(MockText, null, title) : null,
            primaryAction
              ? createElement(
                  MockPressable,
                  { onPress: primaryAction.onPress },
                  createElement(MockText, null, primaryAction.label),
                )
              : null,
            secondaryAction
              ? createElement(
                  MockPressable,
                  { onPress: secondaryAction.onPress },
                  createElement(MockText, null, secondaryAction.label),
                )
              : null,
          )
        : null,
  };
});

jest.mock("@/components/WeekStrip", () => ({
  __esModule: true,
  default: ({
    onSelect,
  }: {
    onSelect: (date: Date) => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress: () => onSelect(new Date("2026-03-17T12:00:00.000Z")) },
      mockReact.createElement(mockText, null, "pick-2026-03-17"),
    ),
}));

jest.mock("../components/HomeHeroCard", () => ({
  __esModule: true,
  default: ({
    title,
    meta,
    ctaLabel,
    methodLabel,
    methodIcon,
    progress,
    supportText,
    onPressCta,
    onPressMethodSelector,
  }: {
    title: string;
    meta: string;
    ctaLabel: string;
    methodLabel?: string;
    methodIcon?: string;
    progress?: number | null;
    supportText?: string | null;
    onPressCta: () => void;
    onPressMethodSelector?: () => void;
  }) =>
    mockReact.createElement(
      mockView,
      null,
      mockReact.createElement(mockText, null, title),
      mockReact.createElement(mockText, null, meta),
      mockReact.createElement(
        mockPressable,
        { onPress: onPressCta },
        mockReact.createElement(mockText, null, ctaLabel),
      ),
      methodIcon
        ? mockReact.createElement(mockText, null, `cta-icon:${methodIcon}`)
        : null,
      methodLabel
        ? mockReact.createElement(
            mockPressable,
            { onPress: onPressMethodSelector },
            mockReact.createElement(mockText, null, methodLabel),
          )
        : null,
      typeof progress === "number"
        ? mockReact.createElement(
            mockText,
            null,
            `hero-progress:${progress.toFixed(2)}`,
          )
        : null,
      supportText
        ? mockReact.createElement(mockText, null, supportText)
        : null,
    ),
}));

jest.mock("../components/MacroTargetsRow", () => ({
  MacroTargetsRow: ({
    macroTargets,
    consumed,
  }: {
    macroTargets: { proteinGrams: number; fatGrams: number; carbsGrams: number };
    consumed: { protein: number; fat: number; carbs: number };
  }) =>
    mockReact.createElement(
      mockText,
      null,
      `macro-targets:${macroTargets.proteinGrams}/${macroTargets.fatGrams}/${macroTargets.carbsGrams};consumed:${consumed.protein}/${consumed.fat}/${consumed.carbs}`,
    ),
}));

jest.mock("../components/TodaysMealsList", () => ({
  TodaysMealsList: ({
    meals,
  }: {
    meals: Array<{ name?: string | null; syncState?: string }>;
  }) =>
    mockReact.createElement(
      mockView,
      null,
      mockReact.createElement(
        mockText,
        null,
        `meals:${meals.length}:${meals
          .map((meal) => `${meal.name ?? ""}/${meal.syncState ?? ""}`)
          .join("|")}`,
      ),
    ),
}));

jest.mock("../components/WeeklyReportCard", () => ({
  __esModule: true,
  default: ({
    loading,
    report,
    action,
    onPress,
  }: {
    loading: boolean;
    report: { status: string };
    action: "open" | "retry";
    onPress: () => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress },
      mockReact.createElement(
        mockText,
        null,
        `weekly-report-card:${loading ? "loading" : action}:${report.status}`,
      ),
    ),
}));

jest.mock("../components/CoachInsightCard", () => ({
  __esModule: true,
  default: ({
    insight,
    onPressCta,
  }: {
    insight: { title: string; actionType: string };
    onPressCta?: () => void;
  }) =>
    mockReact.createElement(
      mockPressable,
      { onPress: onPressCta },
      mockReact.createElement(
        mockText,
        null,
        `coach-insight-card:${insight.title}:${insight.actionType}`,
      ),
    ),
}));

type NavigationMock = {
  navigate: jest.Mock;
};

function createNavigation(): NavigationMock {
  return {
    navigate: jest.fn(),
  };
}

function createMeal(overrides: Record<string, unknown> = {}) {
  return {
    userUid: "user-1",
    mealId: "meal-1",
    timestamp: new Date("2026-03-18T10:00:00.000Z").getTime(),
    dayKey: "2026-03-18",
    type: "breakfast",
    name: "Breakfast",
    ingredients: [],
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:00:00.000Z",
    syncState: "synced",
    source: "manual",
    totals: { kcal: 500, protein: 25, fat: 15, carbs: 45 },
    ...overrides,
  };
}

async function runLatestFocusEffect() {
  const callback = mockFocusEffectCallbacks[mockFocusEffectCallbacks.length - 1];
  await act(async () => {
    callback?.();
    await Promise.resolve();
  });
}

async function storeReviewDraft() {
  await AsyncStorage.setItem(
    "draft:user-1",
    JSON.stringify(
      createMeal({
        mealId: "draft-1",
        syncState: "pending",
        ingredients: [
          {
            id: "ingredient-1",
            name: "Oats",
            amount: 80,
            unit: "g",
            kcal: 300,
            protein: 10,
            fat: 6,
            carbs: 52,
          },
        ],
      }),
    ),
  );
  await AsyncStorage.setItem("screen:user-1", "AddMeal");
}

function createCoachInsight(overrides: Record<string, unknown> = {}) {
  return {
    id: "2026-03-18:stable",
    type: "stable",
    priority: 80,
    title: "Ask coach about today",
    body: "Today has enough signal for a short check-in.",
    actionLabel: "Open chat",
    actionType: "open_chat",
    reasonCodes: ["day_signal_ready"],
    source: "rules",
    validUntil: "2026-03-18T23:59:59Z",
    confidence: 0.8,
    isPositive: false,
    ...overrides,
  };
}

function createCoachResponse(topInsight: ReturnType<typeof createCoachInsight> | null = null) {
  return {
    dayKey: "2026-03-18",
    computedAt: "2026-03-18T08:00:00.000Z",
    source: "rules",
    insights: topInsight ? [topInsight] : [],
    topInsight,
    meta: {
      available: !!topInsight,
      emptyReason: topInsight ? null : "no_data",
      isDegraded: false,
    },
  };
}

describe("HomeScreen", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T08:00:00.000Z"));
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockEventHandlers.clear();
    mockFocusEffectCallbacks.length = 0;
    mockLoadDraft.mockResolvedValue(undefined);
    mockGetSyncCounts.mockResolvedValue({ dead: 0, pending: 0 });
    mockGetDeadLetterOps.mockResolvedValue([]);
    mockRetryDeadLetterOps.mockResolvedValue(0);
    mockGetFailedUploadCount.mockResolvedValue(0);
    mockRetryFailedUploads.mockResolvedValue(0);
    mockDiscardFailedUploads.mockResolvedValue(0);
    mockRequestSync.mockResolvedValue(undefined);
    mockTrackHomeNextActionShown.mockResolvedValue(undefined);
    mockTrackHomeNextActionStarted.mockResolvedValue(undefined);
    mockTrackHomeNextActionDismissed.mockResolvedValue(undefined);

    mockUseUserProfileContext.mockReturnValue({
      userData: {
        username: "Anna",
        profile: {
          language: "en",
          readiness: {
            status: "ready",
            onboardingCompletedAt: "2026-03-18T08:00:00.000Z",
            readyAt: "2026-03-18T08:00:00.000Z",
          },
          nutritionProfile: {
            calorieTarget: 2000,
            preferences: [],
            goal: "maintain",
          },
          aiPreferences: {
            stylePersona: "calm_guide",
          },
          aiConsent: {
            status: "not_granted",
            grantedAt: null,
            revokedAt: null,
          },
        },
      },
    });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUsePremiumContext.mockReturnValue({ isPremium: true });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn((feature: string) => feature === "weeklyReport"),
      getFeature: jest.fn(),
    });
    mockUseMeals.mockReturnValue({
      meals: [],
      getMeals: jest.fn(),
    });
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart: jest.fn(async () => undefined),
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "ready",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: "Weekday rhythm carried most of the week.",
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      error: null,
      refresh: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(),
      loading: false,
      enabled: false,
      source: "disabled",
      status: "disabled",
      isStale: true,
      error: null,
      refresh: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the empty today state and starts the preferred method from the hero CTA", async () => {
    const navigation = createNavigation();
    const handleDirectStart = jest.fn(async () => undefined);
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart,
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Good morning, Anna")).toBeTruthy();
    expect(getByText("Take meal photo")).toBeTruthy();
    expect(getByText("cta-icon:camera")).toBeTruthy();
    expect(getByText("Choose how to add")).toBeTruthy();
    expect(getByText("Small steps each day lead to bigger changes.")).toBeTruthy();
    expect(queryByText(/^weekly-report-card:/)).toBeNull();
    expect(queryByText(/^meals:1:/)).toBeNull();

    fireEvent.press(getByText("Take meal photo"));

    await waitFor(() => {
      expect(handleDirectStart).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText("Choose how to add"));

    expect(navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "persistDefault",
    });

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(mockUseCoach).toHaveBeenCalledWith({
      uid: "user-1",
      dayKey: "2026-03-18",
      active: false,
    });
  });

  it("uses the preferred text method presentation for the Home hero CTA", () => {
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "text",
        icon: "assistant",
        titleKey: "textTitle",
      },
      showResumeModal: false,
      handleDirectStart: jest.fn(async () => undefined),
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Describe meal")).toBeTruthy();
    expect(getByText("cta-icon:text")).toBeTruthy();
  });

  it("renders the in-progress today state with subtle progress and meals list", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Take meal photo")).toBeTruthy();
    expect(getByText("hero-progress:0.25")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:25/15/45")).toBeTruthy();
    expect(getByText(/^meals:1:/)).toBeTruthy();

    fireEvent.press(getByTestId("home-view-history-button"));
    expect(navigation.navigate).toHaveBeenCalledWith("HistoryList");
  });

  it("shows pending, failed and conflict meals from the canonical day state in list and progress", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "pending-meal",
          cloudId: "pending-cloud",
          name: "Pending meal",
          syncState: "pending",
          totals: { kcal: 500, protein: 25, fat: 15, carbs: 45 },
        }),
        createMeal({
          mealId: "failed-meal",
          cloudId: "failed-cloud",
          name: "Failed meal",
          syncState: "failed",
          totals: { kcal: 400, protein: 20, fat: 10, carbs: 50 },
        }),
        createMeal({
          mealId: "conflict-meal",
          cloudId: "conflict-cloud",
          name: "Conflict meal",
          syncState: "conflict",
          totals: { kcal: 300, protein: 15, fat: 9, carbs: 35 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(
      getByText(
        "meals:3:Pending meal/pending|Failed meal/failed|Conflict meal/conflict",
      ),
    ).toBeTruthy();
    expect(getByText("hero-progress:0.60")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:60/34/130")).toBeTruthy();
  });

  it("uses canonical dayKey for the selected day when list and progress update from pending meals", () => {
    const getMeals = jest.fn();
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "late-pending",
          cloudId: "late-pending",
          name: "Late pending",
          dayKey: "2026-03-17",
          timestamp: "2026-03-18T01:30:00.000Z",
          syncState: "pending",
          totals: { kcal: 400, protein: 30, fat: 10, carbs: 45 },
        }),
        createMeal({
          mealId: "timestamp-neighbor",
          cloudId: "timestamp-neighbor",
          name: "Timestamp neighbor",
          dayKey: "2026-03-18",
          timestamp: "2026-03-17T12:00:00.000Z",
          totals: { kcal: 900, protein: 70, fat: 30, carbs: 95 },
        }),
      ],
      getMeals,
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("meals:1:Late pending/pending")).toBeTruthy();
    expect(getByText("hero-progress:0.20")).toBeTruthy();
    expect(getByText("macro-targets:125/65/225;consumed:30/10/45")).toBeTruthy();
    expect(queryByText(/Timestamp neighbor/)).toBeNull();
    expect(getMeals).not.toHaveBeenCalled();
  });

  it("does not trigger an extra meals reload from the screen layer", async () => {
    const getMeals = jest.fn();
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals,
    });

    const navigation = createNavigation();
    renderWithTheme(<HomeScreen navigation={navigation as never} />);

    await waitFor(() => {
      expect(mockUseMeals).toHaveBeenCalledWith("user-1");
    });

    expect(getMeals).not.toHaveBeenCalled();
  });

  it("does not render the Home dead-letter recovery surface when there are no dead letters", async () => {
    const navigation = createNavigation();
    const { queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledWith("user-1", {
        kinds: HOME_MEAL_DEAD_LETTER_KINDS,
      });
    });

    expect(queryByTestId("home-dead-letter-recovery")).toBeNull();
    expect(queryByTestId("home-photo-upload-recovery")).toBeNull();
  });

  it("opens Planning from Home without starting meal logging or draft resume", async () => {
    const handleDirectStart = jest.fn(async () => undefined);
    const handleContinueDraft = jest.fn(async () => undefined);
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart,
      handleContinueDraft,
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Plan next meals")).toBeTruthy();
    expect(
      getByText("Prepare 1-3 days without logging anything yet."),
    ).toBeTruthy();

    fireEvent.press(getByTestId("home-planning-entry"));

    expect(navigation.navigate).toHaveBeenCalledWith("Planning");
    expect(handleDirectStart).not.toHaveBeenCalled();
    expect(handleContinueDraft).not.toHaveBeenCalled();
    expect(mockLoadDraft).not.toHaveBeenCalled();
  });

  it("renders a compact review draft next action after recovery banners and continues to AddMeal review", async () => {
    await storeReviewDraft();
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 1 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "upsert" }]);
    const handleContinueDraft = jest.fn(async () => undefined);
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: false,
      handleDirectStart: jest.fn(async () => undefined),
      handleContinueDraft,
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const navigation = createNavigation();
    const { UNSAFE_getAllByType, getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });

    const visibleSurfaceIds = UNSAFE_getAllByType(mockView)
      .map((view) => view.props.testID)
      .filter(
        (testID): testID is string =>
          testID === "home-dead-letter-recovery" ||
          testID === "home-next-action-prompt",
      );
    expect(visibleSurfaceIds).toEqual([
      "home-dead-letter-recovery",
      "home-next-action-prompt",
    ]);
    expect(getByText("Finish reviewing your meal")).toBeTruthy();
    expect(getByText("You have an unfinished meal ready to review.")).toBeTruthy();
    expect(mockTrackHomeNextActionShown).toHaveBeenCalledTimes(1);
    expect(mockTrackHomeNextActionShown).toHaveBeenCalledWith({
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });

    fireEvent.press(getByTestId("home-next-action-continue-button"));

    await waitFor(() => {
      expect(mockLoadDraft).toHaveBeenCalledWith("user-1");
    });
    expect(navigation.navigate).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackHomeNextActionStarted).toHaveBeenCalledTimes(1);
    expect(mockTrackHomeNextActionStarted).toHaveBeenCalledWith({
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    expect(mockTrackHomeNextActionDismissed).not.toHaveBeenCalled();
    expect(handleContinueDraft).not.toHaveBeenCalled();
  });

  it("emits shown once for the same visible review draft source version", async () => {
    await storeReviewDraft();

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });
    expect(mockTrackHomeNextActionShown).toHaveBeenCalledTimes(1);

    await runLatestFocusEffect();

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });
    expect(mockTrackHomeNextActionShown).toHaveBeenCalledTimes(1);
  });

  it("hides the review draft next action and persists cooldown when dismissed", async () => {
    await storeReviewDraft();

    const navigation = createNavigation();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-next-action-dismiss-button"));

    await waitFor(() => {
      expect(queryByTestId("home-next-action-prompt")).toBeNull();
    });
    expect(mockLoadDraft).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackHomeNextActionDismissed).toHaveBeenCalledTimes(1);
    expect(mockTrackHomeNextActionDismissed).toHaveBeenCalledWith({
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    expect(mockTrackHomeNextActionStarted).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem("home-next-action-dismissals:user-1"),
    ).resolves.toContain("review-draft:local");
  });

  it("refreshes the review draft next action on focus and hides stale cleared drafts", async () => {
    await storeReviewDraft();

    const navigation = createNavigation();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });

    await AsyncStorage.multiRemove(["draft:user-1", "screen:user-1"]);
    await runLatestFocusEffect();

    await waitFor(() => {
      expect(queryByTestId("home-next-action-prompt")).toBeNull();
    });
  });

  it("shows an explicit failure toast and hides the prompt when the review draft cannot load", async () => {
    await storeReviewDraft();
    mockLoadDraft.mockRejectedValueOnce(new Error("draft read failed"));

    const navigation = createNavigation();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-next-action-continue-button"));

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
        key: "nextAction.reviewDraft.unavailable",
        ns: "home",
      });
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackHomeNextActionStarted).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(queryByTestId("home-next-action-prompt")).toBeNull();
    });
  });

  it("shows an explicit failure toast when the review draft disappears before navigation", async () => {
    await storeReviewDraft();
    mockLoadDraft.mockImplementationOnce(async () => {
      await AsyncStorage.multiRemove(["draft:user-1", "screen:user-1"]);
    });

    const navigation = createNavigation();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-next-action-prompt")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-next-action-continue-button"));

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
        key: "nextAction.reviewDraft.unavailable",
        ns: "home",
      });
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(mockTrackHomeNextActionStarted).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(queryByTestId("home-next-action-prompt")).toBeNull();
    });
  });

  it("does not duplicate the review draft prompt while the resume modal is visible", async () => {
    await storeReviewDraft();
    mockUseMealAddMethodState.mockReturnValue({
      preferredOption: {
        key: "photo",
        icon: "camera",
        titleKey: "photoTitle",
      },
      showResumeModal: true,
      handleDirectStart: jest.fn(async () => undefined),
      handleContinueDraft: jest.fn(async () => undefined),
      handleDiscardDraft: jest.fn(async () => undefined),
      closeResumeModal: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByText("meals:continue_draft_title")).toBeTruthy();
    });
    expect(queryByTestId("home-next-action-prompt")).toBeNull();
    expect(mockTrackHomeNextActionShown).not.toHaveBeenCalled();
  });

  it("does not render the review draft next action when the local draft is not eligible", async () => {
    await AsyncStorage.setItem(
      "draft:user-1",
      JSON.stringify(
        createMeal({
          mealId: "empty-draft",
          ingredients: [],
          totals: undefined,
          photoUrl: null,
          localPhotoUrl: null,
          photoLocalPath: null,
        }),
      ),
    );
    await AsyncStorage.setItem("screen:user-1", "DescribeMeal");

    const navigation = createNavigation();
    const { queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledWith("user-1", {
        kinds: HOME_MEAL_DEAD_LETTER_KINDS,
      });
    });
    expect(queryByTestId("home-next-action-prompt")).toBeNull();
    expect(mockTrackHomeNextActionShown).not.toHaveBeenCalled();
  });

  it("renders Home photo upload recovery when failed photos exist without meal dead letters", async () => {
    mockGetFailedUploadCount.mockResolvedValue(1);

    const navigation = createNavigation();
    const { getByTestId, getByText, queryByTestId, queryByText } =
      renderWithTheme(<HomeScreen navigation={navigation as never} />);

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    expect(queryByTestId("home-dead-letter-recovery")).toBeNull();
    expect(getByText("1 meal photo upload needs retry.")).toBeTruthy();
    expect(
      getByText(
        "Your meal is saved, but the photo upload needs recovery before it can appear on synced devices.",
      ),
    ).toBeTruthy();
    expect(getByText("Stop retrying")).toBeTruthy();
    expect(getByTestId("home-photo-upload-discard-button")).toBeTruthy();
    expect(queryByText(/successful sync/i)).toBeNull();
    expect(mockGetFailedUploadCount).toHaveBeenCalledWith("user-1");
  });

  it("renders Home dead-letter diagnostics with count, pending meal changes and retry action", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 2, pending: 3 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "upsert_mymeal" }]);

    const navigation = createNavigation();
    const { getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
    });

    expect(getByText("2 meal changes need retry.")).toBeTruthy();
    expect(
      getByText(
        "Retry sends them back to sync. Pending meal changes: 3. Last failed: saved meal update.",
      ),
    ).toBeTruthy();
    expect(getByTestId("home-dead-letter-retry-button")).toBeTruthy();
    expect(mockGetDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: HOME_MEAL_DEAD_LETTER_KINDS,
      limit: 1,
    });
  });

  it("keeps Home dead-letter diagnostics visible when a later diagnostic refresh fails", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 2 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "upsert_mymeal" }]);

    const navigation = createNavigation();
    const { getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
    });
    expect(getByText("1 meal changes need retry.")).toBeTruthy();

    mockGetSyncCounts.mockRejectedValueOnce(new Error("diagnostic read failed"));
    mockGetDeadLetterOps.mockResolvedValueOnce([{ kind: "delete" }]);

    await act(async () => {
      emitMockEvent("sync:op:dead", { uid: "user-1" });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(2);
    });
    expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
    expect(getByText("1 meal changes need retry.")).toBeTruthy();
    expect(
      getByText(
        "Retry sends them back to sync. Pending meal changes: 2. Last failed: saved meal update.",
      ),
    ).toBeTruthy();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("retries Home dead-letter meal ops once and requests both retry domains", async () => {
    let resolveRetry: (count: number) => void = () => undefined;
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 4 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "delete" }]);
    mockRetryDeadLetterOps.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-dead-letter-retry-button"));
    fireEvent.press(getByTestId("home-dead-letter-retry-button"));

    expect(mockRetryDeadLetterOps).toHaveBeenCalledTimes(1);
    expect(mockRetryDeadLetterOps).toHaveBeenCalledWith({
      uid: "user-1",
      kinds: HOME_MEAL_DEAD_LETTER_KINDS,
    });

    resolveRetry(1);

    await waitFor(() => {
      expect(mockRequestSync).toHaveBeenCalledTimes(2);
    });
    expect(mockRequestSync).toHaveBeenNthCalledWith(1, {
      uid: "user-1",
      domain: "meals",
      reason: "retry",
    });
    expect(mockRequestSync).toHaveBeenNthCalledWith(2, {
      uid: "user-1",
      domain: "myMeals",
      reason: "retry",
    });
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "history.deadLetterRetryQueued",
      ns: "meals",
      options: { count: 1 },
    });
  });

  it("renders both recovery surfaces when meal dead letters and failed photos coexist", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 4 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "delete" }]);
    mockGetFailedUploadCount.mockResolvedValue(1);

    const navigation = createNavigation();
    const { UNSAFE_getAllByType, getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    expect(
      getVisibleRecoveryTestIds(UNSAFE_getAllByType(mockView)),
    ).toEqual([
      "home-dead-letter-recovery",
      "home-photo-upload-recovery",
    ]);
    expect(getByText("1 meal changes need retry.")).toBeTruthy();
    expect(getByText("1 meal photo upload needs retry.")).toBeTruthy();
  });

  it("retries only meal dead letters from the visible dead-letter banner when failed photos coexist", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 4 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "delete" }]);
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockRetryDeadLetterOps.mockResolvedValue(1);
    mockRetryFailedUploads.mockResolvedValue(1);

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-dead-letter-retry-button"));

    await waitFor(() => {
      expect(mockRetryDeadLetterOps).toHaveBeenCalledTimes(1);
    });
    expect(mockRetryFailedUploads).not.toHaveBeenCalled();
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "retry",
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "myMeals",
      reason: "retry",
    });
    expect(mockRequestSync).not.toHaveBeenCalledWith({
      uid: "user-1",
      domain: "images",
      reason: "retry",
    });
  });

  it("retries only failed photo uploads from the visible photo banner when meal dead letters coexist", async () => {
    mockGetSyncCounts.mockResolvedValue({ dead: 1, pending: 4 });
    mockGetDeadLetterOps.mockResolvedValue([{ kind: "delete" }]);
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockRetryDeadLetterOps.mockResolvedValue(1);
    mockRetryFailedUploads.mockResolvedValue(1);

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-dead-letter-recovery")).toBeTruthy();
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-photo-upload-retry-button"));

    await waitFor(() => {
      expect(mockRetryFailedUploads).toHaveBeenCalledTimes(1);
    });
    expect(mockRetryFailedUploads).toHaveBeenCalledWith("user-1");
    expect(mockRetryDeadLetterOps).not.toHaveBeenCalled();
    expect(mockRequestSync).toHaveBeenCalledTimes(1);
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "images",
      reason: "retry",
    });
    expect(mockRequestSync).not.toHaveBeenCalledWith({
      uid: "user-1",
      domain: "meals",
      reason: "retry",
    });
    expect(mockRequestSync).not.toHaveBeenCalledWith({
      uid: "user-1",
      domain: "myMeals",
      reason: "retry",
    });
  });

  it("retries failed photo uploads once and requests image sync only after rows are requeued", async () => {
    let resolveRetry: (count: number) => void = () => undefined;
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockRetryFailedUploads.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-photo-upload-retry-button"));
    fireEvent.press(getByTestId("home-photo-upload-retry-button"));

    expect(mockRetryFailedUploads).toHaveBeenCalledTimes(1);
    expect(mockRetryFailedUploads).toHaveBeenCalledWith("user-1");
    expect(mockRequestSync).not.toHaveBeenCalled();

    resolveRetry(1);

    await waitFor(() => {
      expect(mockRequestSync).toHaveBeenCalledTimes(1);
    });
    expect(mockRequestSync).toHaveBeenCalledWith({
      uid: "user-1",
      domain: "images",
      reason: "retry",
    });
    expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
      key: "history.photoUploadRetryQueued",
      ns: "meals",
      options: { count: 1 },
    });
  });

  it("does not request image sync when failed photo retry requeues no rows", async () => {
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockRetryFailedUploads.mockResolvedValue(0);

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-photo-upload-retry-button"));

    await waitFor(() => {
      expect(mockRetryFailedUploads).toHaveBeenCalledWith("user-1");
    });
    expect(mockRequestSync).not.toHaveBeenCalled();
  });

  it("discards failed photo uploads once without requesting image sync", async () => {
    let resolveDiscard: (count: number) => void = () => undefined;
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockDiscardFailedUploads.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveDiscard = resolve;
        }),
    );

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-photo-upload-discard-button"));
    fireEvent.press(getByTestId("home-photo-upload-discard-button"));

    expect(mockDiscardFailedUploads).toHaveBeenCalledTimes(1);
    expect(mockDiscardFailedUploads).toHaveBeenCalledWith("user-1");
    expect(mockRetryFailedUploads).not.toHaveBeenCalled();
    expect(mockRequestSync).not.toHaveBeenCalled();

    resolveDiscard(1);

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith("ui:toast", {
        key: "history.photoUploadDiscarded",
        ns: "meals",
        options: { count: 1 },
      });
    });
    expect(mockRequestSync).not.toHaveBeenCalled();
  });

  it("does not show discard toast or request sync when no failed photo rows were discarded", async () => {
    mockGetFailedUploadCount.mockResolvedValue(1);
    mockDiscardFailedUploads.mockResolvedValue(0);

    const navigation = createNavigation();
    const { getByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    fireEvent.press(getByTestId("home-photo-upload-discard-button"));

    await waitFor(() => {
      expect(mockDiscardFailedUploads).toHaveBeenCalledWith("user-1");
    });
    expect(mockRequestSync).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalledWith("ui:toast", {
      key: "history.photoUploadDiscarded",
      ns: "meals",
      options: expect.anything(),
    });
  });

  it("refreshes Home dead-letter diagnostics for same-uid sync events", async () => {
    mockGetSyncCounts
      .mockResolvedValueOnce({ dead: 0, pending: 0 })
      .mockResolvedValueOnce({ dead: 1, pending: 2 })
      .mockResolvedValueOnce({ dead: 2, pending: 5 });
    mockGetDeadLetterOps
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ kind: "upsert" }])
      .mockResolvedValueOnce([{ kind: "delete_mymeal" }]);

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });

    emitMockEvent("sync:op:dead", { uid: "user-1" });

    await waitFor(() => {
      expect(getByText("1 meal changes need retry.")).toBeTruthy();
    });
    expect(
      getByText(
        "Retry sends them back to sync. Pending meal changes: 2. Last failed: meal update.",
      ),
    ).toBeTruthy();

    emitMockEvent("sync:op:retried", { uid: "user-1" });

    await waitFor(() => {
      expect(getByText("2 meal changes need retry.")).toBeTruthy();
    });
    expect(
      getByText(
        "Retry sends them back to sync. Pending meal changes: 5. Last failed: saved meal delete.",
      ),
    ).toBeTruthy();
  });

  it("refreshes Home photo diagnostics for same-uid image upload events", async () => {
    mockGetFailedUploadCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const navigation = createNavigation();
    const { getByText, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(mockGetFailedUploadCount).toHaveBeenCalledTimes(1);
    });
    expect(queryByTestId("home-photo-upload-recovery")).toBeNull();

    emitMockEvent("image:upload:failed", { uid: "user-1" });

    await waitFor(() => {
      expect(getByText("1 meal photo upload needs retry.")).toBeTruthy();
    });

    emitMockEvent("image:upload:retried", { uid: "user-1" });

    await waitFor(() => {
      expect(mockGetFailedUploadCount).toHaveBeenCalledTimes(3);
      expect(queryByTestId("home-photo-upload-recovery")).toBeNull();
    });
  });

  it("refreshes Home photo diagnostics for same-uid discard events", async () => {
    mockGetFailedUploadCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const navigation = createNavigation();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    await waitFor(() => {
      expect(getByTestId("home-photo-upload-recovery")).toBeTruthy();
    });

    emitMockEvent("image:upload:discarded", { uid: "user-1" });

    await waitFor(() => {
      expect(mockGetFailedUploadCount).toHaveBeenCalledTimes(2);
      expect(queryByTestId("home-photo-upload-recovery")).toBeNull();
    });
  });

  it("does not refresh Home dead-letter diagnostics for unrelated uid sync events", async () => {
    const navigation = createNavigation();
    renderWithTheme(<HomeScreen navigation={navigation as never} />);

    await waitFor(() => {
      expect(mockGetSyncCounts).toHaveBeenCalledTimes(1);
    });
    const callsAfterInitialRefresh = mockGetSyncCounts.mock.calls.length;

    emitMockEvent("sync:op:dead", { uid: "other-user" });
    emitMockEvent("sync:op:retried", { uid: "other-user" });
    emitMockEvent("image:upload:failed", { uid: "other-user" });
    emitMockEvent("image:upload:retried", { uid: "other-user" });
    emitMockEvent("image:upload:discarded", { uid: "other-user" });

    expect(mockGetSyncCounts).toHaveBeenCalledTimes(callsAfterInitialRefresh);
    expect(mockGetFailedUploadCount).toHaveBeenCalledTimes(
      callsAfterInitialRefresh,
    );
  });

  it("hides weekly report card for free users", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseAccessContext.mockReturnValue({
      accessState: null,
      loading: false,
      refreshAccess: jest.fn(),
      applyAccessFromResponse: jest.fn(),
      canUseFeature: jest.fn(() => false),
      getFeature: jest.fn(),
    });

    const navigation = createNavigation();
    const { queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: false,
    });
    expect(queryByText(/^weekly-report-card:/)).toBeNull();
  });

  it("renders ready weekly report as the only retention card when the day has signal", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(mockUseWeeklyReport).toHaveBeenCalledWith({
      uid: "user-1",
      active: true,
    });
    expect(getByText("weekly-report-card:open:ready")).toBeTruthy();
    expect(queryByText(/^coach-insight-card:/)).toBeNull();

    fireEvent.press(getByText("weekly-report-card:open:ready"));
    expect(navigation.navigate).toHaveBeenCalledWith("WeeklyReport");
  });

  it("does not keep bottom safe-area clearance between history link and weekly report", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByTestId, getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    const historyLinkStyleProp = getByTestId("home-view-history-button").props
      .style;
    const historyLinkStyle = StyleSheet.flatten(
      typeof historyLinkStyleProp === "function"
        ? historyLinkStyleProp({ pressed: false })
        : historyLinkStyleProp,
    );

    expect(getByText("weekly-report-card:open:ready")).toBeTruthy();
    expect(historyLinkStyle.marginBottom).toBe(0);
  });

  it("refreshes an unavailable weekly report card instead of navigating", async () => {
    const refresh = jest.fn(async () => ({
      status: "not_available",
      period: { startDay: "2026-03-09", endDay: "2026-03-15" },
      summary: null,
      insights: [],
      priorities: [],
    }));
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "fallback",
      status: "service_unavailable",
      error: new Error("unavailable"),
      refresh,
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("weekly-report-card:retry:not_available")).toBeTruthy();

    fireEvent.press(getByText("weekly-report-card:retry:not_available"));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith("WeeklyReport");
  });

  it("keeps the unavailable weekly report card visible while retry is pending", async () => {
    let resolveRefresh: () => void = () => undefined;
    const refresh = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({
              status: "not_available",
              period: { startDay: "2026-03-09", endDay: "2026-03-15" },
              summary: null,
              insights: [],
              priorities: [],
            });
        }),
    );
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "not_available",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "fallback",
      status: "service_unavailable",
      error: new Error("unavailable"),
      refresh,
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("weekly-report-card:retry:not_available"));

    await waitFor(() => {
      expect(getByText("weekly-report-card:loading:not_available")).toBeTruthy();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalledWith("WeeklyReport");

    resolveRefresh();

    await waitFor(() => {
      expect(getByText("weekly-report-card:retry:not_available")).toBeTruthy();
    });
  });

  it("renders coach insight when weekly report is not ready and coach has a non-competing action", () => {
    mockUseMeals.mockReturnValue({
      meals: [createMeal()],
      getMeals: jest.fn(),
    });
    mockUseWeeklyReport.mockReturnValue({
      report: {
        status: "insufficient_data",
        period: { startDay: "2026-03-09", endDay: "2026-03-15" },
        summary: null,
        insights: [],
        priorities: [],
      },
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      error: null,
      refresh: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(queryByText(/^weekly-report-card:/)).toBeNull();
    fireEvent.press(getByText("coach-insight-card:Ask coach about today:open_chat"));
    expect(navigation.navigate).toHaveBeenCalledWith("Chat");
  });

  it("shows the past empty state for a previous day without entries", () => {
    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("Take meal photo")).toBeTruthy();
    expect(getByText("You missed a meal log")).toBeTruthy();
    expect(getByText("You can still fill in what was missing.")).toBeTruthy();
    expect(queryByText(/^coach-insight-card:/)).toBeNull();
    expect(queryByText(/^weekly-report-card:/)).toBeNull();
  });

  it("does not show today retention surfaces for a selected past day", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "meal-past",
          dayKey: "2026-03-17",
          timestamp: new Date("2026-03-17T10:00:00.000Z").getTime(),
        }),
      ],
      getMeals: jest.fn(),
    });
    mockUseCoach.mockReturnValue({
      coach: createCoachResponse(createCoachInsight()),
      loading: false,
      enabled: true,
      source: "remote",
      status: "live_success",
      isStale: false,
      error: null,
      refresh: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(queryByText(/^coach-insight-card:/)).toBeNull();
    expect(queryByText(/^weekly-report-card:/)).toBeNull();
    expect(mockUseCoach).toHaveBeenLastCalledWith({
      uid: "user-1",
      dayKey: "2026-03-17",
      active: false,
    });
  });

  it("keeps past days with entries in in-progress state and never shows missing-entry copy", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          mealId: "meal-past",
          dayKey: "2026-03-17",
          timestamp: new Date("2026-03-17T10:00:00.000Z").getTime(),
          createdAt: "2026-03-17T10:00:00.000Z",
          updatedAt: "2026-03-17T10:00:00.000Z",
          totals: { kcal: 700, protein: 40, fat: 20, carbs: 75 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText, queryByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    fireEvent.press(getByText("pick-2026-03-17"));

    expect(getByText("Take meal photo")).toBeTruthy();
    expect(getByText("hero-progress:0.35")).toBeTruthy();
    expect(getByText(/^meals:1:/)).toBeTruthy();
    expect(queryByText("You missed a meal log")).toBeNull();
    expect(queryByText("You can still fill in what was missing.")).toBeNull();
  });

  it("updates meals list and progress consistently after a meal is added", () => {
    const mealsState: { meals: ReturnType<typeof createMeal>[] } = { meals: [] };
    mockUseMeals.mockImplementation(() => ({
      meals: mealsState.meals,
      getMeals: jest.fn(),
    }));

    const navigation = createNavigation();
    const { getByText, queryByText, rerender } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(queryByText(/^meals:1:/)).toBeNull();
    expect(queryByText("hero-progress:0.25")).toBeNull();

    mealsState.meals = [createMeal()];
    rerender(<HomeScreen navigation={navigation as never} />);

    expect(getByText(/^meals:1:/)).toBeTruthy();
    expect(getByText("hero-progress:0.25")).toBeTruthy();
    expect(queryByText("hero-progress:0.00")).toBeNull();
  });

  it("renders the completed state and routes the CTA to review flow instead of add flow", () => {
    mockUseMeals.mockReturnValue({
      meals: [
        createMeal({
          totals: { kcal: 2100, protein: 152, fat: 68, carbs: 243 },
        }),
      ],
      getMeals: jest.fn(),
    });

    const navigation = createNavigation();
    const { getByText } = renderWithTheme(
      <HomeScreen navigation={navigation as never} />,
    );

    expect(getByText("Goal reached, Anna")).toBeTruthy();
    expect(getByText("Review your day")).toBeTruthy();
    expect(getByText("Choose how to add")).toBeTruthy();

    fireEvent.press(getByText("Review your day"));
    expect(navigation.navigate).toHaveBeenCalledWith("HistoryList");
  });
});
