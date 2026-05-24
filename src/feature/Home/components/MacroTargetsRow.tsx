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
  const { t } = useTranslation(["common"]);
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
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <Text style={[styles.value, { color: item.color }]}>
            {item.consumed} / {item.target}g
          </Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...theme.depth.raised,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
      gap: 2,
    },
    value: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    label: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
