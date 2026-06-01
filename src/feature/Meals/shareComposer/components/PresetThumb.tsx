import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import type {
  ShareNutrition,
  SharePresetId,
} from "@/feature/Meals/shareComposer/types";

type PresetThumbProps = {
  presetId: SharePresetId;
  mealPhotoUri: string;
  nutrition: ShareNutrition;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
};

function normalizeMetric(value: number) {
  return Math.max(0, Math.round(value));
}

export default function PresetThumb({
  presetId,
  mealPhotoUri,
  nutrition,
  accessibilityLabel,
  active,
  onPress,
}: PresetThumbProps) {
  const theme = useTheme();
  const macroSegments = [
    {
      key: "protein",
      color: theme.macro.protein,
      grams: normalizeMetric(nutrition.protein),
    },
    {
      key: "carbs",
      color: theme.macro.carbs,
      grams: normalizeMetric(nutrition.carbs),
    },
    {
      key: "fat",
      color: theme.macro.fat,
      grams: normalizeMetric(nutrition.fat),
    },
  ];
  const totalMacroGrams = macroSegments.reduce(
    (sum, segment) => sum + segment.grams,
    0,
  );

  const renderMacroLines = (
    tone: "dark" | "light",
    style: StyleProp<ViewStyle>,
  ) => (
    <View style={[styles.presetMiniMacroRow, style]}>
      {macroSegments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.presetMiniMacroLine,
            {
              backgroundColor: segment.color,
              flex: totalMacroGrams > 0 ? Math.max(segment.grams, 0) : 1,
              opacity: tone === "dark" ? 0.96 : 0.9,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <Pressable
      testID={`share-preset-${presetId}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.presetThumb,
        {
          borderColor: active ? theme.primary : theme.border,
          borderWidth: active ? 1.5 : 1,
          backgroundColor: theme.surfaceAlt,
          opacity: pressed ? 0.86 : 1,
        },
        active ? theme.depth.raised : null,
      ]}
    >
      {mealPhotoUri.trim() ? (
        <Image source={{ uri: mealPhotoUri }} resizeMode="cover" style={styles.presetPreviewPhoto} />
      ) : (
        <View
          style={[
            styles.presetPreviewPhotoFallback,
            { backgroundColor: theme.surfaceAlt },
          ]}
        />
      )}

      {presetId === "quickSidebar" ? (
        <>
          <View style={styles.presetPreviewGlassPanel} />
          <View style={[styles.presetHeadline, styles.presetHeadlineGlass]} />
          <View style={styles.presetKcalPillGlass} />
          {renderMacroLines("dark", styles.presetMiniMacroRowGlass)}
        </>
      ) : presetId === "quickFooter" ? (
        <>
          <View style={[styles.presetPreviewCard, styles.presetPreviewCardClean]} />
          <View style={[styles.presetHeadline, styles.presetHeadlineClean]} />
          <View style={styles.presetKcalLineClean} />
          {renderMacroLines("light", styles.presetMiniMacroRowClean)}
        </>
      ) : (
        <>
          <View style={styles.presetPreviewTopScrim} />
          <View style={[styles.presetHeadline, styles.presetHeadlinePhoto]} />
          <View style={styles.presetKcalPill} />
          {renderMacroLines("dark", styles.presetMiniMacroRowPhoto)}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presetThumb: {
    width: 96,
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
  },
  presetPreviewPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  presetPreviewPhotoFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  presetPreviewCard: {
    position: "absolute",
    backgroundColor: "rgba(251,248,242,0.9)",
  },
  presetPreviewCardClean: {
    left: 6,
    top: 5,
    width: 67,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(251,248,242,0.94)",
  },
  presetPreviewGlassPanel: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 17,
    height: 33,
    borderRadius: 11,
    backgroundColor: "rgba(63,52,42,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.24)",
  },
  presetPreviewTopScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: "rgba(45,37,30,0.34)",
  },
  presetHeadline: {
    position: "absolute",
    backgroundColor: "#393128",
    borderRadius: 2,
    height: 4,
  },
  presetHeadlinePhoto: {
    width: 44,
    top: 8,
    left: 9,
    backgroundColor: "#FFFDF8",
  },
  presetHeadlineGlass: {
    width: 38,
    top: 22,
    left: 12,
    backgroundColor: "#FFFDF8",
  },
  presetHeadlineClean: {
    width: 31,
    top: 10,
    left: 12,
    backgroundColor: "#393128",
  },
  presetKcalLineClean: {
    position: "absolute",
    width: 22,
    height: 3,
    top: 18,
    left: 12,
    borderRadius: 2,
    backgroundColor: "#393128",
  },
  presetKcalPillGlass: {
    position: "absolute",
    width: 22,
    height: 5,
    top: 22,
    right: 13,
    borderRadius: 4,
    backgroundColor: "#FFFDF8",
  },
  presetKcalPill: {
    position: "absolute",
    width: 23,
    height: 6,
    top: 16,
    left: 9,
    borderRadius: 4,
    backgroundColor: "rgba(255,253,248,0.78)",
  },
  presetMiniMacroRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 4,
  },
  presetMiniMacroRowPhoto: {
    left: 8,
    right: 8,
    bottom: 8,
  },
  presetMiniMacroRowGlass: {
    left: 13,
    right: 13,
    bottom: 9,
  },
  presetMiniMacroRowClean: {
    left: 11,
    width: 57,
    bottom: 10,
  },
  presetMiniMacroLine: {
    height: 4,
    minWidth: 8,
    borderRadius: 3,
  },
});
