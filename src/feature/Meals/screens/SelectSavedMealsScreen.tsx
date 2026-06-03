import { useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTheme } from "@/theme/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import type { Meal } from "@/types/meal";
import { EmptyState } from "../components/EmptyState";
import {
  Button,
  FullScreenLoader,
  Layout,
  TextInput,
} from "@/components";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useTranslation } from "react-i18next";
import { useSelectSavedMealsState } from "@/feature/Meals/hooks/useSelectSavedMealsState";
import { syncMyMeals } from "@/services/meals/myMealService";
import AppIcon from "@/components/AppIcon";
import { SavedMealActionCard } from "@/feature/Meals/components/SavedMealActionCard";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";

const FOCUS_REFRESH_THROTTLE_MS = 30_000;

export default function SelectSavedMealScreen({
  navigation,
  flow,
}: {
  navigation: MealAddScreenProps<"SelectSavedMeal">["navigation"];
  flow: MealAddScreenProps<"SelectSavedMeal">["flow"];
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const { uid } = useAuthContext();
  const { setMeal, saveDraft, setLastScreen } = useMealDraftContext();
  const { t } = useTranslation(["meals", "common"]);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;

  const {
    step,
    queryText,
    setQueryText,
    loading,
    refreshing,
    pageItems,
    refresh,
    handleAddMeal,
    handleStartOver,
    keyExtractor,
    onViewableItemsChanged,
    viewabilityConfig,
  } = useSelectSavedMealsState({
    uid,
    syncSavedMeals: () => syncMyMeals(uid),
    setMeal,
    saveDraft,
    setLastScreen,
    onNavigateReview: () =>
      flow.goTo("ReviewMeal", {}),
    onStartOver: () =>
      navigation.navigate("MealAddMethod", {
        selectionMode: "temporary",
        origin: "mealAddFlow",
      }),
  });
  const firstFocusRef = useRef(true);
  const lastFocusRefreshAtRef = useRef(0);

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

  const renderItem = useCallback(
    ({ item }: { item: Meal }) => {
      return (
        <View style={styles.listItemWrap}>
          <SavedMealActionCard meal={item} onAdd={handleAddMeal} />
        </View>
      );
    },
    [handleAddMeal, styles],
  );

  const renderFooter = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        onPress={handleStartOver}
        style={styles.footerLink}
        accessibilityLabel={t("meals:change_method", "Change add method")}
      >
        <Text style={styles.footerLinkLabel}>
          {t("meals:change_method", "Change add method")}
        </Text>
      </Pressable>
    ),
    [handleStartOver, styles, t],
  );

  const header = (
    <View style={styles.header} testID="select-saved-meal-header">
      <Text style={styles.eyebrow}>
        {t("saved_list_eyebrow", "Saved meals")}
      </Text>
      <Text style={styles.title}>
        {t("saved_list_title", "Reuse a saved meal")}
      </Text>
      <Text style={styles.subtitle}>
        {t(
          "saved_list_subtitle",
          "Pick a saved meal, review it, and log it when you're ready.",
        )}
      </Text>
    </View>
  );

  const handleExit = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  }, [navigation]);

  const flowHeader = (
    <AddMealFlowHeader
      progress={flow.progress}
      onBack={flow.goBackOrExit ?? handleExit}
      onClose={handleExit}
      testID="select-saved-meal-flow-header"
      backTestID="select-saved-meal-back"
      closeTestID="select-saved-meal-close"
    />
  );

  if (loading) {
    return (
      <Layout disableScroll showNavigation={false} style={styles.layout}>
        {flowHeader}
        <View testID="select-saved-meal-loading-state" style={styles.screen}>
          <FullScreenLoader />
        </View>
      </Layout>
    );
  }

  if (!pageItems.length) {
    const isOfflineEmpty = !isOnline && !queryText.trim();
    return (
      <Layout disableScroll showNavigation={false} style={styles.layout}>
        {flowHeader}

        <View style={styles.screen} testID="select-saved-meal-screen">
          {header}

          <View style={styles.searchWrap}>
            <TextInput
              testID="select-saved-meal-search-input"
              value={queryText}
              onChangeText={setQueryText}
              placeholder={t(
                "saved_list_search_placeholder",
                "Search saved meals",
              )}
              autoCorrect={false}
              spellCheck={false}
              style={styles.searchInput}
              fieldStyle={styles.searchField}
              inputStyle={styles.searchText}
            />
          </View>

          <View style={styles.emptyContent} testID="select-saved-meal-empty-state">
            {!queryText.trim() ? (
              <>
                <View style={styles.emptyIconTile}>
                  <AppIcon
                    name="saved-items"
                    size={26}
                    color={theme.accentWarmStrong}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {t("saved_list_empty_title", "No saved meals yet")}
                </Text>
                <Text style={styles.emptyDescription}>
                  {isOfflineEmpty
                    ? t("savedMeals.offlineEmpty", { ns: "meals" })
                    : t(
                        "saved_list_empty_description",
                        "Save a meal after review to reuse it here.",
                      )}
                </Text>
                <Button
                  testID="select-saved-meal-empty-change-method-button"
                  label={t("saved_list_empty_cta", "Choose another method")}
                  variant="secondary"
                  onPress={handleStartOver}
                  style={styles.emptyPrimaryAction}
                  textStyle={styles.emptyPrimaryActionLabel}
                />
              </>
            ) : (
              <EmptyState
                title={t("meals:noMealsFound", "No meals found")}
                description={t(
                  "meals:tryDifferentSearch",
                  "Try a different search.",
                )}
              />
            )}
          </View>
        </View>
      </Layout>
    );
  }

  return (
    <Layout disableScroll showNavigation={false} style={styles.layout}>
      {flowHeader}

      <View style={styles.screen} testID="select-saved-meal-screen">
        {header}

        <View style={styles.searchWrap}>
          <TextInput
            testID="select-saved-meal-search-input"
            value={queryText}
            onChangeText={setQueryText}
            placeholder={t(
              "saved_list_search_placeholder",
              "Search saved meals",
            )}
            autoCorrect={false}
            spellCheck={false}
            style={styles.searchInput}
            fieldStyle={styles.searchField}
            inputStyle={styles.searchText}
          />
        </View>
        <FlatList
          testID="select-saved-meal-list"
          style={styles.list}
          data={pageItems}
          keyExtractor={keyExtractor}
          keyboardDismissMode={keyboardDismissMode}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={step}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter}
        />
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: 20,
      paddingRight: 20,
    },
    screen: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      paddingTop: theme.spacing.xs,
      paddingRight: theme.spacing.display,
      paddingBottom: theme.spacing.lg,
    },
    eyebrow: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      marginBottom: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    listItemWrap: {
      marginBottom: 12,
    },
    searchWrap: {
      paddingBottom: theme.spacing.md,
    },
    searchInput: {
      width: "100%",
    },
    searchField: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderSoft,
      paddingHorizontal: 16,
      ...theme.depth.raised,
    },
    searchText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      color: theme.text,
    },
    list: {
      flex: 1,
      minHeight: 0,
    },
    listContent: {
      paddingBottom: theme.spacing.lg,
    },
    emptyContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 48,
    },
    emptyIconTile: {
      width: 72,
      height: 72,
      borderRadius: theme.rounded.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundSecondary,
      marginBottom: 16,
    },
    emptyTitle: {
      color: theme.text,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      marginBottom: 16,
    },
    emptyDescription: {
      maxWidth: 290,
      color: theme.textTertiary,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      marginBottom: 24,
    },
    emptyPrimaryAction: {
      minHeight: 42,
      borderRadius: 12,
      borderColor: "rgba(207, 197, 184, 0.45)",
    },
    emptyPrimaryActionLabel: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: 20,
    },
    footerLink: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      marginTop: theme.spacing.xs,
    },
    footerLinkLabel: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
  });
