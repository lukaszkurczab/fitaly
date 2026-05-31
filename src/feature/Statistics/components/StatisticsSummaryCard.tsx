import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Circle, Svg } from "react-native-svg";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { RangeKey, StatisticsRangeComparison } from "@/feature/Statistics/types";

type Props = {
  activeRange: RangeKey;
  avgKcal: number;
  calorieTarget: number | null;
  calorieGoalProgress: number | null;
  loggedDaysCount: number;
  rangeDaysCount: number;
  comparison: StatisticsRangeComparison;
};

const clampPercent = (value: number | null) =>
  Math.max(0, Math.min(100, value ?? 0));
const PROGRESS_RING_SIZE = 116;
const PROGRESS_RING_STROKE = 12;
const PROGRESS_RING_RADIUS = (PROGRESS_RING_SIZE - PROGRESS_RING_STROKE) / 2;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

function formatSignedPercent(value: number): string {
  if (value > 0) return `+${value}%`;
  return `${value}%`;
}

export function StatisticsSummaryCard({
  activeRange,
  avgKcal,
  calorieTarget,
  calorieGoalProgress,
  loggedDaysCount,
  rangeDaysCount,
  comparison,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics", "common"]);

  const progressPercent = clampPercent(calorieGoalProgress);
  const progressArcLength = (progressPercent / 100) * PROGRESS_RING_CIRCUMFERENCE;
  const progressText =
    calorieGoalProgress !== null ? `${calorieGoalProgress}%` : "--";
  const comparisonValue =
    comparison.kcalAverageDeltaPercent !== null
      ? formatSignedPercent(comparison.kcalAverageDeltaPercent)
      : t("statistics:summary.comparisonUnavailable");
  const comparisonTone =
    comparison.kcalAverageDeltaPercent === null
      ? theme.textTertiary
      : comparison.kcalAverageDeltaPercent > 0
        ? theme.primaryStrong
        : theme.accentWarmStrong;

  return (
    <View style={styles.card} testID="statistics-summary-card">
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t(`statistics:summary.title.${activeRange}`)}</Text>
          <AppIcon name="sparkles" size={18} color={theme.primaryStrong} />
        </View>
        <Text style={styles.rangeMeta}>
          {t("statistics:summary.loggedDays", {
            logged: loggedDaysCount,
            total: rangeDaysCount,
          })}
        </Text>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.valueBlock}>
          <Text style={styles.eyebrow}>{t("statistics:summary.average")}</Text>
          <View style={styles.kcalRow}>
            <Text testID="statistics-summary-kcal" style={styles.kcalValue}>
              {Math.round(avgKcal)}
            </Text>
            <Text style={styles.kcalUnit}>{t("common:kcal")}</Text>
          </View>
        </View>

        <View style={styles.progressRingWrap} testID="statistics-summary-ring">
          <Svg
            width={PROGRESS_RING_SIZE}
            height={PROGRESS_RING_SIZE}
            viewBox={`0 0 ${PROGRESS_RING_SIZE} ${PROGRESS_RING_SIZE}`}
          >
            <Circle
              cx={PROGRESS_RING_SIZE / 2}
              cy={PROGRESS_RING_SIZE / 2}
              r={PROGRESS_RING_RADIUS}
              stroke={theme.isDark ? "rgba(255, 253, 248, 0.12)" : "#EDE3D5"}
              strokeWidth={PROGRESS_RING_STROKE}
              fill="transparent"
            />
            {calorieGoalProgress !== null ? (
              <Circle
                cx={PROGRESS_RING_SIZE / 2}
                cy={PROGRESS_RING_SIZE / 2}
                r={PROGRESS_RING_RADIUS}
                stroke={theme.primaryStrong}
                strokeWidth={PROGRESS_RING_STROKE}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${progressArcLength} ${PROGRESS_RING_CIRCUMFERENCE}`}
                rotation="-90"
                origin={`${PROGRESS_RING_SIZE / 2}, ${PROGRESS_RING_SIZE / 2}`}
              />
            ) : null}
          </Svg>
          <View style={styles.progressRingCopy}>
            <Text style={styles.progressValue}>{progressText}</Text>
            <Text style={styles.progressLabel}>
              {calorieTarget !== null
                ? t("statistics:summary.goalLabel")
                : t("statistics:summary.noTarget")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.progressTrack} testID="statistics-summary-progress-track">
        <View
          style={[
            styles.progressFill,
            { width: `${clampPercent(calorieGoalProgress)}%` },
          ]}
        />
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <View style={styles.iconBubble}>
            <AppIcon name="calendar" size={17} color={theme.primaryStrong} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>{t("statistics:summary.daysLabel")}</Text>
            <Text style={styles.detailValue}>
              {t("statistics:summary.daysValue", {
                logged: loggedDaysCount,
                total: rangeDaysCount,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailItem}>
          <View style={[styles.iconBubble, styles.warmBubble]}>
            <AppIcon name="trend-up" size={17} color={theme.accentWarmStrong} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>
              {t(`statistics:summary.comparison.${activeRange}`)}
            </Text>
            <Text style={[styles.detailValue, { color: comparisonTone }]}>
              {comparisonValue}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.10)"
        : "rgba(207, 197, 184, 0.72)",
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.030)"
        : "rgba(255, 253, 248, 0.70)",
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    titleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      flexShrink: 1,
    },
    rangeMeta: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textAlign: "right",
      flexShrink: 0,
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    valueBlock: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    eyebrow: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    kcalRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.xs,
    },
    kcalValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.numericXL,
      lineHeight: theme.typography.lineHeight.numericXL,
    },
    kcalUnit: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    progressRingWrap: {
      width: PROGRESS_RING_SIZE,
      height: PROGRESS_RING_SIZE,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    progressRingCopy: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    progressValue: {
      color: theme.primaryStrong,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      textAlign: "center",
    },
    progressLabel: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textAlign: "center",
    },
    progressTrack: {
      height: 8,
      borderRadius: theme.rounded.full,
      overflow: "hidden",
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(239, 231, 218, 0.84)",
    },
    progressFill: {
      height: "100%",
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primaryStrong,
    },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.09)"
        : "rgba(207, 197, 184, 0.62)",
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    detailItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.chart.caloriesSoft,
    },
    warmBubble: {
      backgroundColor: theme.isDark
        ? "rgba(199, 126, 97, 0.14)"
        : "rgba(199, 126, 97, 0.14)",
    },
    detailCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    detailLabel: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    detailValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    detailDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.09)"
        : "rgba(207, 197, 184, 0.62)",
    },
  });
