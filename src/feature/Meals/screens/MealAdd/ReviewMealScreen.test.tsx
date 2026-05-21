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
import type { Meal } from "@/types/meal";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
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
        carbs_compact: "Węgle",
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
    Checkbox: ({ checked, onChange }: CheckboxProps) =>
      createElement(
        Pressable,
        {
          onPress: () => onChange(!checked),
          testID: "save-to-my-meals-checkbox",
          accessibilityRole: "checkbox",
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
  photoUrl: "file:///meal.jpg",
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

const buildProps = () => {
  const navigate = jest.fn<(screen: string, params?: unknown) => void>();
  const flowGoTo = jest.fn<(screen: string, params?: unknown) => void>();
  let beforeRemoveListener:
    | ((event: {
        data: { action: { type: string } };
        preventDefault: () => void;
      }) => void)
    | undefined;

  return {
    navigate,
    flowGoTo,
    getBeforeRemoveListener: () => beforeRemoveListener,
    props: {
      navigation: {
        navigate,
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        dispatch: jest.fn(),
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

  it("routes to edit details from the review action block", async () => {
    const ctx = buildDraftContext();
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    await waitFor(() => {
      expect(mockGetInfoAsync).toHaveBeenCalledWith("file:///meal.jpg");
    });

    fireEvent.press(getByText("Edit details"));

    expect(testProps.flowGoTo).toHaveBeenCalledWith("EditMealDetails", {});
  });

  it("does not show the add-photo slot when the meal has no photo", () => {
    const ctx = buildDraftContext({ photoUrl: null });
    const testProps = buildProps();
    mockUseMealDraftContext.mockReturnValue(ctx);

    const { queryByText, queryByTestId } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    expect(queryByText("Add meal photo")).toBeNull();
    expect(queryByTestId("review-meal-add-photo")).toBeNull();
    expect(testProps.flowGoTo).not.toHaveBeenCalled();
  });

  it("renders calories as the hero summary and macros as compact chips", () => {
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
    expect(getByLabelText("Carbs: 12g")).toBeTruthy();
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
    expect(getByTestId("review-meal-save-button").props.accessibilityState).toEqual({
      disabled: true,
    });

    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).not.toHaveBeenCalled();
    });

    fireEvent.press(getByTestId("review-meal-empty-edit-button"));
    expect(testProps.flowGoTo).toHaveBeenCalledWith("EditMealDetails", {});
  });

  it("saves the reviewed meal and navigates home", async () => {
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
      expect(testProps.navigate).toHaveBeenCalledWith("Home");
    });
  });

  it("saves meal and opens share composer from review entry", async () => {
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
      expect(testProps.navigate).toHaveBeenCalledWith("Home");
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

    const { getByTestId, getByText } = renderWithTheme(
      <ReviewMealScreen {...testProps.props} />,
    );

    fireEvent.press(getByTestId("save-to-my-meals-checkbox"));
    fireEvent.press(getByText("Save meal"));

    await waitFor(() => {
      expect(saveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          savedTemplate: { mode: "update", templateId: "saved-template-42" },
        }),
      );
      expect(testProps.navigate).toHaveBeenCalledWith("Home");
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
