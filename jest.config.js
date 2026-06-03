const componentCoverageFiles = [
  "src/components/ButtonToggle.tsx",
  "src/components/Clock24h.tsx",
  "src/components/DateRangePicker.tsx",
  "src/components/DateTimeSection.tsx",
  "src/components/ErrorBox.tsx",
  "src/components/ErrorButton.tsx",
  "src/components/LinkText.tsx",
  "src/components/MacroChip.tsx",
  "src/components/OfflineBanner.tsx",
  "src/components/PrimaryButton.tsx",
  "src/components/ScreenCornerNavButton.tsx",
  "src/components/ScrollableBox.tsx",
  "src/components/SearchBox.tsx",
  "src/components/SecondaryButton.tsx",
  "src/components/StreakBadge.tsx",
  "src/components/TargetProgressBar.tsx",
  "src/components/TextInput.tsx",
  "src/components/TimePartInput.tsx",
  "src/components/UserIcon.tsx",
  "src/components/WeekStrip.tsx",
  "src/components/WeekdaySelector.tsx",
];

const featureCoverageFiles = [
  "src/feature/AI/components/Bubble.tsx",
  "src/feature/AI/components/InputBar.tsx",
  "src/feature/AI/components/TypingDots.tsx",
  "src/feature/History/components/EmptyState.tsx",
  "src/feature/History/components/FallbackImage.tsx",
  "src/feature/History/components/LoadingSkeleton.tsx",
  "src/feature/History/screens/EditResultScreen.tsx",
  "src/feature/History/screens/HistoryListScreen.tsx",
  "src/feature/History/screens/MealDetailsScreen.tsx",
  "src/feature/History/screens/SavedMealsScreen.tsx",
  "src/feature/Home/components/ButtonSection.tsx",
  "src/feature/Home/components/MacroTargetsRow.tsx",
  "src/feature/Home/components/WeeklyProgressGraph.tsx",
  "src/feature/Meals/feature/MapMealAddScreens.tsx",
  "src/feature/Meals/components/EmptyState.tsx",
  "src/feature/Meals/components/LoadingSkeleton.tsx",
  "src/feature/Meals/components/cardLayouts/MacroBadgeCard.tsx",
  "src/feature/Meals/components/cardLayouts/MacroSplitCard.tsx",
  "src/feature/Meals/components/cardLayouts/MacroSummaryCard.tsx",
  "src/feature/Meals/components/cardLayouts/MacroVerticalStackCard.tsx",
  "src/feature/Meals/components/chartLayouts/MacroBarMini.tsx",
  "src/feature/Meals/components/chartLayouts/MacroPieChart.tsx",
  "src/feature/Meals/screens/AddMealScreen.tsx",
  "src/feature/Meals/screens/MealAdd/IngredientsNotRecognizedScreen.tsx",
  "src/feature/Meals/screens/MealAdd/MealCameraScreen.tsx",
  "src/feature/Meals/screens/MealAdd/ReviewMealScreen.tsx",
  "src/feature/Meals/screens/MealAddMethodScreen.tsx",
  "src/feature/Meals/screens/MealAdd/TextAnalyzingScreen.tsx",
  "src/feature/Meals/screens/SelectSavedMealsScreen.tsx",
  "src/feature/Statistics/screens/StatisticsScreen.tsx",
  "src/feature/Subscription/screens/ManageSubscriptionScreen.tsx",
  "src/feature/Statistics/components/LineSection.tsx",
  "src/feature/Statistics/components/MacroPieCard.tsx",
  "src/feature/Statistics/components/MetricsGrid.tsx",
  "src/feature/UserProfile/components/ListItem.tsx",
  "src/feature/UserProfile/components/SectionHeader.tsx",
];

