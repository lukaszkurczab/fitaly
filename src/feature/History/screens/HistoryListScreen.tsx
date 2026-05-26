import React, { useCallback, useMemo } from "react";
import type { StackNavigationProp } from "@react-navigation/stack";
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { Layout, SearchBox } from "@/components";
import AppIcon from "@/components/AppIcon";
import { EmptyState } from "../components/EmptyState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { FilterBadgeButton } from "../components/FilterBadgeButton";
import { FilterPanel } from "../components/FilterPanel";
import type { Meal } from "@/types/meal";
import type { DaySection } from "@/feature/History/types/daySection";
import { useHistoryListState } from "@/feature/History/hooks/useHistoryListState";
import { FREE_WINDOW_DAYS } from "@/services/meals/mealService";
import type { RootStackParamList } from "@/navigation/navigate";

function getMealKcal(meal: Meal): number {
  if (typeof meal.totals?.kcal === "number") {
    return Math.round(meal.totals.kcal);
  }

  return Math.round(
    (meal.ingredients || []).reduce(
      (sum, ingredient) => sum + (Number(ingredient?.kcal) || 0),
      0,
    ),
  );
}

function getMealMacroValue(
  meal: Meal,
  key: "protein" | "carbs" | "fat",
): number {
  if (typeof meal.totals?.[key] === "number") {
    return Math.round(meal.totals[key] || 0);
  }

  return Math.round(
    (meal.ingredients || []).reduce(
      (sum, ingredient) => sum + (Number(ingredient?.[key]) || 0),
      0,
    ),
  );
}

function formatMealTime(
  value: string | null | undefined,
  locale?: string,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(locale || undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

type HistoryMealRowProps = {
  meal: Meal;
  index: number;
  locale?: string;
  kcalLabel: string;
  gramLabel: string;
  fallbackMealName: string;
  onPress: (meal: Meal) => void;
  mealTypeLabel: (meal: Meal) => string;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  theme: ReturnType<typeof useTheme>;
};

const HistoryMealRowComponent = ({
  meal,
  index,
  locale,
  kcalLabel,
  gramLabel,
  fallbackMealName,
  onPress,
  mealTypeLabel,
  macroLabels,
  theme,
}: HistoryMealRowProps) => {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const typeLabel = mealTypeLabel(meal);
  const timeLabel =
    formatMealTime(
      meal.timestamp || meal.updatedAt || meal.createdAt,
      locale,
    ) || null;
  const meta = timeLabel ? `${typeLabel} · ${timeLabel}` : typeLabel;
  const kcal = getMealKcal(meal);
  const protein = getMealMacroValue(meal, "protein");
  const carbs = getMealMacroValue(meal, "carbs");
  const fat = getMealMacroValue(meal, "fat");
  const hasMacroDetails = protein + carbs + fat > 0;

  return (
    <Pressable
      testID={`history-meal-row-${index}`}
      onPress={() => onPress(meal)}
      accessibilityRole="button"
      accessibilityLabel={`${meal.name || fallbackMealName}, ${meta}, ${kcal} ${kcalLabel}`}
      style={({ pressed }) => [
        styles.mealRow,
        pressed ? styles.mealRowPressed : null,
      ]}
    >
      <View style={styles.mealGlyph}>
        <AppIcon name="empty-meals" size={22} color={theme.primaryStrong} />
      </View>
      <View style={styles.mealInfo}>
        <View style={styles.mealTitleRow}>
          <Text numberOfLines={1} style={styles.mealName}>
            {meal.name || fallbackMealName}
          </Text>
          <SyncStatusIndicator
            syncState={meal.syncState}
            testID={`history-meal-sync-${meal.syncState}-${index}`}
          />
        </View>
        <Text numberOfLines={1} style={styles.mealMeta}>
          {meta}
        </Text>
        {hasMacroDetails ? (
          <View style={styles.macroRow}>
            <View style={[styles.macroChip, styles.macroChipProtein]}>
              <Text style={[styles.macroChipText, styles.macroChipProteinText]}>
                {macroLabels.protein} {protein}
                {gramLabel}
              </Text>
            </View>
            <View style={[styles.macroChip, styles.macroChipCarbs]}>
              <Text style={[styles.macroChipText, styles.macroChipCarbsText]}>
                {macroLabels.carbs} {carbs}
                {gramLabel}
              </Text>
            </View>
            <View style={[styles.macroChip, styles.macroChipFat]}>
              <Text style={[styles.macroChipText, styles.macroChipFatText]}>
                {macroLabels.fat} {fat}
                {gramLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.mealKcalBlock}>
        <Text numberOfLines={1} style={styles.mealKcalValue}>
          {kcal}
        </Text>
        <Text numberOfLines={1} style={styles.mealKcalLabel}>
          {kcalLabel}
        </Text>
      </View>
    </Pressable>
  );
};

const HistoryMealRow = React.memo(HistoryMealRowComponent);
HistoryMealRow.displayName = "HistoryMealRow";

type HistorySectionCardProps = {
  section: DaySection;
  locale?: string;
  kcalLabel: string;
  gramLabel: string;
  fallbackMealName: string;
  onMealPress: (meal: Meal) => void;
  mealTypeLabel: (meal: Meal) => string;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  theme: ReturnType<typeof useTheme>;
};

const HistorySectionCardComponent = ({
  section,
  locale,
  kcalLabel,
  gramLabel,
  fallbackMealName,
  onMealPress,
  mealTypeLabel,
  macroLabels,
  theme,
}: HistorySectionCardProps) => {
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.totalPill}>
          <Text style={styles.totalPillLabel}>
            {section.totalKcal} {kcalLabel}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        {section.data.map((meal, index) => (
          <HistoryMealRow
            key={meal.cloudId || meal.mealId}
            meal={meal}
            index={index}
            locale={locale}
            kcalLabel={kcalLabel}
            gramLabel={gramLabel}
            fallbackMealName={fallbackMealName}
            onPress={onMealPress}
            mealTypeLabel={mealTypeLabel}
            macroLabels={macroLabels}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
};

const HistorySectionCard = React.memo(HistorySectionCardComponent);
HistorySectionCard.displayName = "HistorySectionCard";

type DeadLetterBannerProps = {
  title: string;
  description: string;
  actionLabel: string;
  retrying: boolean;
  onRetry: () => void;
  theme: ReturnType<typeof useTheme>;
};

const DeadLetterBannerComponent = ({
  title,
  description,
  actionLabel,
  retrying,
  onRetry,
  theme,
}: DeadLetterBannerProps) => {
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.deadLetterBanner}>
      <View style={styles.deadLetterCopy}>
        <View style={styles.deadLetterDot} />
        <Text style={styles.deadLetterTitle}>{title}</Text>
      </View>
      <View style={styles.deadLetterActions}>
        <Text style={styles.deadLetterDescription}>{description}</Text>
        <Pressable
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.deadLetterRetry,
            retrying ? styles.deadLetterRetryDisabled : null,
            pressed && !retrying ? styles.deadLetterRetryPressed : null,
          ]}
        >
          <Text style={styles.deadLetterRetryLabel}>
            {retrying ? "…" : actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const DeadLetterBanner = React.memo(DeadLetterBannerComponent);
DeadLetterBanner.displayName = "DeadLetterBanner";

export default function HistoryListScreen({
  navigation,
}: {
  navigation: StackNavigationProp<RootStackParamList, "HistoryList">;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const { t, i18n } = useTranslation(["history", "meals", "home", "common"]);
  const state = useHistoryListState({ navigation });
  const sections = useMemo(() => state.sections ?? [], [state.sections]);
  const query = state.query ?? "";

  const totalResults = useMemo(
    () =>
      sections.reduce((sum, section) => {
        return sum + section.data.length;
      }, 0),
    [sections],
  );

  const showResultsPill = query.trim().length > 0 && totalResults > 0;
  const showListHeader =
    state.dataState === "ready" ||
    query.trim().length > 0 ||
    state.filterCount > 0 ||
    !!state.deadLetterBanner;

  const mealTypeLabel = useCallback(
    (meal: Meal) =>
      t(meal.type || "other", {
        ns: "meals",
        defaultValue: t("meal", { ns: "home" }),
      }),
    [t],
  );

  const renderSection = useCallback(
    ({ item }: { item: DaySection }) => (
      <HistorySectionCard
        section={item}
        locale={i18n?.language}
        kcalLabel={state.kcalLabel}
        gramLabel={t("gram", { ns: "common" })}
        fallbackMealName={t("meal", { ns: "home" })}
        onMealPress={state.onMealPress}
        mealTypeLabel={mealTypeLabel}
        macroLabels={{
          protein: t("macroShort.protein", { ns: "history" }),
          carbs: t("macroShort.carbs", { ns: "history" }),
          fat: t("macroShort.fat", { ns: "history" }),
        }}
        theme={theme}
      />
    ),
    [
      i18n?.language,
      mealTypeLabel,
      state.kcalLabel,
      state.onMealPress,
      t,
      theme,
    ],
  );

  const keyExtractor = useCallback((item: DaySection) => item.dateKey, []);

  const listHeader = showListHeader ? (
    <View style={styles.listHeader}>
      {state.deadLetterBanner ? (
        <DeadLetterBanner
          title={state.deadLetterBanner.title}
          description={state.deadLetterBanner.description}
          actionLabel={state.deadLetterBanner.actionLabel}
          retrying={state.retryingFailedSync}
          onRetry={state.retryFailedSyncOps}
          theme={theme}
        />
      ) : null}

      <View style={styles.heroPanel}>
        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>
            {t("screenTitle", { ns: "history" })}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t("screenSubtitle", { ns: "history" })}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <SearchBox
            value={query}
            onChange={state.setQuery}
            placeholder={t("searchPlaceholder", {
              ns: "history",
            })}
            style={styles.searchBox}
            fieldStyle={styles.searchField}
            inputStyle={styles.searchInput}
            iconSize={18}
          />
          <FilterBadgeButton
            activeCount={state.filterCount}
            onPress={state.toggleShowFilters}
          />
        </View>
      </View>

      {showResultsPill ? (
        <View style={styles.resultsPill}>
          <Text style={styles.resultsPillLabel}>
            {t("resultsCount", {
              ns: "history",
              count: totalResults,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  ) : null;

  const emptyComponent =
    state.dataState !== "loading" && state.dataState !== "ready" ? (
      <View style={styles.emptyWrap}>
        <EmptyState
          testID="history-list-empty-state"
          actionTestID="history-list-empty-add-meal-button"
          eyebrow={
            query.trim().length === 0 && state.dataState === "empty"
              ? t("emptyEyebrow", {
                  ns: "history",
                })
              : undefined
          }
          title={state.emptyState?.title || ""}
          description={state.emptyState?.description || ""}
          actionLabel={
            state.dataState === "empty" && query.trim().length === 0
              ? t("emptyAction", {
                  ns: "history",
                })
              : undefined
          }
          onAction={
            state.dataState === "empty" && query.trim().length === 0
              ? state.onLogFirstMeal
              : undefined
          }
        />
      </View>
    ) : null;

  if (state.dataState === "loading") {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator
          testID="history-list-loading"
          size="large"
          color={theme.primary}
        />
      </View>
    );
  }

  return (
    <Layout disableScroll showOfflineBanner={false}>
      {state.showFilters ? (
        <View style={styles.fullHeight} testID="history-filter-panel">
          <FilterPanel
            scope="history"
            isPremium={state.isPremium}
            windowDays={FREE_WINDOW_DAYS}
            onUpgrade={state.onUpgrade}
          />
        </View>
      ) : (
        <FlatList
          testID="history-list-screen"
          data={state.dataState === "ready" ? sections : []}
          keyExtractor={keyExtractor}
          renderItem={renderSection}
          keyboardDismissMode={keyboardDismissMode}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={state.loading}
              onRefresh={state.refresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.surface}
            />
          }
          onEndReached={state.onEndReached}
          onEndReachedThreshold={0.2}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          ListFooterComponent={
            state.loadingMore ? <LoadingSkeleton height={88} /> : null
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={60}
          scrollEventThrottle={16}
        />
      )}
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    loadingState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    fullHeight: {
      flex: 1,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.sectionGapLarge,
    },
    listHeader: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    heroBlock: {
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
    },
    heroTitle: {
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    heroSubtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    heroPanel: {
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      ...theme.depth.floating,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      overflow: "visible",
    },
    searchBox: {
      flex: 1,
    },
    searchField: {
      minHeight: 48,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surface,
      paddingVertical: 0,
      borderColor: theme.borderSoft,
    },
    searchInput: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      marginVertical: 6,
    },
    resultsPill: {
      alignSelf: "center",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs - 2,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    resultsPillLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    sectionBlock: {
      marginBottom: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.labelL,
      lineHeight: theme.typography.lineHeight.labelL,
      fontFamily: theme.typography.fontFamily.medium,
    },
    totalPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
    },
    totalPillLabel: {
      color: theme.success.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    sectionCard: {
      gap: theme.spacing.sm,
    },
    mealRow: {
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      padding: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      minHeight: 86,
      ...theme.depth.floating,
    },
    mealRowPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.995 }],
    },
    mealGlyph: {
      width: 42,
      height: 42,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.isDark
        ? "rgba(122, 153, 115, 0.20)"
        : theme.success.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    mealInfo: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    mealTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    mealName: {
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    mealMeta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    macroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      flexWrap: "wrap",
    },
    macroChip: {
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
    },
    macroChipProtein: {
      backgroundColor: theme.chart.proteinSoft,
    },
    macroChipCarbs: {
      backgroundColor: theme.chart.carbsSoft,
    },
    macroChipFat: {
      backgroundColor: theme.chart.fatSoft,
    },
    macroChipText: {
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    macroChipProteinText: {
      color: theme.chart.protein,
    },
    macroChipCarbsText: {
      color: theme.chart.carbs,
    },
    macroChipFatText: {
      color: theme.chart.fat,
    },
    mealKcalBlock: {
      minWidth: 58,
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 1,
    },
    mealKcalValue: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.bold,
      textAlign: "right",
    },
    mealKcalLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "right",
      flexShrink: 0,
    },
    rowDivider: {
      marginHorizontal: theme.spacing.md,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: "center",
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    deadLetterDescription: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    deadLetterRetry: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs + 1,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.warning.surface,
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
  });
