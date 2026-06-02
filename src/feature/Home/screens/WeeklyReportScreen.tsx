import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { AppIcon, Button, Layout } from "@/components";
import { useAuthContext } from "@/context/AuthContext";
import { useAccessContext } from "@/context/AccessContext";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import type { RootStackParamList } from "@/navigation/navigate";
import type {
  WeeklyReport,
  WeeklyReportInsight,
  WeeklyReportPriority,
} from "@/services/weeklyReport/weeklyReportTypes";
import { getE2EFixtureState } from "@/services/e2e/fixtures";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import {
  formatWeeklyPeriod,
  getCarryForwardLine,
  getSignalDotColor,
} from "@/feature/Home/screens/WeeklyReportScreen.helpers";
import {
  trackWeeklyReportAccessBlocked,
  trackWeeklyReportLockedViewed,
  trackWeeklyReportOpened,
} from "@/services/telemetry/telemetryInstrumentation";

type WeeklyReportNavigation = StackNavigationProp<
  RootStackParamList,
  "WeeklyReport"
>;

type Props = {
  navigation: WeeklyReportNavigation;
};

type HeaderProps = {
  title: string;
  onBack: () => void;
};

type StateCardProps = {
  title: string;
  body: string;
  leading?: React.ReactNode;
  children?: React.ReactNode;
};

type WeeklyReportAccessState =
  | "unknown"
  | "locked"
  | "degraded"
  | "premium";

const HERO_TAKEAWAY_BY_INSIGHT_TYPE: Partial<
  Record<WeeklyReportInsight["type"], string>
> = {
  consistency: "weeklyReport.detailInsightTitle.consistency",
  logging_coverage: "weeklyReport.detailInsightTitle.loggingCoverage",
  start_of_day_pattern: "weeklyReport.detailInsightTitle.startOfDayPattern",
  day_completion_pattern: "weeklyReport.detailInsightTitle.dayCompletionPattern",
  weekend_drift: "weeklyReport.detailInsightTitle.weekendDrift",
  improving_trend: "weeklyReport.detailInsightTitle.improvingTrend",
};

function resolveWeeklyReportAccessState(
  status: "enabled" | "disabled" | "unknown" | null,
  reason: string | null | undefined,
): WeeklyReportAccessState {
  if (!status) {
    return "unknown";
  }
  if (status === "enabled") {
    return "premium";
  }
  if (
    status === "unknown" ||
    reason === "degraded" ||
    reason === "feature_disabled"
  ) {
    return "degraded";
  }
  return "locked";
}

function HeaderButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  testID,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.headerButton,
        pressed || disabled ? styles.headerButtonPressed : null,
      ]}
    >
      {icon}
    </Pressable>
  );
}

function WeeklyReportHeader({
  title,
  onBack,
}: HeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.header}>
      <HeaderButton
        testID="weekly-report-back-button"
        icon={<AppIcon name="arrow" size={18} color={theme.text} />}
        onPress={onBack}
        accessibilityLabel={t("weeklyReport.back")}
      />

      <Text style={styles.headerTitle}>{title}</Text>

      <View style={styles.headerSpacer} />
    </View>
  );
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warm";
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={[styles.pill, tone === "warm" ? styles.pillWarm : null]}>
      <Text style={[styles.pillText, tone === "warm" ? styles.pillWarmText : null]}>
        {label}
      </Text>
    </View>
  );
}

function getHeroTakeaway(
  report: WeeklyReport,
  t: (key: string) => string,
): string {
  const primaryInsight = report.insights[0];
  const insightKey = primaryInsight
    ? HERO_TAKEAWAY_BY_INSIGHT_TYPE[primaryInsight.type]
    : null;

  if (insightKey) {
    return t(insightKey);
  }

  return t("weeklyReport.reflectionReadyFallback");
}

