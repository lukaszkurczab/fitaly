import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useFocusEffect } from "@react-navigation/native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import {
  FullScreenLoader,
  Layout,
  SearchBox,
} from "@/components";
import { MealListItem } from "@/components/MealListItem";
import { useAuthContext } from "@/context/AuthContext";
import { useFilters } from "@/context/HistoryContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { EmptyState } from "../components/EmptyState";
import { FilterBadgeButton } from "../components/FilterBadgeButton";
import { FilterPanel } from "../components/FilterPanel";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { useSavedMealsData } from "@/feature/History/hooks/useSavedMealsData";
import { useSavedMealDeadLetterRecovery } from "@/feature/History/hooks/useSavedMealDeadLetterRecovery";
import { syncMyMeals } from "@/services/meals/myMealService";
import type { RootStackParamList } from "@/navigation/navigate";
import { buildSavedMealDraft } from "@/feature/Meals/utils/buildSavedMealDraft";

type SavedMealsNavigation = StackNavigationProp<RootStackParamList, "SavedMeals">;
const FOCUS_REFRESH_THROTTLE_MS = 30_000;

type SavedMealsDeadLetterBannerProps = {
  title: string;
  description: string;
  actionLabel: string;
  secondaryActionLabel?: string;
  retrying: boolean;
  onRetry: () => void;
  onSecondaryAction?: () => void;
  theme: ReturnType<typeof useTheme>;
};

