import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PieChart } from "@/components";
import { useTheme } from "@/theme/useTheme";

type Props = {
  protein: number;
  carbs: number;
  fat: number;
};

export function StatisticsMacroBreakdownCard({ protein, carbs, fat }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const total = Math.max(1, protein + carbs + fat);

  const items = [
    {
      key: "protein",
      label: t("statistics:tiles.protein"),
      grams: Math.round(protein),
      percent: Math.round((protein / total) * 100),
      color: theme.chart.protein,
    },
    {
      key: "carbs",
      label: t("statistics:tiles.carbs"),
      grams: Math.round(carbs),
      percent: Math.round((carbs / total) * 100),
      color: theme.chart.carbs,
    },
    {
      key: "fat",
      label: t("statistics:tiles.fat"),
      grams: Math.round(fat),
      percent: Math.round((fat / total) * 100),
      color: theme.chart.fat,
    },
  ] as const;

  return (
    <View style={styles.card} testID="statistics-macro-breakdown-card">
      <Text style={styles.title}>{t("statistics:macroBreakdownTitle")}</Text>

      <View style={styles.content}>
        <View style={styles.chartWrap}>
          <PieChart
            data={items.map((item) => ({
              value: Math.max(0, item.grams),
              color: item.color,
              label: item.label,
            }))}
            minSize={108}
            maxSize={108}
            showLegend={false}
            gap={0}
          />
        </View>

        <View style={styles.legendColumn}>
          {items.map((item) => (
            <View key={item.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View style={styles.legendTextRow}>
                <Text
                  style={styles.legendLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.label}
                </Text>
                <Text style={styles.legendMeta} numberOfLines={1}>
                  {`${item.percent}% - ${item.grams}${t("common:gram")}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.depth.raised,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    chartWrap: {
      width: 120,
      alignItems: "center",
      justifyContent: "center",
    },
    legendColumn: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    legendDot: {
      width: theme.spacing.xs + 1,
      height: theme.spacing.xs + 1,
      borderRadius: theme.rounded.full,
    },
    legendTextRow: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    legendLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    legendMeta: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });
