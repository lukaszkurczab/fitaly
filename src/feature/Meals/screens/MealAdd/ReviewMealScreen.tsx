import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import * as FileSystem from "@/services/core/fileSystem";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import {
  Button,
  Checkbox,
  KeyboardAwareScrollView,
  Layout,
  Modal,
  PhotoPreview,
  UnsavedChangesModal,
} from "@/components";
import { BottomActionBar } from "@/components/BottomActionBar";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
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
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";
import { hasReviewableMealContent } from "@/feature/Meals/utils/reviewMealDraft";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { isRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  readReviewSmartMemoryExplanation,
  type ReviewMemoryDetail,
  type ReviewMemoryExplanation,
  type ReviewMemoryRowKind,
} from "@/services/smartMemory/smartMemoryService";

const IMAGE_HEIGHT = 164;
const MACRO_GRAM_UNIT = "g";
const EMPTY_REVIEW_MEMORY_EXPLANATION: ReviewMemoryExplanation = {
  activeIngredients: [],
  row: null,
};

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

function hasPositiveNutritionEvidence(meal?: Meal | null): boolean {
  if (!meal) return false;
  const nutrition = calculateTotalNutrients([meal]);
  const aggregateNutrition = meal.totals;
  return (
    nutrition.kcal > 0 ||
    nutrition.protein > 0 ||
    nutrition.carbs > 0 ||
    nutrition.fat > 0 ||
    (aggregateNutrition?.kcal ?? 0) > 0 ||
    (aggregateNutrition?.protein ?? 0) > 0 ||
    (aggregateNutrition?.carbs ?? 0) > 0 ||
    (aggregateNutrition?.fat ?? 0) > 0
  );
}

