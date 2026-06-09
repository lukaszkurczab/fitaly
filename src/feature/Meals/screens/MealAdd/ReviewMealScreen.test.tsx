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
  primaryAction?: { label: string; onPress?: () => void };
  secondaryAction?: { label: string; onPress?: () => void };
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
    Modal: ({ visible, primaryAction, secondaryAction }: ModalProps) =>
      visible
        ? createElement(
            View,
            null,
            primaryAction
              ? createElement(
                  Pressable,
                  {
                    onPress: primaryAction.onPress,
                    accessibilityRole: "button",
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
    mockUseUserContext.mockReturnValue({ userData: { uid: "user-1" } });
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

  it("logs from saved meal without updating template when checkbox is unchecked", async () => {
    const saveMeal = jest.fn(async ({ meal }: { meal: Meal }) => meal);
    const finalTimestamp = "2026-03-20T08:30:00.000Z";
    const expectedDate = new Date(finalTimestamp);
    const ctx = buildDraftContext({
      source: "saved",
      inputMethod: "saved",
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
            inputMethod: "saved",
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
