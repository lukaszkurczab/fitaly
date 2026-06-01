import {
  Image,
  Pressable,
  StyleSheet,
  Text,
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
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
};

function normalizeMetric(value: number) {
  return Math.max(0, Math.round(value));
}

function compactMacroLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "";
  return (trimmed.length <= 2 ? trimmed : trimmed[0]).toLocaleUpperCase();
}

export default function PresetThumb({
  presetId,
  mealPhotoUri,
  nutrition,
  macroLabels,
  accessibilityLabel,
  active,
  onPress,
}: PresetThumbProps) {
  const theme = useTheme();
  const macroSegments = [
    {
      key: "protein",
      label: compactMacroLabel(macroLabels.protein),
      color: theme.macro.protein,
      grams: normalizeMetric(nutrition.protein),
    },
    {
      key: "carbs",
      label: compactMacroLabel(macroLabels.carbs),
      color: theme.macro.carbs,
      grams: normalizeMetric(nutrition.carbs),
    },
    {
      key: "fat",
      label: compactMacroLabel(macroLabels.fat),
      color: theme.macro.fat,
      grams: normalizeMetric(nutrition.fat),
    },
  ];

  const renderMacroChips = (
    tone: "dark" | "light",
    style: StyleProp<ViewStyle>,
  ) => (
    <View style={[styles.presetMiniMacroRow, style]}>
      {macroSegments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.presetMiniMacroChip,
            tone === "dark"
              ? styles.presetMiniMacroChipDark
              : styles.presetMiniMacroChipLight,
            { borderColor: segment.color },
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[
              styles.presetMiniMacroText,
              {
                color: tone === "dark" ? "#FFFDF8" : "#393128",
                fontFamily: theme.typography.fontFamily.semiBold,
              },
            ]}
          >
            {segment.label} {segment.grams}
          </Text>
        </View>
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
          {renderMacroChips("dark", styles.presetMiniMacroRowGlass)}
        </>
      ) : presetId === "quickFooter" ? (
        <>
          <View style={[styles.presetPreviewCard, styles.presetPreviewCardClean]} />
          <View style={[styles.presetHeadline, styles.presetHeadlineClean]} />
          <View style={styles.presetKcalLineClean} />
          {renderMacroChips("light", styles.presetMiniMacroRowClean)}
        </>
      ) : (
        <>
          <View style={styles.presetPreviewTopScrim} />
          <View style={[styles.presetHeadline, styles.presetHeadlinePhoto]} />
          <View style={styles.presetKcalPill} />
          {renderMacroChips("dark", styles.presetMiniMacroRowPhoto)}
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
  },
  presetMiniMacroRowPhoto: {
    left: 8,
    right: 8,
    bottom: 7,
  },
  presetMiniMacroRowGlass: {
    left: 11,
    right: 11,
    bottom: 7,
  },
  presetMiniMacroRowClean: {
    left: 11,
    width: 57,
    bottom: 9,
  },
  presetMiniMacroChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 14,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  presetMiniMacroChipDark: {
    backgroundColor: "rgba(255,253,248,0.18)",
  },
  presetMiniMacroChipLight: {
    backgroundColor: "rgba(255,253,248,0.72)",
  },
  presetMiniMacroText: {
    fontSize: 7.7,
    lineHeight: 9,
    textAlign: "center",
  },
});