function normalizeMemoryLabel(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function ReviewMealScreen({
  navigation,
  flow,
}: MealAddScreenProps<"ReviewMeal">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const horizontalContentPadding = useMemo(
    () => ({
      paddingLeft: insets.left + theme.spacing.screenPaddingWide,
      paddingRight: insets.right + theme.spacing.screenPaddingWide,
    }),
    [insets.left, insets.right, theme.spacing.screenPaddingWide],
  );
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
  const [reviewMemoryExplanation, setReviewMemoryExplanation] =
    useState<ReviewMemoryExplanation>(EMPTY_REVIEW_MEMORY_EXPLANATION);
  const [selectedMemoryDetail, setSelectedMemoryDetail] =
    useState<ReviewMemoryDetail | null>(null);
  const initialAiReviewMealIdRef = useRef<string | null>(null);
  const initialAiReviewFingerprintRef = useRef<string | null>(null);
  const smartMemoryEnabled = isRuntimeFeatureEnabled("smartMemory");
  const planningEnabled = isRuntimeFeatureEnabled("planning");
  const nutritionProfile = userData?.profile?.nutritionProfile ?? null;
  const reviewMemoryGateEnabled =
    smartMemoryEnabled &&
    getRuntimeConfig().reviewMemoryExplanationEnabled &&
    nutritionProfile !== null;

  const image = meal?.photoUrl ?? null;
  const displayImage = image && !imageError ? image : null;
  const hasDisplayImage = Boolean(displayImage);
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
    initialAiReviewFingerprintRef.current =
      buildAiReviewFingerprint(reviewMeal);
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
      const isLocal =
        photoUrl.startsWith("file://") || photoUrl.startsWith("content://");
      if (!isLocal) return;

      setCheckingImage(true);
      try {
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
  const isEmptyReviewMeal = !hasReviewableMealContent(meal);
  const isPlanningSourceDisabled = !!meal?.planningSource && !planningEnabled;
  const isPlannedNutritionBlocked =
    !!meal?.planningSource &&
    planningEnabled &&
    !hasPositiveNutritionEvidence(meal);
  const isSaveBlocked =
    isEmptyReviewMeal || isPlanningSourceDisabled || isPlannedNutritionBlocked;

  const ingredientPreview = useMemo(() => {
    const items = meal?.ingredients ?? [];
    return {
      items: items.slice(0, 3),
      remainingCount: Math.max(items.length - 3, 0),
      totalCount: items.length,
    };
  }, [meal?.ingredients]);

  useEffect(() => {
    if (!reviewMemoryGateEnabled || !uid || !meal || !nutritionProfile) {
      setReviewMemoryExplanation(EMPTY_REVIEW_MEMORY_EXPLANATION);
      setSelectedMemoryDetail(null);
      return;
    }

    let cancelled = false;
    void readReviewSmartMemoryExplanation({
      uid,
      ingredients: meal.ingredients.map((ingredient) => ({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
      })),
      nutritionProfile,
    })
      .then((nextExplanation) => {
        if (!cancelled) setReviewMemoryExplanation(nextExplanation);
      })
      .catch(() => {
        if (!cancelled) {
          setReviewMemoryExplanation(EMPTY_REVIEW_MEMORY_EXPLANATION);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meal, nutritionProfile, reviewMemoryGateEnabled, uid]);

  const activeMemoryByIngredientName = useMemo(() => {
    const details = new Map<string, ReviewMemoryDetail>();
    reviewMemoryExplanation.activeIngredients.forEach((entry) => {
      details.set(normalizeMemoryLabel(entry.ingredientName), entry.detail);
    });
    return details;
  }, [reviewMemoryExplanation.activeIngredients]);

  const reviewMemoryRow = reviewMemoryExplanation.row;

  const openCamera = useCallback(() => {
    if (!meal) return;
    flow.goTo("CameraDefault", {
      id: meal.mealId,
      skipDetection: true,
    });
  }, [flow, meal]);

  const handleOpenEdit = useCallback(() => {
    flow.goTo("EditMealDetails", { submitIntent: "goBack" });
  }, [flow]);

  const handleFlowBack = useCallback(() => {
    if (!flow.canGoBack()) {
      flow.goBackOrExit?.();
      return;
    }
    flow.goBack();
  }, [flow]);

  const handleSave = useCallback(
    async (openShareComposer: boolean) => {
      if (!meal || !userData?.uid || saving || !uid || isSaveBlocked)
        return;

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
        navigation.dispatch({
          type: "RESET",
          payload: {
            index: 0,
            routes: [{ name: "Home" }],
          },
        } as never);
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
      isSaveBlocked,
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

  const savedMealPreferenceLabel = isFromSaved
    ? t("review_meal_save_template_update_title", {
        ns: "meals",
        defaultValue: "Update saved meal",
      })
    : t("review_meal_save_template_create_title", {
        ns: "meals",
        defaultValue: "Save as my meal",
      });

  const noPhotoIconName = useMemo<AppIconName>(() => {
    if (meal?.inputMethod === "barcode") return "scan-barcode";
    if (meal?.source === "saved") {
      return "saved-items";
    }
    if (meal?.inputMethod === "photo") return "camera";
    if (meal?.inputMethod === "text" || meal?.source === "ai") return "text";
    return "edit";
  }, [meal?.inputMethod, meal?.source]);

  const getMemoryTypeLabel = useCallback(
    (detail: ReviewMemoryDetail) => {
      return t(`review_memory_type_${detail.memoryType}`, {
        ns: "meals",
        defaultValue: detail.memoryType,
      });
    },
    [t],
  );

  const getMemoryStateLabel = useCallback(
    (detail: ReviewMemoryDetail) => {
      return t(`review_memory_state_${detail.state}`, {
        ns: "meals",
        defaultValue: detail.state,
      });
    },
    [t],
  );

  const getMemoryEvidenceLabel = useCallback(
    (detail: ReviewMemoryDetail) => {
      const evidence = detail.evidence;
      const count =
        evidence.observationCount ??
        evidence.selectionCount ??
        evidence.correctionCount ??
        null;
      if (typeof count === "number" && count > 0) {
        return t("review_memory_evidence_count", {
          ns: "meals",
          count,
          defaultValue: "Based on {{count}} recent saves.",
        });
      }
      return t("review_memory_evidence_bounded", {
        ns: "meals",
        defaultValue: "Based on repeated saves.",
      });
    },
    [t],
  );

  const getMemoryDetailSummary = useCallback(
    (detail: ReviewMemoryDetail) => {
      if (detail.state === "failed") {
        return t("review_memory_details_summary_failed", {
          ns: "meals",
          defaultValue:
            "This memory change needs attention, but meal saving still works.",
        });
      }
      if (detail.state === "pending") {
        return t("review_memory_details_summary_pending", {
          ns: "meals",
          defaultValue:
            "This memory update is waiting for sync and is not active yet.",
        });
      }
      if (detail.memoryType === "typical_portion") {
        return t("review_memory_details_summary_portion", {
          ns: "meals",
          defaultValue: "Uses your saved amount for this ingredient.",
        });
      }
      if (detail.memoryType === "ingredient_product_selection") {
        return t("review_memory_details_summary_product", {
          ns: "meals",
          defaultValue: "Uses your selected product for this ingredient.",
        });
      }
      return t("review_memory_details_summary_correction", {
        ns: "meals",
        defaultValue: "Uses a repeated Review correction for this meal.",
      });
    },
    [t],
  );

  const getMemoryRowCopy = useCallback(
    (kind: ReviewMemoryRowKind) => {
      if (kind === "sync_failed") {
        return {
          title: t("review_memory_row_sync_failed_title", {
            ns: "meals",
            defaultValue: "Memory change did not sync.",
          }),
          body: t("review_memory_row_sync_failed_body", {
            ns: "meals",
            defaultValue: "Save still works. Manage this later in Smart Memory.",
          }),
        };
      }
      if (kind === "pending_offline") {
        return {
          title: t("review_memory_row_pending_title", {
            ns: "meals",
            defaultValue: "Memory update will sync when online.",
          }),
          body: t("review_memory_row_pending_body", {
            ns: "meals",
            defaultValue: "This does not block saving this meal.",
          }),
        };
      }
      return {
        title: t("review_memory_row_candidate_title", {
          ns: "meals",
          defaultValue: "Fitaly can remember this after repeated saves.",
        }),
        body: t("review_memory_row_candidate_body", {
          ns: "meals",
          defaultValue: "No active personalization is used yet.",
        }),
      };
    },
    [t],
  );

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

  if (previewVisible && displayImage) {
    return (
      <PhotoPreview
        photoUri={displayImage}
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
    <Layout
      showNavigation={false}
      disableScroll
      style={styles.layout}
    >
      <View style={styles.screen} testID="review-meal-screen">
        <AddMealFlowHeader
          progress={flow.progress}
          onBack={handleFlowBack}
          onClose={guard.requestExit}
          testID="review-meal-flow-header"
          backTestID="review-meal-back"
          closeTestID="review-meal-close"
          containerStyle={horizontalContentPadding}
        />

        <KeyboardAwareScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            horizontalContentPadding,
            {
              paddingBottom: theme.spacing.xxxl + 112 + footerBottomInset,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryBlock}>
            <View
              style={styles.identityBlock}
              testID={
                hasDisplayImage
                  ? "review-meal-identity-summary"
                  : "review-meal-no-photo-summary"
              }
            >
              <View style={styles.identityIconWrap}>
                <AppIcon
                  name={hasDisplayImage ? "camera" : noPhotoIconName}
                  size={22}
                  color={theme.primaryStrong}
                />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityOverline}>
                  {t("review_meal_no_photo_overline", {
                    ns: "meals",
                    defaultValue: "Meal review",
                  })}
                </Text>
                <Text style={styles.title} numberOfLines={2}>
                  {resolvedMealName}
                </Text>
                <View style={styles.identityMetaRow}>
                  <Text style={styles.metaLabel} numberOfLines={1}>
                    {mealMetaLabel}
                  </Text>
                </View>
              </View>
            </View>

            {displayImage ? (
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
                        key={displayImage}
                        source={{ uri: displayImage }}
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

            {reviewMemoryRow ? (
              <Pressable
                testID="review-meal-memory-row"
                accessibilityRole="button"
                accessibilityLabel={getMemoryRowCopy(reviewMemoryRow.kind).title}
                accessibilityHint={t("review_memory_row_hint", {
                  ns: "meals",
                  defaultValue: "Opens Smart Memory details.",
                })}
                onPress={() => setSelectedMemoryDetail(reviewMemoryRow.detail)}
                style={({ pressed }) => [
                  styles.memoryRow,
                  pressed ? styles.itemPressed : null,
                ]}
              >
                <View style={styles.memoryRowIcon}>
                  <AppIcon
                    name="info"
                    size={16}
                    color={
                      reviewMemoryRow.kind === "sync_failed"
                        ? theme.error.main
                        : theme.info.text
                    }
                  />
                </View>
                <View style={styles.memoryRowCopy}>
                  <Text style={styles.memoryRowTitle} numberOfLines={2}>
                    {getMemoryRowCopy(reviewMemoryRow.kind).title}
                  </Text>
                  <Text style={styles.memoryRowBody} numberOfLines={2}>
                    {getMemoryRowCopy(reviewMemoryRow.kind).body}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <View style={styles.nutritionCard}>
              <View
                style={styles.kcalHero}
                accessible
                accessibilityLabel={`${t("calories", {
                  ns: "meals",
                  defaultValue: "Calories",
                })}: ${nutrition.kcal} kcal`}
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
                    {t("calories", {
                      ns: "meals",
                      defaultValue: "Calories",
                    })}
                  </Text>
                  <Text
                    style={styles.kcalValue}
                  >{`${nutrition.kcal} kcal`}</Text>
                </View>
              </View>
              <View style={styles.macroStats}>
                <View
                  style={[styles.macroStat, styles.proteinStat]}
                  accessible
                  accessibilityLabel={`${t("protein", {
                    ns: "meals",
                    defaultValue: "Protein",
                  })}: ${nutrition.protein} ${MACRO_GRAM_UNIT}`}
                >
                  <View style={[styles.macroIconWrap, styles.proteinIconWrap]}>
                    <AppIcon
                      name="macro-protein-drumstick"
                      size={16}
                      color={theme.macro.protein}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel}>
                      {t("protein", {
                        ns: "meals",
                        defaultValue: "Protein",
                      })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {`${nutrition.protein} ${MACRO_GRAM_UNIT}`}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.macroStat, styles.carbsStat]}
                  accessible
                  accessibilityLabel={`${t("carbs", {
                    ns: "meals",
                    defaultValue: "Carbs",
                  })}: ${nutrition.carbs} ${MACRO_GRAM_UNIT}`}
                >
                  <View style={[styles.macroIconWrap, styles.carbsIconWrap]}>
                    <AppIcon
                      name="macro-carbs-grain"
                      size={22}
                      color={theme.macro.carbs}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel}>
                      {t("carbs_compact", {
                        ns: "meals",
                        defaultValue: "Carbs",
                      })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {`${nutrition.carbs} ${MACRO_GRAM_UNIT}`}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.macroStat, styles.fatStat]}
                  accessible
                  accessibilityLabel={`${t("fat", {
                    ns: "meals",
                    defaultValue: "Fat",
                  })}: ${nutrition.fat} ${MACRO_GRAM_UNIT}`}
                >
                  <View style={[styles.macroIconWrap, styles.fatIconWrap]}>
                    <AppIcon
                      name="macro-fat-drop"
                      size={22}
                      color={theme.macro.fat}
                    />
                  </View>
                  <View style={styles.macroStatCopy}>
                    <Text style={styles.macroStatLabel}>
                      {t("fat", {
                        ns: "meals",
                        defaultValue: "Fat",
                      })}
                    </Text>
                    <Text style={styles.macroStatValue}>
                      {`${nutrition.fat} ${MACRO_GRAM_UNIT}`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.itemsCard}>
              <View style={styles.itemsHeader}>
                <Text style={styles.itemsTitle} numberOfLines={1}>
                  {`${t("review_meal_ingredients_title", {
                    ns: "meals",
                    defaultValue: "Ingredients",
                  })} (${ingredientPreview.totalCount})`}
                </Text>
                <Pressable
                  testID="review-meal-ingredients-edit-button"
                  accessibilityRole="button"
                  accessibilityLabel={t("edit_ingredients", {
                    ns: "meals",
                    defaultValue: "Edit ingredients",
                  })}
                  onPress={handleOpenEdit}
                  disabled={saving}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.itemsEditAction,
                    pressed && !saving ? styles.itemPressed : null,
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
              {ingredientPreview.items.length > 0 ? (
                <>
                  {ingredientPreview.items.map((ingredient, index) => (
                    <View key={ingredient.id} style={styles.itemRowWrap}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.itemRow,
                          pressed && !saving ? styles.itemPressed : null,
                        ]}
                        testID={`review-meal-ingredient-row-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("edit_ingredient", {
                          ns: "meals",
                          defaultValue: "Edit ingredient",
                        })}: ${ingredient.name}`}
                        onPress={handleOpenEdit}
                        disabled={saving}
                      >
                        <Text style={styles.itemName} numberOfLines={1}>
                          {ingredient.name}
                        </Text>
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemValue}>
                            {formatIngredientValue(
                              ingredient.amount,
                              ingredient.unit,
                            )}
                          </Text>
                          {activeMemoryByIngredientName.get(
                            normalizeMemoryLabel(ingredient.name),
                          ) ? (
                            <Pressable
                              testID={`review-meal-memory-info-${index}`}
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                "review_memory_ingredient_accessibility_label",
                                {
                                  ns: "meals",
                                  ingredientName: ingredient.name,
                                  defaultValue:
                                    "Memory details for active memory: {{ingredientName}} amount",
                                },
                              )}
                              accessibilityHint={t(
                                "review_memory_ingredient_accessibility_hint",
                                {
                                  ns: "meals",
                                  defaultValue:
                                    "Opens how Smart Memory affected this ingredient.",
                                },
                              )}
                              onPress={(event?: GestureResponderEvent) => {
                                event?.stopPropagation();
                                const detail = activeMemoryByIngredientName.get(
                                  normalizeMemoryLabel(ingredient.name),
                                );
                                if (detail) setSelectedMemoryDetail(detail);
                              }}
                              hitSlop={12}
                              style={styles.memoryInfoButton}
                            >
                              <AppIcon
                                name="info"
                                size={16}
                                color={theme.info.text}
                              />
                            </Pressable>
                          ) : null}
                          <AppIcon
                            name="chevron"
                            rotation="180deg"
                            size={16}
                            color={theme.textTertiary}
                          />
                        </View>
                      </Pressable>
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

          <View
            style={[
              styles.preferenceCard,
              saveToMyMeals ? styles.preferenceCardChecked : null,
              saving ? styles.preferenceCardDisabled : null,
            ]}
          >
            <Checkbox
              checked={saveToMyMeals}
              onChange={setSaveToMyMeals}
              disabled={saving}
              accessibilityLabel={savedMealPreferenceLabel}
              testID="review-meal-save-to-my-meals-checkbox"
            />
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>
                {savedMealPreferenceLabel}
              </Text>
            </View>
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
          {isPlannedNutritionBlocked ? (
            <View
              style={styles.reviewBlockedCard}
              testID="review-meal-planning-nutrition-blocked"
            >
              <View style={styles.reviewBlockedHeader}>
                <AppIcon
                  name="info"
                  size={16}
                  color={theme.warning.text}
                />
                <Text style={styles.reviewBlockedTitle}>
                  {t("review_meal_planned_unknown_nutrition_title", {
                    ns: "meals",
                    defaultValue: "Nutrition needed before saving",
                  })}
                </Text>
              </View>
              <Text style={styles.reviewBlockedDescription}>
                {t("review_meal_planned_unknown_nutrition_description", {
                  ns: "meals",
                  defaultValue:
                    "This planned meal has no confirmed nutrition yet. Add ingredients or totals before logging it.",
                })}
              </Text>
              <Button
                testID="review-meal-planning-nutrition-edit-button"
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
          {isPlanningSourceDisabled ? (
            <View
              style={styles.reviewBlockedCard}
              testID="review-meal-planning-disabled-blocked"
            >
              <View style={styles.reviewBlockedHeader}>
                <AppIcon
                  name="info"
                  size={16}
                  color={theme.warning.text}
                />
                <Text style={styles.reviewBlockedTitle}>
                  {t("review_meal_planning_disabled_title", {
                    ns: "meals",
                    defaultValue: "Planning is unavailable",
                  })}
                </Text>
              </View>
              <Text style={styles.reviewBlockedDescription}>
                {t("review_meal_planning_disabled_description", {
                  ns: "meals",
                  defaultValue:
                    "This draft came from Planning, which is turned off for this build.",
                })}
              </Text>
            </View>
          ) : null}
        </KeyboardAwareScrollView>

        <BottomActionBar
          bottomInset={footerBottomInset}
          primaryAction={{
            testID: "review-meal-save-button",
            label: t("review_meal_save_cta", {
              ns: "meals",
              defaultValue: "Save meal",
            }),
            onPress: () => {
              void handleSave(false);
            },
            loading: saving,
            disabled: saving || isSaveBlocked,
          }}
          linkActions={
            displayImage
              ? [
                  {
                    testID: "review-meal-save-share-button",
                    label: t("review_meal_save_share_cta", {
                      ns: "meals",
                      defaultValue: "Save and share",
                    }),
                    onPress: () => {
                      void handleSave(true);
                    },
                    disabled: saving || isSaveBlocked,
                    accessibilityLabel: t("review_meal_save_share_cta", {
                      ns: "meals",
                      defaultValue: "Save and share",
                    }),
                  },
                ]
              : []
          }
        />
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

      <Modal
        visible={selectedMemoryDetail !== null}
        testID="review-meal-memory-details-modal"
        title={t("review_memory_details_title", {
          ns: "meals",
          defaultValue: "Smart Memory details",
        })}
        onClose={() => setSelectedMemoryDetail(null)}
        primaryAction={{
          label: t("close", { ns: "common" }),
          onPress: () => setSelectedMemoryDetail(null),
          testID: "review-meal-memory-details-close",
        }}
        secondaryAction={
          smartMemoryEnabled
            ? {
                label: t("review_memory_details_memory_center_cta", {
                  ns: "meals",
                  defaultValue: "Open Memory Center",
                }),
                onPress: () => {
                  setSelectedMemoryDetail(null);
                  navigation.navigate("MemoryCenter");
                },
                testID: "review-meal-memory-details-memory-center",
              }
            : undefined
        }
      >
        {selectedMemoryDetail ? (
          <View style={styles.memoryDetailsStack}>
            <Text style={styles.memoryDetailsSummary}>
              {getMemoryDetailSummary(selectedMemoryDetail)}
            </Text>
            {selectedMemoryDetail.affectedLabel ? (
              <View style={styles.memoryDetailsRow}>
                <Text style={styles.memoryDetailsLabel}>
                  {t("review_memory_details_affected_label", {
                    ns: "meals",
                    defaultValue: "Applies to",
                  })}
                </Text>
                <Text style={styles.memoryDetailsValue}>
                  {selectedMemoryDetail.affectedLabel}
                </Text>
              </View>
            ) : null}
            <View style={styles.memoryDetailsRow}>
              <Text style={styles.memoryDetailsLabel}>
                {t("review_memory_details_type_label", {
                  ns: "meals",
                  defaultValue: "Memory type",
                })}
              </Text>
              <Text style={styles.memoryDetailsValue}>
                {getMemoryTypeLabel(selectedMemoryDetail)}
              </Text>
            </View>
            {selectedMemoryDetail.usedValueLabel ? (
              <View style={styles.memoryDetailsRow}>
                <Text style={styles.memoryDetailsLabel}>
                  {t("review_memory_details_value_label", {
                    ns: "meals",
                    defaultValue: "Used value",
                  })}
                </Text>
                <Text style={styles.memoryDetailsValue}>
                  {selectedMemoryDetail.usedValueLabel}
                </Text>
              </View>
            ) : null}
            <View style={styles.memoryDetailsRow}>
              <Text style={styles.memoryDetailsLabel}>
                {t("review_memory_details_state_label", {
                  ns: "meals",
                  defaultValue: "State",
                })}
              </Text>
              <Text style={styles.memoryDetailsValue}>
                {getMemoryStateLabel(selectedMemoryDetail)}
              </Text>
            </View>
            <View style={styles.memoryDetailsRow}>
              <Text style={styles.memoryDetailsLabel}>
                {t("review_memory_details_evidence_label", {
                  ns: "meals",
                  defaultValue: "Evidence",
                })}
              </Text>
              <Text style={styles.memoryDetailsValue}>
                {getMemoryEvidenceLabel(selectedMemoryDetail)}
              </Text>
            </View>
          </View>
        ) : null}
      </Modal>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: 0,
      paddingRight: 0,
      paddingBottom: 0,
    },
    screen: {
      flex: 1,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: theme.spacing.sm,
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
      backgroundColor: theme.isDark
        ? "rgba(38, 43, 38, 0.96)"
        : "rgba(255, 253, 248, 0.96)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.68)",
      ...theme.depth.raised,
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
    memoryRow: {
      minHeight: 54,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.info.main,
      backgroundColor: theme.info.surface,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    memoryRowIcon: {
      width: 24,
      height: 24,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
      backgroundColor: theme.isDark
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(255, 255, 255, 0.58)",
    },
    memoryRowCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    memoryRowTitle: {
      color: theme.info.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    memoryRowBody: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    summaryBlock: {
      gap: theme.spacing.md,
    },
    identityBlock: {
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
    identityOverline: {
      color: theme.primary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    identityMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    metaLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 1,
      maxWidth: "100%",
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      fontFamily: theme.typography.fontFamily.bold,
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
    itemsCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.66)",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.92)"
        : "rgba(255, 253, 248, 0.92)",
      padding: theme.spacing.md,
      gap: 9,
      ...theme.depth.raised,
    },
    itemsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
    },
    itemsTitle: {
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
    itemRow: {
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
    itemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    itemValue: {
      color: theme.textSecondary,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "right",
    },
    memoryInfoButton: {
      width: 20,
      height: 20,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
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
    preferenceCard: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.58)",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.58)"
        : "rgba(255, 253, 248, 0.62)",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    preferenceCardChecked: {
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.44)"
        : "rgba(94, 115, 80, 0.42)",
      backgroundColor: theme.isDark
        ? "rgba(94, 115, 80, 0.16)"
        : "rgba(231, 236, 226, 0.56)",
    },
    preferenceCardDisabled: {
      opacity: 0.64,
    },
    preferenceCopy: {
      flex: 1,
      minWidth: 0,
    },
    preferenceTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    reviewEmptyCard: {
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(226, 215, 199, 0.12)"
        : "rgba(207, 197, 184, 0.66)",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.92)"
        : "rgba(255, 253, 248, 0.92)",
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      ...theme.depth.raised,
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
    reviewBlockedCard: {
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.warning.main,
      backgroundColor: theme.warning.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    reviewBlockedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reviewBlockedTitle: {
      flex: 1,
      color: theme.warning.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    reviewBlockedDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    memoryDetailsStack: {
      gap: theme.spacing.sm,
    },
    memoryDetailsSummary: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    memoryDetailsRow: {
      gap: 3,
    },
    memoryDetailsLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    memoryDetailsValue: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    emptyDraftAction: {
      marginTop: theme.spacing.xs,
    },
    footer: {
      backgroundColor: theme.isDark ? "#1E221E" : "#FFFDF8",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.isDark
        ? "rgba(226, 215, 199, 0.10)"
        : "rgba(207, 197, 184, 0.58)",
      paddingTop: theme.spacing.md,
      gap: theme.spacing.xs,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -8 },
      elevation: 10,
    },
    footerActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.sm,
    },
    editButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 14,
      paddingHorizontal: theme.spacing.xs,
    },
    editButtonText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    saveButton: {
      flex: 1.28,
      minHeight: 50,
      borderRadius: 14,
    },
    saveButtonDark: {
      backgroundColor: theme.primaryStrong,
      borderColor: theme.primaryStrong,
    },
    shareAfterSaveButton: {
      alignSelf: "center",
      marginTop: -2,
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
  });
