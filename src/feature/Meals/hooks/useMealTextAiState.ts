import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { v4 as uuidv4 } from "uuid";
import { useAccessContext } from "@/context/AccessContext";
import type { RootStackParamList } from "@/navigation/navigate";
import type { AiCreditsStatus } from "@/services/ai/contracts";
import { trackPaywallViewed } from "@/services/telemetry/telemetryInstrumentation";
import type {
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
  const { accessState, canUseFeature, refreshAccess } = useAccessContext();
  const credits = accessState?.credits ?? null;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [quickDescription, setQuickDescription] = useState(
    initialValues?.quickDescription ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(
    Boolean(initialValues?.showLimitModal),
  );
  const [retries, setRetries] = useState(initialValues?.retries ?? 0);
  const [descriptionError, setDescriptionError] = useState<
    string | undefined
  >(initialValues?.descriptionError);
  const [submitError, setSubmitError] = useState<string | undefined>(
    initialValues?.submitError,
  );
  const textMealCost = credits?.costs.textMeal ?? 1;

  useEffect(() => {
    setName(initialValues?.name ?? "");
    setQuickDescription(initialValues?.quickDescription ?? "");
    setShowLimitModal(Boolean(initialValues?.showLimitModal));
    setRetries(initialValues?.retries ?? 0);
    setDescriptionError(initialValues?.descriptionError);
    setSubmitError(initialValues?.submitError);
  }, [
    initialValues?.descriptionError,
    initialValues?.name,
    initialValues?.quickDescription,
    initialValues?.retries,
    initialValues?.showLimitModal,
    initialValues?.submitError,
  ]);

  const reconcileCredits = useCallback(async (): Promise<AiCreditsStatus | null> => {
    const refreshedAccess = await refreshAccess();
    return refreshedAccess?.credits ?? credits;
  }, [credits, refreshAccess]);

  const onAnalyze = useCallback(async () => {
    setDescriptionError(undefined);
    setSubmitError(undefined);

    if (!quickDescription.trim()) {
      setDescriptionError(
        t("text_ai_require_quick_description", { ns: "meals" }),
      );
      return;
    }

    setLoading(true);
    try {
      const analysisRequestId = uuidv4();
      const textAnalyzingParams = {
        analysisRequestId,
        name: name.trim(),
        quickDescription: quickDescription.trim(),
        retries,
      } as const;
      let resolvedCredits = credits;

      if (canUseFeature("textMealAnalysis")) {
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
    canUseFeature,
    credits,
    flow,
    name,
    quickDescription,
    reconcileCredits,
    retries,
    t,
  ]);

  const analysisState = useMemo<
    "missing_description" | "credits_unverified" | "insufficient_credits" | "ready"
  >(() => {
    if (!quickDescription.trim()) {
      return "missing_description";
    }
    if (!credits) {
      return "credits_unverified";
    }
    if (credits.balance < textMealCost) {
      return "insufficient_credits";
    }
    return "ready";
  }, [credits, quickDescription, textMealCost]);

  const analyzeDisabled = analysisState !== "ready";

  const creditAllocation = credits?.allocation ?? 0;
  const creditsUsed = Math.max(creditAllocation - (credits?.balance ?? 0), 0);
  const creditsBalance = credits?.balance ?? null;
  const remainingCreditsAfterAnalyze =
    creditsBalance === null ? null : Math.max(creditsBalance - textMealCost, 0);

  const onNameChange = useCallback((text: string) => {
    setName(text);
    if (submitError) setSubmitError(undefined);
    if (retries > 0) setRetries(0);
  }, [retries, submitError]);

  const onQuickDescriptionChange = useCallback(
    (text: string) => {
      setQuickDescription(text);
      if (descriptionError) setDescriptionError(undefined);
      if (submitError) setSubmitError(undefined);
      if (retries > 0) setRetries(0);
    },
    [descriptionError, retries, submitError],
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
    loading,
    retries,
    showLimitModal,
    creditsUsed,
    creditsBalance,
    textMealCost,
    remainingCreditsAfterAnalyze,
    descriptionError,
    submitError,
    analyzeDisabled,
    analysisState,
    creditAllocation,
    onNameChange,
    onQuickDescriptionChange,
    onAnalyze,
    closeLimitModal,
    openPaywall,
  };
}
