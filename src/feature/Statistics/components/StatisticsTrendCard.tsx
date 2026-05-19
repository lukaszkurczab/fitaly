import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import type { MetricKey } from "@/feature/Statistics/types";
import { StatisticsTrendChart } from "@/feature/Statistics/components/StatisticsTrendChart";

type Props = {
  metric: MetricKey;
  metricAverage: number;
  labels: string[];
  series: number[];
  onChangeMetric: (next: MetricKey) => void;
};

const METRICS: MetricKey[] = ["kcal", "protein", "carbs", "fat"];

export function StatisticsTrendCard({
  metric,
  metricAverage,
  labels,
  series,
  onChangeMetric,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const metricText = {
    kcal: t("statistics:tiles.calories"),
    protein: t("statistics:tiles.protein"),
    carbs: t("statistics:tiles.carbs"),
    fat: t("statistics:tiles.fat"),
  } as const;
  const metricChipText = {
    kcal: t("statistics:chips.calories"),
    protein: t("statistics:chips.protein"),
    carbs: t("statistics:chips.carbs"),
    fat: t("statistics:chips.fat"),
  } as const;

  const metricColor = {
    kcal: theme.chart.calories,
    protein: theme.chart.protein,
    carbs: theme.chart.carbs,
    fat: theme.chart.fat,
  } as const;

  const metricSoftColor = {
    kcal: theme.chart.caloriesSoft,
    protein: theme.chart.proteinSoft,
    carbs: theme.chart.carbsSoft,
    fat: theme.chart.fatSoft,
  } as const;

  const metricValue =
    metric === "kcal"
      ? `${Math.round(metricAverage)} ${t("common:kcal")}`
      : `${Math.round(metricAverage)} ${t("common:gram")}`;

  return (
    <View style={styles.card} testID="statistics-trend-card">
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{t("statistics:trend.title")}</Text>
          <View style={styles.metricTag}>
            <Text style={styles.metricTagLabel}>{metricText[metric]}</Text>
          </View>
        </View>

        <View style={styles.valueRow}>
          <Text testID="statistics-trend-metric-value" style={styles.metricValue}>
            {metricValue}
          </Text>
          <Text style={styles.metricMeta}>{t("statistics:trend.avgPerDay")}</Text>
        </View>
      </View>

      <StatisticsTrendChart
        data={series}
        labels={labels}
        color={metricColor[metric]}
        softColor={metricSoftColor[metric]}
      />

      <View style={styles.metricPillsRow}>
        {METRICS.map((metricKey) => {
          const isActive = metricKey === metric;

          return (
            <Pressable
              key={metricKey}
              testID={`statistics-metric-${metricKey}-button`}
              accessibilityRole="button"
              accessibilityLabel={metricChipText[metricKey]}
              onPress={() => onChangeMetric(metricKey)}
              style={({ pressed }) => [
                styles.metricPill,
                isActive ? styles.metricPillActive : null,
                pressed ? styles.metricPillPressed : null,
              ]}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.metricPillLabel, isActive ? styles.metricPillLabelActive : null]}
              >
                {metricChipText[metricKey]}
              </Text>
            </Pressable>
          );
        })}
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
      backgroundColor: theme.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    header: {
      gap: theme.spacing.xxs,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    metricTag: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
    },
    metricTagLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.xs,
    },
    metricValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
    },
    metricMeta: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
    },
    metricPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "nowrap",
      gap: theme.spacing.xxs,
      marginTop: theme.spacing.xxs,
    },
    metricPill: {
      flex: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.surface,
      alignItems: "center",
    },
    metricPillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    metricPillPressed: {
      opacity: 0.9,
    },
    metricPillLabel: {
      textAlign: "center",
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    metricPillLabelActive: {
      color: theme.cta.primaryText,
    },
  });
