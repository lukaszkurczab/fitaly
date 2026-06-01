import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MacroCardProps } from "../CardOverlay";
import {
  OverlayKcalBlock,
  OverlayMacroChip,
  withAlpha,
} from "../overlayPrimitives";

export default function MacroSplitCard({
  protein,
  fat,
  carbs,
  kcal,
  textColor,
  macroColors,
  macroSoftColors,
  showKcal,
  showMacros,
  fontFamily,
  fontWeight,
}: MacroCardProps) {
  const { t } = useTranslation(["meals", "share"]);
  const effectiveFontFamily = fontFamily ?? undefined;
  const effectiveFontWeight = fontWeight ?? "500";
  const macroRows = [
    {
      key: "protein",
      short: t("meals:protein_short"),
      label: t("meals:protein"),
      value: protein,
      color: macroColors.protein,
      softColor: macroSoftColors?.protein ?? macroColors.protein,
    },
    {
      key: "carbs",
      short: t("meals:carbs_short"),
      label: t("meals:carbs"),
      value: carbs,
      color: macroColors.carbs,
      softColor: macroSoftColors?.carbs ?? macroColors.carbs,
    },
    {
      key: "fat",
      short: t("meals:fat_short"),
      label: t("meals:fat"),
      value: fat,
      color: macroColors.fat,
      softColor: macroSoftColors?.fat ?? macroColors.fat,
    },
  ];

  if (!showKcal && !showMacros) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        {showKcal && (
          <OverlayKcalBlock
            kcal={kcal}
            textColor={textColor}
            fontFamily={effectiveFontFamily}
            fontWeight={effectiveFontWeight}
            align="left"
            tone="title"
            subtitle={t("share:cardLabels.meal_summary")}
          />
        )}
        {!showKcal ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            style={[
              styles.label,
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
        {showKcal ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            style={[
              styles.hint,
              {
                color: withAlpha(textColor, 0.68),
                fontFamily: effectiveFontFamily,
                fontWeight: effectiveFontWeight,
              },
            ]}
          >
            {t("share:cardLabels.balanced_macros")}
          </Text>
        ) : null}
      </View>
      {showMacros && (
        <>
          <View style={[styles.divider, { backgroundColor: withAlpha(textColor, 0.22) }]} />
          <View style={styles.right}>
            {macroRows.map((row) => (
              <OverlayMacroChip
                key={row.key}
                label={row.short}
                value={row.value}
                color={row.color}
                textColor={textColor}
                fontFamily={effectiveFontFamily}
                fontWeight={effectiveFontWeight}
                compact
                markerMode="none"
                backgroundColor={row.softColor}
                borderColor={withAlpha(row.color, 0.5)}
                style={styles.rowCard}
              />
            ))}
          </View>
        </>
      )}
      {!showMacros ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
          style={[
            styles.sideHint,
            {
              color: textColor,
              fontFamily: effectiveFontFamily,
              fontWeight: effectiveFontWeight,
            },
          ]}
        >
          {t("meals:protein_short")} {protein}g • {t("meals:carbs_short")} {carbs}g • {t("meals:fat_short")} {fat}g
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    minHeight: 92,
    gap: 12,
  },
  left: {
    flex: 1.05,
    justifyContent: "center",
    paddingVertical: 1,
  },
  divider: {
    width: 1,
    opacity: 1,
    marginVertical: 4,
  },
  right: {
    flex: 0.95,
    justifyContent: "center",
    gap: 5,
  },
  rowCard: {
    borderRadius: 10,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.82,
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 13,
  },
  sideHint: {
    alignSelf: "center",
    fontSize: 11,
    lineHeight: 14,
    textTransform: "lowercase",
    opacity: 0.78,
  },
});
