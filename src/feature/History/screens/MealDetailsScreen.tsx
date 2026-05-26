import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackTitleHeader, Button, Layout, Modal } from "@/components";
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

  const macroTotal =
    (state.nutrition?.protein || 0) +
    (state.nutrition?.carbs || 0) +
    (state.nutrition?.fat || 0);

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
    isE2EModeEnabled() && state.draft.name === "E2E Photo Meal";
  const canShareMeal = Boolean(
    (state.effectivePhotoUri || canUseE2EPhotoFallback) &&
      (state.draft.cloudId || state.draft.mealId),
  );

  return (
    <Layout showNavigation={false} style={styles.layout}>
      <>
        <View
          style={[styles.content, contentInsetsStyle]}
          testID="history-meal-details-screen"
        >
          <BackTitleHeader
            title={t("screenTitle", { ns: "history" })}
            onBack={state.handleBack}
            titleSize="h2"
            style={{ marginBottom: 0 }}
          />
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
                        <AppIcon name="share" size={18} color={theme.surface} />
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopy}>
                <Text
                  testID="history-meal-details-title"
                  style={styles.heroTitle}
                  numberOfLines={2}
                >
                  {state.draft.name || mealTypeLabel}
                </Text>
                <View style={styles.heroMetaRow}>
                  <Text style={styles.heroMeta}>{mealMeta}</Text>
                  <SyncStatusIndicator
                    syncState={state.draft.syncState}
                    testID={`history-meal-details-sync-${state.draft.syncState}`}
                  />
                </View>
              </View>

              <View style={styles.kcalBadge}>
                <Text testID="history-meal-details-kcal" style={styles.kcalValue}>
                  {state.nutrition.kcal}
                </Text>
                <Text style={styles.kcalUnit}>
                  {t("kcal", { ns: "common" })}
                </Text>
              </View>
            </View>

            <View style={styles.macroTrack}>
              <View
                style={[
                  styles.macroSegment,
                  styles.macroProtein,
                  { flex: macroTotal > 0 ? state.nutrition.protein || 0 : 1 },
                ]}
              />
              <View
                style={[
                  styles.macroSegment,
                  styles.macroCarbs,
                  { flex: macroTotal > 0 ? state.nutrition.carbs || 0 : 1 },
                ]}
              />
              <View
                style={[
                  styles.macroSegment,
                  styles.macroFat,
                  { flex: macroTotal > 0 ? state.nutrition.fat || 0 : 1 },
                ]}
              />
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroBlock}>
                <Text style={[styles.macroValue, styles.proteinValue]}>
                  {state.nutrition.protein}g
                </Text>
                <Text style={styles.macroLabel}>
                  {t("protein", { ns: "common" })}
                </Text>
              </View>
              <View style={[styles.macroBlock, styles.macroBlockCentered]}>
                <Text style={[styles.macroValue, styles.carbsValue]}>
                  {state.nutrition.carbs}g
                </Text>
                <Text style={styles.macroLabel}>
                  {t("carbs", { ns: "common" })}
                </Text>
              </View>
              <View style={[styles.macroBlock, styles.macroBlockRight]}>
                <Text style={[styles.macroValue, styles.fatValue]}>
                  {state.nutrition.fat}g
                </Text>
                <Text style={styles.macroLabel}>
                  {t("fat", { ns: "common" })}
                </Text>
              </View>
            </View>
          </View>

          {ingredientCount > 0 && (
            <View style={styles.ingredientsSection}>
              <View style={styles.ingredientsHeader}>
                <Text style={styles.ingredientsTitle}>
                  {t("detailsIngredientsTitle", {
                    ns: "history",
                  })}
                </Text>
                <View style={styles.itemsPill}>
                  <Text style={styles.itemsPillLabel}>
                    {t("detailsItemsCount", {
                      ns: "history",
                      count: state.draft.ingredients.length,
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.ingredientsCard} testID="history-meal-ingredients-list">
                {state.draft.ingredients.map((ingredient, idx) => (
                  <View key={ingredient.id || String(idx)}>
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
                          t("gram", { ns: "common" }),
                        )}
                      </Text>
                    </View>
                    {idx < ingredientCount - 1 ? (
                      <View style={styles.ingredientDivider} />
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.actionsWrap}>
            {canShareMeal && isE2EModeEnabled() ? (
              <Button
                testID="history-meal-share-button"
                variant="secondary"
                label={t("share", { ns: "common" })}
                onPress={state.goShare}
                style={styles.editButton}
              />
            ) : null}

            <Button
              testID="history-meal-edit-button"
              variant="secondary"
              label={t("edit_meal", {
                ns: "meals",
              })}
              onPress={() => {
                void state.startEdit();
              }}
              style={styles.editButton}
            />

            <Pressable
              testID="history-meal-delete-button"
              onPress={state.openDeleteModal}
              accessibilityRole="button"
              accessibilityLabel={t("delete_meal", {
                ns: "history",
              })}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed ? styles.deleteButtonPressed : null,
              ]}
            >
              <Text style={styles.deleteButtonLabel}>
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
        />
      </>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingTop: 0,
      paddingLeft: 0,
      paddingRight: 0,
      backgroundColor: theme.background,
    },
    content: {
      gap: theme.spacing.md,
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
    heroCard: {
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.depth.floating,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    heroTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    kcalBadge: {
      minWidth: 92,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.success.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      alignItems: "flex-end",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    heroMeta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
    },
    sectionCard: {
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: theme.spacing.sm,
    },
    heroMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    nutritionCard: {
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: 18,
      gap: theme.spacing.sm,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.18 : 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: theme.isDark ? 0 : 1,
    },
    sectionEyebrow: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    kcalRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
    },
    kcalValue: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    kcalUnit: {
      color: theme.success.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    macroTrack: {
      height: 8,
      borderRadius: theme.rounded.full,
      overflow: "hidden",
      flexDirection: "row",
      backgroundColor: theme.success.surface,
    },
    macroSegment: {
      height: 8,
      borderRadius: theme.rounded.full,
    },
    macroProtein: {
      backgroundColor: theme.chart.protein,
    },
    macroCarbs: {
      backgroundColor: theme.chart.carbs,
    },
    macroFat: {
      backgroundColor: theme.chart.fat,
    },
    macroRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    macroBlock: {
      flex: 1,
      gap: 2,
    },
    macroBlockCentered: {
      alignItems: "center",
    },
    macroBlockRight: {
      alignItems: "flex-end",
    },
    macroValue: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    proteinValue: {
      color: theme.chart.protein,
    },
    carbsValue: {
      color: theme.chart.carbs,
    },
    fatValue: {
      color: theme.chart.fat,
    },
    macroLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.regular,
    },
    ingredientsSection: {
      gap: theme.spacing.sm,
    },
    ingredientsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ingredientsTitle: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    itemsPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs - 2,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.success.surface,
    },
    itemsPillLabel: {
      color: theme.success.text,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    ingredientsCard: {
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 18,
      paddingVertical: theme.spacing.sm,
    },
    ingredientRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    ingredientName: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.medium,
    },
    ingredientAmount: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "right",
    },
    ingredientDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
    },
    ingredientsToggle: {
      minHeight: 48,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    ingredientsTogglePressed: {
      opacity: 0.88,
    },
    ingredientsToggleLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    ingredientsEditorList: {
      gap: theme.spacing.sm,
    },
    ingredientEditorItem: {
      marginBottom: 0,
    },
    actionsWrap: {
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    editButton: {
      borderColor: "rgba(79, 104, 75, 0.32)",
    },
    deleteButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButtonPressed: {
      opacity: 0.76,
    },
    deleteButtonLabel: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.bold,
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
