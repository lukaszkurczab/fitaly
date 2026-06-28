import { BackHandler } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import ReviewMealScreen from "@/feature/Meals/screens/MealAdd/ReviewMealScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal, UserAiConsent, UserData, UserReadiness } from "@/types";
import type { ReviewMemoryExplanation } from "@/services/smartMemory/smartMemoryService";
import type { RuntimeConfig } from "@/services/core/runtimeConfig";
import plMeals from "@/locales/pl/meals.json";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

type ModalProps = {
  visible: boolean;
  testID?: string;
  title?: string;
  children?: unknown;
  primaryAction?: { label: string; onPress?: () => void; testID?: string };
  secondaryAction?: { label: string; onPress?: () => void; testID?: string };
};

type UnsavedChangesModalProps = {
  visible: boolean;
  discardLabel: string;
  continueEditingLabel: string;
  onDiscard: () => void;
  onContinueEditing: () => void;
};

const mockUseAuthContext = jest.fn();
const mockUseMealDraftContext = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseNetInfo = jest.fn<() => { isConnected: boolean | null }>();
const mockUseMeals = jest.fn();
const mockGetInfoAsync =
  jest.fn<(uri: string) => Promise<{ exists: boolean }>>();
const mockBackHandlerAddEventListener = jest.fn();
const mockGetRuntimeConfig = jest.fn<() => RuntimeConfig>();
function createRuntimeConfig(
  overrides?: Partial<RuntimeConfig>,
): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    apiVersion: "v1",
    backendLoggingEnabled: false,
    telemetryEnabled: false,
    smartRemindersEnabled: true,
    foodLibraryEnabled: false,
    smartMemoryEnabled: false,
    knownPatternsEnabled: false,
    recipeCatalogEnabled: false,
    planningEnabled: false,
    homeNextActionEnabled: false,
    reviewMemoryExplanationEnabled: false,
    billingDisabled: false,
    buildProfile: "",
    termsUrl: "",
    privacyUrl: "",
    sentryDsn: "",
    sentryEnvironment: "development",
    sentryOrganization: "",
    sentryProject: "",
    revenuecatIosKey: "",
    revenuecatAndroidKey: "",
    firebaseProjectId: "",
    firebaseAuthEmulatorHost: "",
    ...overrides,
  };
}
const mockReadReviewSmartMemoryExplanation =
  jest.fn<
    (params: {
      uid: string;
      ingredients: Array<{ name: string; amount?: number; unit?: string }>;
      nutritionProfile: unknown;
    }) => Promise<ReviewMemoryExplanation>
  >();

jest.mock("@/services/core/fileSystem", () => ({
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserContext(),
}));

jest.mock("@hooks/useMeals", () => ({
  useMeals: (uid: string | null) => mockUseMeals(uid),
}));

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackAiMealReviewSaved: jest.fn(),
}));

jest.mock("@/services/smartMemory/smartMemoryService", () => ({
  readReviewSmartMemoryExplanation: (params: {
    uid: string;
    ingredients: Array<{ name: string; amount?: number; unit?: string }>;
    nutritionProfile: unknown;
  }) => mockReadReviewSmartMemoryExplanation(params),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (
      key: string,
      options?: { ns?: string; defaultValue?: string; count?: number },
    ) => {
      const labels: Record<string, string> = {
        breakfast: "Breakfast",
        carbs: "Węglowodany",
        carbs_compact: "Węgle",
        lunch: "Lunch",
        review_meal_no_photo_overline: "Meal review",
        review_meal_save_template_create_title: "Save as my meal",
        review_meal_save_template_create_helper:
          "Makes it quicker to add again next time.",
        review_meal_save_template_update_title: "Update saved meal",
        review_meal_save_template_update_helper:
          "Keeps these changes for the next time you reuse it.",
        review_memory_row_candidate_title:
          "Fitaly can remember this after repeated saves.",
        review_memory_row_candidate_body:
          "No active personalization is used yet.",
        review_memory_row_pending_title:
          "Memory update will sync when online.",
        review_memory_row_pending_body:
          "This does not block saving this meal.",
        review_memory_row_sync_failed_title: "Memory change did not sync.",
        review_memory_row_sync_failed_body:
          "Save still works. Manage this later in Smart Memory.",
        review_memory_row_hint: "Opens Smart Memory details.",
        review_memory_ingredient_accessibility_label:
          "Memory details for active memory: {{ingredientName}} amount",
        review_memory_ingredient_accessibility_hint:
          "Opens how Smart Memory affected this ingredient.",
        review_memory_details_title: "Smart Memory details",
        review_memory_details_type_label: "Memory type",
        review_memory_details_affected_label: "Applies to",
        review_memory_details_value_label: "Used value",
        review_memory_details_state_label: "State",
        review_memory_details_evidence_label: "Evidence",
        review_memory_details_summary_portion:
          "Uses your saved amount for this ingredient.",
        review_memory_details_summary_product:
          "Uses your selected product for this ingredient.",
        review_memory_details_summary_correction:
          "Uses a repeated Review correction for this meal.",
        review_memory_details_summary_pending:
          "This memory update is waiting for sync and is not active yet.",
        review_memory_details_summary_failed:
          "This memory change needs attention, but meal saving still works.",
        review_memory_details_memory_center_cta: "Open Memory Center",
        review_memory_type_typical_portion: "Typical portion",
        review_memory_type_ingredient_product_selection: "Selected product",
        review_memory_type_review_correction: "Review correction",
        review_memory_type_settings: "Settings",
        review_memory_state_active: "Active",
        review_memory_state_pending: "Pending",
        review_memory_state_failed: "Failed",
        review_memory_evidence_count: `Based on ${options?.count ?? "{{count}}"} recent saves.`,
        review_memory_evidence_bounded: "Based on repeated saves.",
      };
      return (
        labels[key] ??
        options?.defaultValue ??
        (options?.count !== undefined
          ? `${options.ns}:${key}:${options.count}`
          : options?.ns
            ? `${options.ns}:${key}`
            : key)
      );
    },
  }),
}));

