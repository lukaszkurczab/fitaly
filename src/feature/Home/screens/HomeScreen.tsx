import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Layout, Modal } from "@/components";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import { useAccessContext } from "@/context/AccessContext";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import { useCoach } from "@/hooks/useCoach";
import { getE2EFixtureState } from "@/services/e2e/fixtures";
import WeekStrip, { type WeekDayItem } from "@/components/WeekStrip";
import { MacroTargetsRow } from "../components/MacroTargetsRow";
import { TodaysMealsList } from "../components/TodaysMealsList";
import HomeHeroCard from "../components/HomeHeroCard";
import WeeklyReportCard from "../components/WeeklyReportCard";
import CoachInsightCard from "../components/CoachInsightCard";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useMealAddMethodState } from "@/feature/Meals/hooks/useMealAddMethodState";
import { useMealDraftContext } from "@/context/MealDraftContext";
import { formatMealDayKey } from "@/services/meals/mealMetadata";
import { useHomeMealDeadLetterRecovery } from "@/feature/Home/hooks/useHomeMealDeadLetterRecovery";
import { useHomeTodayState } from "@/feature/Home/hooks/useHomeTodayState";
import { buildHomeHeroModel } from "@/feature/Home/services/homeHeroPresenter";
import type { AppIconName } from "@/components/AppIcon";
import {
  buildHomeRetentionSurface,
  shouldRequestHomeCoach,
  shouldRequestHomeWeeklyReport,
} from "@/feature/Home/services/homeRetentionPresenter";
import {
  buildHomeReviewDraftNextActionCandidate,
  dismissHomeReviewDraftNextAction,
  selectHomeNextAction,
} from "@/feature/Home/services/homeNextActionSelector";
import type {
  HomeNextActionInput,
  HomeNextActionSelection,
} from "@/feature/Home/services/homeNextActionSelector";
import type { Meal } from "@/types/meal";
import { emit } from "@/services/core/events";

function buildLast7Days(): WeekDayItem[] {
  const now = new Date();
  const todayString = now.toDateString();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));

    return {
      date,
      label: String(date.getDate()).padStart(2, "0"),
      isToday: date.toDateString() === todayString,
    };
  });
}

type HomeNavigation = StackNavigationProp<RootStackParamList, "Home">;

type Props = {
  navigation: HomeNavigation;
};

type HomeAddMethodPresentation = {
  icon: AppIconName;
  ctaKey: string;
};

type HomeDeadLetterRecoveryBannerProps = {
  testID?: string;
  titleTestID?: string;
  descriptionTestID?: string;
  retryButtonTestID?: string;
  secondaryButtonTestID?: string;
  title: string;
  description: string;
  actionLabel: string;
  secondaryActionLabel?: string;
  retrying: boolean;
  onRetry: () => void;
  onSecondaryAction?: () => void;
  styles: ReturnType<typeof makeStyles>;
};

type HomeNextActionPromptProps = {
  title: string;
  description: string;
  actionLabel: string;
  dismissLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  styles: ReturnType<typeof makeStyles>;
};