function WeeklyRhythmAccent() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rhythm = [
    { height: 18, tone: "calories" },
    { height: 26, tone: "protein" },
    { height: 22, tone: "carbs" },
    { height: 30, tone: "calories" },
    { height: 24, tone: "fat" },
    { height: 16, tone: "carbs" },
    { height: 28, tone: "protein" },
  ] as const;

  return (
    <View
      style={styles.rhythmAccent}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.rhythmLine} />
      <View style={styles.rhythmBars}>
        {rhythm.map((item, index) => (
          <View
            key={`${item.tone}:${index}`}
            style={[
              styles.rhythmBar,
              {
                height: item.height,
                backgroundColor: theme.macro[item.tone],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ReflectionHero({ report, locale }: { report: WeeklyReport; locale?: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.heroCard} testID="weekly-report-summary-section">
      <View style={styles.heroTopRow}>
        <View style={styles.heroMetaGroup}>
          <StatusPill label={t("weeklyReport.readyDetailPill")} />
          <Text style={styles.metaText}>
            {formatWeeklyPeriod(report.period, locale)}
          </Text>
        </View>
        <WeeklyRhythmAccent />
      </View>
      <Text style={styles.heroHeadline}>{getHeroTakeaway(report, t)}</Text>
      <Text style={styles.heroSupport}>{getCarryForwardLine(report)}</Text>
    </View>
  );
}

function SignalRow({ insight }: { insight: WeeklyReportInsight }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.signalRow}>
      <View
        style={[
          styles.signalDot,
          { backgroundColor: getSignalDotColor(insight, theme) },
        ]}
      />
      <View style={styles.signalTextWrap}>
        <Text style={styles.signalTitle}>{insight.title}</Text>
        <Text style={styles.signalBody}>{insight.body}</Text>
      </View>
    </View>
  );
}

function SignalsCard({ insights }: { insights: WeeklyReportInsight[] }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");
  const visibleInsights = insights.slice(0, 2);

  return (
    <View style={styles.section} testID="weekly-report-signals-section">
      <Text style={styles.sectionLabel}>{t("weeklyReport.signalsBehindIt")}</Text>
      <View style={styles.signalsCard}>
        {visibleInsights.map((insight, index) => (
          <View key={`${insight.type}:${insight.title}`}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <SignalRow insight={insight} />
          </View>
        ))}
      </View>
    </View>
  );
}

function PriorityRow({
  index,
  priority,
}: {
  index: number;
  priority: WeeklyReportPriority;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isPrimary = index === 0;

  return (
    <View style={isPrimary ? styles.priorityPrimary : styles.prioritySecondary}>
      <View
        style={
          isPrimary
            ? styles.priorityMarkerPrimary
            : styles.priorityMarkerSecondary
        }
      >
        {isPrimary ? (
          <AppIcon name="check" size={15} color={theme.textInverse} />
        ) : null}
      </View>
      <Text
        style={
          isPrimary
            ? styles.priorityPrimaryText
            : styles.prioritySecondaryText
        }
      >
        {priority.text}
      </Text>
    </View>
  );
}

function CarryForwardCard({ priorities }: { priorities: WeeklyReportPriority[] }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.carryCard} testID="weekly-report-priorities-section">
      <Text style={styles.carryTitle}>{t("weeklyReport.carryForwardTitle")}</Text>
      <Text style={styles.carryBody}>{t("weeklyReport.carryForwardBody")}</Text>

      <View style={styles.priorityList}>
        {priorities.slice(0, 2).map((priority, index) => (
          <PriorityRow
            key={`${priority.type}:${priority.text}`}
            index={index}
            priority={priority}
          />
        ))}
      </View>
    </View>
  );
}

function LoadingRing() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.loadingRingWrap}>
      <View style={styles.loadingRing} />
      <View style={styles.loadingRingDot} />
    </View>
  );
}

function LoadingState({
  report,
  title,
  body,
  helperNote,
}: {
  report: WeeklyReport;
  title?: string;
  body?: string;
  helperNote?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("home");

  return (
    <View style={styles.content} testID="weekly-report-loading-state">
      <View style={styles.loadingHero}>
        <StatusPill
          label={`${t("weeklyReport.closedWeekPill")} · ${formatWeeklyPeriod(report.period, i18n.language)}`}
        />

        <View style={styles.loadingHeadlineRow}>
          <LoadingRing />
          <Text style={styles.loadingTitle}>
            {title ?? t("weeklyReport.loadingTitle")}
          </Text>
        </View>

        <Text style={styles.loadingBody}>
          {body ?? t("weeklyReport.loadingBody")}
        </Text>

        <View style={[styles.skeletonBar, styles.skeletonBarLong]} />
        <View style={[styles.skeletonBar, styles.skeletonBarShort]} />
      </View>

      <View style={styles.loadingSupportCard}>
        <View style={[styles.skeletonBar, styles.skeletonMini]} />
        <View style={[styles.skeletonBar, styles.skeletonMedium]} />
        <View style={[styles.skeletonBar, styles.skeletonSupport]} />
      </View>

      <Text style={styles.helperNote}>
        {helperNote ?? t("weeklyReport.loadingHelperNote")}
      </Text>
    </View>
  );
}

function StateCard({ title, body, leading, children }: StateCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.stateCard}>
      {leading}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {children}
    </View>
  );
}