jest.mock("@/components", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: unknown }) =>
      createElement(View, null, children as never),
    KeyboardAwareScrollView: ({ children }: { children?: unknown }) =>
      createElement(View, null, children as never),
    Card: ({
      children,
      onPress,
    }: {
      children?: unknown;
      onPress?: () => void;
    }) =>
      onPress
        ? createElement(Pressable, { onPress }, children as never)
        : createElement(View, null, children as never),
    Button: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        {
          onPress,
          disabled,
          testID,
          accessibilityRole: "button",
          accessibilityState: { disabled: !!disabled },
        },
        createElement(Text, null, label),
      ),
    TextButton: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        {
          onPress,
          disabled,
          testID,
          accessibilityRole: "button",
          accessibilityState: { disabled: !!disabled },
        },
        createElement(Text, null, label),
      ),
    ScreenCornerNavButton: ({ onPress }: { onPress: () => void }) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button" },
        createElement(Text, null, "close-button"),
      ),
    Checkbox: ({
      checked,
      onChange,
      disabled,
      accessibilityLabel,
      testID,
    }: CheckboxProps) =>
      createElement(
        Pressable,
        {
          onPress: () => !disabled && onChange(!checked),
          disabled,
          testID,
          accessibilityRole: "checkbox",
          accessibilityLabel,
          accessibilityState: { checked, disabled: !!disabled },
        },
        createElement(Text, null, checked ? "checked" : "unchecked"),
      ),
    Modal: ({
      visible,
      testID,
      title,
      children,
      primaryAction,
      secondaryAction,
    }: ModalProps) =>
      visible
        ? createElement(
            View,
            { testID },
            title ? createElement(Text, null, title) : null,
            children as never,
            primaryAction
              ? createElement(
                  Pressable,
                  {
                    onPress: primaryAction.onPress,
                    accessibilityRole: "button",
                    testID: primaryAction.testID,
                  },
                  createElement(Text, null, primaryAction.label),
                )
              : null,
            secondaryAction
              ? createElement(
                  Pressable,
                  {
                    onPress: secondaryAction.onPress,
                    accessibilityRole: "button",
                    testID: secondaryAction.testID,
                  },
                  createElement(Text, null, secondaryAction.label),
                )
              : null,
          )
        : null,
    UnsavedChangesModal: ({
      visible,
      discardLabel,
      continueEditingLabel,
      onDiscard,
      onContinueEditing,
    }: UnsavedChangesModalProps) =>
      visible
        ? createElement(
            View,
            null,
            createElement(
              Pressable,
              { onPress: onDiscard, accessibilityRole: "button" },
              createElement(Text, null, discardLabel),
            ),
            createElement(
              Pressable,
              { onPress: onContinueEditing, accessibilityRole: "button" },
              createElement(Text, null, continueEditingLabel),
            ),
          )
        : null,
    PhotoPreview: () => createElement(Text, null, "photo-preview"),
  };
});

const buildMeal = (overrides?: Partial<Meal>): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-01-10T12:00:00.000Z",
  type: "breakfast",
  name: "Protein bowl",
  ingredients: [
    {
      id: "ing-1",
      name: "Chicken",
      amount: 180,
      kcal: 250,
      protein: 35,
      carbs: 0,
      fat: 8,
    },
  ],
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
  syncState: "synced",
  source: "manual",
  photoUrl: null,
  ...overrides,
});

