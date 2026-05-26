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
import { StatisticsTrendCard } from "@/feature/Statistics/components/StatisticsTrendCard";
import { StatisticsDailyAveragesSection } from "@/feature/Statistics/components/StatisticsDailyAveragesSection";
import { StatisticsMacroBreakdownCard } from "@/feature/Statistics/components/StatisticsMacroBreakdownCard";
import { StatisticsPremiumBanner } from "@/feature/Statistics/components/StatisticsPremiumBanner";
import { StatisticsEmptyState } from "@/feature/Statistics/components/StatisticsEmptyState";
import { endOfDay, getAccessWindowStartDate } from "@/utils/accessWindow";

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

  const state = useStatisticsState({
    uid,
    calorieTarget: userData?.profile?.nutritionProfile.calorieTarget ?? null,
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
              <StatisticsTrendCard
                metric={state.metric}
                metricAverage={state.metricAverage}
                labels={state.labels}
                series={state.selectedSeries}
                onChangeMetric={state.setMetric}
              />

              <StatisticsDailyAveragesSection
                avgKcal={state.avgKcal}
                avgProtein={state.avgProtein}
                avgCarbs={state.avgCarbs}
                avgFat={state.avgFat}
              />

              {state.hasTotals ? (
                <StatisticsMacroBreakdownCard
                  protein={state.totals.protein}
                  carbs={state.totals.carbs}
                  fat={state.totals.fat}
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
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
      ...theme.depth.raised,
    },
    header: {
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xxs,
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
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    content: {
      flex: 1,
      marginTop: theme.spacing.md,
    },
    loaderWrap: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.display,
      gap: theme.spacing.md,
    },
  });
