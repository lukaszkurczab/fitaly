import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "@/services/core/fileSystem";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import {
  Button,
  Checkbox,
  KeyboardAwareScrollView,
  Layout,
  PhotoPreview,
  ScreenCornerNavButton,
  TextButton,
  UnsavedChangesModal,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useMeals } from "@hooks/useMeals";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";
import { useAuthContext } from "@/context/AuthContext";
import { autoMealName } from "@/utils/autoMealName";
import type { Meal } from "@/types/meal";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trackAiMealReviewSaved } from "@/services/telemetry/telemetryInstrumentation";
import {
  deriveMealTimingMetadata,
  formatMealDayKey,
} from "@/services/meals/mealMetadata";

const IMAGE_HEIGHT = 164;

function isValidIsoDate(value?: string | null) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function formatMealTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatIngredientValue(amount?: number, unit?: string) {
  if (!Number.isFinite(amount)) return unit ?? "";
  const value = Number.isInteger(amount ?? 0)
    ? String(amount)
    : (amount ?? 0).toFixed(1);
  return `${value}${unit ? ` ${unit}` : ""}`.trim();
}

function buildAiReviewFingerprint(meal: Meal): string {
  const normalizedIngredients = meal.ingredients.map((ingredient) => ({
    name: ingredient.name.trim().toLowerCase(),
    amount: Number(ingredient.amount.toFixed(3)),
    unit: ingredient.unit ?? "g",
    kcal: Number(ingredient.kcal.toFixed(3)),
    protein: Number(ingredient.protein.toFixed(3)),
    carbs: Number(ingredient.carbs.toFixed(3)),
    fat: Number(ingredient.fat.toFixed(3)),
  }));

  return JSON.stringify({
    name: (meal.name ?? "").trim().toLowerCase(),
    type: meal.type,
    timestamp: meal.timestamp,
    ingredients: normalizedIngredients,
  });
}

const hasNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function hasMeaningfulIngredient(ingredient: Meal["ingredients"][number]) {
  return (
    hasNonEmptyText(ingredient.name) ||
    hasPositiveNumber(ingredient.amount) ||
    hasPositiveNumber(ingredient.kcal) ||
    hasPositiveNumber(ingredient.protein) ||
    hasPositiveNumber(ingredient.carbs) ||
    hasPositiveNumber(ingredient.fat)
  );
}