const SavedMealsDeadLetterBanner = ({
  title,
  description,
  actionLabel,
  secondaryActionLabel,
  retrying,
  onRetry,
  onSecondaryAction,
  theme,
}: SavedMealsDeadLetterBannerProps) => {
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      style={styles.deadLetterBanner}
      testID="saved-meals-dead-letter-banner"
    >
      <View style={styles.deadLetterCopy}>
        <View style={styles.deadLetterDot} />
        <Text style={styles.deadLetterTitle}>{title}</Text>
      </View>
      <View style={styles.deadLetterActions}>
        <Text
          style={styles.deadLetterDescription}
          testID="saved-meals-dead-letter-description"
        >
          {description}
        </Text>
        <View style={styles.deadLetterButtonRow}>
          {secondaryActionLabel && onSecondaryAction ? (
            <Pressable
              onPress={onSecondaryAction}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionLabel}
              testID="saved-meals-photo-upload-discard-button"
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
            onPress={onRetry}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            testID="saved-meals-dead-letter-retry"
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
};

export default function SavedMealsScreen({
  navigation,
}: {
  navigation: SavedMealsNavigation;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;
  const { uid } = useAuthContext();
  const { t } = useTranslation(["meals", "common"]);
  const {
    meal: draftMeal,
    setMeal,
    saveDraft,
    setLastScreen,
  } = useMealDraftContext();

  const {
    query,
    setQuery,
    filters,
    showFilters,
    toggleShowFilters,
    filterCount,
  } = useFilters("myMeals");

  const {
    pageSize,
    loadingMore,
    validating,
    refreshing,
    errorKind,
    dataState,
    visibleItems,
    refresh,
    onDelete,
    onViewableItemsChanged,
    viewabilityConfig,
  } = useSavedMealsData({
    uid,
    query,
    filters,
    isOnline,
    syncSavedMeals: () => syncMyMeals(uid),
  });
  const {
    diagnostics: savedMealDeadLetterDiagnostics,
    retrying: retryingSavedMealDeadLetters,
    retryDeadLetters: retrySavedMealDeadLetters,
    discardPhotoDeadLetters: discardSavedMealPhotoDeadLetters,
  } = useSavedMealDeadLetterRecovery(uid);
  const firstFocusRef = useRef(true);
  const lastFocusRefreshAtRef = useRef(0);

  const deadLetterBanner = useMemo(() => {
    if (savedMealDeadLetterDiagnostics.dead <= 0) return null;
    if (savedMealDeadLetterDiagnostics.hasFailedLocalPhotoUpload) {
      return {
        title: t("history.savedMealPhotoUploadRecoveryTitle", {
          ns: "meals",
          count: savedMealDeadLetterDiagnostics.dead,
        }),
        description: t("history.savedMealPhotoUploadRecoverySubtitle", {
          ns: "meals",
          pending: savedMealDeadLetterDiagnostics.pending,
        }),
        actionLabel: t("common:retry"),
        secondaryActionLabel: t("history.savedMealPhotoUploadDiscardAction", {
          ns: "meals",
        }),
      };
    }

    const lastFailedKind = savedMealDeadLetterDiagnostics.lastFailedKind
      ? t(
          `history.deadLetterOperation.${savedMealDeadLetterDiagnostics.lastFailedKind}`,
          { ns: "meals" },
        )
      : null;

    return {
      title: t("history.deadLetterTitle", {
        ns: "meals",
        count: savedMealDeadLetterDiagnostics.dead,
      }),
      description: lastFailedKind
        ? t("history.deadLetterSubtitleWithLast", {
            ns: "meals",
            pending: savedMealDeadLetterDiagnostics.pending,
            operation: lastFailedKind,
          })
        : t("history.deadLetterSubtitle", {
            ns: "meals",
            pending: savedMealDeadLetterDiagnostics.pending,
          }),
      actionLabel: t("common:retry"),
    };
  }, [savedMealDeadLetterDiagnostics, t]);

  const deadLetterBannerElement = deadLetterBanner ? (
    <SavedMealsDeadLetterBanner
      title={deadLetterBanner.title}
      description={deadLetterBanner.description}
      actionLabel={deadLetterBanner.actionLabel}
      secondaryActionLabel={deadLetterBanner.secondaryActionLabel}
      retrying={retryingSavedMealDeadLetters}
      onRetry={retrySavedMealDeadLetters}
      onSecondaryAction={
        deadLetterBanner.secondaryActionLabel
          ? discardSavedMealPhotoDeadLetters
          : undefined
      }
      theme={theme}
    />
  ) : null;

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }

      const now = Date.now();
      if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_THROTTLE_MS) {
        return;
      }

      lastFocusRefreshAtRef.current = now;
      void refresh();
    }, [refresh]),
  );

  const onDuplicate = useCallback(
    async (meal: Meal) => {
      if (!uid) return;
      const next = buildSavedMealDraft({
        picked: meal,
        uid,
        createdAt: draftMeal?.createdAt,
      });
      setMeal(next);
      await saveDraft(uid, next);
      await setLastScreen(uid, "ReviewMeal");
      navigation.navigate("AddMeal", { start: "ReviewMeal" });
    },
    [draftMeal?.createdAt, navigation, saveDraft, setLastScreen, setMeal, uid],
  );

  const onEdit = useCallback(
    async (meal: Meal) => {
      if (!uid) return;
      const next = buildSavedMealDraft({
        picked: meal,
        uid,
        createdAt: draftMeal?.createdAt,
      });
      setMeal(next);
      await saveDraft(uid, next);
      await setLastScreen(uid, "EditMealDetails");
      navigation.navigate("AddMeal", {
        start: "EditMealDetails",
        submitIntent: "replaceReview",
      });
    },
    [draftMeal?.createdAt, navigation, saveDraft, setLastScreen, setMeal, uid],
  );

  const keyExtractor = useCallback(
    (item: Meal) => item.cloudId || item.mealId,
    [],
  );

  const onOpenMeal = useCallback(
    (meal: Meal) => {
      if (!meal.cloudId) return;
      navigation.navigate("MealDetails", {
        cloudId: meal.cloudId,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Meal }) => (
      <View style={styles.listItemWrap}>
        <MealListItem
          meal={item}
          onPress={() => onOpenMeal(item)}
          onDuplicate={() => onDuplicate(item)}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      </View>
    ),
    [onDelete, onDuplicate, onEdit, onOpenMeal, styles],
  );

  if (dataState === "loading") {
    return (
      <Layout disableScroll>
        <FullScreenLoader />
      </Layout>
    );
  }

  if (dataState !== "ready") {
    const errorMessage =
      errorKind === "load"
        ? t("savedMeals.loadError", { ns: "meals" })
        : errorKind === "loadMore"
          ? t("savedMeals.loadMoreError", { ns: "meals" })
          : errorKind === "refresh"
            ? t("savedMeals.refreshError", { ns: "meals" })
            : t("common:unknownError");

    const emptyTitle =
      dataState === "error"
        ? t("savedMeals.errorTitle", { ns: "meals" })
        : t("meals:noSavedMeals", "No saved meals");
    const emptyDescription =
      dataState === "error"
        ? errorMessage
        : dataState === "offline-empty"
          ? t("savedMeals.offlineEmpty", { ns: "meals" })
          : query
            ? t("meals:tryDifferentSearch", "Try a different search.")
            : t("meals:saveMealsToReuse", "Save meals to reuse them later.");

    return (
      <Layout disableScroll>
        {showFilters ? (
          <View style={styles.filtersWrap}>
            {deadLetterBannerElement ? (
              <View style={styles.filterBannerWrap}>
                {deadLetterBannerElement}
              </View>
            ) : null}
            <FilterPanel scope="myMeals" />
          </View>
        ) : (
          <>
            <View style={styles.topBarWrap}>
              {deadLetterBannerElement}
              <SearchBox value={query} onChange={setQuery} />
            </View>
            <EmptyState title={emptyTitle} description={emptyDescription} />
          </>
        )}
      </Layout>
    );
  }

  return (
    <Layout disableScroll>
      {showFilters ? (
        <View style={styles.filtersWrap}>
          {deadLetterBannerElement ? (
            <View style={styles.filterBannerWrap}>
              {deadLetterBannerElement}
            </View>
          ) : null}
          <FilterPanel scope="myMeals" />
        </View>
      ) : (
        <View style={styles.topBarWrap}>
          {deadLetterBannerElement}
          <View style={styles.row}>
            <SearchBox value={query} onChange={setQuery} style={styles.searchBox} />
            <FilterBadgeButton
              activeCount={filterCount}
              onPress={toggleShowFilters}
            />
          </View>
        </View>
      )}
      {!showFilters && (
        <>
          {validating && (
            <View style={styles.validatingWrap}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          <FlatList
            data={visibleItems}
            keyExtractor={keyExtractor}
            keyboardDismissMode={keyboardDismissMode}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={viewabilityConfig}
            ListFooterComponent={
              loadingMore ? <LoadingSkeleton height={56} /> : null
            }
            removeClippedSubviews
            windowSize={7}
            initialNumToRender={pageSize}
          />
        </>
      )}
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    filtersWrap: { height: "100%", paddingBottom: theme.spacing.nav },
    filterBannerWrap: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    topBarWrap: { padding: theme.spacing.md, gap: theme.spacing.sm },
    row: { flexDirection: "row", gap: theme.spacing.sm },
    searchBox: { flex: 1 },
    validatingWrap: {
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    listContent: { paddingBottom: theme.spacing.lg },
    listItemWrap: { marginBottom: theme.spacing.sm },
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
    deadLetterButtonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    deadLetterSecondary: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs + 1,
      borderRadius: theme.rounded.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.warning.surface,
      backgroundColor: theme.surface,
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
    deadLetterSecondaryLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
