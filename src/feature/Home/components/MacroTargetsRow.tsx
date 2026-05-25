import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { MacroTargets } from "@/utils/calculateMacroTargets";
import type { Nutrients } from "@/types/meal";
import { useTranslation } from "react-i18next";

type Props = {
  macroTargets: MacroTargets;
  consumed: Pick<Nutrients, "protein" | "fat" | "carbs">;
};

type MacroItem = {
  key: "protein" | "carbs" | "fat";
  label: string;
  consumed: number;
  target: number;
  color: string;
};

export function MacroTargetsRow({ macroTargets, consumed }: Props) {
  const theme = useTheme();
  const { t } = useTranslation(["common", "home"]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const items = useMemo<MacroItem[]>(
    () => [
      {
        key: "protein",
        label: t("common:protein", "Protein"),
        consumed: Math.round(consumed.protein || 0),
        target: Math.round(macroTargets.proteinGrams || 0),
        color: theme.chart.protein,
      },
      {
        key: "carbs",
        label: t("common:carbs", "Carbs"),
        consumed: Math.round(consumed.carbs || 0),
        target: Math.round(macroTargets.carbsGrams || 0),
        color: theme.chart.carbs,
      },
      {
        key: "fat",
        label: t("common:fat", "Fat"),
        consumed: Math.round(consumed.fat || 0),
        target: Math.round(macroTargets.fatGrams || 0),
        color: theme.chart.fat,
      },
    ],
    [
      consumed.carbs,
      consumed.fat,
      consumed.protein,
      macroTargets.carbsGrams,
      macroTargets.fatGrams,
      macroTargets.proteinGrams,
      t,
      theme.chart.carbs,
      theme.chart.fat,
      theme.chart.protein,
    ],
  );

  const hasAnyTarget = items.some((item) => item.target > 0);
  if (!hasAnyTarget) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home:todaysMacros")}</Text>
        <View style={styles.detailsPill}>
          <Text style={styles.detailsText}>
            {t("home:details", "Details")}
          </Text>
        </View>
      </View>

      <View style={styles.itemsRow}>
        {items.map((item) => {
          const progress = item.target > 0 ? item.consumed / item.target : 0;
          const percent = Math.round(Math.max(0, Math.min(progress, 1)) * 100);

          return (
            <View key={item.key} style={styles.item}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={[styles.label, { color: item.color }]}
              >
                {item.label}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={styles.value}
              >
                <Text style={styles.valueStrong}>{item.consumed}</Text>
                <Text style={styles.valueMuted}> / {item.target}g</Text>
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: item.color,
                      width: `${percent}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.percent}>{percent}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
      ...theme.depth.floating,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    title: {
      color: theme.text,
      flex: 1,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    detailsPill: {
      minHeight: 34,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    detailsText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    itemsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    item: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    value: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
    },
    valueStrong: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    valueMuted: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
    },
    progressTrack: {
      height: 5,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceAlt,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: theme.rounded.full,
    },
    label: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    percent: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
