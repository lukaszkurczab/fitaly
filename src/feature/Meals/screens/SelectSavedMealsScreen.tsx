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
import type { StackNavigationProp } from "@react-navigation/stack";
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
  ScreenCornerNavButton,
  TextInput,
} from "@/components";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useTranslation } from "react-i18next";
import { useSelectSavedMealsState } from "@/feature/Meals/hooks/useSelectSavedMealsState";
import { syncMyMeals } from "@/services/meals/myMealService";
import type { RootStackParamList } from "@/navigation/navigate";
import AppIcon from "@/components/AppIcon";
import { SavedMealActionCard } from "@/feature/Meals/components/SavedMealActionCard";

type SelectSavedMealNavigation = StackNavigationProp<
  RootStackParamList,
  "SelectSavedMeal"
>;
const FOCUS_REFRESH_THROTTLE_MS = 30_000;

export default function SelectSavedMealScreen({
  navigation,
}: {
  navigation: SelectSavedMealNavigation;
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
      navigation.navigate("AddMeal", { start: "ReviewMeal" }),
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

  const handleExit = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  }, [navigation]);

  const closeButton = (
    <ScreenCornerNavButton
      icon="close"
      onPress={handleExit}
      accessibilityLabel={t("common:close", { defaultValue: "Close" })}
    />
  );

  if (loading) {
    return (
      <Layout disableScroll showNavigation={false}>
        <FullScreenLoader />
      </Layout>
    );
  }

  if (!pageItems.length) {
    const isOfflineEmpty = !isOnline && !queryText.trim();
    return (
      <Layout disableScroll showNavigation={false} style={styles.layout}>
        {closeButton}

        <View style={styles.screen}>
          <View style={styles.searchWrap}>
            <TextInput
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

          <View style={styles.emptyContent}>
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

          {renderFooter()}
        </View>
      </Layout>
    );
  }

  return (
    <Layout disableScroll showNavigation={false} style={styles.layout}>
      {closeButton}

      <View style={styles.screen}>
        <View style={styles.searchWrap}>
          <TextInput
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
        />
        {renderFooter()}
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
    listItemWrap: {
      marginBottom: 12,
    },
    searchWrap: {
      paddingTop: theme.spacing.xs,
      paddingBottom: 18,
      paddingRight: theme.spacing.display,
    },
    searchInput: {
      width: "100%",
    },
    searchField: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderColor: theme.borderSoft,
      paddingHorizontal: 16,
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
      paddingBottom: 12,
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
      minHeight: 32,
      marginTop: 2,
    },
    footerLinkLabel: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
  });
