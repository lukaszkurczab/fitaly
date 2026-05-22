import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import BarcodeScanScreen from "@/feature/Meals/screens/MealAdd/BarcodeScanScreen";
import type { Ingredient } from "@/types";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

type CameraViewProps = {
  onBarcodeScanned?: (payload: { data: string }) => void;
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  children?: ReactNode;
};

type TextInputProps = {
  testID?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

const mockLookupBarcodeProduct = jest.fn<
  (barcode: string) => Promise<
    | { kind: "found"; name: string; ingredient: Ingredient }
    | { kind: "not_found" }
    | { kind: "error" }
  >
>();
const mockSetMeal = jest.fn();
const mockSaveDraft = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockSetLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>();
const mockRequestPermission = jest.fn();
const mockLayoutProps = jest.fn();
let mockKeyboardInset = 0;

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 4, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/hooks/useKeyboardInset", () => ({
  useKeyboardInset: () => mockKeyboardInset,
}));

jest.mock("expo-camera", () => ({
  CameraView: ({ onBarcodeScanned }: CameraViewProps) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(
      View,
      null,
      createElement(Text, null, "camera-view"),
      createElement(
        Pressable,
        {
          onPress: () => onBarcodeScanned?.({ data: "5901234123457" }),
          accessibilityRole: "button",
        },
        createElement(Text, null, "barcode-scan"),
      ),
    );
  },
  useCameraPermissions: () => [
    { granted: true, canAskAgain: true },
    mockRequestPermission,
  ],
}));

jest.mock("react-i18next", () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, options?: { defaultValue?: string } | string) =>
      typeof options === "string"
        ? options
        : options?.defaultValue ?? `${ns}:${key}`,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ uid: "user-1" }),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => ({
    meal: null,
    saveDraft: (uid: string, meal: unknown) => mockSaveDraft(uid, meal),
    setLastScreen: (uid: string, screen: string) => mockSetLastScreen(uid, screen),
    setMeal: mockSetMeal,
  }),
}));

