import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import type {
  WeeklyReport,
  WeeklyReportInsightType,
} from "@/services/weeklyReport/weeklyReportTypes";
import { useTheme } from "@/theme/useTheme";

type Props = {
  loading: boolean;
  report: WeeklyReport;
  action: "open" | "retry";
  onPress: () => void;
};

type HomeT = (key: string, options?: { defaultValue?: string }) => string;

const CARD_INSIGHT_TITLE_KEYS = {
  consistency: "weeklyReport.cardInsightTitle.consistency",
  logging_coverage: "weeklyReport.cardInsightTitle.loggingCoverage",
  start_of_day_pattern: "weeklyReport.cardInsightTitle.startOfDayPattern",
  day_completion_pattern: "weeklyReport.cardInsightTitle.dayCompletionPattern",
  weekend_drift: "weeklyReport.cardInsightTitle.weekendDrift",
  improving_trend: "weeklyReport.cardInsightTitle.improvingTrend",
} satisfies Record<WeeklyReportInsightType, string>;

function formatPeriod(period: WeeklyReport["period"], locale?: string): string {
  const start = new Date(`${period.startDay}T12:00:00`);
  const end = new Date(`${period.endDay}T12:00:00`);

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    const monthLabel = new Intl.DateTimeFormat(locale, { month: "long" }).format(start);
    return `${monthLabel} ${start.getDate()} - ${end.getDate()}`;
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getTitle(report: WeeklyReport, t: HomeT): string {
  if (report.status === "ready") {
    const fallbackTitle = t("weeklyReport.reflectionReadyFallback");
    const insightType = report.insights[0]?.type;
    const mappedTitleKey = insightType
      ? CARD_INSIGHT_TITLE_KEYS[insightType]
      : null;

    return mappedTitleKey
      ? t(mappedTitleKey, { defaultValue: fallbackTitle })
      : fallbackTitle;
  }
  if (report.status === "insufficient_data") {
    return t("weeklyReport.cardTitleInsufficient");
  }
  return t("weeklyReport.cardTitleUnavailable");
}

function getBody(report: WeeklyReport, t: HomeT): string {
  if (report.status === "ready") {
    return t("weeklyReport.cardBodyReady");
  }
  if (report.status === "insufficient_data") {
    return t("weeklyReport.cardBodyInsufficient");
  }
  return t("weeklyReport.cardBodyUnavailable");
}

function getStatusPill(report: WeeklyReport, t: HomeT): string | null {
  if (report.status === "ready") return null;
  if (report.status === "insufficient_data") {
    return t("weeklyReport.needsMoreSignalPill");
  }
  return t("weeklyReport.temporarilyUnavailablePill");
}

function getActionLabel(action: Props["action"], t: HomeT): string {
  if (action === "retry") return t("weeklyReport.tryAgain");
  return t("weeklyReport.openCta");
}

function getAccessibilityLabel(
  action: Props["action"],
  t: HomeT,
): string {
  if (action === "retry") return t("weeklyReport.accessibilityRefresh");
  return t("weeklyReport.openCta");
}

export default function WeeklyReportCard({
  loading,
  report,
  action,
  onPress,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("home");
  const periodLabel = useMemo(() => formatPeriod(report.period, i18n.language), [report.period, i18n.language]);
  const statusPill = loading
    ? t("weeklyReport.cardRetryingPill")
    : getStatusPill(report, t);
  const isRetryAction = !loading && action === "retry";
  const isInteractive = !loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        loading
          ? t("weeklyReport.cardRetryingTitle")
          : getAccessibilityLabel(action, t)
      }
      accessibilityState={{ busy: loading, disabled: !isInteractive }}
      disabled={!isInteractive}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
      testID="weekly-report-card"
    >
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{t("weeklyReport.eyebrow")}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.metaRow}>
          {statusPill ? (
            <View
              style={[
                styles.pill,
                report.status === "not_available" ? styles.pillWarm : null,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  report.status === "not_available" ? styles.pillWarmText : null,
                ]}
              >
                {statusPill}
              </Text>
            </View>
          ) : null}
          <Text style={styles.period}>{periodLabel}</Text>
        </View>

        <Text style={styles.title}>
          {loading ? t("weeklyReport.cardRetryingTitle") : getTitle(report, t)}
        </Text>
        <Text style={styles.body}>
          {loading
            ? t("weeklyReport.cardRetryingBody")
            : getBody(report, t)}
        </Text>
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>
            {loading
              ? t("weeklyReport.cardRetryingCta")
              : getActionLabel(action, t)}
          </Text>
          {loading ? (
            <ActivityIndicator
              color={theme.primaryStrong}
              size="small"
              testID="weekly-report-card-loading-indicator"
            />
          ) : isRetryAction ? (
            <AppIcon
              name="refresh"
              size={16}
              color={theme.primaryStrong}
              testID="weekly-report-card-action-icon"
            />
          ) : (
            <AppIcon
              name="chevron"
              rotation="180deg"
              size={16}
              color={theme.primaryStrong}
              testID="weekly-report-card-action-icon"
            />
          )}
        </View>
      </View>

    </Pressable>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.9,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xs,
    },
    eyebrow: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    heroCard: {
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    pill: {
      alignSelf: "flex-start",
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.backgroundSecondary,
    },
    pillWarm: {
      borderColor: theme.warning.surface,
      backgroundColor: theme.warning.surface,
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    pillWarmText: {
      color: theme.warning.text,
    },
    period: {
      flexShrink: 0,
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    body: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.regular,
    },
    ctaRow: {
      marginTop: theme.spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 28,
    },
    ctaText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