export default function ReviewMealScreen({
  navigation,
  flow,
}: MealAddScreenProps<"ReviewMeal">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const { t, i18n } = useTranslation(["meals", "common"]);
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;
  const { uid } = useAuthContext();
  const { userData } = useUserProfileContext();
  const { saveMeal } = useMeals(uid ?? null);
  const { meal, clearMeal, loadDraft, saveDraft, setLastScreen, setPhotoUrl } =
    useMealDraftContext();

  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [checkingImage, setCheckingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [saveToMyMeals, setSaveToMyMeals] = useState(false);
  const initialAiReviewMealIdRef = useRef<string | null>(null);
  const initialAiReviewFingerprintRef = useRef<string | null>(null);

  const image = meal?.photoUrl ?? null;
  const isFromSaved = meal?.source === "saved";
  const savedTemplateId = isFromSaved
    ? (meal?.savedMealRefId ?? meal?.cloudId ?? null)
    : null;

  useEffect(() => {
    setSaveToMyMeals(false);
  }, [isFromSaved, meal?.mealId, savedTemplateId]);

  useEffect(() => {
    const reviewMeal = meal;
    if (!reviewMeal || reviewMeal.source !== "ai") {
      initialAiReviewMealIdRef.current = null;
      initialAiReviewFingerprintRef.current = null;
      return;
    }

    const reviewMealId = reviewMeal.mealId || reviewMeal.cloudId || "draft";
    if (initialAiReviewMealIdRef.current === reviewMealId) {
      return;
    }

    initialAiReviewMealIdRef.current = reviewMealId;
    initialAiReviewFingerprintRef.current = buildAiReviewFingerprint(reviewMeal);
  }, [meal]);

  useEffect(() => {
    if (uid) {
      void setLastScreen(uid, "AddMeal");
    }
  }, [setLastScreen, uid]);

  useEffect(() => {
    setImageError(false);
  }, [image]);

  const guard = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges: Boolean(uid && meal) && !saving,
    onDiscard: () => {
      if (!uid) return;
      clearMeal(uid);
    },
    onExit: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("Home");
    },
    onBeforeExitAttempt: () => {
      if (previewVisible) {
        setPreviewVisible(false);
        return true;
      }

      return false;
    },
  });

  useEffect(() => {
    const photoUrl = meal?.photoUrl;
    if (!photoUrl || !uid) return;

    let cancelled = false;

    const validateLocalImage = async () => {
      setCheckingImage(true);
      try {
        const isLocal =
          photoUrl.startsWith("file://") || photoUrl.startsWith("content://");
        if (!isLocal) return;

        const info = await FileSystem.getInfoAsync(photoUrl);
        if (!info.exists && !cancelled) {
          setPhotoUrl(null);
          await saveDraft(uid, { ...meal, photoUrl: null });
        }
      } finally {
        if (!cancelled) setCheckingImage(false);
      }
    };

    void validateLocalImage();

    return () => {
      cancelled = true;
    };
  }, [meal, saveDraft, setPhotoUrl, uid]);

  const retryLoadDraft = useCallback(async () => {
    if (!uid) return;
    await loadDraft(uid);
  }, [loadDraft, uid]);

  const resolvedMealName = useMemo(() => {
    const candidate = meal?.name?.trim();
    return candidate || autoMealName();
  }, [meal?.name]);

  const mealTime = useMemo(
    () =>
      isValidIsoDate(meal?.timestamp)
        ? new Date(meal?.timestamp as string)
        : new Date(),
    [meal?.timestamp],
  );

  const nutrition = useMemo(
    () => calculateTotalNutrients(meal ? [meal] : []),
    [meal],
  );
  const isEmptyReviewMeal = useMemo(() => {
    if (!meal) return true;
    const hasIngredients = (meal.ingredients ?? []).some(hasMeaningfulIngredient);
    const hasNutrition =
      hasPositiveNumber(nutrition.kcal) ||
      hasPositiveNumber(nutrition.protein) ||
      hasPositiveNumber(nutrition.carbs) ||
      hasPositiveNumber(nutrition.fat);

    return (
      !hasNonEmptyText(meal.name) &&
      !hasIngredients &&
      !hasNutrition &&
      !hasNonEmptyText(meal.photoUrl) &&
      !hasNonEmptyText(meal.localPhotoUrl) &&
      !hasNonEmptyText(meal.photoLocalPath)
    );
  }, [meal, nutrition]);

  const ingredientPreview = useMemo(() => {
    const items = meal?.ingredients ?? [];
    return {
      items: items.slice(0, 3),
      remainingCount: Math.max(items.length - 3, 0),
      totalCount: items.length,
    };
  }, [meal?.ingredients]);

  const openCamera = useCallback(() => {
    if (!meal) return;
    flow.goTo("CameraDefault", {
      id: meal.mealId,
      skipDetection: true,
    });
  }, [flow, meal]);

  const handleOpenEdit = useCallback(() => {
    flow.goTo("EditMealDetails", {});
  }, [flow]);

  const handleSave = useCallback(
    async (openShareComposer: boolean) => {
      if (!meal || !userData?.uid || saving || !uid || isEmptyReviewMeal) return;

      setSaving(true);
      const finalTimestamp = mealTime.toISOString();
      const timingMetadata = deriveMealTimingMetadata(finalTimestamp);
      const reviewMeal: Meal = {
        ...meal,
        userUid: uid,
        name: resolvedMealName,
        type: meal.type || "other",
        timestamp: finalTimestamp,
        dayKey: formatMealDayKey(new Date(finalTimestamp)),
        loggedAtLocalMin: timingMetadata.loggedAtLocalMin,
        tzOffsetMin: timingMetadata.tzOffsetMin,
        source: meal.source ?? "manual",
      };

      try {
        const savedMeal = await saveMeal({
          meal: reviewMeal,
          savedTemplate: saveToMyMeals
            ? isFromSaved && savedTemplateId
              ? { mode: "update", templateId: savedTemplateId }
              : { mode: "create" }
            : { mode: "none" },
        });
        if (!savedMeal) {
          setSaving(false);
          return;
        }
        if (savedMeal.source === "ai") {
          const initialFingerprint = initialAiReviewFingerprintRef.current;
          const corrected =
            initialFingerprint !== null &&
            initialFingerprint !== buildAiReviewFingerprint(savedMeal);
          void trackAiMealReviewSaved({
            inputMethod: savedMeal.inputMethod === "text" ? "text" : "photo",
            corrected,
            ingredientCount: savedMeal.ingredients.length,
            requestId: savedMeal.aiMeta?.runId ?? null,
          });
        }
        clearMeal(uid);
        if (openShareComposer && savedMeal.photoUrl) {
          navigation.navigate("MealShare", {
            meal: savedMeal,
            returnTo: "ReviewMeal",
          });
          return;
        }
        navigation.navigate("Home");
      } catch {
        setSaving(false);
      }
    },
    [
      clearMeal,
      isFromSaved,
      meal,
      mealTime,
      navigation,
      resolvedMealName,
      savedTemplateId,
      saveToMyMeals,
      saveMeal,
      saving,
      uid,
      userData?.uid,
      isEmptyReviewMeal,
    ],
  );

  const mealMetaLabel = useMemo(() => {
    return `${t(meal?.type || "other", { ns: "meals" })} • ${formatMealTime(
      mealTime,
      i18n.language || "en",
    )}`;
  }, [i18n.language, meal?.type, mealTime, t]);

  const needsQuickCheck =
    meal?.source === "ai" &&
    typeof meal.aiMeta?.confidence === "number" &&
    meal.aiMeta.confidence < 0.8;

  if (!meal || !uid) {
    return (
      <Layout showNavigation={false}>
        <View style={styles.emptyWrap} testID="review-meal-empty-state">
          <Text style={styles.emptyTitle}>
            {t("reviewMealUnavailable.title", { ns: "meals" })}
          </Text>
          <Text style={styles.emptyDescription}>
            {!uid
              ? t("reviewMealUnavailable.authDesc", { ns: "meals" })
              : isOnline
                ? t("reviewMealUnavailable.desc", { ns: "meals" })
                : t("reviewMealUnavailable.offlineDesc", { ns: "meals" })}
          </Text>
          <Button
            testID="review-meal-empty-retry-button"
            label={t("retry", { ns: "common" })}
            onPress={() => {
              void retryLoadDraft();
            }}
            disabled={!uid}
            style={styles.emptyAction}
          />
          <Button
            testID="review-meal-empty-home-button"
            variant="secondary"
            label={t("back_home", { ns: "meals" })}
            onPress={() => navigation.navigate("Home")}
            style={styles.emptyAction}
          />
        </View>
      </Layout>
    );
  }

  if (previewVisible && image) {
    return (
      <PhotoPreview
        photoUri={image}
        onRetake={() => setPreviewVisible(false)}
        onAccept={() => {
          setPreviewVisible(false);
          openCamera();
        }}
        isLoading={false}
        secondaryText={t("back", { ns: "common" })}
        primaryText={t("change_photo", { ns: "meals" })}
      />
    );
  }

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <ScreenCornerNavButton
        icon="close"
        onPress={guard.requestExit}
        accessibilityLabel={t("close", { ns: "common", defaultValue: "Close" })}
        containerStyle={styles.screenCornerNavButton}
        testID="review-meal-close"
      />

      <View style={styles.screen} testID="review-meal-screen">
        <KeyboardAwareScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                theme.spacing.xxxl + 104 + footerBottomInset,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {image && !imageError ? (
            <View style={styles.heroBlock}>
              <View style={styles.imageWrapper}>
                {checkingImage ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : (
                  <Pressable
                    onPress={() => !saving && setPreviewVisible(true)}
                    disabled={saving}
                    style={styles.imagePressable}
                    testID="review-meal-photo"
                    accessibilityRole="button"
                    accessibilityLabel={t("review_meal_photo_preview", {
                      ns: "meals",
                      defaultValue: "Review meal photo",
                    })}
                  >
                    <Image
                      key={image}
                      source={{ uri: image }}
                      style={styles.image}
                      resizeMode="cover"
                      onError={() => setImageError(true)}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {needsQuickCheck ? (
            <View style={styles.reviewNote}>
              <View style={styles.reviewNoteDot} />
              <Text style={styles.reviewNoteText}>
                {t("review_meal_quick_check_note", {
                  ns: "meals",
                  defaultValue:
                    "If something looks off, edit details before saving.",
                })}
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryBlock}>
            <View style={styles.identityBlock}>
              <Text style={styles.metaLabel}>{mealMetaLabel}</Text>
              <Text style={styles.title}>{resolvedMealName}</Text>
            </View>

            <View style={styles.nutritionCard}>
              <View
                style={styles.kcalHero}
                accessible
                accessibilityLabel={`${t("calories", {
                  ns: "meals",
                  defaultValue: "Calories",
                })}: ${nutrition.kcal} kcal`}
              >
                <View style={styles.kcalAccent} />
                <View style={styles.kcalCopy}>
                  <Text style={styles.kcalLabel}>
                    {t("calories", {
                      ns: "meals",
                      defaultValue: "Calories",
                    })}
                  </Text>
                  <Text style={styles.kcalValue}>{`${nutrition.kcal} kcal`}</Text>
                </View>
              </View>
              <View style={styles.macroStats}>
                <View
                  style={[styles.macroStat, styles.proteinStat]}
                  accessible
                  accessibilityLabel={`${t("protein", {
                    ns: "meals",
                    defaultValue: "Protein",
                  })}: ${nutrition.protein}g`}
                >
                  <View style={[styles.macroAccent, styles.proteinAccent]} />
                  <Text
                    numberOfLines={2}
                    style={styles.macroStatLabel}
                  >
                    {t("protein_compact", {
                      ns: "meals",
                      defaultValue: "Protein",
                    })}
                  </Text>
                  <Text
                    style={styles.macroStatValue}
                  >{`${nutrition.protein}g`}</Text>
                </View>
                <View
                  style={[styles.macroStat, styles.carbsStat]}
                  accessible
                  accessibilityLabel={`${t("carbs", {
                    ns: "meals",
                    defaultValue: "Carbs",
                  })}: ${nutrition.carbs}g`}
                >
                  <View style={[styles.macroAccent, styles.carbsAccent]} />
                  <Text
                    numberOfLines={2}
                    style={styles.macroStatLabel}
                  >
                    {t("carbs_compact", {
                      ns: "meals",
                      defaultValue: "Carbs",
                    })}
                  </Text>
                  <Text
                    style={styles.macroStatValue}
                  >{`${nutrition.carbs}g`}</Text>
                </View>
                <View
                  style={[styles.macroStat, styles.fatStat]}
                  accessible
                  accessibilityLabel={`${t("fat", {
                    ns: "meals",
                    defaultValue: "Fat",
                  })}: ${nutrition.fat}g`}
                >
                  <View style={[styles.macroAccent, styles.fatAccent]} />
                  <Text
                    numberOfLines={2}
                    style={styles.macroStatLabel}
                  >
                    {t("fat_compact", {
                      ns: "meals",
                      defaultValue: "Fat",
                    })}
                  </Text>
                  <Text
                    style={styles.macroStatValue}
                  >{`${nutrition.fat}g`}</Text>
                </View>
              </View>
            </View>

            <View style={styles.itemsCard}>
              {ingredientPreview.items.length > 0 ? (
                <>
                  {ingredientPreview.items.map((ingredient, index) => (
                    <View
                      key={ingredient.id}
                      style={styles.itemRow}
                      testID={`review-meal-ingredient-row-${index}`}
                    >
                      <Text style={styles.itemName}>{ingredient.name}</Text>
                      <Text style={styles.itemValue}>
                        {formatIngredientValue(
                          ingredient.amount,
                          ingredient.unit,
                        )}
                      </Text>
                      {index < ingredientPreview.items.length - 1 ||
                      ingredientPreview.remainingCount > 0 ? (
                        <View style={styles.itemDivider} />
                      ) : null}
                    </View>
                  ))}
                  {ingredientPreview.remainingCount > 0 ? (
                    <Text style={styles.ingredientMoreText}>
                      {t("review_meal_ingredients_more", {
                        ns: "meals",
                        count: ingredientPreview.remainingCount,
                        defaultValue: "+{{count}} more",
                      })}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text
                  style={styles.emptyIngredientsText}
                  testID="review-meal-empty-ingredients"
                >
                  {t("review_meal_edit_no_ingredients_title", {
                    ns: "meals",
                    defaultValue: "No ingredients yet",
                  })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.preferenceRow}>
            <Checkbox
              testID="review-meal-save-to-my-meals-checkbox"
              checked={saveToMyMeals}
              onChange={!saving ? setSaveToMyMeals : () => {}}
              style={styles.checkboxSpacing}
              disabled={saving}
            />
            <Text style={styles.checkboxLabel}>
              {isFromSaved
                ? t("update_in_my_meals", {
                    ns: "meals",
                    defaultValue: "Update in My Meals",
                  })
                : t("add_to_my_meals", { ns: "meals" })}
            </Text>
          </View>

          {isEmptyReviewMeal ? (
            <View
              style={styles.reviewEmptyCard}
              testID="review-meal-empty-draft-state"
            >
              <Text style={styles.reviewEmptyTitle}>
                {t("review_meal_empty_draft_title", {
                  ns: "meals",
                  defaultValue: "Add meal details first",
                })}
              </Text>
              <Text style={styles.reviewEmptyDescription}>
                {t("review_meal_empty_draft_description", {
                  ns: "meals",
                  defaultValue:
                    "This draft has no name, ingredients, or nutrition yet.",
                })}
              </Text>
              <Button
                testID="review-meal-empty-edit-button"
                variant="secondary"
                label={t("review_meal_edit_cta", {
                  ns: "meals",
                  defaultValue: "Edit details",
                })}
                onPress={handleOpenEdit}
                disabled={saving}
                style={styles.emptyDraftAction}
              />
            </View>
          ) : null}
        </KeyboardAwareScrollView>

        <View style={[styles.footer, { paddingBottom: footerBottomInset }]}>
          <Button
            testID="review-meal-edit-button"
            variant="secondary"
            label={t("review_meal_edit_cta", {
              ns: "meals",
              defaultValue: "Edit details",
            })}
            accessibilityLabel={t("review_meal_edit_cta", { ns: "meals" })}
            onPress={handleOpenEdit}
            disabled={saving}
            style={styles.editButton}
          />
          <Button
            label={t("review_meal_save_cta", {
              ns: "meals",
              defaultValue: "Save meal",
            })}
            onPress={() => {
              void handleSave(false);
            }}
            loading={saving}
            disabled={saving || isEmptyReviewMeal}
            style={styles.saveButton}
            testID="review-meal-save-button"
          />
          {image ? (
            <TextButton
              testID="review-meal-save-share-button"
              label={t("review_meal_save_share_cta", {
                ns: "meals",
                defaultValue: "Save and share",
              })}
              tone="link"
              onPress={() => {
                void handleSave(true);
              }}
              disabled={saving || isEmptyReviewMeal}
              style={styles.shareAfterSaveButton}
              accessibilityLabel={t("review_meal_save_share_cta", {
                ns: "meals",
                defaultValue: "Save and share",
              })}
            />
          ) : null}
        </View>
      </View>

      <UnsavedChangesModal
        visible={guard.confirmVisible}
        title={t("confirm_exit_title", { ns: "meals" })}
        message={t("confirm_exit_message", { ns: "meals" })}
        discardLabel={t("leave", { ns: "common" })}
        continueEditingLabel={t("cancel", { ns: "common" })}
        onDiscard={guard.confirmExit}
        onContinueEditing={guard.cancelExit}
      />
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: theme.spacing.screenPaddingWide,
      paddingRight: theme.spacing.screenPaddingWide,
      paddingBottom: 0,
    },
    screen: {
      flex: 1,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: theme.spacing.xxxl,
      gap: theme.spacing.md,
    },
    heroBlock: {
      gap: theme.spacing.sm,
    },
    imageWrapper: {
      width: "100%",
      height: IMAGE_HEIGHT,
      borderRadius: theme.rounded.xl + 2,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    imagePressable: {
      width: "100%",
      height: "100%",
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.borderSoft,
    },
    reviewNote: {
      minHeight: 54,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.warning.surface,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    reviewNoteDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accentWarm,
      marginTop: 6,
    },
    reviewNoteText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
    summaryBlock: {
      gap: theme.spacing.md,
    },
    identityBlock: {
      gap: theme.spacing.xs,
    },
    metaLabel: {
      color: theme.primary,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.medium,
    },
    title: {
      color: theme.text,
      fontSize: 26,
      lineHeight: 32,
      fontFamily: theme.typography.fontFamily.bold,
    },
    nutritionCard: {
      minHeight: 144,
      borderRadius: 20,
      backgroundColor: theme.surface,
      paddingHorizontal: 18,
      paddingVertical: 18,
      gap: theme.spacing.sm,
      overflow: "hidden",
    },
    kcalHero: {
      minHeight: 62,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.macro.calories,
      backgroundColor: theme.macro.caloriesSoft,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    kcalAccent: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: theme.rounded.full,
      backgroundColor: theme.macro.calories,
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
      fontSize: 28,
      lineHeight: 34,
      fontFamily: theme.typography.fontFamily.bold,
    },
    macroStats: {
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "space-between",
      gap: theme.spacing.xs,
    },
    macroStat: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      gap: 3,
      justifyContent: "center",
      alignItems: "flex-start",
    },
    proteinStat: {
      borderColor: theme.macro.protein,
      backgroundColor: theme.macro.proteinSoft,
    },
    carbsStat: {
      borderColor: theme.macro.carbs,
      backgroundColor: theme.macro.carbsSoft,
    },
    fatStat: {
      borderColor: theme.macro.fat,
      backgroundColor: theme.macro.fatSoft,
    },
    macroAccent: {
      width: 18,
      height: 3,
      borderRadius: theme.rounded.full,
      marginBottom: 2,
    },
    proteinAccent: {
      backgroundColor: theme.macro.protein,
    },
    carbsAccent: {
      backgroundColor: theme.macro.carbs,
    },
    fatAccent: {
      backgroundColor: theme.macro.fat,
    },
    macroStatLabel: {
      color: theme.textSecondary,
      width: "100%",
      fontSize: 12,
      lineHeight: 15,
      fontFamily: theme.typography.fontFamily.medium,
    },
    macroStatValue: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    itemsCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.primary + "59",
      backgroundColor: theme.surface,
      padding: 18,
      gap: 9,
    },
    itemRow: {
      gap: theme.spacing.xs,
    },
    itemDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginTop: theme.spacing.xs,
    },
    itemName: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
    },
    itemValue: {
      position: "absolute",
      right: 0,
      top: 0,
      color: theme.textSecondary,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "right",
    },
    ingredientMoreText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    emptyIngredientsText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    preferenceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    checkboxSpacing: {
      marginRight: 0,
    },
    checkboxLabel: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    reviewEmptyCard: {
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    reviewEmptyTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    reviewEmptyDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    emptyDraftAction: {
      marginTop: theme.spacing.xs,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.background,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    editButton: {
      minHeight: 48,
      borderRadius: 14,
    },
    saveButton: {
      minHeight: 54,
      borderRadius: 14,
    },
    shareAfterSaveButton: {
      alignSelf: "center",
      marginTop: -2,
    },
    pressed: {
      opacity: 0.82,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.screenPadding,
      paddingBottom: theme.spacing.xl,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    emptyDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      textAlign: "center",
      lineHeight: Math.round(theme.typography.size.bodyS * 1.5),
    },
    emptyAction: {
      alignSelf: "stretch",
    },
    screenCornerNavButton: {
      top: 0,
    },
  });
