import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { v4 as uuidv4 } from "uuid";
import { useAuthContext } from "@/context/AuthContext";
import { useAccessContext } from "@/context/AccessContext";
import type { RootStackParamList } from "@/navigation/navigate";
import type { AiCreditsStatus } from "@/services/ai/contracts";
import { getE2EAccessState } from "@/services/e2e/fixtures";
import { trackPaywallViewed } from "@/services/telemetry/telemetryInstrumentation";
import type {
  MealAddTextIngredientInput,
  MealAddFlowApi,
  MealAddStepParams,
} from "@/feature/Meals/feature/MapMealAddScreens";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function useMealTextAiState(params: {
  t: Translate;
  language?: string;
  flow: Pick<MealAddFlowApi, "goTo">;
  initialValues?: MealAddStepParams["DescribeMeal"];
}) {
  const { t, flow, initialValues } = params;
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { uid } = useAuthContext();
  const { accessState, canUseFeature, refreshAccess } = useAccessContext();
  const e2eAccessState = uid ? getE2EAccessState(uid) : null;
  const effectiveAccessState = e2eAccessState ?? accessState;
  const credits = effectiveAccessState?.credits ?? null;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [quickDescription, setQuickDescription] = useState(
    initialValues?.quickDescription ?? "",
  );
  const [textIngredients, setTextIngredients] = useState<
    MealAddTextIngredientInput[]
  >(initialValues?.textIngredients ?? []);
  const [servingAmount, setServingAmount] = useState(
    initialValues?.servingAmount ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(
    Boolean(initialValues?.showLimitModal),
  );
  const [retries, setRetries] = useState(initialValues?.retries ?? 0);
  const [nameError, setNameError] = useState<string | undefined>(
    initialValues?.nameError,
  );
  const [submitError, setSubmitError] = useState<string | undefined>(
    initialValues?.submitError,
  );
  const textMealCost = credits?.costs.textMeal ?? 1;

  useEffect(() => {
    setName(initialValues?.name ?? "");
    setQuickDescription(initialValues?.quickDescription ?? "");
    setTextIngredients(initialValues?.textIngredients ?? []);
    setServingAmount(initialValues?.servingAmount ?? "");
    setShowLimitModal(Boolean(initialValues?.showLimitModal));
    setRetries(initialValues?.retries ?? 0);
    setNameError(initialValues?.nameError);
    setSubmitError(initialValues?.submitError);
  }, [
    initialValues?.name,
    initialValues?.nameError,
    initialValues?.quickDescription,
    initialValues?.retries,
    initialValues?.servingAmount,
    initialValues?.showLimitModal,
    initialValues?.submitError,
    initialValues?.textIngredients,
  ]);

  const clearSubmitState = useCallback(() => {
    if (submitError) setSubmitError(undefined);
    if (retries > 0) setRetries(0);
  }, [retries, submitError]);

  const reconcileCredits = useCallback(async (): Promise<AiCreditsStatus | null> => {
    const refreshedAccess = await refreshAccess();
    return refreshedAccess?.credits ?? credits;
  }, [credits, refreshAccess]);

  const onAnalyze = useCallback(async () => {
    setNameError(undefined);
    setSubmitError(undefined);

    if (!name.trim()) {
      setNameError(t("text_ai_require_meal_name", { ns: "meals" }));
      return;
    }

    setLoading(true);
    try {
      const analysisRequestId = uuidv4();
      const normalizedTextIngredients = textIngredients
        .map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name.trim(),
          amount: ingredient.amount.trim(),
        }))
        .filter((ingredient) => ingredient.name.length > 0);
      const textAnalyzingParams = {
        analysisRequestId,
        name: name.trim(),
        quickDescription: quickDescription.trim(),
        textIngredients: normalizedTextIngredients,
        servingAmount: servingAmount.trim(),
        retries,
      } as const;
      let resolvedCredits = credits;

      const canUseTextMealAnalysis =
        e2eAccessState?.features.textMealAnalysis.enabled ??
        canUseFeature("textMealAnalysis");

      if (canUseTextMealAnalysis) {
        flow.goTo("TextAnalyzing", textAnalyzingParams);
        return;
      }

      resolvedCredits = await reconcileCredits();

      if (!resolvedCredits) {
        setSubmitError(
          t("text_ai_credits_unverified", { ns: "meals" }),
        );
        return;
      }

      if (resolvedCredits.balance < resolvedCredits.costs.textMeal) {
        setShowLimitModal(true);
        return;
      }

      flow.goTo("TextAnalyzing", textAnalyzingParams);
    } finally {
      setLoading(false);
    }
  }, [
    credits,
    e2eAccessState?.features.textMealAnalysis.enabled,
    canUseFeature,
    flow,
    name,
    quickDescription,
    reconcileCredits,
    retries,
    servingAmount,
    t,
    textIngredients,
  ]);

  const analysisState = useMemo<
    "missing_name" | "credits_unverified" | "insufficient_credits" | "ready"
  >(() => {
    if (!name.trim()) {
      return "missing_name";
    }
    if (!credits) {
      return "credits_unverified";
    }
    if (credits.balance < textMealCost) {
      return "insufficient_credits";
    }
    return "ready";
  }, [credits, name, textMealCost]);

  const analyzeDisabled = analysisState !== "ready";

  const creditAllocation = credits?.allocation ?? 0;
  const creditsUsed = Math.max(creditAllocation - (credits?.balance ?? 0), 0);
  const creditsBalance = credits?.balance ?? null;
  const remainingCreditsAfterAnalyze =
    creditsBalance === null ? null : Math.max(creditsBalance - textMealCost, 0);

  const onNameChange = useCallback((text: string) => {
    setName(text);
    if (nameError) setNameError(undefined);
    clearSubmitState();
  }, [clearSubmitState, nameError]);

  const onQuickDescriptionChange = useCallback(
    (text: string) => {
      setQuickDescription(text);
      clearSubmitState();
    },
    [clearSubmitState],
  );

  const onServingAmountChange = useCallback(
    (text: string) => {
      setServingAmount(text);
      clearSubmitState();
    },
    [clearSubmitState],
  );

  const onAddTextIngredient = useCallback(() => {
    setTextIngredients((current) => [
      ...current,
      { id: uuidv4(), name: "", amount: "" },
    ]);
    clearSubmitState();
  }, [clearSubmitState]);

  const onUpdateTextIngredient = useCallback(
    (
      id: string,
      patch: Partial<Pick<MealAddTextIngredientInput, "name" | "amount">>,
    ) => {
      setTextIngredients((current) =>
        current.map((ingredient) =>
          ingredient.id === id ? { ...ingredient, ...patch } : ingredient,
        ),
      );
      clearSubmitState();
    },
    [clearSubmitState],
  );

  const onRemoveTextIngredient = useCallback(
    (id: string) => {
      setTextIngredients((current) =>
        current.filter((ingredient) => ingredient.id !== id),
      );
      clearSubmitState();
    },
    [clearSubmitState],
  );

  const closeLimitModal = useCallback(() => {
    setShowLimitModal(false);
  }, []);

  const openPaywall = useCallback(() => {
    setShowLimitModal(false);
    void trackPaywallViewed({
      source: "meal_text_limit",
      triggerSource: "meal_text_limit_modal",
    });
    navigation.navigate("ManageSubscription");
  }, [navigation]);

  return {
    name,
    quickDescription,
    textIngredients,
    servingAmount,
    loading,
    retries,
    showLimitModal,
    creditsUsed,
    creditsBalance,
    textMealCost,
    remainingCreditsAfterAnalyze,
    nameError,
    submitError,
    analyzeDisabled,
    analysisState,
    creditAllocation,
    onNameChange,
    onQuickDescriptionChange,
    onServingAmountChange,
    onAddTextIngredient,
    onUpdateTextIngredient,
    onRemoveTextIngredient,
    onAnalyze,
    closeLimitModal,
    openPaywall,
  };
}