jest.mock("@/services/barcode/barcodeService", () => ({
  extractBarcodeFromPayload: (payload: string) => {
    const digits = String(payload).replace(/\D+/g, "");
    return digits.length === 8 || digits.length === 12 || digits.length === 13
      ? digits
      : null;
  },
  lookupBarcodeProduct: (barcode: string) => mockLookupBarcodeProduct(barcode),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: (props: { children?: ReactNode; keyboardAvoiding?: boolean }) => {
      mockLayoutProps(props);
      return createElement(View, null, props.children);
    },
    ScreenCornerNavButton: ({ onPress }: { onPress: () => void }) =>
      createElement(
        Pressable,
        { onPress, accessibilityRole: "button" },
        createElement(Text, null, "nav-button"),
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
      message ? createElement(Text, null, message) : null,
    TextInput: ({ testID, value, onChangeText, placeholder }: TextInputProps) =>
      createElement(TextInput, {
        testID,
        value,
        onChangeText,
        placeholder,
      }),
  };
});

const ingredient: Ingredient = {
  id: "ing-1",
  name: "Greek yogurt",
  amount: 100,
  unit: "g",
  kcal: 120,
  protein: 12,
  fat: 4,
  carbs: 8,
};

const buildProps = (
  params: MealAddScreenProps<"BarcodeScan">["params"] = {},
) =>
  ({
    navigation: {
      goBack: jest.fn(),
      navigate: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    } as unknown as MealAddScreenProps<"BarcodeScan">["navigation"],
    flow: {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    } as unknown as MealAddScreenProps<"BarcodeScan">["flow"],
    params,
  }) as MealAddScreenProps<"BarcodeScan">;

describe("BarcodeScanScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKeyboardInset = 0;
    mockSaveDraft.mockResolvedValue(undefined);
    mockSetLastScreen.mockResolvedValue(undefined);
  });

  it("waits for explicit confirmation before searching and routes success to ReviewMeal", async () => {
    mockLookupBarcodeProduct.mockResolvedValue({
      kind: "found",
      name: "Greek yogurt",
      ingredient,
    });
    const props = buildProps();

    const { getByText } = renderWithTheme(<BarcodeScanScreen {...props} />);

    fireEvent.press(getByText("barcode-scan"));

    expect(getByText("5901234123457")).toBeTruthy();
    expect(mockLookupBarcodeProduct).not.toHaveBeenCalled();

    fireEvent.press(getByText("Search product"));

    await waitFor(() => {
      expect(mockLookupBarcodeProduct).toHaveBeenCalledWith("5901234123457");
    });
    expect(mockSetMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMethod: "barcode",
        name: "Greek yogurt",
        ingredients: [ingredient],
        notes: "barcode:5901234123457",
      }),
    );
    expect(mockSaveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        inputMethod: "barcode",
        name: "Greek yogurt",
      }),
    );
    await waitFor(() => {
      expect(props.flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    });
  });

  it("supports manual code entry in the sheet fallback", async () => {
    mockLookupBarcodeProduct.mockResolvedValue({
      kind: "found",
      name: "Greek yogurt",
      ingredient,
    });
    const props = buildProps({ showManualEntry: true });

    const { getByTestId, getByText } = renderWithTheme(
      <BarcodeScanScreen {...props} />,
    );

    fireEvent.changeText(getByTestId("barcode-manual-input"), "5901234123457");
    fireEvent.press(getByText("Search product"));

    await waitFor(() => {
      expect(mockLookupBarcodeProduct).toHaveBeenCalledWith("5901234123457");
    });
    await waitFor(() => {
      expect(props.flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    });
  });

  it("lets the manual sheet own keyboard avoidance while staying height-capped", () => {
    mockKeyboardInset = 280;
    const props = buildProps({ showManualEntry: true });

    const { getByTestId } = renderWithTheme(<BarcodeScanScreen {...props} />);

    const sheetStyle = StyleSheet.flatten(
      getByTestId("barcode-manual-sheet").props.style,
    );
    expect(mockLayoutProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyboardAvoiding: false }),
    );
    expect(sheetStyle.marginBottom).toBe(280);
    expect(sheetStyle.maxHeight).toEqual(expect.any(Number));
    expect(sheetStyle.maxHeight).toBeGreaterThan(0);
  });

  it("keeps unmatched scanned codes in the scanner lookup state", async () => {
    mockLookupBarcodeProduct.mockResolvedValue({
      kind: "not_found",
    });
    const props = buildProps();

    const { getByText } = renderWithTheme(<BarcodeScanScreen {...props} />);

    fireEvent.press(getByText("barcode-scan"));
    fireEvent.press(getByText("Search product"));

    expect(
      await screen.findAllByText(
        "We couldn't find a product. Edit the code or choose another method.",
      ),
    ).not.toHaveLength(0);
    expect(props.flow.replace).not.toHaveBeenCalled();
  });

  it("opens the add method chooser from the footer link", () => {
    const props = buildProps();

    const { getByText } = renderWithTheme(<BarcodeScanScreen {...props} />);

    fireEvent.press(getByText("Change add method"));

    expect(props.navigation.navigate).toHaveBeenCalledWith("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  });

  it("keeps unmatched manual codes in the manual sheet", async () => {
    mockLookupBarcodeProduct.mockResolvedValue({
      kind: "not_found",
    });
    const props = buildProps({ showManualEntry: true });

    const { getByTestId, getByText } = renderWithTheme(
      <BarcodeScanScreen {...props} />,
    );

    fireEvent.changeText(getByTestId("barcode-manual-input"), "5901234123457");
    fireEvent.press(getByText("Search product"));

    expect(
      await screen.findAllByText(
        "We couldn't find a product. Edit the code or choose another method.",
      ),
    ).not.toHaveLength(0);
    expect(props.flow.replace).not.toHaveBeenCalled();
  });
});