const serviceCoverageFiles = [
  // AI
  "src/services/ai/contracts.ts",
  // chatThreadRepository.ts excluded — async/error path coverage requires integration tests
  "src/services/ai/textMealService.ts",
  "src/services/ai/visionService.ts",
  // Coach
  "src/services/coach/coachService.ts",
  // Contracts
  "src/services/contracts/guards.ts",
  "src/services/contracts/serviceError.ts",
  // Core network
  "src/services/core/apiClient.ts",
  "src/services/core/apiVersioning.ts",
  // Feedback
  "src/services/feedback/feedbackService.ts",
  // Gamification
  "src/services/gamification/badgeService.ts",
  "src/services/gamification/streakService.ts",
  // Meals
  "src/services/meals/mealMetadata.ts",
  "src/services/meals/mealService.images.ts",
  "src/services/meals/mealService.ts",
  // Notifications
  "src/services/notifications/conditions.ts",
  "src/services/notifications/dayRange.ts",
  "src/services/notifications/engine.ts",
  // localScheduler.ts excluded — system scheduling API branches require integration tests
  "src/services/notifications/notificationTelemetry.ts",
  "src/services/notifications/texts.ts",
  // Nutrition state
  "src/services/nutritionState/nutritionStateService.ts",
  // Offline / sync
  // offline/db.ts excluded — SQLite schema branches require integration tests
  "src/services/offline/fileCleanup.ts",
  // offline/meals.repo.ts excluded — SQLite query branches require integration tests
  "src/services/offline/sync.engine.ts",
  // Release
  "src/services/release/launchReadiness.ts",
  // Reminders
  "src/services/reminders/reminderRuntime.ts",
  "src/services/reminders/reminderScheduling.ts",
  "src/services/reminders/reminderService.ts",
  "src/services/reminders/reminderSettings.ts",
  // Telemetry
  "src/services/telemetry/navigationTelemetry.ts",
  "src/services/telemetry/telemetryClient.ts",
  "src/services/telemetry/telemetryInstrumentation.ts",
  "src/services/telemetry/telemetryLifecycle.ts",
  // User
  "src/services/user/common.ts",
  "src/services/user/profile.ts",
  "src/services/user/userProfileRepository.ts",
  "src/services/user/usernameService.ts",
  // Weekly report
  "src/services/weeklyReport/weeklyReportService.ts",
];

const hooksCoverageFiles = [
  "src/hooks/useAppFonts.ts",
  "src/hooks/useBadges.ts",
  "src/hooks/useChatHistory.ts",
  "src/hooks/useCoach.ts",
  "src/hooks/useDebouncedValue.ts",
  "src/hooks/useMeals.ts",
  "src/hooks/useNotifications.ts",
  "src/hooks/useReminderDecision.ts",
  "src/hooks/useUser.ts",
];

const utilityCoverageFiles = [
  "src/utils/autoMealName.ts",
  "src/utils/calculateMacroTargets.ts",
  "src/utils/calculateTotalNutrients.ts",
  "src/utils/convertToJpegAndResize.ts",
  "src/utils/debug.ts",
  "src/utils/devSamples.ts",
  "src/utils/ensureJpeg.ts",
  "src/utils/findUndefined.ts",
  "src/utils/getLastNDaysAggregated.ts",
  "src/utils/getTodayMeals.ts",
  "src/utils/mealImage.ts",
  "src/utils/numericInput.ts",
  "src/utils/omitLocalUserKeys.ts",
  "src/utils/parseMarkdownToReactNative.tsx",
  "src/utils/perf.ts",
  "src/utils/photoFilters.ts",
  "src/utils/savePhotoLocally.ts",
  "src/utils/syncUtils.ts",
  "src/utils/units.ts",
  "src/utils/uriToBase64.ts",
  "src/utils/validation.ts",
];

module.exports = {
  preset: "react-native",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^uuid(?:$|/.*)$": "<rootDir>/src/test-utils/uuidMock.ts",
    "^expo/virtual/env$": "<rootDir>/src/test-utils/expoVirtualEnvMock.ts",
    "\\.svg$": "<rootDir>/src/test-utils/svgMock.tsx",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@assets/(.*)$": "<rootDir>/assets/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@contexts/(.*)$": "<rootDir>/src/context/$1",
    "^@feature/(.*)$": "<rootDir>/src/feature/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@navigation/(.*)$": "<rootDir>/src/navigation/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@theme/(.*)$": "<rootDir>/src/theme/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  // Coverage gate covers reusable UI units, utility modules, hooks, and
  // service/integration layer. Screens are excluded (E2E covers those).
  collectCoverageFrom: [
    ...componentCoverageFiles,
    ...featureCoverageFiles,
    ...utilityCoverageFiles,
    ...serviceCoverageFiles,
    ...hooksCoverageFiles,
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 94,
      lines: 90,
      statements: 89,
    },
  },
  clearMocks: true,
};
