import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import {
  toSmartReminderConfidenceBucket,
  toSmartReminderScheduledWindow,
  trackAiMealReviewSaved,
  trackAutocompleteResultSelected,
  trackAutocompleteSearchOutcome,
  trackCoachInsightTapped,
  trackCoachInsightViewed,
  trackEntitlementConfirmationFailed,
  trackEntitlementConfirmed,
  trackHomeNextActionDismissed,
  trackHomeNextActionShown,
  trackHomeNextActionStarted,
  trackIngredientProductCreateOutcome,
  trackKnownPatternCandidateDismissed,
  trackKnownPatternCandidateShown,
  trackKnownPatternReviewStarted,
  trackMealLogged,
  trackMemoryCandidateConfirmed,
  trackMemoryCandidateCreated,
  trackMemoryCandidateDismissed,
  trackMemoryDeleted,
  trackMemoryMuted,
  trackMemoryUsed,
  trackNotificationOpened,
  trackOnboardingCompleted,
  trackPaywallViewed,
  trackPlannedMealChanged,
  trackPlannedMealConfirmed,
  trackPlannedMealCreated,
  trackPlannedMealSkipped,
  trackPurchaseStarted,
  trackPurchaseSucceeded,
  trackRestoreFailed,
  trackRestoreStarted,
  trackRestoreSucceeded,
  trackSessionStart,
  trackWeeklyReportAccessBlocked,
  trackWeeklyReportLockedViewed,
  trackSmartReminderDecisionFailed,
  trackSmartReminderNoop,
  trackSmartReminderScheduled,
  trackSmartReminderScheduleFailed,
  trackSmartReminderSuppressed,
  trackWeeklyReportOpened,
} from "@/services/telemetry/telemetryInstrumentation";

const mockTrack = jest.fn<(name: string, props?: Record<string, unknown>) => Promise<void>>();

