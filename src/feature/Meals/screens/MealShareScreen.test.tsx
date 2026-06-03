import { describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import MealShareScreen from "@/feature/Meals/screens/MealShareScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

let mockRouteMeal = {
  cloudId: "meal-cloud-1",
  mealId: "meal-1",
  name: "Dinner",
  localPhotoUrl: "https://example.com/meal.jpg",
  photoLocalPath: "",
  photoUrl: "",
  ingredients: [],
  totals: { kcal: 420, protein: 32, carbs: 44, fat: 12 },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    canGoBack: () => false,
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      meal: mockRouteMeal,
      returnTo: "MealDetails",
    },
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === "string") return options;
      return options?.defaultValue ?? key;
    },
  }),
}));

jest.mock("@/components/Layout", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Layout: ({
      children,
      style,
    }: {
      children: ReactNode;
      style?: StyleProp<ViewStyle>;
    }) => <View style={style}>{children}</View>,
  };
});

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-native-view-shot", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const MockViewShot = React.forwardRef<
    unknown,
    { children?: ReactNode; style?: StyleProp<ViewStyle> }
  >(({ children, style }, ref) => (
    <View ref={ref as never} style={style}>
      {children}
    </View>
  ));
  MockViewShot.displayName = "MockViewShot";

  return {
    __esModule: true,
    default: MockViewShot,
    captureRef: jest.fn(),
  };
});

jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => false,
}));

jest.mock("@/services/e2e/fixtures", () => ({
  resolveE2EShareExport: () => null,
}));

jest.mock("@/feature/Meals/shareComposer/ShareComposerCanvas", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: () => <View testID="mock-share-composer-canvas" />,
  };
});

jest.mock("@/feature/Meals/shareComposer/ShareComposerDock", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  "@/feature/Meals/shareComposer/components/CustomizeToolRail",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

describe("MealShareScreen visual chrome", () => {
  it("keeps the canvas frame on tinted material without local depth", () => {
    mockRouteMeal = {
      ...mockRouteMeal,
      cloudId: "meal-cloud-1",
      localPhotoUrl: "https://example.com/meal.jpg",
    };

    const { getByTestId } = renderWithTheme(<MealShareScreen />);
    const frameStyle = StyleSheet.flatten(getByTestId("share-canvas").props.style);

    expect(frameStyle.backgroundColor).toContain("rgba");
    expect(frameStyle.shadowOpacity).toBeUndefined();
    expect(frameStyle.shadowRadius).toBeUndefined();
    expect(frameStyle.elevation).toBeUndefined();
  });

  it("keeps the invalid state explicit without raised local chrome", () => {
    mockRouteMeal = {
      ...mockRouteMeal,
      cloudId: "meal-cloud-1",
      localPhotoUrl: "",
      photoLocalPath: "",
      photoUrl: "",
    };

    const { getByTestId } = renderWithTheme(<MealShareScreen />);
    const invalidStyle = StyleSheet.flatten(
      getByTestId("share-unavailable-state").props.style,
    );

    expect(invalidStyle.backgroundColor).toContain("rgba");
    expect(invalidStyle.shadowOpacity).toBeUndefined();
    expect(invalidStyle.shadowRadius).toBeUndefined();
    expect(invalidStyle.elevation).toBeUndefined();
  });
});
