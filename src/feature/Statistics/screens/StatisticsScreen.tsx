import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { Layout, FullScreenLoader } from "@/components";
import { useAccessContext } from "@/context/AccessContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/navigate";
import { FREE_WINDOW_DAYS } from "@/services/meals/mealService";
import { useStatisticsState } from "@/feature/Statistics/hooks/useStatisticsState";
import type { RangeKey } from "@/feature/Statistics/types";
import { StatisticsRangeSwitcher } from "@/feature/Statistics/components/StatisticsRangeSwitcher";
import { StatisticsCustomRangeControl } from "@/feature/Statistics/components/StatisticsCustomRangeControl";
import { StatisticsSummaryCard } from "@/feature/Statistics/components/StatisticsSummaryCard";
import { StatisticsTrendCard } from "@/feature/Statistics/components/StatisticsTrendCard";
import { StatisticsMacroBreakdownCard } from "@/feature/Statistics/components/StatisticsMacroBreakdownCard";
import { StatisticsPremiumBanner } from "@/feature/Statistics/components/StatisticsPremiumBanner";
import { StatisticsEmptyState } from "@/feature/Statistics/components/StatisticsEmptyState";
import { endOfDay, getAccessWindowStartDate } from "@/utils/accessWindow";
import { calculateMacroTargets } from "@/utils/calculateMacroTargets";

type StatisticsNavigation = StackNavigationProp<RootStackParamList, "Statistics">;
type Props = {
  navigation: StatisticsNavigation;
};

export default function StatisticsScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const { t } = useTranslation(["statistics", "common"]);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;

  const { userData } = useUserProfileContext();
  const { canUseFeature } = useAccessContext();

  const uid = userData?.uid || "";
  const premiumActive = canUseFeature("fullHistory");
  const accessWindowDays = premiumActive ? undefined : FREE_WINDOW_DAYS;
  const minCustomRangeDate = getAccessWindowStartDate(accessWindowDays);
  const maxCustomRangeDate = endOfDay(new Date());
  const nutritionProfile = userData?.profile?.nutritionProfile;
  const calorieTarget = nutritionProfile?.calorieTarget ?? null;
  const macroTargets = useMemo(
    () =>
      calorieTarget && calorieTarget > 0
        ? calculateMacroTargets({
            calorieTarget,
            preferences: nutritionProfile?.preferences,
            goal: nutritionProfile?.goal,
          })
        : null,
    [calorieTarget, nutritionProfile?.goal, nutritionProfile?.preferences],
  );

  const state = useStatisticsState({
    uid,
    calorieTarget,
    accessWindowDays,
  });

  const showAnalytics = state.emptyKind === "none";

  return (
    <Layout disableScroll style={styles.layout} showOfflineBanner={showAnalytics}>
      <View style={styles.container} testID="statistics-screen">
        <View style={styles.headerPanel}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("statistics:title")}</Text>
            <Text style={styles.subtitle}>{t("statistics:subtitle")}</Text>
          </View>

          <StatisticsRangeSwitcher
            active={state.active}
            options={[
              { key: "7d", label: t("statistics:ranges.7d") },
              { key: "30d", label: t("statistics:ranges.30d") },
              { key: "custom", label: t("statistics:ranges.custom") },
            ]}
            onChange={(next) => state.setActive(next as RangeKey)}
          />

          {state.active === "custom" ? (
            <StatisticsCustomRangeControl
              range={state.customRange}
              onApply={(range) => {
                state.setCustomRange(range);
                state.setActive("custom");
              }}
              minDate={minCustomRangeDate}
              maxDate={maxCustomRangeDate}
            />
          ) : null}
        </View>

        <View style={styles.content} testID="statistics-content">
          {state.loadingMeals ? (
            <View testID="statistics-loading-state" style={styles.loaderWrap}>
              <FullScreenLoader label={t("common:loading")} />
            </View>
          ) : showAnalytics ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode={keyboardDismissMode}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <StatisticsSummaryCard
                activeRange={state.active}
                avgKcal={state.avgKcal}
                calorieTarget={state.calorieTarget}
                calorieGoalProgress={state.calorieGoalProgress}
                loggedDaysCount={state.loggedDaysCount}
                rangeDaysCount={state.rangeDaysCount}
                comparison={state.calorieComparison}
              />

              <StatisticsTrendCard
                metric={state.metric}
                labels={state.labels}
                series={state.selectedSeries}
                calorieTarget={state.calorieTarget}
                macroTargets={macroTargets}
                onChangeMetric={state.setMetric}
              />

              {state.hasTotals ? (
                <StatisticsMacroBreakdownCard
                  protein={state.avgLoggedProtein}
                  carbs={state.avgLoggedCarbs}
                  fat={state.avgLoggedFat}
                  targets={macroTargets}
                />
              ) : null}

              {!premiumActive && accessWindowDays && state.isWindowLimited ? (
                <StatisticsPremiumBanner
                  days={accessWindowDays}
                  onPress={() => navigation.navigate("ManageSubscription")}
                />
              ) : null}
            </ScrollView>
          ) : (
            <StatisticsEmptyState
              kind={state.emptyKind}
              isOffline={!isOnline}
              accessWindowDays={accessWindowDays}
              onManageSubscription={
                premiumActive
                  ? undefined
                  : () => navigation.navigate("ManageSubscription")
              }
            />
          )}
        </View>
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: theme.spacing.screenPadding,
      paddingRight: theme.spacing.screenPadding,
    },
    container: {
      flex: 1,
    },
    headerPanel: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.xs,
    },
    header: {
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
    },
    subtitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    content: {
      flex: 1,
      marginTop: theme.spacing.lg,
    },
    loaderWrap: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.display,
      gap: theme.spacing.lg,
    },
  });