jest.mock("@/services/telemetry/telemetryClient", () => ({
  track: (name: string, props?: Record<string, unknown>) => mockTrack(name, props),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-03-18T12:00:00.000Z",
  type: "lunch",
  name: "Meal",
  ingredients: [],
  createdAt: "2026-03-18T12:00:00.000Z",
  updatedAt: "2026-03-18T12:00:00.000Z",
  syncState: "pending",
  source: "manual",
  ...overrides,
});

describe("telemetryInstrumentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrack.mockResolvedValue();
  });

  it("maps launch KPI telemetry events to the backend allowlist", async () => {
    await trackSessionStart();
    await trackOnboardingCompleted({ mode: "first" });
    await trackMealLogged(
      baseMeal({
        source: "ai",
        inputMethod: "photo",
        ingredients: [
          {
            id: "i1",
            name: "Egg",
            amount: 1,
            kcal: 80,
            protein: 6,
            fat: 5,
            carbs: 0,
          },
        ],
      }),
    );
    await trackAiMealReviewSaved({
      inputMethod: "photo",
      corrected: true,
      ingredientCount: 1,
      requestId: "run-1",
    });
    await trackNotificationOpened({
      notificationType: "meal_reminder",
      origin: "system_notifications",
    });
    await trackPaywallViewed({
      source: "meal_text_limit",
      triggerSource: "meal_text_limit_modal",
    });
    await trackPurchaseStarted();
    await trackPurchaseSucceeded();
    await trackEntitlementConfirmed({ source: "purchase" });
    await trackEntitlementConfirmationFailed({
      source: "purchase",
      reason: "credits_not_premium",
    });
    await trackRestoreStarted();
    await trackRestoreSucceeded({ confirmed: true });
    await trackRestoreFailed({ reason: "network" });
    await trackWeeklyReportOpened({
      reportStatus: "ready",
      insightCount: 2,
      priorityCount: 2,
      source: "remote",
      accessState: "premium",
      accessReason: null,
    });
    await trackWeeklyReportLockedViewed({
      source: "disabled",
      accessState: "locked",
      accessReason: "requires_premium",
    });
    await trackWeeklyReportAccessBlocked({
      source: "disabled",
      accessState: "degraded",
      accessReason: "degraded",
    });
    await trackCoachInsightViewed({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });
    await trackCoachInsightTapped({
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "degraded",
    });
    await trackAutocompleteSearchOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "results",
      queryLength: 7,
      resultCount: 4,
      sourceClass: "remote",
      latencyMs: 420,
    });
    await trackAutocompleteResultSelected({
      surface: "manual_ingredient_sheet",
      resultCount: 4,
      sourceClass: "global",
      rank: 2,
      warningReason: "profile_unknown",
    });
    await trackIngredientProductCreateOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "synced",
    });
    await trackHomeNextActionShown({
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });
    await trackHomeNextActionStarted({
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    await trackMemoryCandidateCreated({
      memoryType: "typical_portion",
      surface: "review",
      confidenceBucket: "medium",
      featureState: "shadow",
    });
    await trackMemoryCandidateConfirmed({
      memoryType: "review_correction",
      surface: "review",
      confidenceBucket: "high",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackMemoryCandidateDismissed({
      memoryType: "ingredient_product_selection",
      surface: "memory_center",
      actionResult: "queued",
      featureState: "enabled",
    });
    await trackMemoryUsed({
      memoryType: "typical_portion",
      surface: "review",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackMemoryMuted({
      memoryType: "review_correction",
      surface: "settings",
      actionResult: "blocked",
      featureState: "disabled",
    });
    await trackMemoryDeleted({
      memoryType: "ingredient_product_selection",
      surface: "memory_center",
      actionResult: "failed",
      featureState: "enabled",
    });
    await trackPlannedMealCreated({
      sourceType: "manual",
      estimateState: "unknown",
      surface: "planning",
      featureState: "enabled",
    });
    await trackPlannedMealConfirmed({
      sourceType: "saved_meal",
      estimateState: "known",
      surface: "home_next_action",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackPlannedMealChanged({
      sourceType: "recipe",
      estimateState: "partial",
      surface: "planning",
      actionResult: "queued",
      featureState: "shadow",
    });
    await trackPlannedMealSkipped({
      sourceType: "ingredient_product_draft",
      estimateState: "partial",
      surface: "planning",
      actionResult: "blocked",
      featureState: "disabled",
    });
    await trackKnownPatternCandidateShown({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      featureState: "enabled",
    });
    await trackKnownPatternReviewStarted({
      surface: "meal_add_method",
      confidenceBucket: "high",
      sourceCountBucket: "5_plus",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackKnownPatternCandidateDismissed({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      actionResult: "queued",
      featureState: "shadow",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "session_start", {
      origin: "app_boot",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "onboarding_completed", {
      mode: "first",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "meal_logged", {
      ingredientCount: 1,
      source: "ai",
      mealInputMethod: "photo",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(4, "ai_meal_review_saved", {
      inputMethod: "photo",
      corrected: true,
      ingredientCount: 1,
      requestId: "run-1",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(5, "notification_opened", {
      notificationType: "meal_reminder",
      origin: "system_notifications",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(6, "paywall_view", {
      source: "meal_text_limit",
      trigger_source: "meal_text_limit_modal",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(7, "purchase_started", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(8, "purchase_succeeded", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(9, "entitlement_confirmed", {
      source: "purchase",
      tier: "premium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      10,
      "entitlement_confirmation_failed",
      {
        source: "purchase",
        reason: "credits_not_premium",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(11, "restore_started", {
      source: "manage_subscription",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(12, "restore_succeeded", {
      source: "manage_subscription",
      confirmed: true,
    });
    expect(mockTrack).toHaveBeenNthCalledWith(13, "restore_failed", {
      source: "manage_subscription",
      reason: "network",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(14, "weekly_report_opened", {
      reportStatus: "ready",
      insightCount: 2,
      priorityCount: 2,
      source: "remote",
      accessState: "premium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      15,
      "weekly_report_locked_viewed",
      {
        source: "disabled",
        accessState: "locked",
        accessReason: "requires_premium",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      16,
      "weekly_report_access_blocked",
      {
        source: "disabled",
        accessState: "degraded",
        accessReason: "degraded",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(17, "coach_insight_viewed", {
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "fresh",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(18, "coach_insight_tapped", {
      insightType: "under_logging",
      actionType: "log_next_meal",
      freshness: "degraded",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      19,
      "autocomplete_search_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "results",
        queryLengthBucket: "4_8",
        resultCountBucket: "4_6",
        sourceClass: "remote",
        latencyBucket: "250_750_ms",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      20,
      "autocomplete_result_selected",
      {
        surface: "manual_ingredient_sheet",
        resultCountBucket: "4_6",
        sourceClass: "global",
        rankBucket: "2_3",
        selectionState: "selected",
        warningReason: "profile_unknown",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      21,
      "ingredient_product_create_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "synced",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(22, "home_next_action_shown", {
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(23, "home_next_action_started", {
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(24, "home_next_action_dismissed", {
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(25, "memory_candidate_created", {
      memoryType: "typical_portion",
      surface: "review",
      confidenceBucket: "medium",
      featureState: "shadow",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(26, "memory_candidate_confirmed", {
      memoryType: "review_correction",
      surface: "review",
      confidenceBucket: "high",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(27, "memory_candidate_dismissed", {
      memoryType: "ingredient_product_selection",
      surface: "memory_center",
      actionResult: "queued",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(28, "memory_used", {
      memoryType: "typical_portion",
      surface: "review",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(29, "memory_muted", {
      memoryType: "review_correction",
      surface: "settings",
      actionResult: "blocked",
      featureState: "disabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(30, "memory_deleted", {
      memoryType: "ingredient_product_selection",
      surface: "memory_center",
      actionResult: "failed",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(31, "planned_meal_created", {
      sourceType: "manual",
      estimateState: "unknown",
      surface: "planning",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(32, "planned_meal_confirmed", {
      sourceType: "saved_meal",
      estimateState: "known",
      surface: "home_next_action",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(33, "planned_meal_changed", {
      sourceType: "recipe",
      estimateState: "partial",
      surface: "planning",
      actionResult: "queued",
      featureState: "shadow",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(34, "planned_meal_skipped", {
      sourceType: "ingredient_product_draft",
      estimateState: "partial",
      surface: "planning",
      actionResult: "blocked",
      featureState: "disabled",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(
      35,
      "known_pattern_candidate_shown",
      {
        surface: "meal_add_method",
        confidenceBucket: "medium",
        sourceCountBucket: "3_4",
        featureState: "enabled",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      36,
      "known_pattern_review_started",
      {
        surface: "meal_add_method",
        confidenceBucket: "high",
        sourceCountBucket: "5_plus",
        actionResult: "succeeded",
        featureState: "enabled",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      37,
      "known_pattern_candidate_dismissed",
      {
        surface: "meal_add_method",
        confidenceBucket: "medium",
        sourceCountBucket: "3_4",
        actionResult: "queued",
        featureState: "shadow",
      },
    );
  });

  it("keeps C5 Smart Memory, Planning and Known Patterns telemetry bounded and content-free", async () => {
    const forbiddenPropNames = [
      "mealName",
      "ingredientName",
      "notes",
      "candidateId",
      "subjectKeyHash",
      "createdByRuleVersion",
      "sourceHash",
      "memoryId",
      "plannedMealId",
      "sourceRef",
      "sourceRefs",
      "rawReason",
      "rawPrompt",
      "rawResponse",
      "imageUrl",
      "fullPayload",
      "calories",
      "kcal",
      "macros",
      "protein",
      "carbs",
      "fat",
    ];

    await trackMemoryCandidateCreated({
      memoryType: "typical_portion",
      surface: "review",
      confidenceBucket: "low",
      featureState: "shadow",
    });
    await trackMemoryUsed({
      memoryType: "review_correction",
      surface: "review",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackPlannedMealCreated({
      sourceType: "manual",
      estimateState: "unknown",
      surface: "planning",
      featureState: "disabled",
    });
    await trackPlannedMealSkipped({
      sourceType: "recipe",
      estimateState: "partial",
      surface: "home_next_action",
      actionResult: "blocked",
      featureState: "enabled",
    });
    await trackKnownPatternCandidateShown({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      featureState: "enabled",
    });
    await trackKnownPatternReviewStarted({
      surface: "meal_add_method",
      confidenceBucket: "high",
      sourceCountBucket: "5_plus",
      actionResult: "succeeded",
      featureState: "enabled",
    });
    await trackKnownPatternCandidateDismissed({
      surface: "meal_add_method",
      confidenceBucket: "medium",
      sourceCountBucket: "3_4",
      actionResult: "queued",
      featureState: "shadow",
    });

    const assertC5TelemetryTypeBoundaries = () => {
      void trackMemoryCandidateCreated({
        memoryType: "typical_portion",
        surface: "review",
        confidenceBucket: "low",
        featureState: "shadow",
        // @ts-expect-error raw candidate identifiers are not part of the C5 contract.
        candidateId: "candidate-1",
      });
      void trackPlannedMealCreated({
        // @ts-expect-error sourceType must stay a bounded planning source enum.
        sourceType: "raw_recipe_name",
        estimateState: "unknown",
        surface: "planning",
        featureState: "disabled",
      });
      void trackPlannedMealSkipped({
        sourceType: "recipe",
        estimateState: "partial",
        surface: "home_next_action",
        // @ts-expect-error raw reason text is not a C5 actionResult enum.
        actionResult: "I skipped oats because...",
        featureState: "enabled",
      });
      void trackKnownPatternCandidateShown({
        surface: "meal_add_method",
        confidenceBucket: "medium",
        sourceCountBucket: "3_4",
        featureState: "enabled",
        // @ts-expect-error raw candidate identifiers are not part of the C5 contract.
        candidateId: "candidate-1",
      });
      void trackKnownPatternReviewStarted({
        // @ts-expect-error surface must stay a bounded Known Patterns surface enum.
        surface: "raw_meal_add_card",
        confidenceBucket: "high",
        sourceCountBucket: "5_plus",
        actionResult: "succeeded",
        featureState: "enabled",
      });
    };
    expect(assertC5TelemetryTypeBoundaries).toBeDefined();

    for (const [, props] of mockTrack.mock.calls) {
      expect(Object.keys(props ?? {})).not.toEqual(
        expect.arrayContaining(forbiddenPropNames),
      );
      expect(JSON.stringify(props)).not.toContain("Oats");
      expect(JSON.stringify(props)).not.toContain("candidate-1");
      expect(JSON.stringify(props)).not.toContain("memory-1");
      expect(JSON.stringify(props)).not.toContain("planned-1");
    }
  });

  it("keeps autocomplete telemetry behavioral and bucketed", async () => {
    await trackAutocompleteSearchOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "no_results",
      queryLength: 19,
      resultCount: 0,
      sourceClass: "none",
      latencyMs: 1800,
    });
    await trackAutocompleteResultSelected({
      surface: "manual_ingredient_sheet",
      resultCount: 13,
      sourceClass: "user_scoped",
      rank: 13,
    });

    expect(mockTrack).toHaveBeenNthCalledWith(
      1,
      "autocomplete_search_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "no_results",
        queryLengthBucket: "17_plus",
        resultCountBucket: "0",
        sourceClass: "none",
        latencyBucket: "1500_ms_plus",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      2,
      "autocomplete_result_selected",
      {
        surface: "manual_ingredient_sheet",
        resultCountBucket: "13_plus",
        sourceClass: "user_scoped",
        rankBucket: "13_plus",
        selectionState: "selected",
      },
    );
  });

  it("tracks manual Product/Ingredient create outcomes without raw payload data", async () => {
    await trackIngredientProductCreateOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "synced",
    });
    await trackIngredientProductCreateOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "queued",
    });
    await trackIngredientProductCreateOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "failed",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(
      1,
      "ingredient_product_create_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "synced",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      2,
      "ingredient_product_create_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "queued",
      },
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      3,
      "ingredient_product_create_outcome",
      {
        surface: "manual_ingredient_sheet",
        outcome: "failed",
      },
    );

    for (const [, props] of mockTrack.mock.calls) {
      expect(props).toEqual(
        expect.not.objectContaining({
          query: expect.anything(),
          displayName: expect.anything(),
          productName: expect.anything(),
          nutritionPer100: expect.anything(),
          ingredientProductId: expect.anything(),
          barcode: expect.anything(),
          sourceRef: expect.anything(),
          memoryId: expect.anything(),
        }),
      );
    }
  });

  it("keeps Home Next Action telemetry behavioral and bounded", async () => {
    await trackHomeNextActionShown({
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });
    await trackHomeNextActionStarted({
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    await trackHomeNextActionShown({
      actionType: "continue_planned_item",
      state: "eligible",
      reasonCode: "planned_item_due",
      sourceDomain: "planned_meal",
    });
    await trackHomeNextActionStarted({
      actionType: "continue_planned_item",
      ownerFlow: "Planning",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "continue_planned_item",
      reasonCode: "planned_item_due",
      cooldownBucket: "24h",
    });
    await trackHomeNextActionShown({
      actionType: "confirm_known_pattern",
      state: "eligible",
      reasonCode: "known_pattern_available",
      sourceDomain: "known_pattern_candidate",
    });
    await trackHomeNextActionStarted({
      actionType: "confirm_known_pattern",
      ownerFlow: "MealAddMethod",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "confirm_known_pattern",
      reasonCode: "known_pattern_available",
      cooldownBucket: "24h",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "home_next_action_shown", {
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "home_next_action_started", {
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "home_next_action_dismissed", {
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(4, "home_next_action_shown", {
      actionType: "continue_planned_item",
      state: "eligible",
      reasonCode: "planned_item_due",
      sourceDomain: "planned_meal",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(5, "home_next_action_started", {
      actionType: "continue_planned_item",
      ownerFlow: "Planning",
      state: "eligible",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(6, "home_next_action_dismissed", {
      actionType: "continue_planned_item",
      reasonCode: "planned_item_due",
      cooldownBucket: "24h",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(7, "home_next_action_shown", {
      actionType: "confirm_known_pattern",
      state: "eligible",
      reasonCode: "known_pattern_available",
      sourceDomain: "known_pattern_candidate",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(8, "home_next_action_started", {
      actionType: "confirm_known_pattern",
      ownerFlow: "MealAddMethod",
      state: "eligible",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(9, "home_next_action_dismissed", {
      actionType: "confirm_known_pattern",
      reasonCode: "known_pattern_available",
      cooldownBucket: "24h",
    });
  });

  it("does not emit raw Home Next Action content, identity, or nutrition props", async () => {
    const forbiddenPropNames = [
      "suggestionText",
      "rawSuggestionText",
      "mealText",
      "recipeName",
      "productName",
      "ingredientName",
      "candidateId",
      "mealId",
      "barcode",
      "kcal",
      "calories",
      "macros",
      "protein",
      "carbs",
      "fat",
      "sourceRef",
      "memoryId",
      "patternId",
      "profileHealth",
      "profileFreeText",
      "rawProviderPayload",
      "userId",
    ];

    await trackHomeNextActionShown({
      actionType: "continue_review",
      state: "eligible",
      reasonCode: "review_draft_available",
      sourceDomain: "review_draft",
    });
    await trackHomeNextActionStarted({
      actionType: "continue_review",
      ownerFlow: "ReviewMeal",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "continue_review",
      reasonCode: "review_draft_available",
      cooldownBucket: "24h",
    });
    await trackHomeNextActionShown({
      actionType: "continue_planned_item",
      state: "eligible",
      reasonCode: "planned_item_due",
      sourceDomain: "planned_meal",
    });
    await trackHomeNextActionStarted({
      actionType: "continue_planned_item",
      ownerFlow: "Planning",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "continue_planned_item",
      reasonCode: "planned_item_due",
      cooldownBucket: "24h",
    });
    await trackHomeNextActionShown({
      actionType: "confirm_known_pattern",
      state: "eligible",
      reasonCode: "known_pattern_available",
      sourceDomain: "known_pattern_candidate",
    });
    await trackHomeNextActionStarted({
      actionType: "confirm_known_pattern",
      ownerFlow: "MealAddMethod",
      state: "eligible",
    });
    await trackHomeNextActionDismissed({
      actionType: "confirm_known_pattern",
      reasonCode: "known_pattern_available",
      cooldownBucket: "24h",
    });

    for (const [, props] of mockTrack.mock.calls) {
      expect(Object.keys(props ?? {})).not.toEqual(
        expect.arrayContaining(forbiddenPropNames),
      );
      expect(JSON.stringify(props)).not.toContain("Oats");
      expect(JSON.stringify(props)).not.toContain("5901234123457");
      expect(JSON.stringify(props)).not.toContain("draft-1");
    }
  });

  it("does not emit raw autocomplete query, food identity, nutrition, or memory refs", async () => {
    const forbiddenPropNames = [
      "query",
      "rawQuery",
      "normalizedQuery",
      "displayName",
      "ingredientName",
      "productName",
      "ingredientProductId",
      "productId",
      "barcode",
      "nutritionPer100",
      "kcal",
      "protein",
      "carbs",
      "fat",
      "sourceRef",
      "memoryId",
    ];

    await trackAutocompleteSearchOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "warning",
      queryLength: 12,
      resultCount: 2,
      sourceClass: "remote",
      latencyMs: 620,
      warningReason: "profile_warning",
    });
    await trackAutocompleteResultSelected({
      surface: "manual_ingredient_sheet",
      resultCount: 2,
      sourceClass: "global",
      rank: 1,
      warningReason: "profile_warning",
    });
    await trackIngredientProductCreateOutcome({
      surface: "manual_ingredient_sheet",
      outcome: "failed",
    });

    for (const [, props] of mockTrack.mock.calls) {
      expect(Object.keys(props ?? {})).not.toEqual(
        expect.arrayContaining(forbiddenPropNames),
      );
      expect(JSON.stringify(props)).not.toContain("Owies");
      expect(JSON.stringify(props)).not.toContain("5901234123457");
      expect(JSON.stringify(props)).not.toContain("ingredient-product");
    }
  });

  it("keeps smart reminder telemetry mappings contract-safe", async () => {
    expect(toSmartReminderConfidenceBucket(0.2)).toBe("low");
    expect(toSmartReminderConfidenceBucket(0.7)).toBe("medium");
    expect(toSmartReminderConfidenceBucket(0.9)).toBe("high");
    expect(toSmartReminderScheduledWindow(360)).toBe("morning");
    expect(toSmartReminderScheduledWindow(780)).toBe("afternoon");
    expect(toSmartReminderScheduledWindow(1140)).toBe("evening");

    await trackSmartReminderScheduled({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      scheduledWindow: "evening",
    });
    await trackSmartReminderSuppressed({
      decision: "suppress",
      suppressionReason: "quiet_hours",
      confidenceBucket: "high",
    });
    await trackSmartReminderNoop({
      decision: "noop",
      noopReason: "insufficient_signal",
      confidenceBucket: "medium",
    });
    await trackSmartReminderDecisionFailed({
      failureReason: "invalid_payload",
    });
    await trackSmartReminderScheduleFailed({
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "channel_unavailable",
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "smart_reminder_scheduled", {
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      scheduledWindow: "evening",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "smart_reminder_suppressed", {
      decision: "suppress",
      suppressionReason: "quiet_hours",
      confidenceBucket: "high",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "smart_reminder_noop", {
      decision: "noop",
      noopReason: "insufficient_signal",
      confidenceBucket: "medium",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(4, "smart_reminder_decision_failed", {
      failureReason: "invalid_payload",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(5, "smart_reminder_schedule_failed", {
      reminderKind: "log_next_meal",
      decision: "send",
      confidenceBucket: "high",
      failureReason: "channel_unavailable",
    });
  });

  it("normalizes optional telemetry dimensions before sending", async () => {
    expect(toSmartReminderScheduledWindow(0)).toBe("overnight");
    expect(toSmartReminderScheduledWindow(1300)).toBe("late_evening");

    await trackMealLogged(baseMeal({ source: "saved", ingredients: [] }));
    await trackMealLogged(
      baseMeal({
        source: "ai",
        photoUrl: null,
        photoLocalPath: null,
        localPhotoUrl: null,
        imageId: null,
        ingredients: [],
      }),
    );
    await trackNotificationOpened({
      notificationType: " Meal Reminder! ",
      origin: "third-party",
      actionIdentifier: "Open Chat",
      openedFromBackground: true,
    });

    expect(mockTrack).toHaveBeenNthCalledWith(1, "meal_logged", {
      ingredientCount: 0,
      source: "saved",
      mealInputMethod: "manual",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, "meal_logged", {
      ingredientCount: 0,
      source: "ai",
      mealInputMethod: "text",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(3, "notification_opened", {
      notificationType: "meal_reminder",
      origin: "unknown",
      actionIdentifier: "open_chat",
      openedFromBackground: true,
    });
  });
});
