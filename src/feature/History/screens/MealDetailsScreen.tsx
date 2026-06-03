import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BackTitleHeader,
  Button,
  Layout,
  Modal,
} from "@/components";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { FallbackImage } from "../components/FallbackImage";
import AppIcon from "@/components/AppIcon";
import { useMealDetailsScreenState } from "@/feature/History/hooks/useMealDetailsScreenState";
import { isE2EModeEnabled } from "@/services/e2e/config";

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
}

function buildMealMeta(params: {
  value?: string | null;
  mealTypeLabel: string;
  locale?: string;
  todayLabel: string;
}): string {
  const { value, mealTypeLabel, locale, todayLabel } = params;
  if (!value) return mealTypeLabel;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return mealTypeLabel;
  }

  const dayLabel = isSameDay(parsed, new Date())
    ? todayLabel
    : new Intl.DateTimeFormat(locale || undefined, {
        month: "short",
        day: "numeric",
      }).format(parsed);
  const timeLabel = new Intl.DateTimeFormat(locale || undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);

  return `${mealTypeLabel} · ${dayLabel}, ${timeLabel}`;
}

function formatIngredientAmount(
  amount: number,
  unit: string | undefined,
  gramLabel: string,
): string {
  const resolvedUnit =
    typeof unit === "string" && unit.trim() ? unit.trim() : "g";
  const displayUnit = resolvedUnit === "g" ? gramLabel : resolvedUnit;
  if (!Number.isFinite(amount)) return `0 ${displayUnit}`;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return `${value} ${displayUnit}`;
}

function formatMacro(value: number, unit: string): string {
  return `${value} ${unit}`;
}

