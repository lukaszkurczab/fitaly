import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import type { MacroCardProps } from "../CardOverlay";
import {
  OverlayKcalBlock,
  OverlayMacroChip,
  withAlpha,
} from "../overlayPrimitives";

export default function MacroTagStripCard({
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
  const theme = useTheme();
  const { t } = useTranslation(["meals"]);
  const effectiveFontFamily = fontFamily ?? undefined;
  const baseWeight = fontWeight ?? "500";
  const items = [
    {
      key: "protein",
      label: t("meals:protein_short"),
      value: protein,
      color: macroColors.protein,
      softColor: macroSoftColors?.protein ?? macroColors.protein,
    },
    {
      key: "carbs",
      label: t("meals:carbs_short"),
      value: carbs,
      color: macroColors.carbs,
      softColor: macroSoftColors?.carbs ?? macroColors.carbs,
    },
    {
      key: "fat",
      label: t("meals:fat_short"),
      value: fat,
      color: macroColors.fat,
      softColor: macroSoftColors?.fat ?? macroColors.fat,
    },
  ];

  if (!showKcal && !showMacros) {
    return null;
  }

  return (
    <View style={styles.strip}>
      {showKcal ? (
        <View style={styles.kcalCell}>
          <OverlayKcalBlock
            kcal={kcal}
            textColor={textColor}
            fontFamily={effectiveFontFamily}
            fontWeight="700"
            align="left"
            tone="compact"
          />
        </View>
      ) : null}

      {showMacros ? (
        <View
          style={[
            styles.ribbon,
            showKcal
              ? {
                  borderLeftWidth: 1,
                  borderLeftColor: withAlpha(textColor, 0.16),
                }
              : null,
            {
              backgroundColor: withAlpha(theme.surface, theme.isDark ? 0.26 : 0.36),
              borderColor: withAlpha(theme.borderSoft, theme.isDark ? 0.58 : 0.44),
            },
          ]}
        >
          {items.map((item) => (
            <OverlayMacroChip
              key={item.key}
              label={item.label}
              value={item.value}
              color={item.color}
              textColor={textColor}
              fontFamily={effectiveFontFamily}
              fontWeight={baseWeight}
              compact
              markerMode="none"
              backgroundColor={item.softColor}
              borderColor={withAlpha(item.color, 0.48)}
              style={styles.badge}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  kcalCell: {
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  ribbon: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingLeft: 5,
    paddingRight: 5,
    marginLeft: 1,
  },
  badge: {
    flex: 1,
    minWidth: 40,
    minHeight: 26,
    borderRadius: 999,
  },
});
