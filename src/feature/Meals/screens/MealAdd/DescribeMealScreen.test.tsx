import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import DescribeMealScreen from "@/feature/Meals/screens/MealAdd/DescribeMealScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

type TextInputProps = {
  label?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  testID?: string;
  multiline?: boolean;
  numberOfLines?: number;
  value?: string;
  onChangeText?: (text: string) => void;
  style?: object;
  fieldStyle?: unknown;
  inputStyle?: unknown;
};

const mockUseMealTextAiState = jest.fn();
const mockGetTextDetailsExpandedPreference = jest.fn<() => Promise<boolean>>();
const mockSetTextDetailsExpandedPreference = jest.fn<
  (_uid: string | null | undefined, _expanded: boolean) => Promise<void>
>();

const buildTextAiState = (overrides: Record<string, unknown> = {}) => ({
  name: "",
  quickDescription: "",
  textIngredients: [],
  servingAmount: "",
  loading: false,
  showLimitModal: false,
  creditsUsed: 0,
  creditsBalance: 74,
  textMealCost: 1,
  remainingCreditsAfterAnalyze: 73,
  nameError: undefined,
  submitError: undefined,
  analyzeDisabled: false,
  analysisState: "ready",
  creditAllocation: 100,
  onNameChange: jest.fn(),
  onQuickDescriptionChange: jest.fn(),
  onServingAmountChange: jest.fn(),
  onAddTextIngredient: jest.fn(),
  onUpdateTextIngredient: jest.fn(),
  onRemoveTextIngredient: jest.fn(),
  onAnalyze: jest.fn(),
  closeLimitModal: jest.fn(),
  openPaywall: jest.fn(),
  ...overrides,
});

jest.mock("@/feature/Meals/hooks/useMealTextAiState", () => ({
  useMealTextAiState: (params: unknown) => mockUseMealTextAiState(params),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ uid: "user-1" }),
}));

jest.mock("@/feature/Meals/services/textDetailsPreference", () => ({
  getTextDetailsExpandedPreference: () => mockGetTextDetailsExpandedPreference(),
  setTextDetailsExpandedPreference: (
    uid: string | null | undefined,
    expanded: boolean,
  ) => mockSetTextDetailsExpandedPreference(uid, expanded),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "pl" },
    t: (
      key: string,
      options?: {
        ns?: string;
        defaultValue?: string;
        count?: number;
        cost?: number;
      },
    ) => {
      if (options?.defaultValue) {
        return options.defaultValue
          .replace("{{count}}", String(options.count ?? ""))
          .replace("{{cost}}", String(options.cost ?? ""));
      }

      return options?.ns ? `${options.ns}:${key}` : key;
    },
  }),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
    KeyboardAwareScrollView: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
    ScreenCornerNavButton: ({ onPress }: { onPress: () => void }) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button" },
        createElement(Text, null, "screen-corner-button"),
      ),
    Button: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    TextButton: ({ label, onPress, disabled, testID }: ButtonProps) =>
      createElement(
        Pressable,
        { onPress, disabled, testID, accessibilityRole: "button" },
        createElement(Text, null, label),
      ),
    ErrorBox: ({ message }: { message: string }) =>
      createElement(Text, null, message),
    Modal: () => null,
    UnsavedChangesModal: () => null,
    TextInput: ({
      label,
      autoCapitalize,
      testID,
      multiline,
      numberOfLines,
      value,
      onChangeText,
      style,
      fieldStyle,
      inputStyle,
    }: TextInputProps) =>
      createElement(
        View,
        { testID, style },
        createElement(Text, null, label ?? ""),
        testID
          ? createElement(
              Pressable,
              {
                testID: `${testID}-change-text`,
                onPress: () => onChangeText?.("changed"),
                accessibilityRole: "button",
              },
              createElement(Text, null, value ?? ""),
            )
          : null,
        testID
          ? createElement(
              Text,
              { testID: `${testID}-multiline` },
              String(multiline === true),
            )
          : null,
        testID
          ? createElement(
              Text,
              { testID: `${testID}-number-of-lines` },
              String(numberOfLines ?? ""),
            )
          : null,
        testID
          ? createElement(
              Text,
              { testID: `${testID}-field-style` },
              String(fieldStyle !== undefined),
            )
          : null,
        testID
          ? createElement(
              Text,
              { testID: `${testID}-input-style` },
              String(inputStyle !== undefined),
            )
          : null,
        createElement(
          Text,
          {
            testID:
              label === "meals:describe_meal_name_label"
                ? "describe-meal-name-autocap"
                : "describe-meal-description-autocap",
          },
          autoCapitalize ?? "undefined",
        ),
      ),
    NumberInput: (props: TextInputProps) =>
      createElement(
        View,
        { testID: props.testID, style: props.style },
        createElement(Text, null, props.label ?? ""),
        createElement(
          Pressable,
          {
            testID: props.testID ? `${props.testID}-change-text` : undefined,
            onPress: () => props.onChangeText?.("120"),
            accessibilityRole: "button",
          },
          createElement(Text, null, props.value ?? ""),
        ),
      ),
  };
});

jest.mock("@/components/AiCreditsBadge", () => ({
  AiCreditsBadge: () => null,
}));

jest.mock("@/feature/Meals/components/MealAddPhotoScaffold", () => ({
  MealAddPhotoScaffold: ({
    preview,
    content,
  }: {
    preview?: ReactNode;
    content?: ReactNode;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(View, null, preview, content);
  },
  MealAddTextLink: ({ label, onPress, disabled, testID }: ButtonProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      Pressable,
      { onPress, disabled, testID, accessibilityRole: "button" },
      createElement(Text, null, label),
    );
  },
}));