export default function MealDetailsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation(["meals", "common", "home", "history"]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;
  const insets = useSafeAreaInsets();
  const state = useMealDetailsScreenState();

  const contentInsetsStyle = useMemo(
    () => ({
      paddingTop: insets.top + theme.spacing.lg,
      paddingLeft: insets.left + theme.spacing.screenPadding,
      paddingRight: insets.right + theme.spacing.screenPadding,
      paddingBottom: theme.spacing.sectionGapLarge,
    }),
    [
      insets.left,
      insets.right,
      insets.top,
      theme.spacing.lg,
      theme.spacing.screenPadding,
      theme.spacing.sectionGapLarge,
    ],
  );
  const horizontalInsetsStyle = useMemo(
    () => ({
      paddingLeft: insets.left + theme.spacing.screenPaddingWide,
      paddingRight: insets.right + theme.spacing.screenPaddingWide,
    }),
    [
      insets.left,
      insets.right,
      theme.spacing.screenPaddingWide,
    ],
  );
  const stickyHeaderInsetsStyle = useMemo(
    () => ({
      paddingLeft: insets.left + theme.spacing.screenPaddingWide,
      paddingRight: insets.right + theme.spacing.screenPaddingWide,
    }),
    [
      insets.left,
      insets.right,
      theme.spacing.screenPaddingWide,
    ],
  );
  const stickyActionsInsetsStyle = useMemo(
    () => ({
      paddingLeft: insets.left + theme.spacing.screenPaddingWide,
      paddingRight: insets.right + theme.spacing.screenPaddingWide,
      paddingBottom: insets.bottom + theme.spacing.sm,
    }),
    [
      insets.bottom,
      insets.left,
      insets.right,
      theme.spacing.screenPaddingWide,
      theme.spacing.sm,
    ],
  );

  const mealTypeLabel = state.draft
    ? t(state.draft.type || "other", {
        ns: "meals",
        defaultValue: t("meal", { ns: "home" }),
      })
    : t("meal", { ns: "home" });

  const mealMeta = buildMealMeta({
    value: state.draft?.timestamp || state.draft?.createdAt,
    mealTypeLabel,
    locale: i18n?.language,
    todayLabel: t("common:today"),
  });

  if (!state.draft || !state.nutrition) {
    return (
      <Layout showNavigation={false} style={styles.layout}>
        <BackTitleHeader
          title={t("screenTitle", { ns: "history" })}
          onBack={state.handleBack}
          titleSize="h2"
        />
        <View
          style={[styles.emptyWrap, contentInsetsStyle]}
          testID="history-meal-details-empty-state"
        >
          <Text style={styles.emptyTitle}>
            {t("detailsUnavailable.title", { ns: "meals" })}
          </Text>
          <Text style={styles.emptyDescription}>
            {isOnline
              ? t("detailsUnavailable.desc", { ns: "meals" })
              : t("detailsUnavailable.offlineDesc", { ns: "meals" })}
          </Text>
          <Button
            testID="history-meal-details-empty-retry-button"
            label={t("retry", { ns: "common" })}
            onPress={() => {
              void state.reloadFromLocal();
            }}
            style={styles.emptyAction}
          />
        </View>
      </Layout>
    );
  }

  const ingredientCount = state.draft.ingredients.length;
  const canUseE2EPhotoFallback =
    isE2EModeEnabled() && state.draft.inputMethod === "photo";
  const canShareMeal = Boolean(
    (state.effectivePhotoUri || canUseE2EPhotoFallback) &&
      (state.draft.cloudId || state.draft.mealId),
  );
  const macroGramLabel = t("gram", { ns: "common" });

  return (
    <Layout
      showNavigation={false}
      disableScroll
      keyboardAvoiding={false}
      style={styles.layout}
    >
      <>
        <View style={styles.screen}>
          <View
            style={[styles.stickyHeader, stickyHeaderInsetsStyle]}
            testID="history-meal-details-sticky-header"
          >
            <Pressable
              testID="history-meal-details-back-button"
              accessibilityRole="button"
              accessibilityLabel={t("back", { ns: "common" })}
              hitSlop={8}
              onPress={state.handleBack}
              style={({ pressed }) => [
                styles.headerBackButton,
                pressed ? styles.headerBackButtonPressed : null,
              ]}
            >
              <AppIcon name="arrow" size={20} color={theme.text} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t("screenTitle", { ns: "history" })}
            </Text>
          </View>

          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={[
              styles.content,
              styles.scrollContent,
              horizontalInsetsStyle,
            ]}
            showsVerticalScrollIndicator={false}
            testID="history-meal-details-screen"
          >
            {state.showImageBlock || canUseE2EPhotoFallback ? (
              <View style={styles.imageSection}>
                <View style={styles.imageWrap}>
                  {state.checkingImage ? (
                    <View style={styles.imageLoaderWrap}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  ) : state.effectivePhotoUri || canUseE2EPhotoFallback ? (
                    <>
                      <FallbackImage
                        uri={
                          state.effectivePhotoUri ||
                          "https://example.com/fitaly-e2e-photo-meal.jpg"
                        }
                        width={"100%"}
                        height={164}
                        borderRadius={theme.rounded.xl}
                        onError={state.onImageError}
                      />
                      {canShareMeal ? (
                        <Pressable
                          testID="history-meal-share-button"
                          onPress={state.goShare}
                          accessibilityRole="button"
                          accessibilityLabel={t("share", { ns: "common" })}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.fab,
                            pressed ? styles.fabPressed : null,
                          ]}
                        >
                          <AppIcon
                            name="share"
                            size={18}
                            color={theme.surface}
                          />
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.identityCard}>
              <View style={styles.identityIconWrap}>
                <AppIcon name="edit" size={22} color={theme.primaryStrong} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityOverline}>
                  {t("detailsRecordOverline", { ns: "history" })}
                </Text>
                <View style={styles.identityTitleRow}>
                  <Text
                    testID="history-meal-details-title"
                    style={styles.identityTitle}
                    numberOfLines={2}
                  >
                    {state.draft.name || mealTypeLabel}
                  </Text>
                  <SyncStatusIndicator
                    syncState={state.draft.syncState}
                    testID={`history-meal-details-sync-${state.draft.syncState}`}
                  />
                </View>
                <Text style={styles.identityMeta} numberOfLines={1}>
                  {mealMeta}
                </Text>
              </View>
            </View>

            <View style={styles.nutritionCard}>
              <View
                style={styles.kcalHero}
                accessible
                accessibilityLabel={`${t("calories", {
                  ns: "meals",
                })}: ${state.nutrition.kcal} ${t("kcal", { ns: "common" })}`}
              >
                <View style={styles.kcalIconWrap}>
                  <AppIcon
                    name="macro-calories-flame"
                    size={22}
                    color={theme.macro.calories}
                  />
                </View>
                <View style={styles.kcalCopy}>
                  <Text style={styles.kcalLabel}>
                    {t("calories", { ns: "meals" })}
                  </Text>
                  <Text
                    testID="history-meal-details-kcal"
                    style={styles.kcalValue}
                  >
                    {state.nutrition.kcal} {t("kcal", { ns: "common" })}
                  </Text>
                </View>
              </View>

              <View style={styles.macroStats}>
                <View
                  style={[styles.macroStat, styles.proteinStat]}
                  accessible
                  accessibilityLabel={`${t("protein", {
                    ns: "common",
                  })}: ${formatMacro(state.nutrition.protein, macroGramLabel)}`}
                >
                  <View style={[styles.macroIconWrap, styles.proteinIconWrap]}>
                    <AppIcon
                      name="macro-protein-drumstick"
                      size={16}
                      color={theme.macro.protein}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel} numberOfLines={2}>
                      {t("protein", { ns: "common" })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {formatMacro(state.nutrition.protein, macroGramLabel)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.macroStat, styles.carbsStat]}
                  accessible
                  accessibilityLabel={`${t("carbs", {
                    ns: "common",
                  })}: ${formatMacro(state.nutrition.carbs, macroGramLabel)}`}
                >
                  <View style={[styles.macroIconWrap, styles.carbsIconWrap]}>
                    <AppIcon
                      name="macro-carbs-grain"
                      size={20}
                      color={theme.macro.carbs}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel} numberOfLines={2}>
                      {t("carbs_compact", {
                        ns: "meals",
                        defaultValue: t("carbs", { ns: "common" }),
                      })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {formatMacro(state.nutrition.carbs, macroGramLabel)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.macroStat, styles.fatStat]}
                  accessible
                  accessibilityLabel={`${t("fat", {
                    ns: "common",
                  })}: ${formatMacro(state.nutrition.fat, macroGramLabel)}`}
                >
                  <View style={[styles.macroIconWrap, styles.fatIconWrap]}>
                    <AppIcon
                      name="macro-fat-drop"
                      size={20}
                      color={theme.macro.fat}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel} numberOfLines={2}>
                      {t("fat", { ns: "common" })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {formatMacro(state.nutrition.fat, macroGramLabel)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View
              style={styles.ingredientsCard}
              testID="history-meal-ingredients-list"
            >
              <View style={styles.ingredientsHeader}>
                <Text style={styles.ingredientsTitle} numberOfLines={1}>
                  {`${t("detailsIngredientsTitle", {
                    ns: "history",
                  })} (${ingredientCount})`}
                </Text>
                <Pressable
                  testID="history-meal-ingredients-edit-button"
                  accessibilityRole="button"
                  accessibilityLabel={t("edit_ingredients", {
                    ns: "meals",
                    defaultValue: "Edit ingredients",
                  })}
                  onPress={() => {
                    void state.startEdit();
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.itemsEditAction,
                    pressed ? styles.itemPressed : null,
                  ]}
                >
                  <Text style={styles.itemsEditText} numberOfLines={1}>
                    {t("edit_ingredients", {
                      ns: "meals",
                      defaultValue: "Edit ingredients",
                    })}
                  </Text>
                  <AppIcon
                    name="chevron"
                    rotation="180deg"
                    size={14}
                    color={theme.primary}
                  />
                </Pressable>
              </View>

              {ingredientCount > 0 ? (
                state.draft.ingredients.map((ingredient, idx) => (
                  <View
                    key={ingredient.id || String(idx)}
                    style={styles.itemRowWrap}
                  >
                    <View
                      style={styles.ingredientRow}
                      testID={`history-meal-ingredient-row-${idx}`}
                    >
                      <Text numberOfLines={1} style={styles.ingredientName}>
                        {ingredient.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.ingredientAmount}>
                        {formatIngredientAmount(
                          Number(ingredient.amount) || 0,
                          ingredient.unit,
                          macroGramLabel,
                        )}
                      </Text>
                    </View>
                    {idx < ingredientCount - 1 ? (
                      <View style={styles.ingredientDivider} />
                    ) : null}
                  </View>
                ))
              ) : (
                <Text
                  style={styles.emptyIngredientsText}
                  testID="history-meal-empty-ingredients"
                >
                  {t("review_meal_edit_no_ingredients_title", {
                    ns: "meals",
                    defaultValue: "No ingredients yet",
                  })}
                </Text>
              )}
            </View>
          </ScrollView>

          <View
            style={[styles.stickyActions, stickyActionsInsetsStyle]}
            testID="history-meal-details-sticky-actions"
          >
            <Pressable
              testID="history-meal-edit-button"
              onPress={() => {
                void state.startEdit();
              }}
              accessibilityRole="button"
              accessibilityLabel={t("edit_meal", {
                ns: "meals",
              })}
              style={({ pressed }) => [
                styles.editAction,
                pressed ? styles.actionPressed : null,
              ]}
            >
              <View style={styles.actionIconWrap}>
                <AppIcon name="edit" size={18} color={theme.primary} />
              </View>
              <Text style={styles.editActionLabel}>
                {t("edit_meal", {
                  ns: "meals",
                })}
              </Text>
            </Pressable>

            <Pressable
              testID="history-meal-delete-button"
              onPress={state.openDeleteModal}
              accessibilityRole="button"
              accessibilityLabel={t("delete_meal", {
                ns: "history",
              })}
              style={({ pressed }) => [
                styles.deleteAction,
                pressed ? styles.actionPressed : null,
              ]}
            >
              <View style={styles.deleteIconWrap}>
                <AppIcon name="delete" size={18} color={theme.error.text} />
              </View>
              <Text style={styles.deleteActionLabel}>
                {t("delete_meal", {
                  ns: "history",
                })}
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          testID="history-meal-delete-modal"
          visible={state.showDeleteModal}
          title={t("deleteMealTitle", {
            ns: "history",
          })}
          message={t("deleteMealMessage", {
            ns: "history",
          })}
          primaryAction={{
            testID: "history-meal-delete-confirm-button",
            label: t("delete", {
              ns: "common",
            }),
            onPress: () => {
              void state.confirmDelete();
            },
            tone: "destructive",
            loading: state.deleting,
            disabled: state.deleting,
          }}
          secondaryAction={{
            testID: "history-meal-delete-cancel-button",
            label: t("cancel", {
              ns: "common",
            }),
            onPress: state.closeDeleteModal,
            tone: "secondary",
            disabled: state.deleting,
          }}
          onClose={state.closeDeleteModal}
          overlayStyle={styles.deleteModalOverlay}
          containerStyle={styles.deleteModalContainer}
          closeButtonContainerStyle={styles.deleteModalClose}
          closeButtonBackgroundColor={
            theme.isDark ? "rgba(242, 196, 187, 0.10)" : theme.surface
          }
          closeButtonIconColor={theme.textSecondary}
        />
      </>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: 0,
      paddingRight: 0,
      paddingBottom: 0,
      backgroundColor: "transparent",
    },
    screen: {
      flex: 1,
    },
    stickyHeader: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      zIndex: 2,
    },
    headerBackButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    headerBackButtonPressed: {
      opacity: 0.72,
    },
    headerTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.bold,
    },
    detailsScroll: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.md,
    },
    scrollContent: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    imageSection: {
      marginBottom: theme.spacing.xs,
    },
    imageWrap: {
      position: "relative",
      borderRadius: theme.rounded.xl,
      overflow: "hidden",
      backgroundColor: theme.backgroundSecondary,
    },
    imageLoaderWrap: {
      width: "100%",
      height: 164,
      borderRadius: theme.rounded.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundSecondary,
    },
    fab: {
      position: "absolute",
      right: theme.spacing.sm,
      bottom: theme.spacing.sm,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      backgroundColor: "rgba(30, 34, 30, 0.92)",
      borderColor: theme.surface,
    },
    fabPressed: {
      opacity: 0.84,
    },
    identityCard: {
      minHeight: 112,
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.62)",
      backgroundColor: theme.isDark
        ? "rgba(39, 45, 38, 0.94)"
        : "rgba(255, 253, 248, 0.92)",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      ...theme.depth.raised,
    },
    identityIconWrap: {
      width: 50,
      height: 50,
      borderRadius: theme.rounded.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.28)"
        : "rgba(94, 115, 80, 0.22)",
      backgroundColor: theme.isDark
        ? "rgba(94, 115, 80, 0.18)"
        : "rgba(231, 236, 226, 0.72)",
    },
    identityCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    identityTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    identityOverline: {
      color: theme.primary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    identityTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      fontFamily: theme.typography.fontFamily.bold,
    },
    identityMeta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    nutritionCard: {
      minHeight: 132,
      borderRadius: 20,
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.94)"
        : "rgba(255, 253, 248, 0.94)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.66)",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
      overflow: "hidden",
      ...theme.depth.raised,
    },
    kcalHero: {
      minHeight: 82,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(126, 160, 122, 0.48)"
        : "rgba(94, 115, 80, 0.52)",
      backgroundColor: theme.isDark
        ? "rgba(94, 115, 80, 0.18)"
        : "rgba(231, 236, 226, 0.78)",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.md,
    },
    kcalIconWrap: {
      width: 46,
      height: 46,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(126, 160, 122, 0.40)"
        : "rgba(94, 115, 80, 0.28)",
      backgroundColor: theme.macro.caloriesSoft,
    },
    kcalCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    kcalLabel: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    kcalValue: {
      color: theme.text,
      fontSize: theme.typography.size.numericXL,
      lineHeight: theme.typography.lineHeight.numericXL,
      fontFamily: theme.typography.fontFamily.bold,
    },
    macroStats: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.xs,
    },
    macroStat: {
      minHeight: 76,
      flex: 1,
      minWidth: 0,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: theme.spacing.xs - 2,
    },
    proteinStat: {
      borderColor: theme.isDark
        ? "rgba(74, 144, 226, 0.24)"
        : "rgba(74, 144, 226, 0.22)",
      backgroundColor: theme.isDark
        ? "rgba(74, 144, 226, 0.07)"
        : "rgba(220, 235, 251, 0.34)",
    },
    carbsStat: {
      borderColor: theme.isDark
        ? "rgba(102, 169, 107, 0.24)"
        : "rgba(102, 169, 107, 0.22)",
      backgroundColor: theme.isDark
        ? "rgba(102, 169, 107, 0.07)"
        : "rgba(228, 241, 226, 0.34)",
    },
    fatStat: {
      borderColor: theme.isDark
        ? "rgba(201, 162, 39, 0.26)"
        : "rgba(201, 162, 39, 0.24)",
      backgroundColor: theme.isDark
        ? "rgba(201, 162, 39, 0.07)"
        : "rgba(245, 235, 194, 0.34)",
    },
    macroIconWrap: {
      width: 32,
      height: 32,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    proteinIconWrap: {
      backgroundColor: theme.macro.proteinSoft,
    },
    carbsIconWrap: {
      backgroundColor: theme.macro.carbsSoft,
    },
    fatIconWrap: {
      backgroundColor: theme.macro.fatSoft,
    },
    macroStatCopy: {
      flex: 1,
      minWidth: 0,
      alignItems: "flex-start",
      justifyContent: "center",
      gap: 2,
    },
    macroStatLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "left",
    },
    macroStatValue: {
      color: theme.text,
      fontSize: theme.typography.size.numericS,
      lineHeight: theme.typography.lineHeight.numericM,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "left",
    },
    ingredientsCard: {
      borderRadius: 18,
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.92)"
        : "rgba(255, 253, 248, 0.92)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.66)",
      padding: theme.spacing.md,
      gap: 9,
      ...theme.depth.raised,
    },
    ingredientsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    ingredientsTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    itemsEditAction: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      flexShrink: 0,
    },
    itemsEditText: {
      color: theme.primary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "right",
    },
    itemRowWrap: {
      gap: theme.spacing.xs,
    },
    ingredientRow: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      borderRadius: theme.rounded.sm,
    },
    itemPressed: {
      opacity: 0.72,
    },
    ingredientName: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
    ingredientAmount: {
      color: theme.textSecondary,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "right",
    },
    ingredientDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginTop: theme.spacing.xs,
    },
    emptyIngredientsText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    stickyActions: {
      backgroundColor: theme.surfaceElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      borderTopLeftRadius: theme.rounded.md,
      borderTopRightRadius: theme.rounded.md,
      overflow: "hidden",
      paddingTop: theme.spacing.md,
      gap: theme.spacing.sm,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -8 },
      elevation: 10,
    },
    editAction: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.button.secondary.border,
      backgroundColor: theme.button.secondary.background,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    deleteAction: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.error.border,
      backgroundColor: theme.error.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    actionIconWrap: {
      width: 26,
      height: 26,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark
        ? "rgba(127, 160, 122, 0.12)"
        : "rgba(79, 104, 75, 0.08)",
    },
    deleteIconWrap: {
      width: 26,
      height: 26,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark
        ? "rgba(200, 93, 76, 0.13)"
        : "rgba(194, 78, 61, 0.08)",
    },
    actionPressed: {
      opacity: 0.82,
    },
    editActionLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    deleteActionLabel: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    deleteModalOverlay: {
      backgroundColor: theme.isDark
        ? "rgba(4, 6, 4, 0.66)"
        : "rgba(47, 49, 43, 0.46)",
    },
    deleteModalContainer: {
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.98)"
        : theme.surface,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.16)"
        : "rgba(207, 197, 184, 0.76)",
    },
    deleteModalClose: {
      borderRadius: theme.rounded.full,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    emptyDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
      maxWidth: 320,
    },
    emptyAction: {
      alignSelf: "stretch",
      marginTop: theme.spacing.sm,
    },
  });
