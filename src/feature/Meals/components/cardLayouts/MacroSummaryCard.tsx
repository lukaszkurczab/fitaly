import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MacroCardProps } from "../CardOverlay";
import {
  OverlayKcalBlock,
  OverlayMacroLegendItem,
} from "../overlayPrimitives";

export default function MacroSummaryCard({
  protein,
  fat,
  carbs,
  kcal,
  textColor,
  macroColors,
  showKcal,
  showMacros,
  fontFamily,
  fontWeight,
}: MacroCardProps) {
  const { t } = useTranslation(["meals", "share"]);
  const effectiveFontFamily = fontFamily ?? undefined;
  const effectiveFontWeight = fontWeight ?? "500";

  const macroItems = [
    { key: "protein", label: t("meals:protein_short"), value: protein, color: macroColors.protein },
    { key: "carbs", label: t("meals:carbs_short"), value: carbs, color: macroColors.carbs },
    { key: "fat", label: t("meals:fat_short"), value: fat, color: macroColors.fat },
  ];

  if (!showKcal && !showMacros) {
    return null;
  }

  return (
    <View style={styles.card}>
      {showKcal && (
        <OverlayKcalBlock
          kcal={kcal}
          textColor={textColor}
          fontFamily={effectiveFontFamily}
          fontWeight={effectiveFontWeight}
          align="center"
          tone="hero"
        />
      )}
      {showMacros && (
        <View style={[styles.row, showKcal ? styles.rowWithKcal : null]}>
          {macroItems.map((item) => (
            <OverlayMacroLegendItem
              key={item.key}
              label={item.label}
              value={item.value}
              color={item.color}
              textColor={textColor}
              fontFamily={effectiveFontFamily}
              fontWeight={effectiveFontWeight}
              align="center"
              compact
              style={styles.macroItem}
            />
          ))}
        </View>
      )}
      {!showMacros && showKcal ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
          style={[
            styles.subtitle,
            {
              color: textColor,
              fontFamily: effectiveFontFamily,
              fontWeight: effectiveFontWeight,
            },
          ]}
        >
          {t("share:cardLabels.meal_summary")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
  },
  rowWithKcal: {
    marginTop: 8,
  },
  macroItem: {
    flex: 1,
    minWidth: 48,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.72,
  },
});
