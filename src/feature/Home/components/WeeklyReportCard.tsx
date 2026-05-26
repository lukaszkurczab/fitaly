import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import type { WeeklyReport } from "@/services/weeklyReport/weeklyReportTypes";
import { useTheme } from "@/theme/useTheme";

type Props = {
  loading: boolean;
  report: WeeklyReport;
  onPress: () => void;
};

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

function getTitle(report: WeeklyReport, t: (key: string) => string): string {
  if (report.status === "ready") {
    return report.summary ?? t("weeklyReport.reflectionReadyFallback");
  }
  if (report.status === "insufficient_data") {
    return t("weeklyReport.cardTitleInsufficient");
  }
  return t("weeklyReport.cardTitleUnavailable");
}

function getBody(report: WeeklyReport, t: (key: string) => string): string {
  if (report.status === "ready") {
    return t("weeklyReport.cardBodyReady");
  }
  if (report.status === "insufficient_data") {
    return t("weeklyReport.cardBodyInsufficient");
  }
  return t("weeklyReport.cardBodyUnavailable");
}

function getStatusPill(report: WeeklyReport, t: (key: string) => string): string {
  if (report.status === "ready") {
    return t("weeklyReport.closedWeekPill");
  }
  if (report.status === "insufficient_data") {
    return t("weeklyReport.needsMoreSignalPill");
  }
  return t("weeklyReport.unavailablePill");
}

export default function WeeklyReportCard({ loading, report, onPress }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("home");
  const periodLabel = useMemo(() => formatPeriod(report.period, i18n.language), [report.period, i18n.language]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("weeklyReport.openCta")}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
      testID="weekly-report-card"
    >
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{t("weeklyReport.eyebrow")}</Text>
        <View style={styles.iconWrap}>
          <AppIcon name="weekly-raport" size={18} color={theme.primaryStrong} />
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.metaRow}>
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
              {loading ? t("weeklyReport.preparingPill") : getStatusPill(report, t)}
            </Text>
          </View>
          <Text style={styles.period}>{periodLabel}</Text>
        </View>

        <Text style={styles.title}>
          {loading ? t("weeklyReport.loadingTitle") : getTitle(report, t)}
        </Text>
        <Text style={styles.body}>
          {loading
            ? t("weeklyReport.loadingReadingClosed")
            : getBody(report, t)}
        </Text>
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>{t("weeklyReport.openCta")}</Text>
          <AppIcon name="chevron" rotation="-90deg" size={16} color={theme.primaryStrong} />
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
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    eyebrow: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.success.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    heroCard: {
      borderRadius: theme.rounded.xl,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      ...theme.depth.raised,
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
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.backgroundSecondary,
    },
    pillWarm: {
      borderColor: "transparent",
      backgroundColor: theme.error.surface,
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    pillWarmText: {
      color: theme.accentWarmStrong,
    },
    period: {
      flexShrink: 0,
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: 30,
      fontFamily: theme.typography.fontFamily.bold,
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
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      paddingTop: theme.spacing.sm,
    },
    ctaText: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