describe("DescribeMealScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTextDetailsExpandedPreference.mockResolvedValue(false);
    mockSetTextDetailsExpandedPreference.mockResolvedValue(undefined);
    mockUseMealTextAiState.mockReturnValue(buildTextAiState());
  });

  it("does not auto-capitalize text inputs", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(getByTestId("describe-meal-name-autocap").props.children).toBe("none");
    fireEvent.press(getByTestId("add-meal-text-details-toggle"));
    expect(getByTestId("describe-meal-description-autocap").props.children).toBe("none");
  });

  it("keeps the full-screen text entry shell transparent so Layout material remains visible", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId } = renderWithTheme(<DescribeMealScreen {...props} />);
    const screenStyle = StyleSheet.flatten(
      getByTestId("add-meal-text-screen").props.style,
    );

    expect(screenStyle?.backgroundColor).toBeUndefined();
  });

  it("starts with optional details collapsed", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId, queryByTestId } = renderWithTheme(
      <DescribeMealScreen {...props} />,
    );

    expect(getByTestId("add-meal-text-details-toggle")).toBeTruthy();
    expect(queryByTestId("add-meal-text-description-input")).toBeNull();
  });

  it("expands optional details as lightweight fields and persists the state", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId } = renderWithTheme(<DescribeMealScreen {...props} />);

    fireEvent.press(getByTestId("add-meal-text-details-toggle"));

    const descriptionInput = getByTestId("add-meal-text-description-input");

    expect(getByTestId("add-meal-text-description-input-multiline").props.children).toBe("true");
    expect(getByTestId("add-meal-text-description-input-number-of-lines").props.children).toBe("4");
    expect(descriptionInput).toBeTruthy();
    expect(getByTestId("add-meal-text-ingredients-add-button")).toBeTruthy();
    expect(getByTestId("add-meal-text-serving-input")).toBeTruthy();
    expect(getByTestId("add-meal-text-description-input-field-style").props.children).toBe("true");
    expect(getByTestId("add-meal-text-description-input-input-style").props.children).toBe("true");
    expect(mockSetTextDetailsExpandedPreference).toHaveBeenCalledWith(
      "user-1",
      true,
    );
  });

  it("renders editable ingredient rows when optional ingredients exist", () => {
    const onUpdateTextIngredient = jest.fn();
    const onRemoveTextIngredient = jest.fn();
    mockUseMealTextAiState.mockReturnValue(
      buildTextAiState({
        textIngredients: [{ id: "ingredient-1", name: "Rice", amount: "120" }],
        onUpdateTextIngredient,
        onRemoveTextIngredient,
      }),
    );
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: { textIngredients: [{ id: "ingredient-1", name: "Rice", amount: "120" }] },
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(getByTestId("add-meal-text-ingredient-name-input-0")).toBeTruthy();
    expect(getByTestId("add-meal-text-ingredient-amount-input-0")).toBeTruthy();

    fireEvent.press(
      getByTestId("add-meal-text-ingredient-name-input-0-change-text"),
    );
    fireEvent.press(
      getByTestId("add-meal-text-ingredient-amount-input-0-change-text"),
    );
    fireEvent.press(getByTestId("add-meal-text-ingredient-remove-button-0"));

    expect(onUpdateTextIngredient).toHaveBeenCalledWith("ingredient-1", {
      name: "changed",
    });
    expect(onUpdateTextIngredient).toHaveBeenCalledWith("ingredient-1", {
      amount: "120",
    });
    expect(onRemoveTextIngredient).toHaveBeenCalledWith("ingredient-1");
  });

  it("restores the persisted expanded optional-details state", async () => {
    mockGetTextDetailsExpandedPreference.mockResolvedValue(true);
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByTestId } = renderWithTheme(<DescribeMealScreen {...props} />);

    await waitFor(() => {
      expect(getByTestId("add-meal-text-description-input")).toBeTruthy();
    });
  });

  it("opens the temporary method chooser", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByText } = renderWithTheme(<DescribeMealScreen {...props} />);

    fireEvent.press(getByText("meals:change_method"));

    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("shows remaining credits note for assistant analysis", () => {
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByText } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(getByText("✦ 73 credits remaining")).toBeTruthy();
  });

  it("explains disabled CTA when meal name is missing", () => {
    mockUseMealTextAiState.mockReturnValue({
      ...buildTextAiState(),
      analyzeDisabled: true,
      analysisState: "missing_name",
      creditsBalance: 74,
      remainingCreditsAfterAnalyze: 73,
    });
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByText } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(getByText("Enter a meal name to prepare a summary.")).toBeTruthy();
  });

  it("explains disabled CTA while credits are unverified", () => {
    mockUseMealTextAiState.mockReturnValue({
      ...buildTextAiState(),
      analyzeDisabled: true,
      analysisState: "credits_unverified",
      creditsBalance: null,
      remainingCreditsAfterAnalyze: null,
    });
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByText } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(getByText("Checking available AI Credits...")).toBeTruthy();
  });

  it("shows a hard stop and upgrade link when credits are insufficient", () => {
    mockUseMealTextAiState.mockReturnValue({
      ...buildTextAiState(),
      analyzeDisabled: true,
      analysisState: "insufficient_credits",
      creditsBalance: 0,
      remainingCreditsAfterAnalyze: 0,
    });
    const props = {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
      } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"DescribeMeal">["flow"],
      params: {},
    } as MealAddScreenProps<"DescribeMeal">;

    const { getByText } = renderWithTheme(<DescribeMealScreen {...props} />);

    expect(
      getByText("You do not have enough AI Credits to prepare a summary."),
    ).toBeTruthy();
    expect(getByText("chat:limit.upgradeCta")).toBeTruthy();
  });
});
