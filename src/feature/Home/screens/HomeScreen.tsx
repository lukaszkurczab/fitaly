import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Layout, Modal } from "@/components";
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
import { formatMealDayKey } from "@/services/meals/mealMetadata";
import { useHomeTodayState } from "@/feature/Home/hooks/useHomeTodayState";
import { buildHomeHeroModel } from "@/feature/Home/services/homeHeroPresenter";
import {
  buildHomeRetentionSurface,
  shouldRequestHomeCoach,
  shouldRequestHomeWeeklyReport,
} from "@/feature/Home/services/homeRetentionPresenter";
import type { Meal } from "@/types/meal";

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

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation(["home", "common", "meals"]);
  const { userData } = useUserProfileContext();
  const { uid } = useAuthContext();
  const { canUseFeature } = useAccessContext();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDayKey = useMemo(
    () => formatMealDayKey(selectedDate),
    [selectedDate],
  );
  const homeDay = useHomeTodayState({
    uid,
    selectedDayKey,
    nutritionProfile: userData?.profile?.nutritionProfile,
  });
  const last7Days = useMemo(buildLast7Days, []);
  const mealAddEntry = useMealAddMethodState({
    navigation,
    replaceOnStart: false,
  });

  const {
    dayMeals,
    mealCount,
    consumed,
    macroTargets,
  } = homeDay;
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

  const selectedMethodName = t(`meals:${mealAddEntry.preferredOption.titleKey}`);
  const methodSelectorLabel = t("home:methodSelector", {
    method: selectedMethodName,
  });

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
          ctaLabel={heroModel.ctaLabel}
          onPressCta={() => {
            if (heroModel.ctaAction === "review_history") {
              navigation.navigate("HistoryList");
              return;
            }

            void mealAddEntry.handleDirectStart();
          }}
          methodLabel={heroModel.showMethodSelector ? methodSelectorLabel : undefined}
          methodIcon={heroModel.showMethodSelector ? mealAddEntry.preferredOption.icon : undefined}
          onPressMethodSelector={
            heroModel.showMethodSelector
              ? () =>
                  navigation.navigate("MealAddMethod", {
                    selectionMode: "persistDefault",
                  })
              : undefined
          }
          progress={heroModel.progress}
          supportText={heroModel.supportText ?? undefined}
          tone={heroModel.tone}
        />

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

        {heroModel.supportCopy ? (
          <Text style={styles.supportCopy}>{heroModel.supportCopy}</Text>
        ) : null}

        {mealCount > 0 ? (
          <TodaysMealsList
            meals={dayMeals}
            onOpenMeal={openMealDetails}
          />
        ) : null}

        {retentionSurface.type === "weekly_report" ? (
          <WeeklyReportCard
            loading={false}
            report={weeklyReport.report}
            onPress={() => navigation.navigate("WeeklyReport")}
          />
        ) : retentionSurface.type === "coach_insight" ? (
          <CoachInsightCard
            insight={retentionSurface.insight}
            freshness={coachInsightFreshness}
            ctaTargetScreen={retentionSurface.ctaTargetScreen ?? undefined}
            onPressCta={handleCoachCta}
          />
        ) : null}

        <Pressable
          testID="home-view-history-button"
          onPress={() => navigation.navigate("HistoryList")}
          accessibilityRole="button"
          accessibilityLabel={t("home:viewHistory")}
          style={({ pressed }) => [styles.historyLink, pressed && styles.historyLinkPressed]}
        >
          <Text style={styles.historyLinkText}>
            {t("home:viewHistory")} →
          </Text>
        </Pressable>
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
      gap: theme.spacing.sectionGap,
    },
    supportCopy: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "left",
      paddingHorizontal: theme.spacing.sm,
    },
    historyLink: {
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
    },
    historyLinkPressed: {
      opacity: 0.6,
    },
    historyLinkText: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
