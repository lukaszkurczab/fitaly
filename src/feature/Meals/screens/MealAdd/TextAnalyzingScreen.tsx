import { useEffect, useMemo, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { StyleSheet, View } from "react-native";
import { Layout, TextInput, Toast } from "@/components";
import { useTranslation } from "react-i18next";
import { useAiCreditsContext } from "@/context/AiCreditsContext";
import { useAccessContext } from "@/context/AccessContext";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import { useAppSettingsContext } from "@/context/AppSettingsContext";
import type { Meal } from "@/types";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { extractIngredientsFromText } from "@/services/ai/textMealService";
import type {
  AiCreditsStatus,
  AiTextMealPayload,
} from "@/services/ai/contracts";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { getAiUxErrorType } from "@/services/ai/uxError";
import { getMealAiMetaFromAiResponse } from "@/services/meals/mealMetadata";
import { AiCreditsBadge } from "@/components/AiCreditsBadge";
import {
  MealAddPhotoScaffold,
  MealAddStatusBanner,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import { isOfflineNetState } from "@/services/core/networkState";
import { useTheme } from "@/theme/useTheme";
import { v4 as uuidv4 } from "uuid";
import AddMealFlowHeader from "@/feature/Meals/screens/MealAdd/components/AddMealFlowHeader";

const MAX_RETRIES = 3;
const TEXT_PREVIEW_HEIGHT = 220;
const ANALYZING_MIN_VISIBLE_MS = 900;

const nextRetryCount = (current: number) => Math.min(current + 1, MAX_RETRIES);

const parsePositiveInteger = (value?: string): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const buildIngredientsText = (
  ingredients?: MealAddScreenProps<"TextAnalyzing">["params"]["textIngredients"],
): string => {
  if (!ingredients?.length) return "";

  return ingredients
    .map((ingredient) => {
      const name = ingredient.name.trim();
      if (!name) return "";

      const amount = parsePositiveInteger(ingredient.amount);
      return amount ? `${name} ${amount} g` : name;
    })
    .filter(Boolean)
    .join(", ");
};

const buildPayload = (
  params: MealAddScreenProps<"TextAnalyzing">["params"],
): AiTextMealPayload => {
  const name = params.name.trim();
  const description = params.quickDescription.trim();
  const ingredientsText = buildIngredientsText(params.textIngredients);

  return {
    name: name || null,
    ingredients: ingredientsText || description || name || null,
    amount_g: parsePositiveInteger(params.servingAmount),
    notes: description || null,
  };
};

const buildInitialMeal = (uid: string): Meal => ({
  mealId: uuidv4(),
  userUid: uid,
  name: null,
  photoUrl: null,
  ingredients: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncState: "pending",
  tags: [],
  deleted: false,
  notes: null,
  type: "other",
  timestamp: "",
  source: "ai",
  inputMethod: "text",
  aiMeta: null,
  cloudId: undefined,
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TextAnalyzingScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"TextAnalyzing">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals", "chat"]);
  const { uid } = useAuthContext();
  const { language } = useAppSettingsContext();
  const { clearMeal, meal, saveDraft, setLastScreen, setMeal } =
    useMealDraftContext();
  const { applyCreditsFromResponse } = useAiCreditsContext();
  const { applyAccessFromResponse, refreshAccess } = useAccessContext();
  const mealRef = useRef(meal);
  const startedForKeyRef = useRef<string | null>(null);
  const trimmedName = params.name.trim();
  const trimmedDescription = params.quickDescription.trim();
  const trimmedIngredientsText = buildIngredientsText(params.textIngredients);
  const parsedServingAmount = parsePositiveInteger(params.servingAmount);
  const detailsPreview = [
    trimmedDescription,
    trimmedIngredientsText,
    parsedServingAmount
      ? `${t("describe_meal_serving_label", { ns: "meals" })}: ${parsedServingAmount} ${t("describe_meal_grams_suffix", { ns: "meals" })}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const hasDetailsPreview = detailsPreview.length > 0;
  const retries = params.retries ?? 0;
  const analysisLang = language || "en";
  const analysisKey = params.analysisRequestId;

  useEffect(() => {
    mealRef.current = meal;
  }, [meal]);

  useEffect(() => {
    if (startedForKeyRef.current === analysisKey) {
      return;
    }
    startedForKeyRef.current = analysisKey;

    let cancelled = false;

    const replaceDescribeMeal = (
      patch: Partial<MealAddScreenProps<"DescribeMeal">["params"]>,
    ) => {
      if (cancelled) return;
      flow.replace("DescribeMeal", {
        name: params.name,
        quickDescription: params.quickDescription,
        textIngredients: params.textIngredients,
        servingAmount: params.servingAmount,
        retries,
        ...patch,
      });
    };

    const refreshAccessCredits = async (): Promise<AiCreditsStatus | null> => {
      const refreshedAccess = await refreshAccess();
      return refreshedAccess?.credits ?? null;
    };

    const analyze = async () => {
      const startedAt = Date.now();
      if (!uid) {
        replaceDescribeMeal({
          submitError: t("text_ai_error_auth"),
        });
        return;
      }

      try {
        const net = await NetInfo.fetch();
        if (isOfflineNetState(net)) {
          replaceDescribeMeal({
            submitError: t("text_ai_error_offline"),
          });
          return;
        }

        const runAnalysis = () =>
          extractIngredientsFromText(uid, buildPayload(params), {
            lang: analysisLang,
          });

        let result: Awaited<ReturnType<typeof runAnalysis>> | undefined;
        let analysisError: unknown = null;

        try {
          result = await runAnalysis();
        } catch (error) {
          analysisError = error;
        }

        if (analysisError && getErrorStatus(analysisError) === 402) {
          const creditsSnapshot = await refreshAccessCredits();
          const canRetry =
            creditsSnapshot !== null &&
            creditsSnapshot.balance >= creditsSnapshot.costs.textMeal;

          if (canRetry) {
            try {
              result = await runAnalysis();
              analysisError = null;
            } catch (retryError) {
              analysisError = retryError;
            }
          }
        }

        if (analysisError) {
          throw analysisError;
        }

        if (!result || result.ingredients.length === 0) {
          const retriesCount = nextRetryCount(retries);
          Toast.show(t("not_recognized_title"));
          replaceDescribeMeal({
            retries: retriesCount,
            submitError: t("text_ai_not_recognized_retry"),
          });
          return;
        }

        applyCreditsFromResponse(result.credits);
        applyAccessFromResponse(result.credits);
        const aiMeta = getMealAiMetaFromAiResponse(result.credits);
        const baseMeal = mealRef.current ?? buildInitialMeal(uid);

        if (!mealRef.current) {
          setMeal(baseMeal);
          mealRef.current = baseMeal;
          await saveDraft(uid, baseMeal);
        }

        const nextMeal: Meal = {
          ...baseMeal,
          name: trimmedName || baseMeal.name,
          notes: trimmedDescription || baseMeal.notes || null,
          ingredients: result.ingredients,
          source: "ai",
          inputMethod: "text",
          aiMeta,
          updatedAt: new Date().toISOString(),
        };

        setMeal(nextMeal);
        await saveDraft(uid, nextMeal);
        await setLastScreen(uid, "AddMeal");

        const elapsedMs = Date.now() - startedAt;
        const remainingVisibleMs = Math.max(
          ANALYZING_MIN_VISIBLE_MS - elapsedMs,
          0,
        );

        if (remainingVisibleMs > 0) {
          await wait(remainingVisibleMs);
        }

        if (!cancelled) {
          flow.replace("ReviewMeal", {});
        }
      } catch (error) {
        if (getErrorStatus(error) === 402) {
          await refreshAccess();
          replaceDescribeMeal({
            showLimitModal: true,
          });
          return;
        }

        const errorType = getAiUxErrorType(error);
        if (errorType === "offline") {
          replaceDescribeMeal({
            submitError: t("text_ai_error_offline"),
          });
          return;
        }
        if (errorType === "AI_CHAT_TIMEOUT") {
          replaceDescribeMeal({
            submitError: t("text_ai_error_timeout"),
          });
          return;
        }
        if (errorType === "AI_CHAT_PROVIDER_UNAVAILABLE") {
          replaceDescribeMeal({
            submitError: t("text_ai_error_unavailable"),
          });
          return;
        }
        if (errorType === "auth") {
          replaceDescribeMeal({
            submitError: t("text_ai_error_auth"),
          });
          return;
        }

        const retriesCount = nextRetryCount(retries);
        Toast.show(t("text_ai_analyze_failed"));
        replaceDescribeMeal({
          retries: retriesCount,
          submitError: t("text_ai_analyze_failed"),
        });
      }
    };

    void analyze();

    return () => {
      cancelled = true;
    };
  }, [
    applyCreditsFromResponse,
    applyAccessFromResponse,
    analysisKey,
    analysisLang,
    flow,
    params,
    retries,
    refreshAccess,
    saveDraft,
    setLastScreen,
    setMeal,
    t,
    trimmedDescription,
    trimmedName,
    uid,
  ]);
  const handleBack = () => {
    if (flow.canGoBack()) {
      flow.goBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  };
  const handleCloseFlow = () => {
    if (uid) {
      clearMeal(uid);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  };

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.fill} testID="add-meal-text-analyzing-screen">
        <AddMealFlowHeader
          progress={flow.progress}
          onBack={handleBack}
          onClose={handleCloseFlow}
          containerStyle={styles.flowHeader}
          testID="add-meal-text-analyzing-flow-header"
          backTestID="add-meal-text-analyzing-back"
          closeTestID="add-meal-text-analyzing-close"
        />
        <MealAddPhotoScaffold
          previewHeight={TEXT_PREVIEW_HEIGHT}
          preview={
            <View style={styles.preview}>
              <TextInput
                label={t("describe_meal_name_label", { ns: "meals" })}
                value={params.name}
                onChangeText={() => {}}
                editable={false}
                style={styles.previewNameField}
              />
              {hasDetailsPreview ? (
                <TextInput
                  label={t("describe_meal_optional_details_label", {
                    ns: "meals",
                  })}
                  value={detailsPreview}
                  onChangeText={() => {}}
                  editable={false}
                  style={styles.previewDescriptionField}
                  multiline
                  numberOfLines={4}
                />
              ) : null}
            </View>
          }
          eyebrow={t("text_analyzing_overline")}
          title={t("text_analyzing_title")}
          description={t("text_analyzing_subtitle")}
          accessory={
            <AiCreditsBadge
              text={`✦ ${String(t("credits.costSingle", { ns: "chat" }))}`}
              tone="success"
            />
          }
          content={
            <View testID="add-meal-text-analyzing-state">
              <MealAddStatusBanner label={t("text_analyzing_status")} loading />
            </View>
          }
          footerNote={t("text_analyzing_footer")}
        />
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    fill: {
      flex: 1,
      backgroundColor: theme.background,
    },
    preview: {
      flex: 1,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    flowHeader: {
      marginHorizontal: theme.spacing.lg,
    },
    previewNameField: {
      marginBottom: 16,
    },
    previewDescriptionField: {
      flexShrink: 1,
    },
  });