function InsufficientSignal() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.signalMeter}>
      <Text style={styles.signalMeterLabel}>{t("weeklyReport.signalMeterLabel")}</Text>
      <View style={styles.signalMeterDots}>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <View
            key={index}
            style={[
              styles.signalMeterDot,
              index < 3 ? styles.signalMeterDotFilled : null,
              index === 3 ? styles.signalMeterDotMid : null,
            ]}
          />
        ))}
      </View>
      <Text style={styles.signalMeterCaption}>{t("weeklyReport.signalMeterCaption")}</Text>
    </View>
  );
}

function InsufficientDataState({
  report,
  onBack,
}: {
  report: WeeklyReport;
  onBack: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("home");

  return (
    <View style={styles.content} testID="weekly-report-insufficient-state">
      <StatusPill label={`${t("weeklyReport.closedWeekPill")} · ${formatWeeklyPeriod(report.period, i18n.language)}`} />

      <StateCard
        title={t("weeklyReport.insufficientTitle")}
        body={t("weeklyReport.insufficientBody")}
        leading={
          <View style={styles.stateIconWrap}>
            <Text style={styles.stateIncompleteIcon}>◔</Text>
          </View>
        }
      >
        <InsufficientSignal />
        <Text style={styles.footnoteText}>{t("weeklyReport.insufficientFootnote")}</Text>
      </StateCard>

      <Button
        testID="weekly-report-back-home-button"
        label={t("weeklyReport.backToHome")}
        variant="secondary"
        style={styles.secondaryButton}
        onPress={onBack}
      />
    </View>
  );
}

function UnavailableState({
  onRetry,
  onBack,
  retrying,
}: {
  onRetry: () => void;
  onBack: () => void;
  retrying: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.content} testID="weekly-report-unavailable-state">
      <View
        style={styles.unavailableCard}
        testID="weekly-report-unavailable-card"
      >
        <View style={styles.unavailableStatusRow}>
          <View style={styles.unavailableCompactIconWrap}>
            <AppIcon name="refresh" size={16} color={theme.accentWarm} />
          </View>
          <StatusPill label={t("weeklyReport.temporarilyUnavailablePill")} tone="warm" />
        </View>

        <Text style={styles.unavailableTitle}>{t("weeklyReport.unavailableTitle")}</Text>
        <Text style={styles.unavailableBody}>{t("weeklyReport.unavailableBody")}</Text>
      </View>

      <Button
        testID="weekly-report-retry-button"
        label={t("weeklyReport.tryAgain")}
        onPress={onRetry}
        loading={retrying}
        style={styles.primaryButton}
      />

      <Pressable
        testID="weekly-report-unavailable-back-button"
        accessibilityRole="button"
        accessibilityLabel={t("weeklyReport.back")}
        onPress={onBack}
        style={({ pressed }) => [styles.textButton, pressed ? styles.textButtonPressed : null]}
      >
        <Text style={styles.textButtonLabel}>{t("weeklyReport.back")}</Text>
      </Pressable>
    </View>
  );
}

function LockedState({
  onManageSubscription,
}: {
  onManageSubscription: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.content} testID="weekly-report-locked-state">
      <StateCard
        title={t("weeklyReport.lockedTitle", {
          defaultValue: "Weekly Report is a Premium feature",
        })}
        body={t("weeklyReport.lockedBody", {
          defaultValue:
            "Upgrade to Premium to unlock your weekly reflection before we generate it.",
        })}
        leading={
          <View style={styles.stateIconWrap}>
            <Text style={styles.stateLockedIcon}>✦</Text>
          </View>
        }
      >
        <Button
          testID="weekly-report-manage-subscription-button"
          label={t("weeklyReport.unlockCta", {
            defaultValue: "Manage subscription",
          })}
          onPress={onManageSubscription}
          style={styles.primaryButton}
        />
      </StateCard>
    </View>
  );
}

