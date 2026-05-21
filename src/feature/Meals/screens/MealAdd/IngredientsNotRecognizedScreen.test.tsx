import type { ReactNode } from "react";
import { fireEvent } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import IngredientsNotRecognizedScreen from "@/feature/Meals/screens/MealAdd/IngredientsNotRecognizedScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  children?: ReactNode;
};

const mockUseMealDraftContext = jest.fn();
const mockUseAuthContext = jest.fn();

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, options?: { defaultValue?: string } | string) =>
      typeof options === "string"
        ? options
        : options?.defaultValue ?? `${ns}:${key}`,
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
  };
});

const buildProps = (
  params: MealAddScreenProps<"IngredientsNotRecognized">["params"],
) =>
  ({
    navigation: {
      navigate: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
    } as unknown as MealAddScreenProps<"IngredientsNotRecognized">["navigation"],
    flow: {
      goTo: jest.fn<(screen: string, params?: unknown) => void>(),
      replace: jest.fn<(screen: string, params?: unknown) => void>(),
      goBack: jest.fn<() => void>(),
      canGoBack: jest.fn(() => true),
    } as unknown as MealAddScreenProps<"IngredientsNotRecognized">["flow"],
    params,
  }) as MealAddScreenProps<"IngredientsNotRecognized">;

describe("IngredientsNotRecognizedScreen", () => {
  beforeEach(() => {
    mockUseMealDraftContext.mockReturnValue({ clearMeal: jest.fn() });
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
  });

  it("retries the camera flow before the max attempts", () => {
    const props = buildProps({
      image: "file:///meal.jpg",
      id: "meal-1",
      attempt: 2,
    });

    const { getByText } = renderWithTheme(
      <IngredientsNotRecognizedScreen {...props} />,
    );

    fireEvent.press(getByText("Retake photo (2/3)"));

    expect(props.flow.goTo).toHaveBeenCalledWith("CameraDefault", {
      id: "meal-1",
      attempt: 3,
    });
  });

  it("offers manual and product database paths when AI is unavailable", () => {
    const props = buildProps({
      image: "file:///meal.jpg",
      id: "meal-1",
      reason: "ai_unavailable",
    });

    const { getByText } = renderWithTheme(
      <IngredientsNotRecognizedScreen {...props} />,
    );

    fireEvent.press(getByText("Enter ingredients manually"));
    fireEvent.press(getByText("Use product database"));
    fireEvent.press(getByText("Cancel"));

    expect(props.flow.replace).toHaveBeenCalledWith("EditMealDetails", {});
    expect(props.navigation.replace).toHaveBeenCalledWith("SavedMeals");
    expect(props.flow.goBack).toHaveBeenCalledTimes(1);
  });

  it("opens the temporary method chooser and clears the draft", () => {
    const clearMeal = jest.fn();
    mockUseMealDraftContext.mockReturnValue({ clearMeal });
    const props = buildProps({
      image: "file:///meal.jpg",
      id: "meal-1",
      attempt: 3,
    });

    const { getByText, queryByText } = renderWithTheme(
      <IngredientsNotRecognizedScreen {...props} />,
    );

    expect(queryByText("Retake photo (3/3)")).toBeNull();
    fireEvent.press(getByText("Change add method"));

    expect(clearMeal).toHaveBeenCalledWith("user-1");
    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("renders offline copy and still allows changing the method", () => {
    const clearMeal = jest.fn();
    mockUseMealDraftContext.mockReturnValue({ clearMeal });
    const props = buildProps({
      image: "file:///meal.jpg",
      id: "meal-1",
      reason: "offline",
    });

    const { getByText } = renderWithTheme(
      <IngredientsNotRecognizedScreen {...props} />,
    );

    expect(getByText("You're offline")).toBeTruthy();
    expect(
      getByText(
        "Reconnect to the internet and try again, or add ingredients manually.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByText("Change add method"));

    expect(clearMeal).toHaveBeenCalledWith("user-1");
    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("renders timeout copy on the last attempt", () => {
    const props = buildProps({
      image: "file:///meal.jpg",
      id: "meal-1",
      attempt: 3,
      reason: "timeout",
    });

    const { getByText, queryByText } = renderWithTheme(
      <IngredientsNotRecognizedScreen {...props} />,
    );

    expect(getByText("AI analysis timed out")).toBeTruthy();
    expect(
      getByText("The analysis took too long. Please try again in a moment."),
    ).toBeTruthy();
    expect(queryByText("Retake photo (3/3)")).toBeNull();
    expect(getByText("Change add method")).toBeTruthy();
  });
});
