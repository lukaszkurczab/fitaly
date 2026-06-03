import { describe, expect, it } from "@jest/globals";
import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import PresetThumb from "@/feature/Meals/shareComposer/components/PresetThumb";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

function flattenPressableStyle(style: unknown) {
  const resolved =
    typeof style === "function" ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved as StyleProp<ViewStyle>);
}

describe("PresetThumb visual chrome", () => {
  it("marks the active preset with tint and border instead of local depth", () => {
    const { getByTestId } = renderWithTheme(
      <PresetThumb
        presetId="quickClassic"
        mealPhotoUri="https://example.com/meal.jpg"
        nutrition={{ kcal: 420, protein: 32, carbs: 44, fat: 12 }}
        accessibilityLabel="Photo first"
        active
        onPress={() => undefined}
      />,
    );

    const thumbStyle = flattenPressableStyle(
      getByTestId("share-preset-quickClassic").props.style,
    );

    expect(thumbStyle.backgroundColor).toContain("rgba");
    expect(thumbStyle.shadowOpacity).toBeUndefined();
    expect(thumbStyle.shadowRadius).toBeUndefined();
    expect(thumbStyle.elevation).toBeUndefined();
  });
});