function DegradedAccessState({
  onRetryAccess,
  onManageSubscription,
  retrying,
}: {
  onRetryAccess: () => void;
  onManageSubscription: () => void;
  retrying: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("home");

  return (
    <View style={styles.content} testID="weekly-report-access-issue-state">
      <StateCard
        title={t("weeklyReport.accessIssueTitle", {
          defaultValue: "Weekly Report access needs attention",
        })}
        body={t("weeklyReport.accessIssueBody", {
          defaultValue:
            "Restore or review your Premium subscription before requesting this report again.",
        })}
        leading={
          <View style={styles.unavailableIconWrap}>
            <AppIcon name="refresh" size={22} color={theme.accentWarm} />
          </View>
        }
      >
        <View style={styles.stateActions}>
          <Button
            testID="weekly-report-retry-access-button"
            label={t("weeklyReport.retryAccessCta", {
              defaultValue: "Retry access check",
            })}
            onPress={onRetryAccess}
            loading={retrying}
            style={styles.primaryButton}
          />
          <Button
            testID="weekly-report-restore-access-button"
            label={t("weeklyReport.restoreAccessCta", {
              defaultValue: "Manage subscription",
            })}
            variant="secondary"
            onPress={onManageSubscription}
            style={styles.secondaryButton}
          />
        </View>
      </StateCard>
    </View>
  );
}

export default function WeeklyReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("home");
  const { uid } = useAuthContext();
  const { getFeature, refreshAccess } = useAccessContext();
  const weeklyReportFeature = getFeature("weeklyReport");
  const hasE2EWeeklyReport = Boolean(getE2EFixtureState()?.weeklyReport);
  const accessState = hasE2EWeeklyReport
    ? "premium"
    : resolveWeeklyReportAccessState(
        weeklyReportFeature?.status ?? null,
        weeklyReportFeature?.reason,
      );
  const weeklyReport = useWeeklyReport({
    uid,
    active: accessState === "premium",
  });
  const [refreshing, setRefreshing] = useState(false);
  const hasTrackedOpenRef = useRef(false);
  const hasTrackedBlockedRef = useRef<string | null>(null);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await weeklyReport.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, weeklyReport]);

  const handleBackToHome = useCallback(() => {
    navigation.navigate("Home");
  }, [navigation]);

  const handleManageSubscription = useCallback(() => {
    navigation.navigate("ManageSubscription");
  }, [navigation]);

  const handleRetryAccess = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshAccess();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAccess, refreshing]);

  const isReady = !weeklyReport.loading && weeklyReport.report.status === "ready";
  const isInsufficient =
    !weeklyReport.loading &&
    weeklyReport.status === "live_success" &&
    weeklyReport.report.status === "insufficient_data";
  const showPremiumLocked =
    accessState === "locked" || weeklyReport.status === "premium_required";
  const showDegradedAccess =
    accessState === "degraded";

  useEffect(() => {
    if (
      accessState !== "premium"
      || weeklyReport.loading
      || showPremiumLocked
      || showDegradedAccess
      || hasTrackedOpenRef.current
    ) {
      return;
    }

    const reportStatus =
      weeklyReport.report.status === "ready"
        ? "ready"
        : weeklyReport.report.status === "insufficient_data"
          ? "insufficient_data"
          : "unavailable";

    hasTrackedOpenRef.current = true;
    void trackWeeklyReportOpened({
      reportStatus,
      insightCount: weeklyReport.report.insights.length,
      priorityCount: weeklyReport.report.priorities.length,
      source: weeklyReport.source,
      accessState,
      accessReason: weeklyReportFeature?.reason ?? null,
    });
  }, [
    accessState,
    showDegradedAccess,
    showPremiumLocked,
    weeklyReport.loading,
    weeklyReport.report,
    weeklyReport.source,
    weeklyReportFeature?.reason,
  ]);

  useEffect(() => {
    const accessReason =
      weeklyReport.status === "premium_required"
        ? "premium_required"
        : weeklyReportFeature?.reason ?? null;
    const blockedState = showPremiumLocked
      ? "locked"
      : showDegradedAccess
        ? "degraded"
        : null;
    const trackKey = `${blockedState ?? "none"}:${accessReason ?? "none"}`;

    if (blockedState === "locked") {
      if (hasTrackedBlockedRef.current === trackKey) {
        return;
      }

      hasTrackedBlockedRef.current = trackKey;
      void trackWeeklyReportLockedViewed({
        source: weeklyReport.source,
        accessState: "locked",
        accessReason,
      });
      return;
    }

    if (blockedState === "degraded") {
      if (hasTrackedBlockedRef.current === trackKey) {
        return;
      }

      hasTrackedBlockedRef.current = trackKey;
      void trackWeeklyReportAccessBlocked({
        source: weeklyReport.source,
        accessState: "degraded",
        accessReason,
      });
      return;
    }

    if (blockedState === null && accessState !== "unknown") {
      hasTrackedBlockedRef.current = null;
    }
  }, [
    accessState,
    showDegradedAccess,
    showPremiumLocked,
    weeklyReport.source,
    weeklyReport.status,
    weeklyReportFeature?.reason,
  ]);

  return (
    <Layout showNavigation={false}>
      <WeeklyReportHeader
        title={t("weeklyReport.screenTitle")}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.screen} testID="weekly-report-screen">
        {accessState === "unknown" ? (
          <LoadingState
            report={weeklyReport.report}
            title={t("weeklyReport.accessLoadingTitle", {
              defaultValue: "Checking weekly report access",
            })}
            body={t("weeklyReport.accessLoadingBody", {
              defaultValue:
                "Confirming your Premium access before we generate this report.",
            })}
            helperNote={t("weeklyReport.accessLoadingHelper", {
              defaultValue:
                "We wait for subscription state first so we don't trigger the report unnecessarily.",
            })}
          />
        ) : showPremiumLocked ? (
          <LockedState onManageSubscription={handleManageSubscription} />
        ) : showDegradedAccess ? (
          <DegradedAccessState
            onRetryAccess={handleRetryAccess}
            onManageSubscription={handleManageSubscription}
            retrying={refreshing}
          />
        ) : weeklyReport.loading ? (
          <LoadingState report={weeklyReport.report} />
        ) : isReady ? (
          <View style={styles.content} testID="weekly-report-ready-state">
            <ReflectionHero report={weeklyReport.report} locale={i18n.language} />
            <SignalsCard insights={weeklyReport.report.insights} />
            <CarryForwardCard priorities={weeklyReport.report.priorities} />
          </View>
        ) : isInsufficient ? (
          <InsufficientDataState
            report={weeklyReport.report}
            onBack={handleBackToHome}
          />
        ) : (
          <UnavailableState
            onRetry={handleRefresh}
            onBack={() => navigation.goBack()}
            retrying={refreshing}
          />
        )}
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: 20,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerButtonPressed: {
      opacity: 0.72,
    },
    headerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.bold,
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    content: {
      gap: 20,
      paddingBottom: theme.spacing.sectionGap,
    },
    heroCard: {
      borderRadius: theme.rounded.xxl,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.borderSoft : "rgba(207,197,184,0.58)",
      backgroundColor: theme.isDark ? theme.surfaceElevated : "#FFF9F0",
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    heroMetaGroup: {
      flex: 1,
      alignItems: "flex-start",
      gap: 8,
    },
    rhythmAccent: {
      width: 92,
      height: 56,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.isDark ? theme.backgroundSecondary : "#F2E8DA",
      paddingHorizontal: 12,
      paddingVertical: 10,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    rhythmLine: {
      position: "absolute",
      left: 12,
      right: 12,
      top: 27,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.isDark
        ? "rgba(255,253,248,0.14)"
        : "rgba(143,114,90,0.22)",
    },
    rhythmBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    rhythmBar: {
      width: 5,
      borderRadius: theme.rounded.full,
      opacity: theme.isDark ? 0.78 : 0.72,
    },
    pill: {
      alignSelf: "flex-start",
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.borderSoft : "rgba(111,138,105,0.22)",
      backgroundColor: theme.isDark ? theme.backgroundSecondary : "#EDF2E8",
      paddingHorizontal: 10,
      paddingVertical: 6,
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
    metaText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    heroHeadline: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: 25,
      fontFamily: theme.typography.fontFamily.bold,
    },
    heroSupport: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 19,
      fontFamily: theme.typography.fontFamily.regular,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    signalsCard: {
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255,253,248,0.10)"
        : "rgba(207,197,184,0.30)",
      backgroundColor: theme.isDark
        ? "rgba(255,253,248,0.03)"
        : "rgba(255,253,248,0.46)",
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 2,
    },
    signalRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 8,
    },
    signalDot: {
      width: 7,
      height: 7,
      borderRadius: theme.rounded.full,
      marginTop: 6,
      opacity: 0.86,
    },
    signalTextWrap: {
      flex: 1,
      gap: 1,
    },
    signalTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    signalBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.regular,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.borderSoft,
      marginVertical: 2,
    },
    carryCard: {
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.borderSoft : "rgba(199,126,97,0.16)",
      backgroundColor: theme.isDark ? theme.surfaceAlt : "#F8F0E7",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      gap: 10,
    },
    carryTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.bold,
    },
    carryBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 18,
      fontFamily: theme.typography.fontFamily.regular,
    },
    priorityList: {
      gap: 8,
      marginTop: 4,
    },
    priorityPrimary: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.isDark
        ? "rgba(111,138,105,0.18)"
        : "rgba(237,242,232,0.92)",
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    prioritySecondary: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    priorityMarkerPrimary: {
      width: 22,
      height: 22,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    priorityMarkerSecondary: {
      width: 7,
      height: 7,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.textTertiary,
      marginTop: 7,
      opacity: 0.62,
    },
    priorityPrimaryText: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 19,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    prioritySecondaryText: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: 16,
      fontFamily: theme.typography.fontFamily.regular,
    },
    loadingHero: {
      borderRadius: theme.rounded.xxl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 18,
      gap: 12,
      ...theme.depth.raised,
    },
    loadingHeadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    loadingRingWrap: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingRing: {
      width: 18,
      height: 18,
      borderRadius: theme.rounded.xs,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    loadingRingDot: {
      position: "absolute",
      top: 8,
      width: 6,
      height: 6,
      borderRadius: theme.rounded.xs,
      backgroundColor: theme.primary,
    },
    loadingTitle: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.bold,
    },
    loadingBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 19,
      fontFamily: theme.typography.fontFamily.regular,
    },
    skeletonBar: {
      borderRadius: theme.rounded.sm,
      backgroundColor: "#EADFD2",
    },
    skeletonBarLong: {
      width: 214,
      height: 14,
    },
    skeletonBarShort: {
      width: 176,
      height: 12,
      backgroundColor: "#F0E7DB",
    },
    loadingSupportCard: {
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 18,
      paddingVertical: 18,
      gap: 12,
      ...theme.depth.raised,
    },
    skeletonMini: {
      width: 92,
      height: 10,
    },
    skeletonMedium: {
      width: 210,
      height: 12,
      backgroundColor: "#F0E7DB",
    },
    skeletonSupport: {
      width: 168,
      height: 10,
      backgroundColor: "#F0E7DB",
    },
    helperNote: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: 16,
      fontFamily: theme.typography.fontFamily.regular,
    },
    stateCard: {
      borderRadius: theme.rounded.xxl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
      gap: 12,
      ...theme.depth.raised,
    },
    stateIconWrap: {
      alignSelf: "center",
      width: 72,
      height: 72,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.success.surface,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    stateIncompleteIcon: {
      color: theme.primary,
      fontSize: theme.typography.size.displayM,
      lineHeight: 32,
      fontFamily: theme.typography.fontFamily.medium,
    },
    stateLockedIcon: {
      color: theme.primary,
      fontSize: theme.typography.size.displayM,
      lineHeight: 32,
      fontFamily: theme.typography.fontFamily.medium,
    },
    stateTitle: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "center",
    },
    stateBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 19,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    stateActions: {
      gap: 12,
      marginTop: 4,
    },
    signalMeter: {
      alignItems: "flex-start",
      gap: 8,
      marginTop: 2,
    },
    signalMeterLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    signalMeterDots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    signalMeterDot: {
      width: 10,
      height: 10,
      borderRadius: theme.rounded.xs,
      backgroundColor: theme.border,
      opacity: 0.65,
    },
    signalMeterDotFilled: {
      backgroundColor: theme.primary,
      opacity: 1,
    },
    signalMeterDotMid: {
      backgroundColor: theme.primarySoft,
      opacity: 0.9,
    },
    signalMeterCaption: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    footnoteText: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: 16,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    unavailableIconWrap: {
      width: 72,
      height: 72,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },
    unavailableCompactIconWrap: {
      width: 36,
      height: 36,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    unavailableCard: {
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 15,
      gap: 9,
    },
    unavailableStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    unavailableTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: 21,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    unavailableBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: 19,
      fontFamily: theme.typography.fontFamily.regular,
    },
    primaryButton: {
      minHeight: 46,
      borderRadius: theme.rounded.xl,
      marginTop: 4,
    },
    secondaryButton: {
      minHeight: 46,
      borderRadius: theme.rounded.xl,
      marginTop: 2,
    },
    textButton: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 24,
      paddingVertical: 2,
    },
    textButtonPressed: {
      opacity: 0.65,
    },
    textButtonLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