const buildDraftContext = (mealOverrides?: Partial<Meal>) => ({
  meal: buildMeal(mealOverrides),
  clearMeal: jest.fn(),
  loadDraft: jest.fn(async (_uid: string) => undefined),
  saveDraft: jest.fn(async (_uid: string, _draft?: Meal | null) => undefined),
  setLastScreen: jest.fn(async (_uid: string, _screen: string) => undefined),
  setPhotoUrl: jest.fn(),
});

const readyReadiness: UserReadiness = {
  status: "ready",
  onboardingCompletedAt: "2026-05-01T09:00:00Z",
  readyAt: "2026-05-01T10:00:00Z",
};

const revokedAiConsent: UserAiConsent = {
  status: "revoked",
  grantedAt: "2026-05-01T10:00:00Z",
  revokedAt: "2026-05-02T10:00:00Z",
};

const buildUserData = (
  readiness: UserReadiness,
  aiConsent: UserAiConsent,
): UserData => ({
  uid: "user-1",
  email: "user@example.com",
  username: "neo",
  plan: "free",
  createdAt: 1,
  lastLogin: "2026-05-01T10:00:00Z",
  syncState: "synced",
  profile: {
    language: "en",
    nutritionProfile: {
      unitsSystem: "metric",
      age: "30",
      sex: "female",
      height: "170",
      heightInch: "",
      weight: "70",
      preferences: [],
      activityLevel: "moderate",
      goal: "maintain",
      chronicDiseases: [],
      chronicDiseasesOther: "",
      allergies: [],
      allergiesOther: "",
      lifestyle: "",
      calorieTarget: 2200,
    },
    aiPreferences: {
      stylePersona: "calm_guide",
    },
    aiConsent,
    readiness,
  },
});

const activeReviewMemoryExplanation: ReviewMemoryExplanation = {
  activeIngredients: [
    {
      ingredientName: "Chicken",
      detail: {
        key: "active-chicken",
        memoryType: "typical_portion",
        state: "active",
        affectedLabel: "Chicken",
        usedValueLabel: "180 g",
        evidence: {
          observationCount: 3,
          distinctDayCount: 2,
          selectionCount: null,
          correctionCount: null,
        },
      },
    },
  ],
  row: null,
};

const pendingReviewMemoryExplanation: ReviewMemoryExplanation = {
  activeIngredients: [],
  row: {
    kind: "pending_offline",
    detail: {
      key: "pending-candidate",
      memoryType: "typical_portion",
      state: "pending",
      affectedLabel: "Chicken",
      usedValueLabel: "",
      evidence: {
        observationCount: 1,
        distinctDayCount: null,
        selectionCount: null,
        correctionCount: null,
      },
    },
  },
};

const failedReviewMemoryExplanation: ReviewMemoryExplanation = {
  activeIngredients: [],
  row: {
    kind: "sync_failed",
    detail: {
      key: "failed-candidate",
      memoryType: "typical_portion",
      state: "failed",
      affectedLabel: "Chicken",
      usedValueLabel: "",
      evidence: {
        observationCount: null,
        distinctDayCount: null,
        selectionCount: null,
        correctionCount: null,
      },
    },
  },
};