function HomeDeadLetterRecoveryBanner({
  testID = "home-dead-letter-recovery",
  titleTestID = "home-dead-letter-title",
  descriptionTestID = "home-dead-letter-description",
  retryButtonTestID = "home-dead-letter-retry-button",
  secondaryButtonTestID,
  title,
  description,
  actionLabel,
  secondaryActionLabel,
  retrying,
  onRetry,
  onSecondaryAction,
  styles,
}: HomeDeadLetterRecoveryBannerProps) {
  return (
    <View
      testID={testID}
      style={styles.deadLetterBanner}
    >
      <View style={styles.deadLetterCopy}>
        <View style={styles.deadLetterDot} />
        <Text testID={titleTestID} style={styles.deadLetterTitle}>
          {title}
        </Text>
      </View>
      <View style={styles.deadLetterActions}>
        <Text
          testID={descriptionTestID}
          style={styles.deadLetterDescription}
        >
          {description}
        </Text>
        <View style={styles.deadLetterButtonRow}>
          {secondaryActionLabel && onSecondaryAction ? (
            <Pressable
              testID={secondaryButtonTestID}
              onPress={onSecondaryAction}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityState={{ disabled: retrying }}
              accessibilityLabel={secondaryActionLabel}
              style={({ pressed }) => [
                styles.deadLetterSecondary,
                retrying ? styles.deadLetterRetryDisabled : null,
                pressed && !retrying ? styles.deadLetterRetryPressed : null,
              ]}
            >
              <Text style={styles.deadLetterSecondaryLabel}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID={retryButtonTestID}
            onPress={onRetry}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityState={{ disabled: retrying }}
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [
              styles.deadLetterRetry,
              retrying ? styles.deadLetterRetryDisabled : null,
              pressed && !retrying ? styles.deadLetterRetryPressed : null,
            ]}
          >
            <Text style={styles.deadLetterRetryLabel}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HomeNextActionPrompt({
  title,
  description,
  actionLabel,
  dismissLabel,
  onAction,
  onDismiss,
  styles,
}: HomeNextActionPromptProps) {
  return (
    <View testID="home-next-action-prompt" style={styles.nextActionPrompt}>
      <View style={styles.nextActionCopy}>
        <Text testID="home-next-action-title" style={styles.nextActionTitle}>
          {title}
        </Text>
        <Text
          testID="home-next-action-description"
          style={styles.nextActionDescription}
        >
          {description}
        </Text>
      </View>
      <View style={styles.nextActionButtons}>
        <Pressable
          testID="home-next-action-dismiss-button"
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          style={({ pressed }) => [
            styles.nextActionDismiss,
            pressed ? styles.nextActionButtonPressed : null,
          ]}
        >
          <Text style={styles.nextActionDismissLabel}>{dismissLabel}</Text>
        </Pressable>
        <Pressable
          testID="home-next-action-continue-button"
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.nextActionContinue,
            pressed ? styles.nextActionButtonPressed : null,
          ]}
        >
          <Text style={styles.nextActionContinueLabel}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getHomeAddMethodPresentation(
  key: string | undefined,
): HomeAddMethodPresentation {
  switch (key) {
    case "photo":
      return { icon: "camera", ctaKey: "home:hero.methodCta.photo" };
    case "text":
      return { icon: "text", ctaKey: "home:hero.methodCta.text" };
    case "barcode":
      return { icon: "scan-barcode", ctaKey: "home:hero.methodCta.barcode" };
    case "saved":
      return { icon: "saved-items", ctaKey: "home:hero.methodCta.saved" };
    case "manual":
      return { icon: "edit", ctaKey: "home:hero.methodCta.manual" };
    default:
      return { icon: "add", ctaKey: "home:hero.methodCta.default" };
  }
}

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation(["home", "common", "meals"]);
  const { userData } = useUserProfileContext();
  const { uid } = useAuthContext();
  const { canUseFeature } = useAccessContext();
  const { loadDraft } = useMealDraftContext();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [homeNextActionInput, setHomeNextActionInput] =
    useState<HomeNextActionInput | null>(null);
  const homeNextActionInputRef = useRef<HomeNextActionInput | null>(null);
  const homeNextActionRequestRef = useRef(0);
  const homeNextActionMountedRef = useRef(false);
  const selectedDayKey = useMemo(
    () => formatMealDayKey(selectedDate),
    [selectedDate],
  );
  const homeDay = useHomeTodayState({
    uid,
    selectedDayKey,
    nutritionProfile: userData?.profile?.nutritionProfile,
  });
  const mealDeadLetterRecovery = useHomeMealDeadLetterRecovery(uid);
  const last7Days = useMemo(buildLast7Days, []);
  const mealAddEntry = useMealAddMethodState({
    navigation,
    replaceOnStart: false,
  });
  const addMethodPresentation = useMemo(
    () => getHomeAddMethodPresentation(mealAddEntry.preferredOption.key),
    [mealAddEntry.preferredOption.key],
  );

  useEffect(() => {
    homeNextActionMountedRef.current = true;
    return () => {
      homeNextActionMountedRef.current = false;
    };
  }, []);

  const refreshHomeNextAction = useCallback(() => {
    const requestId = homeNextActionRequestRef.current + 1;
    homeNextActionRequestRef.current = requestId;

    void buildHomeReviewDraftNextActionCandidate({ uid })
      .then((candidate) => {
        if (
          !homeNextActionMountedRef.current ||
          homeNextActionRequestRef.current !== requestId
        ) {
          return;
        }

        const nextInput = candidate.state === "no_action" ? null : candidate;
        if (homeNextActionInputRef.current === null && nextInput === null) {
          return;
        }

        homeNextActionInputRef.current = nextInput;
        setHomeNextActionInput(nextInput);
      })
      .catch(() => {
        if (
          !homeNextActionMountedRef.current ||
          homeNextActionRequestRef.current !== requestId
        ) {
          return;
        }

        homeNextActionInputRef.current = null;
        setHomeNextActionInput(null);
      });
  }, [uid]);

  useEffect(() => {
    refreshHomeNextAction();
  }, [refreshHomeNextAction]);

  useFocusEffect(
    useCallback(() => {
      refreshHomeNextAction();
      return undefined;
    }, [refreshHomeNextAction]),
  );

  const homeNextActionSelection: HomeNextActionSelection = useMemo(() => {
    if (!homeNextActionInput) {
      return {
        type: "no_action",
        reasonCode: "inputs_pending",
        sourceCandidateId: null,
      };
    }

    return selectHomeNextAction({
      candidates: [homeNextActionInput],
    });
  }, [homeNextActionInput]);

  const { dayMeals, mealCount, consumed, macroTargets } = homeDay;
  const canAccessWeeklyReport =
    canUseFeature("weeklyReport") ||
    Boolean(getE2EFixtureState()?.weeklyReport);
  const weeklyReportActive = shouldRequestHomeWeeklyReport({
    hasAccess: canAccessWeeklyReport,
    dayState: homeDay,
  });
  const weeklyReport = useWeeklyReport({
    uid,
    active: weeklyReportActive,
  });
  const [weeklyReportRetrying, setWeeklyReportRetrying] = useState(false);
  const weeklyReportStatus = weeklyReport.report.status;
  const refreshWeeklyReport = weeklyReport.refresh;
  const coachActive = shouldRequestHomeCoach({
    uid,
    dayState: homeDay,
  });
  const coach = useCoach({
    uid,
    dayKey: selectedDayKey,
    active: coachActive,
  });

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language || undefined),
    [i18n.language],
  );
  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [i18n.language],
  );

  const displayName = useMemo(() => {
    const candidate = userData?.username?.trim();
    if (!candidate) return null;
    return candidate.split(/\s+/)[0] ?? null;
  }, [userData?.username]);

  const heroModel = useMemo(() => {
    return buildHomeHeroModel({
      dayState: homeDay,
      selectedDate,
      displayName,
      t,
      numberFormatter,
      fullDateFormatter,
    });
  }, [
    displayName,
    fullDateFormatter,
    homeDay,
    numberFormatter,
    selectedDate,
    t,
  ]);

  const retentionSurface = useMemo(
    () =>
      buildHomeRetentionSurface({
        dayState: homeDay,
        weekly: {
          hasAccess: canAccessWeeklyReport,
          loading: weeklyReport.loading,
          report: weeklyReport.report,
          status: weeklyReport.status,
        },
        coach: {
          loading: coach.loading,
          enabled: coach.enabled,
          coach: coach.coach,
          status: coach.status,
          isStale: coach.isStale,
        },
      }),
    [
      canAccessWeeklyReport,
      coach.coach,
      coach.enabled,
      coach.isStale,
      coach.loading,
      coach.status,
      homeDay,
      weeklyReport.loading,
      weeklyReport.report,
      weeklyReport.status,
    ],
  );

  const coachInsightFreshness = useMemo(() => {
    if (coach.isStale) {
      return "stale" as const;
    }

    return coach.coach.meta.isDegraded ? "degraded" : "fresh";
  }, [coach.coach.meta.isDegraded, coach.isStale]);

  const openMealDetails = useCallback(
    (meal: Meal) => {
      if (!meal.cloudId) return;
      navigation.navigate("MealDetails", {
        cloudId: meal.cloudId,
      });
    },
    [navigation],
  );
  const heroCtaLabel =
    heroModel.ctaAction === "add_meal"
      ? t(addMethodPresentation.ctaKey, {
          defaultValue: heroModel.ctaLabel,
        })
      : heroModel.ctaLabel;
  const recoveryBanners = useMemo(() => {
    const banners: Array<
      Omit<HomeDeadLetterRecoveryBannerProps, "retrying" | "styles">
    > = [];
    const failedSyncCount = mealDeadLetterRecovery.diagnostics.dead;
    if (failedSyncCount > 0) {
      const lastFailedKind = mealDeadLetterRecovery.diagnostics.lastFailedKind
        ? t(
            `history.deadLetterOperation.${mealDeadLetterRecovery.diagnostics.lastFailedKind}`,
            {
              ns: "meals",
            },
          )
        : null;

      banners.push({
        testID: "home-dead-letter-recovery",
        titleTestID: "home-dead-letter-title",
        descriptionTestID: "home-dead-letter-description",
        retryButtonTestID: "home-dead-letter-retry-button",
        title: t("history.deadLetterTitle", {
          ns: "meals",
          count: failedSyncCount,
        }),
        description: lastFailedKind
          ? t("history.deadLetterSubtitleWithLast", {
              ns: "meals",
              pending: mealDeadLetterRecovery.diagnostics.pending,
              operation: lastFailedKind,
            })
          : t("history.deadLetterSubtitle", {
              ns: "meals",
              pending: mealDeadLetterRecovery.diagnostics.pending,
            }),
        actionLabel: t("common:retry"),
        onRetry: mealDeadLetterRecovery.retryDeadLetters,
      });
    }

    const failedPhotoUploads =
      mealDeadLetterRecovery.diagnostics.failedPhotoUploads;
    if (failedPhotoUploads > 0) {
      banners.push({
        testID: "home-photo-upload-recovery",
        titleTestID: "home-photo-upload-title",
        descriptionTestID: "home-photo-upload-description",
        retryButtonTestID: "home-photo-upload-retry-button",
        secondaryButtonTestID: "home-photo-upload-discard-button",
        title: t("history.photoUploadRecoveryTitle", {
          ns: "meals",
          count: failedPhotoUploads,
        }),
        description: t("history.photoUploadRecoverySubtitle", {
          ns: "meals",
        }),
        actionLabel: t("common:retry"),
        secondaryActionLabel: t("history.photoUploadDiscardAction", {
          ns: "meals",
        }),
        onRetry: mealDeadLetterRecovery.retryPhotoUploads,
        onSecondaryAction: mealDeadLetterRecovery.discardPhotoUploads,
      });
    }

    return banners;
  }, [
    mealDeadLetterRecovery.diagnostics,
    mealDeadLetterRecovery.discardPhotoUploads,
    mealDeadLetterRecovery.retryDeadLetters,
    mealDeadLetterRecovery.retryPhotoUploads,
    t,
  ]);

  const handleCoachCta = useCallback(() => {
    if (retentionSurface.type !== "coach_insight") {
      return;
    }

    const { actionType } = retentionSurface.insight;
    if (actionType === "log_next_meal") {
      void mealAddEntry.handleDirectStart();
      return;
    }
    if (actionType === "open_chat") {
      navigation.navigate("Chat");
      return;
    }
    if (actionType === "review_history") {
      navigation.navigate("HistoryList");
    }
  }, [mealAddEntry, navigation, retentionSurface]);

  const handleWeeklyReportPress = useCallback(() => {
    if (weeklyReportStatus === "ready") {
      navigation.navigate("WeeklyReport");
      return;
    }

    if (weeklyReportRetrying) {
      return;
    }

    setWeeklyReportRetrying(true);
    void refreshWeeklyReport().finally(() => {
      setWeeklyReportRetrying(false);
    });
  }, [
    navigation,
    refreshWeeklyReport,
    weeklyReportRetrying,
    weeklyReportStatus,
  ]);

  const openHomeMethodChooser = useCallback(() => {
    navigation.navigate("MealAddMethod", {
      selectionMode: "persistDefault",
    });
  }, [navigation]);

  const showReviewDraftUnavailable = useCallback(() => {
    homeNextActionInputRef.current = null;
    setHomeNextActionInput(null);
    emit("ui:toast", {
      key: "nextAction.reviewDraft.unavailable",
      ns: "home",
    });
  }, []);

  const handleNextActionContinue = useCallback(() => {
    if (
      homeNextActionSelection.type !== "action" ||
      homeNextActionSelection.action.actionType !== "continue_review" ||
      !uid
    ) {
      return;
    }

    void (async () => {
      try {
        await loadDraft(uid);
        const candidate = await buildHomeReviewDraftNextActionCandidate({ uid });
        if (candidate.state === "no_action") {
          showReviewDraftUnavailable();
          return;
        }
        navigation.navigate("AddMeal", { start: "ReviewMeal" });
      } catch {
        showReviewDraftUnavailable();
      }
    })();
  }, [
    homeNextActionSelection,
    loadDraft,
    navigation,
    showReviewDraftUnavailable,
    uid,
  ]);

  const handleNextActionDismiss = useCallback(() => {
    if (homeNextActionSelection.type !== "action" || !uid) {
      return;
    }

    const { candidateId, sourceVersion } = homeNextActionSelection.action;
    homeNextActionInputRef.current = null;
    setHomeNextActionInput(null);
    void dismissHomeReviewDraftNextAction({
      uid,
      candidateId,
      sourceVersion,
    }).catch(() => {
      emit("ui:toast", {
        key: "nextAction.reviewDraft.dismissUnavailable",
        ns: "home",
      });
    });
  }, [homeNextActionSelection, uid]);

  return (
    <Layout>
      <View style={[styles.screen, styles.screenGap]} testID="home-screen">
        <WeekStrip
          days={last7Days}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />

        <HomeHeroCard
          title={heroModel.title}
          meta={heroModel.meta}
          ctaLabel={heroCtaLabel}
          onPressCta={() => {
            if (heroModel.ctaAction === "review_history") {
              navigation.navigate("HistoryList");
              return;
            }

            void mealAddEntry.handleDirectStart();
          }}
          methodLabel={t("home:chooseAddMethod")}
          methodIcon={
            heroModel.showMethodSelector
              ? addMethodPresentation.icon
              : undefined
          }
          onPressMethodSelector={openHomeMethodChooser}
          progress={heroModel.progress}
          supportText={
            heroModel.supportText ?? heroModel.supportCopy ?? undefined
          }
          tone={heroModel.tone}
        />

        {recoveryBanners.map((banner) => (
          <HomeDeadLetterRecoveryBanner
            key={banner.testID}
            testID={banner.testID}
            titleTestID={banner.titleTestID}
            descriptionTestID={banner.descriptionTestID}
            retryButtonTestID={banner.retryButtonTestID}
            secondaryButtonTestID={banner.secondaryButtonTestID}
            title={banner.title}
            description={banner.description}
            actionLabel={banner.actionLabel}
            secondaryActionLabel={banner.secondaryActionLabel}
            retrying={mealDeadLetterRecovery.retrying}
            onRetry={banner.onRetry}
            onSecondaryAction={banner.onSecondaryAction}
            styles={styles}
          />
        ))}

        {!mealAddEntry.showResumeModal &&
        homeNextActionSelection.type === "action" &&
        homeNextActionSelection.action.actionType === "continue_review" ? (
          <HomeNextActionPrompt
            title={t("home:nextAction.reviewDraft.title")}
            description={t("home:nextAction.reviewDraft.description")}
            actionLabel={t("home:nextAction.reviewDraft.cta")}
            dismissLabel={t("home:nextAction.dismiss")}
            onAction={handleNextActionContinue}
            onDismiss={handleNextActionDismiss}
            styles={styles}
          />
        ) : null}

        {macroTargets ? (
          <MacroTargetsRow
            macroTargets={macroTargets}
            consumed={{
              protein: consumed.protein,
              carbs: consumed.carbs,
              fat: consumed.fat,
            }}
          />
        ) : null}

        {mealCount > 0 ? (
          <>
            <TodaysMealsList meals={dayMeals} onOpenMeal={openMealDetails} />
            <Pressable
              testID="home-view-history-button"
              onPress={() => navigation.navigate("HistoryList")}
              accessibilityRole="button"
              accessibilityLabel={t("home:viewHistory")}
              style={({ pressed }) => [
                styles.historyLink,
                retentionSurface.type === "weekly_report"
                  ? styles.historyLinkBeforeReport
                  : null,
                pressed && styles.historyLinkPressed,
              ]}
            >
              <Text style={styles.historyLinkText}>
                {t("home:viewHistory")} →
              </Text>
            </Pressable>
          </>
        ) : null}

        {retentionSurface.type === "weekly_report" ? (
          <View
            style={mealCount > 0 ? styles.retentionBottomClearance : null}
          >
            <WeeklyReportCard
              loading={weeklyReportRetrying}
              report={weeklyReport.report}
              action={weeklyReportStatus === "ready" ? "open" : "retry"}
              onPress={handleWeeklyReportPress}
            />
          </View>
        ) : retentionSurface.type === "coach_insight" ? (
          <CoachInsightCard
            insight={retentionSurface.insight}
            freshness={coachInsightFreshness}
            ctaTargetScreen={retentionSurface.ctaTargetScreen ?? undefined}
            onPressCta={handleCoachCta}
          />
        ) : null}

        {mealCount === 0 ? (
          <Pressable
            testID="home-view-history-button"
            onPress={() => navigation.navigate("HistoryList")}
            accessibilityRole="button"
            accessibilityLabel={t("home:viewHistory")}
            style={({ pressed }) => [
              styles.historyLink,
              pressed && styles.historyLinkPressed,
            ]}
          >
            <Text style={styles.historyLinkText}>
              {t("home:viewHistory")} →
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        testID="home-resume-draft-modal"
        visible={mealAddEntry.showResumeModal}
        title={t("meals:continue_draft_title")}
        message={t("meals:continue_draft_message")}
        primaryAction={{
          testID: "home-resume-draft-continue-button",
          label: t("meals:continue"),
          onPress: () => {
            void mealAddEntry.handleContinueDraft();
          },
        }}
        secondaryAction={{
          testID: "home-resume-draft-discard-button",
          label: t("meals:discard"),
          onPress: () => {
            void mealAddEntry.handleDiscardDraft();
          },
          tone: "destructive",
        }}
        onClose={mealAddEntry.closeResumeModal}
      />
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    screenGap: {
      gap: theme.spacing.lg,
    },
    retentionBottomClearance: {
      marginBottom: theme.spacing.nav + theme.spacing.md,
    },
    historyLink: {
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
      marginBottom: theme.spacing.nav + theme.spacing.md,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
      backgroundColor: "transparent",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xxs,
    },
    historyLinkBeforeReport: {
      marginBottom: 0,
    },
    historyLinkPressed: {
      opacity: 0.6,
    },
    historyLinkText: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    deadLetterBanner: {
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.warning.surface,
      backgroundColor: theme.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    deadLetterCopy: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    deadLetterDot: {
      width: 8,
      height: 8,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.warning.main,
    },
    deadLetterTitle: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    deadLetterActions: {
      gap: theme.spacing.sm,
    },
    deadLetterDescription: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    deadLetterButtonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    deadLetterRetry: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs + 1,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.warning.surface,
    },
    deadLetterSecondary: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs + 1,
      borderRadius: theme.rounded.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.warning.surface,
      backgroundColor: "transparent",
    },
    deadLetterRetryPressed: {
      opacity: 0.84,
    },
    deadLetterRetryDisabled: {
      opacity: 0.6,
    },
    deadLetterRetryLabel: {
      color: theme.warning.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    deadLetterSecondaryLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    nextActionPrompt: {
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    nextActionCopy: {
      gap: theme.spacing.xxs,
    },
    nextActionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    nextActionDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    nextActionButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    nextActionDismiss: {
      minHeight: 32,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.full,
      backgroundColor: "transparent",
    },
    nextActionContinue: {
      minHeight: 32,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
    },
    nextActionButtonPressed: {
      opacity: 0.82,
    },
    nextActionDismissLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    nextActionContinueLabel: {
      color: theme.cta.primaryText,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
