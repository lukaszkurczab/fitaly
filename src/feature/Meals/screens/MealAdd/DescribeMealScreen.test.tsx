import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
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
};

const mockUseMealTextAiState = jest.fn();

const buildTextAiState = (overrides: Record<string, unknown> = {}) => ({
  name: "",
  quickDescription: "",
  loading: false,
  showLimitModal: false,
  creditsUsed: 0,
  creditsBalance: 74,
  textMealCost: 1,
  remainingCreditsAfterAnalyze: 73,
  descriptionError: undefined,
  submitError: undefined,
  analyzeDisabled: false,
  analysisState: "ready",
  creditAllocation: 100,
  onNameChange: jest.fn(),
  onQuickDescriptionChange: jest.fn(),
  onAnalyze: jest.fn(),
  closeLimitModal: jest.fn(),
  openPaywall: jest.fn(),
  ...overrides,
});

jest.mock("@/feature/Meals/hooks/useMealTextAiState", () => ({
  useMealTextAiState: (params: unknown) => mockUseMealTextAiState(params),
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
    ErrorBox: ({ message }: { message: string }) =>
      createElement(Text, null, message),
    Modal: () => null,
    UnsavedChangesModal: () => null,
    TextInput: ({ label, autoCapitalize }: TextInputProps) =>
      createElement(
        View,
        null,
        createElement(Text, null, label ?? ""),
        createElement(
          Text,
          {
            testID:
              label === "meals:meal_name"
                ? "describe-meal-name-autocap"
                : "describe-meal-description-autocap",
          },
          autoCapitalize ?? "undefined",
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
    expect(getByTestId("describe-meal-description-autocap").props.children).toBe("none");
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

  it("explains disabled CTA when description is missing", () => {
    mockUseMealTextAiState.mockReturnValue({
      ...buildTextAiState(),
      analyzeDisabled: true,
      analysisState: "missing_description",
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

    expect(getByText("Add a meal description to prepare a summary.")).toBeTruthy();
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