const buildProps = () => {
  const navigate = jest.fn<(screen: string, params?: unknown) => void>();
  const dispatch = jest.fn();
  const flowGoTo = jest.fn<(screen: string, params?: unknown) => void>();
  let beforeRemoveListener:
    | ((event: {
        data: { action: { type: string } };
        preventDefault: () => void;
      }) => void)
    | undefined;

  return {
    navigate,
    dispatch,
    flowGoTo,
    getBeforeRemoveListener: () => beforeRemoveListener,
    props: {
      navigation: {
        navigate,
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        dispatch,
        addListener: jest.fn(
          (_eventName: string, listener: typeof beforeRemoveListener) => {
            beforeRemoveListener = listener ?? undefined;
            return jest.fn();
          },
        ),
      } as unknown as MealAddScreenProps<"ReviewMeal">["navigation"],
      flow: {
        goTo: flowGoTo,
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"ReviewMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"ReviewMeal">,
  };
};

describe("ReviewMealScreen", () => {
  beforeEach(() => {
    jest.spyOn(BackHandler, "addEventListener").mockImplementation(((
      _eventName: string,
      _listener: () => boolean,
    ) => {
      mockBackHandlerAddEventListener();
      return { remove: jest.fn() };
    }) as typeof BackHandler.addEventListener);

    mockGetInfoAsync.mockReset();
    mockGetInfoAsync.mockResolvedValue({ exists: true });
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseUserContext.mockReturnValue({
      userData: buildUserData(readyReadiness, revokedAiConsent),
    });
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      reviewMemoryExplanationEnabled: false,
    }));
    mockReadReviewSmartMemoryExplanation.mockReset();
    mockReadReviewSmartMemoryExplanation.mockResolvedValue({
      activeIngredients: [],
      row: null,
    });
    mockUseMeals.mockReturnValue({
      saveMeal: jest.fn(async ({ meal }: { meal: Meal }) => meal),
      meals: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not duplicate the edit details action in the review footer", () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(queryByText("Edit details")).toBeNull();
    expect(getByTestId("review-meal-ingredients-edit-button")).toBeTruthy();
  });

  it("routes ingredient summary affordances to edit meal details", () => {
    const ctx = buildDraftContext({
      photoUrl: null,
      ingredients: [
        {
          id: "ing-1",
          name: "Chicken",
          amount: 180,
          unit: "g",
          kcal: 250,
          protein: 35,
          carbs: 0,
          fat: 8,
        },
      ],
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByTestId("review-meal-ingredient-row-0"));
    fireEvent.press(getByTestId("review-meal-ingredients-edit-button"));

    expect(testProps.flowGoTo).toHaveBeenNthCalledWith(
      1,
      "EditMealDetails",
      { submitIntent: "goBack" },
    );
    expect(testProps.flowGoTo).toHaveBeenNthCalledWith(
      2,
      "EditMealDetails",
      { submitIntent: "goBack" },
    );
  });

  it("renders the ingredient count in the section title", () => {
    const ctx = buildDraftContext({
      photoUrl: null,
      ingredients: [
        {
          id: "ing-1",
          name: "Chicken",
          amount: 180,
          unit: "g",
          kcal: 250,
          protein: 35,
          carbs: 0,
          fat: 8,
        },
        {
          id: "ing-2",
          name: "Rice",
          amount: 150,
          unit: "g",
          kcal: 190,
          protein: 4,
          carbs: 42,
          fat: 1,
        },
        {
          id: "ing-3",
          name: "Vegetables",
          amount: 120,
          unit: "g",
          kcal: 70,
          protein: 3,
          carbs: 12,
          fat: 2,
        },
      ],
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByText("Ingredients (3)")).toBeTruthy();
    expect(queryByText("{{count}} ingredients")).toBeNull();
    expect(getByText("Edit ingredients")).toBeTruthy();
    expect(getByTestId("review-meal-ingredients-edit-button")).toBeTruthy();
  });

  it("keeps meal time as metadata without a change-time affordance", () => {
    const ctx = buildDraftContext({
      type: "lunch",
      timestamp: "2026-01-10T12:30:00.000",
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByText, queryByTestId, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByText(/Lunch • .*12:30/)).toBeTruthy();
    expect(queryByTestId("review-meal-change-time-button")).toBeNull();
    expect(queryByText("Change time")).toBeNull();
    expect(testProps.flowGoTo).not.toHaveBeenCalled();
  });

  it("renders the Add Meal flow header with separate back and close actions", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByTestId("review-meal-flow-header")).toBeTruthy();
    expect(queryByText("Meal summary")).toBeNull();
    expect(queryByText("Check and save")).toBeNull();

    fireEvent.press(getByTestId("review-meal-back"));
    expect(testProps.props.flow.goBack).toHaveBeenCalledTimes(1);
    expect(ctx.clearMeal).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("review-meal-close"));
    await waitFor(() => {
      expect(getByText("common:leave")).toBeTruthy();
    });
  });

  it("renders an intentional no-photo summary when the meal has no photo", () => {
    const ctx = buildDraftContext({ photoUrl: null });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId, getByText, queryByText, queryByTestId } =
      renderWithTheme(<ReviewMealScreen {...testProps.props} />);

    expect(getByTestId("review-meal-no-photo-summary")).toBeTruthy();
    expect(getByText("Meal review")).toBeTruthy();
    expect(getByText("Protein bowl")).toBeTruthy();
    expect(queryByTestId("review-meal-photo")).toBeNull();
    expect(queryByText("Add meal photo")).toBeNull();
    expect(queryByTestId("review-meal-add-photo")).toBeNull();
    expect(testProps.flowGoTo).not.toHaveBeenCalled();
  });

  it("keeps the photo variant when a meal photo is available", async () => {
    const ctx = buildDraftContext({ photoUrl: "https://example.com/meal.jpg" });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByTestId, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-photo")).toBeTruthy();
    });
    expect(queryByTestId("review-meal-no-photo-summary")).toBeNull();
  });

  it("renders calories as the hero summary and macros as accessible tiles", () => {
    const ctx = buildDraftContext({
      photoUrl: null,
      ingredients: [
        {
          id: "ing-1",
          name: "Chicken",
          amount: 180,
          kcal: 250,
          protein: 35,
          carbs: 12,
          fat: 8,
        },
      ],
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByLabelText, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByLabelText("Calories: 250 kcal")).toBeTruthy();
    expect(getByText("250 kcal")).toBeTruthy();
    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("Węgle")).toBeTruthy();
    expect(getByText("Fat")).toBeTruthy();
    expect(getByLabelText("Protein: 35 g")).toBeTruthy();
    expect(getByLabelText("Węglowodany: 12 g")).toBeTruthy();
    expect(getByLabelText("Fat: 8 g")).toBeTruthy();
  });

  it("keeps empty review drafts from saving and routes the empty-state CTA to editing", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      name: null,
      ingredients: [],
      photoUrl: null,
      localPhotoUrl: null,
      photoLocalPath: null,
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByTestId("review-meal-empty-draft-state")).toBeTruthy();
    expect(getByTestId("review-meal-save-button").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).not.toHaveBeenCalled();
    });

    fireEvent.press(getByTestId("review-meal-empty-edit-button"));
    expect(testProps.flowGoTo).toHaveBeenCalledWith("EditMealDetails", {
      submitIntent: "goBack",
    });
  });

  it("blocks unknown planned drafts with no positive nutrition evidence", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      planningEnabled: true,
    }));
    const ctx = buildDraftContext({
      name: "Name-only plan",
      ingredients: [],
      totals: undefined,
      photoUrl: null,
      localPhotoUrl: null,
      photoLocalPath: null,
      planningSource: {
        plannedMealId: "planned-unknown-1",
        plannedMealVersion: 1,
        sourceType: "manual",
        sourceRef: null,
        nutritionEstimateState: "unknown",
        missingNutritionFields: ["kcal", "protein", "fat", "carbs"],
      },
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByTestId("review-meal-planning-nutrition-blocked")).toBeTruthy();
    expect(getByTestId("review-meal-save-button").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).not.toHaveBeenCalled();
    });

    fireEvent.press(getByTestId("review-meal-planning-nutrition-edit-button"));
    expect(testProps.flowGoTo).toHaveBeenCalledWith("EditMealDetails", {
      submitIntent: "goBack",
    });
  });

  it("blocks partial planned drafts with no positive nutrition evidence", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      planningEnabled: true,
    }));
    const ctx = buildDraftContext({
      name: "Partial plan without macros",
      ingredients: [],
      totals: undefined,
      photoUrl: null,
      localPhotoUrl: null,
      photoLocalPath: null,
      planningSource: {
        plannedMealId: "planned-partial-1",
        plannedMealVersion: 1,
        sourceType: "manual",
        sourceRef: null,
        nutritionEstimateState: "partial",
        missingNutritionFields: ["kcal", "protein", "fat", "carbs"],
      },
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByTestId("review-meal-planning-nutrition-blocked")).toBeTruthy();
    expect(getByTestId("review-meal-save-button").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).not.toHaveBeenCalled();
    });
  });

  it("blocks planned-source Review saves when Planning is disabled", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      name: "Estimated planned meal",
      ingredients: [],
      totals: { kcal: 420, protein: 32, fat: 10, carbs: 45 },
      photoUrl: null,
      planningSource: {
        plannedMealId: "planned-disabled-1",
        plannedMealVersion: 2,
        sourceType: "manual",
        sourceRef: null,
        nutritionEstimateState: "known",
        missingNutritionFields: [],
      },
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByTestId("review-meal-planning-disabled-blocked")).toBeTruthy();
    expect(queryByTestId("review-meal-planning-nutrition-blocked")).toBeNull();
    expect(getByTestId("review-meal-save-button").props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).not.toHaveBeenCalled();
    });
  });

  it("allows planned drafts with explicit positive nutrition evidence", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      planningEnabled: true,
    }));
    const ctx = buildDraftContext({
      name: "Estimated planned meal",
      ingredients: [],
      totals: { kcal: 420, protein: 32, fat: 10, carbs: 45 },
      photoUrl: null,
      planningSource: {
        plannedMealId: "planned-positive-1",
        plannedMealVersion: 2,
        sourceType: "manual",
        sourceRef: null,
        nutritionEstimateState: "unknown",
        missingNutritionFields: ["fat"],
      },
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { queryByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(queryByTestId("review-meal-planning-nutrition-blocked")).toBeNull();
    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          meal: expect.objectContaining({
            planningSource: expect.objectContaining({
              plannedMealId: "planned-positive-1",
              plannedMealVersion: 2,
            }),
            totals: { kcal: 420, protein: 32, fat: 10, carbs: 45 },
          }),
        }),
      );
    });
  });

  it("allows planned drafts when ingredient rows are zero but aggregate totals are positive", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      planningEnabled: true,
    }));
    const ctx = buildDraftContext({
      name: "Planned estimate",
      ingredients: [
        {
          id: "ing-zero",
          name: "Planned portion",
          amount: 1,
          unit: "g",
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
        },
      ],
      totals: { kcal: 510, protein: 28, fat: 18, carbs: 62 },
      photoUrl: null,
      planningSource: {
        plannedMealId: "planned-aggregate-1",
        plannedMealVersion: 3,
        sourceType: "manual",
        sourceRef: null,
        nutritionEstimateState: "partial",
        missingNutritionFields: [],
      },
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { queryByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(queryByTestId("review-meal-planning-nutrition-blocked")).toBeNull();
    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          meal: expect.objectContaining({
            planningSource: expect.objectContaining({
              plannedMealId: "planned-aggregate-1",
              plannedMealVersion: 3,
            }),
            totals: { kcal: 510, protein: 28, fat: 18, carbs: 62 },
          }),
        }),
      );
    });
  });

  it("saves the reviewed meal and resets back home", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext();
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledTimes(1);
      expect(ctx.clearMeal).toHaveBeenCalledWith("user-1");
      expect(testProps.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: {
          index: 0,
          routes: [{ name: "Home" }],
        },
      });
    });
  });

  it("keeps save/reset behavior unchanged when memory UI is present", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext();
    const testProps = buildProps();

    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-info-0")).toBeTruthy();
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledTimes(1);
      expect(ctx.clearMeal).toHaveBeenCalledWith("user-1");
      expect(testProps.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: {
          index: 0,
          routes: [{ name: "Home" }],
        },
      });
    });
  });

  it("saves a manual draft for a ready profile with revoked AI consent", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      source: "manual",
      inputMethod: "manual",
    });
    const testProps = buildProps();
    const userData = buildUserData(readyReadiness, revokedAiConsent);

    expect(userData.profile.readiness.status).toBe("ready");
    expect(userData.profile.aiConsent.status).toBe("revoked");

    mockUseUserContext.mockReturnValue({ userData });
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          meal: expect.objectContaining({
            userUid: "user-1",
            mealId: "meal-1",
            source: "manual",
            inputMethod: "manual",
            name: "Protein bowl",
          }),
          savedTemplate: { mode: "none" },
        }),
      );
      expect(ctx.clearMeal).toHaveBeenCalledWith("user-1");
      expect(testProps.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: {
          index: 0,
          routes: [{ name: "Home" }],
        },
      });
    });
  });

  it("saves meal and opens share composer from review entry", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      photoUrl: "https://example.com/meal.jpg",
    });
    const testProps = buildProps();

    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByText("Save and share"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledTimes(1);
      expect(ctx.clearMeal).toHaveBeenCalledWith("user-1");
      expect(testProps.navigate).toHaveBeenCalledWith(
        "MealShare",
        expect.objectContaining({
          returnTo: "ReviewMeal",
        }),
      );
    });
  });

  it("shows a quick-check note for low-confidence ai meals", () => {
    const ctx = buildDraftContext({
      source: "ai",
      aiMeta: { confidence: 0.6 },
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(
      getByText("If something looks off, edit details before saving."),
    ).toBeTruthy();
  });

  it("keeps Review memory UI suppressed when the explicit gate is off", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(mockReadReviewSmartMemoryExplanation).not.toHaveBeenCalled();
    });
    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();
    expect(queryByTestId("review-meal-memory-row")).toBeNull();
  });

  it("does not let Smart Memory influence Review when Review apply is disabled", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: false,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { queryByTestId, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(mockReadReviewSmartMemoryExplanation).not.toHaveBeenCalled();
    });

    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();
    expect(queryByTestId("review-meal-memory-row")).toBeNull();
    expect(queryByTestId("review-meal-memory-details-modal")).toBeNull();
    expect(queryByText("Open Memory Center")).toBeNull();
    expect(testProps.navigate).not.toHaveBeenCalledWith("MemoryCenter");
  });

  it("shows no Review memory UI when the gate is on but there is no supported signal", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue({
      activeIngredients: [],
      row: null,
    });

    const { queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(mockReadReviewSmartMemoryExplanation).toHaveBeenCalledTimes(1);
    });
    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();
    expect(queryByTestId("review-meal-memory-row")).toBeNull();
  });

  it("shows active memory as an inline ingredient info icon with bounded details", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseUserContext.mockReturnValue({
      userData: buildUserData(readyReadiness, revokedAiConsent),
    });
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { getAllByText, getByTestId, getByText, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-info-0")).toBeTruthy();
    });
    expect(mockReadReviewSmartMemoryExplanation).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        nutritionProfile: expect.objectContaining({
          allergies: [],
          preferences: [],
        }),
      }),
    );
    expect(queryByTestId("review-meal-memory-row")).toBeNull();

    fireEvent.press(getByTestId("review-meal-memory-info-0"));

    expect(getByTestId("review-meal-memory-details-modal")).toBeTruthy();
    expect(getByText("Smart Memory details")).toBeTruthy();
    expect(getByText("Uses your saved amount for this ingredient.")).toBeTruthy();
    expect(getByText("Applies to")).toBeTruthy();
    expect(getAllByText("Chicken").length).toBeGreaterThanOrEqual(2);
    expect(getByText("Memory type")).toBeTruthy();
    expect(getByText("Typical portion")).toBeTruthy();
    expect(getByText("Used value")).toBeTruthy();
    expect(getByText("180 g")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
    expect(getByText("Based on 3 recent saves.")).toBeTruthy();
    expect(testProps.flowGoTo).not.toHaveBeenCalled();

    fireEvent.press(getByText("Open Memory Center"));
    expect(testProps.navigate).toHaveBeenCalledWith("MemoryCenter");
  });

  it("does not save the meal from active memory details or Memory Center navigation", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-info-0")).toBeTruthy();
    });

    fireEvent.press(getByTestId("review-meal-memory-info-0"));
    expect(getByTestId("review-meal-memory-details-modal")).toBeTruthy();

    fireEvent.press(getByText("Open Memory Center"));

    expect(testProps.navigate).toHaveBeenCalledWith("MemoryCenter");
    expect(saveMeal).not.toHaveBeenCalled();
    expect(ctx.clearMeal).not.toHaveBeenCalled();
    expect(testProps.dispatch).not.toHaveBeenCalledWith({
      type: "RESET",
      payload: {
        index: 0,
        routes: [{ name: "Home" }],
      },
    });
    expect(testProps.flowGoTo).not.toHaveBeenCalled();
  });

  it("does not read or expose Review memory when Smart Memory is disabled", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: false,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { queryByTestId, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(mockReadReviewSmartMemoryExplanation).not.toHaveBeenCalled();
    });

    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();
    expect(queryByTestId("review-meal-memory-row")).toBeNull();
    expect(queryByTestId("review-meal-memory-details-modal")).toBeNull();
    expect(queryByTestId("review-meal-memory-details-memory-center")).toBeNull();
    expect(queryByText("Open Memory Center")).toBeNull();
    expect(testProps.navigate).not.toHaveBeenCalledWith("MemoryCenter");
  });

  it("shows a single non-blocking pending memory row above nutrition", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      pendingReviewMemoryExplanation,
    );

    const { getByTestId, getByText, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-row")).toBeTruthy();
    });
    expect(getByText("Memory update will sync when online.")).toBeTruthy();
    expect(getByText("This does not block saving this meal.")).toBeTruthy();
    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();
  });

  it("does not save the meal from a pending memory row details modal", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      pendingReviewMemoryExplanation,
    );

    const { getByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-row")).toBeTruthy();
    });

    fireEvent.press(getByTestId("review-meal-memory-row"));
    expect(getByTestId("review-meal-memory-details-modal")).toBeTruthy();

    fireEvent.press(getByTestId("review-meal-memory-details-close"));

    expect(getByTestId("review-meal-save-button")).toBeTruthy();
    expect(saveMeal).not.toHaveBeenCalled();
    expect(ctx.clearMeal).not.toHaveBeenCalled();
    expect(testProps.dispatch).not.toHaveBeenCalledWith({
      type: "RESET",
      payload: {
        index: 0,
        routes: [{ name: "Home" }],
      },
    });
    expect(testProps.navigate).not.toHaveBeenCalledWith("Home");
    expect(testProps.flowGoTo).not.toHaveBeenCalled();
  });

  it("saves current Review draft values when active memory explanation is visible", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      ingredients: [
        {
          id: "ing-1",
          name: "Chicken",
          amount: 90,
          unit: "g",
          kcal: 125,
          protein: 18,
          carbs: 0,
          fat: 4,
        },
      ],
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      activeReviewMemoryExplanation,
    );

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-info-0")).toBeTruthy();
    });

    expect(getByText("90 g")).toBeTruthy();
    fireEvent.press(getByTestId("review-meal-memory-info-0"));
    expect(getByTestId("review-meal-memory-details-modal")).toBeTruthy();
    expect(getByText("180 g")).toBeTruthy();
    fireEvent.press(getByTestId("review-meal-memory-details-close"));

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          meal: expect.objectContaining({
            ingredients: [
              expect.objectContaining({
                name: "Chicken",
                amount: 90,
                unit: "g",
                kcal: 125,
                protein: 18,
                fat: 4,
              }),
            ],
          }),
        }),
      );
    });
  });

  it("shows sync failed memory as one non-blocking row with bounded details", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockGetRuntimeConfig.mockReturnValue(createRuntimeConfig({
      smartMemoryEnabled: true,
      reviewMemoryExplanationEnabled: true,
    }));
    mockReadReviewSmartMemoryExplanation.mockResolvedValue(
      failedReviewMemoryExplanation,
    );

    const { getByTestId, getByText, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(getByTestId("review-meal-memory-row")).toBeTruthy();
    });
    expect(getByText("Memory change did not sync.")).toBeTruthy();
    expect(getByText("Save still works. Manage this later in Smart Memory.")).toBeTruthy();
    expect(queryByTestId("review-meal-memory-info-0")).toBeNull();

    fireEvent.press(getByTestId("review-meal-memory-row"));
    expect(getByText("This memory change needs attention, but meal saving still works.")).toBeTruthy();
    expect(getByText("Failed")).toBeTruthy();
  });

  it("keeps Polish Review memory copy compact and bounded", () => {
    const keys = [
      "review_memory_row_candidate_title",
      "review_memory_row_candidate_body",
      "review_memory_row_pending_title",
      "review_memory_row_pending_body",
      "review_memory_row_sync_failed_title",
      "review_memory_row_sync_failed_body",
      "review_memory_ingredient_accessibility_label",
      "review_memory_details_summary_portion",
      "review_memory_details_summary_pending",
      "review_memory_details_summary_failed",
      "review_memory_details_memory_center_cta",
    ] as const;

    for (const key of keys) {
      const value = plMeals[key];
      expect(typeof value).toBe("string");
      expect(value.length).toBeLessThanOrEqual(80);
      expect(value).not.toMatch(/zawsze|idealn|wiemy/i);
    }
  });

  it("logs from saved meal without updating template when checkbox is unchecked", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const finalTimestamp = "2026-03-20T08:30:00.000Z";
    const expectedDate = new Date(finalTimestamp);
    const ctx = buildDraftContext({
      source: "saved",
      inputMethod: "manual",
      savedMealRefId: "saved-template-1",
      timestamp: finalTimestamp,
      dayKey: "2026-01-10",
      loggedAtLocalMin: 780,
      tzOffsetMin: 60,
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          meal: expect.objectContaining({
            source: "saved",
            inputMethod: "manual",
            timestamp: finalTimestamp,
            dayKey: "2026-03-20",
            loggedAtLocalMin:
              expectedDate.getHours() * 60 + expectedDate.getMinutes(),
            tzOffsetMin: -expectedDate.getTimezoneOffset(),
          }),
          savedTemplate: { mode: "none" },
        }),
      );
      expect(testProps.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: {
          index: 0,
          routes: [{ name: "Home" }],
        },
      });
    });
  });

  it("creates a saved template only when the saved-meal option is checked", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      source: "manual",
      inputMethod: "manual",
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByText("Save as my meal")).toBeTruthy();
    expect(queryByText("Makes it quicker to add again next time.")).toBeNull();

    fireEvent.press(getByTestId("review-meal-save-to-my-meals-checkbox"));
    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          savedTemplate: { mode: "create" },
        }),
      );
    });
  });

  it("updates existing saved template when checkbox is checked", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const ctx = buildDraftContext({
      source: "saved",
      savedMealRefId: "saved-template-42",
    });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);
    mockUseMeals.mockReturnValue({
      saveMeal,
      meals: [],
    });

    const { getByTestId, getByText, queryByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(getByText("Update saved meal")).toBeTruthy();
    expect(
      queryByText("Keeps these changes for the next time you reuse it."),
    ).toBeNull();

    fireEvent.press(getByTestId("review-meal-save-to-my-meals-checkbox"));
    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          savedTemplate: { mode: "update", templateId: "saved-template-42" },
        }),
      );
      expect(testProps.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: {
          index: 0,
          routes: [{ name: "Home" }],
        },
      });
    });
  });

  it("shows the leave-flow modal on navigation back instead of returning to camera", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    const preventDefault = jest.fn();
    act(() => {
      testProps.getBeforeRemoveListener()?.({
        data: { action: { type: "GO_BACK" } },
        preventDefault,
      });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(getByText("common:leave")).toBeTruthy();
    });

    fireEvent.press(getByText("common:leave"));
    expect(ctx.clearMeal).toHaveBeenCalledWith("user-1");
    expect(testProps.props.navigation.dispatch).toHaveBeenCalledWith({
      type: "GO_BACK",
    });
    expect(mockBackHandlerAddEventListener).toHaveBeenCalled();
  });
});
