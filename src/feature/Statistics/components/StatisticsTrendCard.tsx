import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { MetricKey } from "@/feature/Statistics/types";
import { StatisticsTrendChart } from "@/feature/Statistics/components/StatisticsTrendChart";

type Props = {
  metric: MetricKey;
  labels: string[];
  series: number[];
  calorieTarget: number | null;
  macroTargets?: {
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  } | null;
  onChangeMetric: (next: MetricKey) => void;
};

const METRICS: MetricKey[] = ["kcal", "protein", "carbs", "fat"];

export function StatisticsTrendCard({
  metric,
  labels,
  series,
  calorieTarget,
  macroTargets,
  onChangeMetric,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const metricChipText = {
    kcal: t("statistics:chips.calories"),
    protein: t("statistics:chips.protein"),
    carbs: t("statistics:chips.carbs"),
    fat: t("statistics:chips.fat"),
  } as const;
  const metricColor = {
    kcal: theme.isDark ? theme.primaryStrong : theme.chart.calories,
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
  const metricIcon = {
    kcal: "macro-calories-flame",
    protein: "macro-protein-drumstick",
    carbs: "macro-carbs-grain",
    fat: "macro-fat-drop",
  } as const;

  const activeMetricColor = metricColor[metric];
  const targetValueByMetric: Record<MetricKey, number | null> = {
    kcal: calorieTarget,
    protein: macroTargets?.proteinGrams ?? null,
    carbs: macroTargets?.carbsGrams ?? null,
    fat: macroTargets?.fatGrams ?? null,
  };
  const targetValue = targetValueByMetric[metric];
  const showTargetLine = targetValue !== null;

  return (
    <View style={styles.card} testID="statistics-trend-card">
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>
            {t(`statistics:trend.chartTitle.${metric}`)}
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: activeMetricColor }]} />
              <Text style={styles.legendLabel}>
                {t(`statistics:trend.legend.${metric}`)}
              </Text>
            </View>
            {showTargetLine ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, styles.goalLine]} />
                <Text style={styles.legendLabel}>
                  {t("statistics:trend.legend.target")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <StatisticsTrendChart
        data={series}
        labels={labels}
        color={metricColor[metric]}
        softColor={metricSoftColor[metric]}
        targetValue={targetValue}
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
                isActive
                  ? [
                      styles.metricPillActive,
                      {
                        borderColor: metricColor[metricKey],
                        backgroundColor: metricSoftColor[metricKey],
                      },
                    ]
                  : null,
                pressed ? styles.metricPillPressed : null,
              ]}
            >
              <AppIcon
                name={metricIcon[metricKey]}
                size={13}
                color={isActive ? metricColor[metricKey] : theme.textTertiary}
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.metricPillLabel,
                  isActive
                    ? [styles.metricPillLabelActive, { color: metricColor[metricKey] }]
                    : null,
                ]}
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
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    header: {
      gap: theme.spacing.sm,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      flex: 1,
      minWidth: 0,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      flexShrink: 0,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendLine: {
      width: 18,
      height: 2,
      borderRadius: theme.rounded.full,
    },
    goalLine: {
      backgroundColor: theme.textTertiary,
      opacity: 0.72,
    },
    legendLabel: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    metricPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "nowrap",
      gap: theme.spacing.xs,
    },
    metricPill: {
      flex: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xxs,
      paddingVertical: theme.spacing.xxs + 1,
      backgroundColor: theme.surface,
      alignItems: "center",
      minHeight: 32,
      justifyContent: "center",
      flexDirection: "row",
      gap: 3,
    },
    metricPillActive: {
      backgroundColor: theme.surfaceAlt,
    },
    metricPillPressed: {
      opacity: 0.9,
    },
    metricPillLabel: {
      textAlign: "center",
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    metricPillLabelActive: {
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
