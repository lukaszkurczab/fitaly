import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import type { StackNavigationProp } from "@react-navigation/stack";
import { getDraftKey, getScreenKey } from "@contexts/MealDraftContext";
import { useAuthContext } from "@/context/AuthContext";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import type { RootStackParamList } from "@/navigation/navigate";
import type { Meal, MealInputMethod } from "@/types/meal";
import type { KnownPatternCandidate } from "@/types/knownPatterns";
import type { AppIconName } from "@/components/AppIcon";
import { debugScope } from "@/utils/debug";
import { emit, on } from "@/services/core/events";
import { isRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  isE2EModeEnabled,
} from "@/services/e2e/config";
import { getPhotoFullscreenPreference } from "@/feature/Meals/services/photoFullscreenPreference";
import {
  fetchKnownPatternCandidatesRemote,
  markKnownPatternCandidateRemote,
  openKnownPatternReviewDraftRemote,
} from "@/services/knownPatterns/knownPatternCandidatesApi";
import {
  trackKnownPatternCandidateDismissed,
  trackKnownPatternCandidateShown,
  trackKnownPatternReviewStarted,
} from "@/services/telemetry/telemetryInstrumentation";

type MealAddMethodNavigationProp = {
  navigate: Pick<
    StackNavigationProp<RootStackParamList, "Home">,
    "navigate"
  >["navigate"];
  replace: Pick<
    StackNavigationProp<RootStackParamList, "Home">,
    "replace"
  >["replace"];
  dispatch: Pick<
    StackNavigationProp<RootStackParamList, "Home">,
    "dispatch"
  >["dispatch"];
};

type DraftResumeScreen = "AddMeal";

type AddMealStart = NonNullable<
  NonNullable<RootStackParamList["AddMeal"]>["start"]
>;

type MethodOptionBase = {
  key: "photo" | "text" | "manual" | "barcode" | "saved";
  icon: AppIconName;
  titleKey: string;
  descKey: string;
};

type AddMealMethodOption = MethodOptionBase & {
  screen: "AddMeal";
  params: NonNullable<RootStackParamList["AddMeal"]>;
};
export type MethodOption = AddMealMethodOption;

export const mealAddMethodOptions: readonly MethodOption[] = [
  {
    key: "photo",
    icon: "camera",
    titleKey: "photoTitle",
    descKey: "photoDesc",
    screen: "AddMeal",
    params: {
      start: "CameraDefault",
      attempt: 1,
    },
  },
  {
    key: "text",
    icon: "assistant",
    titleKey: "textTitle",
    descKey: "textDesc",
    screen: "AddMeal",
    params: {
      start: "DescribeMeal",
    },
  },
  {
    key: "manual",
    icon: "edit",
    titleKey: "manualTitle",
    descKey: "manualDesc",
    screen: "AddMeal",
    params: {
      start: "EditMealDetails",
      submitIntent: "replaceReview",
    },
  },
  {
    key: "barcode",
    icon: "scan-barcode",
    titleKey: "barcodeTitle",
    descKey: "barcodeDesc",
    screen: "AddMeal",
    params: {
      start: "BarcodeScan",
    },
  },
  {
    key: "saved",
    icon: "saved-items",
    titleKey: "savedTitle",
    descKey: "savedDesc",
    screen: "AddMeal",
    params: {
      start: "SelectSavedMeal",
    },
  },
] as const;

function normalizeDraftResumeScreen(
  value: string | null,
): DraftResumeScreen | null {
  if (value === "AddMeal") {
    return "AddMeal";
  }

  return null;
}

const log = debugScope("Hook:useMealAddMethodState");
const E2E_DRAFT_MEAL_ID = "e2e-draft-meal";
const PREFERRED_METHOD_STORAGE_KEY = "meal-add-preferred-method";
const DEFAULT_PREFERRED_METHOD = "photo";
const PREFERRED_METHOD_CHANGED_EVENT = "meal:add-method:preferred-changed";

const hasNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function ingredientHasMeaningfulContent(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const ingredient = payload as Partial<Meal["ingredients"][number]>;

  return Boolean(
    hasNonEmptyText(ingredient.name) ||
      isPositiveNumber(ingredient.amount) ||
      isPositiveNumber(ingredient.kcal) ||
      isPositiveNumber(ingredient.protein) ||
      isPositiveNumber(ingredient.carbs) ||
      isPositiveNumber(ingredient.fat),
  );
}

function hasMeaningfulDraft(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const draft = payload as Partial<Meal> & { isDirty?: unknown };
  const hasIdentity =
    hasNonEmptyText(draft.mealId) || hasNonEmptyText(draft.createdAt);
  if (!hasIdentity) return false;

  const hasIngredients =
    Array.isArray(draft.ingredients) &&
    draft.ingredients.some((ingredient) =>
      ingredientHasMeaningfulContent(ingredient),
    );
  const hasPhoto =
    hasNonEmptyText(draft.photoUrl) ||
    hasNonEmptyText(draft.localPhotoUrl) ||
    hasNonEmptyText(draft.photoLocalPath);
  const hasTotals =
    !!draft.totals &&
    (isPositiveNumber(draft.totals.kcal) ||
      isPositiveNumber(draft.totals.protein) ||
      isPositiveNumber(draft.totals.carbs) ||
      isPositiveNumber(draft.totals.fat));
  const hasDirtyFlag = draft.isDirty === true;

  return hasIngredients || hasPhoto || hasTotals || hasDirtyFlag;
}

function getInputMethodForOption(option: MethodOption): MealInputMethod | null {
  if (option.key === "photo") return "photo";
  if (option.key === "text") return "text";
  if (option.key === "manual") return "manual";
  if (option.key === "barcode") return "barcode";
  return null;
}

function isMealAddMethodOptionKey(
  value: string | null,
): value is MethodOption["key"] {
  return mealAddMethodOptions.some((option) => option.key === value);
}

function getMethodOptionByKey(key: MethodOption["key"]): MethodOption {
  return (
    mealAddMethodOptions.find((option) => option.key === key) ??
    mealAddMethodOptions[0]
  );
}

export function useMealAddMethodState(params: {
  navigation: MealAddMethodNavigationProp;
  replaceOnStart?: boolean;
  persistSelection?: boolean;
  resetStackOnStart?: boolean;
  loadKnownPatternCandidate?: boolean;
}) {
  const { uid } = useAuthContext();
  const { setMeal, saveDraft, setLastScreen, loadDraft, removeDraft } =
    useMealDraftContext();

  const [preferredMethodKey, setPreferredMethodKey] =
    useState<MethodOption["key"]>(DEFAULT_PREFERRED_METHOD);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeScreen, setResumeScreen] =
    useState<DraftResumeScreen | null>(null);
  const [pendingOption, setPendingOption] = useState<MethodOption | null>(null);
  const [pendingKnownPatternCandidate, setPendingKnownPatternCandidate] =
    useState<KnownPatternCandidate | null>(null);
  const [resumeDraftMeal, setResumeDraftMeal] = useState<Meal | null>(null);
  const [knownPatternCandidate, setKnownPatternCandidate] =
    useState<KnownPatternCandidate | null>(null);
  const [knownPatternBusy, setKnownPatternBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPreferredMethod = async () => {
      const stored = await AsyncStorage.getItem(PREFERRED_METHOD_STORAGE_KEY);

      if (!cancelled && isMealAddMethodOptionKey(stored)) {
        setPreferredMethodKey(stored);
      }
    };

    void loadPreferredMethod();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = on<{ key?: MethodOption["key"] }>(
      PREFERRED_METHOD_CHANGED_EVENT,
      (payload) => {
        if (!payload?.key || !isMealAddMethodOptionKey(payload.key)) {
          return;
        }

        setPreferredMethodKey(payload.key);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const primeEmptyMeal = useCallback(
    async (nextScreen: AddMealStart, inputMethod?: MealInputMethod | null) => {
      if (!uid) return;

      const now = new Date().toISOString();
      const isE2E = isE2EModeEnabled();
      const emptyMeal: Meal = {
        mealId: isE2E ? E2E_DRAFT_MEAL_ID : uuidv4(),
        userUid: uid,
        name: null,
        photoUrl: null,
        ingredients: [],
        createdAt: now,
        updatedAt: now,
        syncState: "pending",
        tags: [],
        deleted: false,
        notes: null,
        type: "other",
        timestamp: "",
        source: null,
        inputMethod: inputMethod ?? null,
        aiMeta: null,
      };

      setMeal(emptyMeal);
      await saveDraft(uid, emptyMeal);
      await setLastScreen(uid, nextScreen);
    },
    [saveDraft, setLastScreen, setMeal, uid],
  );

  const persistPreferredMethod = useCallback(async (key: MethodOption["key"]) => {
    setPreferredMethodKey(key);
    await AsyncStorage.setItem(PREFERRED_METHOD_STORAGE_KEY, key);
    emit(PREFERRED_METHOD_CHANGED_EVENT, { key });
  }, []);

  const openAddMeal = useCallback(
    (routeParams: RootStackParamList["AddMeal"]) => {
      if (params.resetStackOnStart) {
        params.navigation.dispatch(
          {
            type: "RESET",
            payload: {
              index: 1,
              routes: [
                { name: "Home" },
                { name: "AddMeal", params: routeParams },
              ],
            },
          } as never,
        );
        return;
      }

      if (params.replaceOnStart) {
        params.navigation.replace("AddMeal", routeParams);
        return;
      }

      params.navigation.navigate("AddMeal", routeParams);
    },
    [params.navigation, params.replaceOnStart, params.resetStackOnStart],
  );

  useEffect(() => {
    let cancelled = false;

    const loadKnownPatternCandidate = async () => {
      if (
        !params.loadKnownPatternCandidate ||
        !uid ||
        !isRuntimeFeatureEnabled("knownPatterns")
      ) {
        setKnownPatternCandidate(null);
        return;
      }

      try {
        const response = await fetchKnownPatternCandidatesRemote({ limit: 1 });
        if (!cancelled) {
          const candidate = response.items[0] ?? null;
          setKnownPatternCandidate(candidate);
          if (candidate) {
            void trackKnownPatternCandidateShown({
              surface: "meal_add_method",
              confidenceBucket: candidate.confidenceBucket,
              sourceCountBucket: candidate.sourceCountBucket,
              featureState: "enabled",
            });
          }
        }
      } catch {
        if (!cancelled) {
          setKnownPatternCandidate(null);
        }
      }
    };

    void loadKnownPatternCandidate();

    return () => {
      cancelled = true;
    };
  }, [params.loadKnownPatternCandidate, uid]);

  const executeOption = useCallback(
    async (option: MethodOption) => {
      if (option.key === "saved") {
        openAddMeal(option.params);
        return;
      }

      const start = option.params.start;
      await primeEmptyMeal(
        start ?? "CameraDefault",
        getInputMethodForOption(option),
      );
      const photoFullscreenPreferred =
        option.key === "photo" ? await getPhotoFullscreenPreference(uid) : false;
      openAddMeal(
        photoFullscreenPreferred
          ? { ...option.params, fullscreenPreferred: true }
          : option.params,
      );
    },
    [openAddMeal, primeEmptyMeal, uid],
  );

  const checkDraftBeforeLaunch = useCallback(
    async (option: MethodOption): Promise<boolean> => {
      if (!uid) return false;

      const [draftRaw, lastScreenStored] = await Promise.all([
        AsyncStorage.getItem(getDraftKey(uid)),
        AsyncStorage.getItem(getScreenKey(uid)),
      ]);

      if (!draftRaw) {
        return false;
      }

      try {
        const parsed = JSON.parse(draftRaw) as unknown;
        if (!hasMeaningfulDraft(parsed)) {
          log.log("Removing inactive meal draft after startup sanity-check.");
          await removeDraft(uid);
          return false;
        }

        const normalizedResumeScreen =
          normalizeDraftResumeScreen(lastScreenStored);

        if (!normalizedResumeScreen) {
          log.log("Active draft found but no resumable screen.", {
            lastScreenStored: lastScreenStored ?? null,
          });
          return false;
        }

        setPendingOption(option);
        setPendingKnownPatternCandidate(null);
        setResumeScreen(normalizedResumeScreen);
        setResumeDraftMeal(parsed as Meal);
        setShowResumeModal(true);
        log.log("Active draft found. Showing resume modal.", {
          resumeScreen: normalizedResumeScreen,
          pendingOption: option.key,
        });
        return true;
      } catch {
        log.log("Removing malformed meal draft payload.");
        await removeDraft(uid);
        return false;
      }
    },
    [removeDraft, uid],
  );

  const checkDraftBeforeKnownPatternLaunch = useCallback(
    async (candidate: KnownPatternCandidate): Promise<boolean> => {
      if (!uid) return false;

      const [draftRaw, lastScreenStored] = await Promise.all([
        AsyncStorage.getItem(getDraftKey(uid)),
        AsyncStorage.getItem(getScreenKey(uid)),
      ]);

      if (!draftRaw) {
        return false;
      }

      try {
        const parsed = JSON.parse(draftRaw) as unknown;
        if (!hasMeaningfulDraft(parsed)) {
          log.log("Removing inactive meal draft before known-pattern launch.");
          await removeDraft(uid);
          return false;
        }

        const normalizedResumeScreen =
          normalizeDraftResumeScreen(lastScreenStored);

        if (!normalizedResumeScreen) {
          log.log("Active draft found but no resumable screen.", {
            lastScreenStored: lastScreenStored ?? null,
          });
          return false;
        }

        setPendingOption(null);
        setPendingKnownPatternCandidate(candidate);
        setResumeScreen(normalizedResumeScreen);
        setResumeDraftMeal(parsed as Meal);
        setShowResumeModal(true);
        return true;
      } catch {
        log.log("Removing malformed meal draft payload.");
        await removeDraft(uid);
        return false;
      }
    },
    [removeDraft, uid],
  );

  const executeKnownPatternReview = useCallback(
    async (candidate: KnownPatternCandidate) => {
      if (!uid) return;

      setKnownPatternBusy(true);
      try {
        const response = await openKnownPatternReviewDraftRemote(
          candidate.candidateId,
          {
            clientMutationId: `known-pattern:review:${uid}:${candidate.candidateId}:${uuidv4()}`,
            subjectKeyHash: candidate.subjectKeyHash,
            createdByRuleVersion: candidate.createdByRuleVersion,
          },
        );
        const now = new Date().toISOString();
        const draft: Meal = {
          mealId: uuidv4(),
          userUid: uid,
          name: response.draft.name,
          photoUrl: null,
          ingredients: response.draft.ingredients,
          totals: response.draft.totals,
          createdAt: now,
          updatedAt: now,
          syncState: "pending",
          tags: response.draft.tags,
          deleted: false,
          notes: response.draft.notes,
          type: response.draft.type,
          timestamp: "",
          source: null,
          inputMethod: "manual",
          aiMeta: null,
        };

        setMeal(draft);
        await saveDraft(uid, draft);
        await setLastScreen(uid, "ReviewMeal");
        await Promise.resolve(
          trackKnownPatternReviewStarted({
            surface: "meal_add_method",
            confidenceBucket: candidate.confidenceBucket,
            sourceCountBucket: candidate.sourceCountBucket,
            actionResult: "succeeded",
            featureState: "enabled",
          }),
        ).catch(() => undefined);
        setKnownPatternCandidate((current) =>
          current?.candidateId === candidate.candidateId
            ? { ...current, state: "shown" }
            : current,
        );
        openAddMeal({ start: "ReviewMeal" });
      } finally {
        setKnownPatternBusy(false);
      }
    },
    [openAddMeal, saveDraft, setLastScreen, setMeal, uid],
  );

  const handleKnownPatternReview = useCallback(async () => {
    if (!knownPatternCandidate || knownPatternBusy) return;

    const shouldPauseForDraft = await checkDraftBeforeKnownPatternLaunch(
      knownPatternCandidate,
    );
    if (shouldPauseForDraft) {
      return;
    }

    await executeKnownPatternReview(knownPatternCandidate);
  }, [
    checkDraftBeforeKnownPatternLaunch,
    executeKnownPatternReview,
    knownPatternBusy,
    knownPatternCandidate,
  ]);

  const handleKnownPatternDismiss = useCallback(async () => {
    if (!knownPatternCandidate || !uid || knownPatternBusy) return;

    setKnownPatternBusy(true);
    const dismissedCandidate = knownPatternCandidate;
    setKnownPatternCandidate(null);
    try {
      await markKnownPatternCandidateRemote(dismissedCandidate.candidateId, {
        clientMutationId: `known-pattern:decline:${uid}:${dismissedCandidate.candidateId}:${uuidv4()}`,
        subjectKeyHash: dismissedCandidate.subjectKeyHash,
        createdByRuleVersion: dismissedCandidate.createdByRuleVersion,
        action: "declined",
      });
      await Promise.resolve(
        trackKnownPatternCandidateDismissed({
          surface: "meal_add_method",
          confidenceBucket: dismissedCandidate.confidenceBucket,
          sourceCountBucket: dismissedCandidate.sourceCountBucket,
          actionResult: "succeeded",
          featureState: "enabled",
        }),
      ).catch(() => undefined);
    } catch {
      setKnownPatternCandidate(dismissedCandidate);
    } finally {
      setKnownPatternBusy(false);
    }
  }, [knownPatternBusy, knownPatternCandidate, uid]);

  const handleOptionPress = useCallback(
    async (option: MethodOption) => {
      if (params.persistSelection) {
        await persistPreferredMethod(option.key);
      }

      const shouldPauseForDraft = await checkDraftBeforeLaunch(option);
      if (shouldPauseForDraft) {
        return;
      }

      await executeOption(option);
    },
    [
      checkDraftBeforeLaunch,
      executeOption,
      params.persistSelection,
      persistPreferredMethod,
    ],
  );

  const handleDirectStart = useCallback(async () => {
    const option = getMethodOptionByKey(preferredMethodKey);
    await handleOptionPress(option);
  }, [handleOptionPress, preferredMethodKey]);

  const handleContinueDraft = useCallback(async () => {
    if (uid) {
      await loadDraft(uid);
    }

    setShowResumeModal(false);
    setPendingOption(null);
    setResumeScreen(null);
    setResumeDraftMeal(null);
    setPendingKnownPatternCandidate(null);

    if (resumeScreen === "AddMeal") {
      log.log("Resuming AddMeal draft at ReviewMeal.");
      openAddMeal({ start: "ReviewMeal" });
    }
  }, [loadDraft, openAddMeal, resumeScreen, uid]);

  const handleDiscardDraft = useCallback(async () => {
    if (uid) {
      await removeDraft(uid);
    }

    setShowResumeModal(false);
    setResumeScreen(null);
    setResumeDraftMeal(null);

    const nextKnownPatternCandidate = pendingKnownPatternCandidate;
    setPendingKnownPatternCandidate(null);
    const nextOption = pendingOption;
    setPendingOption(null);

    if (nextKnownPatternCandidate) {
      await executeKnownPatternReview(nextKnownPatternCandidate);
    } else if (nextOption) {
      await executeOption(nextOption);
    }
  }, [
    executeKnownPatternReview,
    executeOption,
    pendingKnownPatternCandidate,
    pendingOption,
    removeDraft,
    uid,
  ]);

  const closeResumeModal = useCallback(() => {
    setShowResumeModal(false);
    setPendingOption(null);
    setPendingKnownPatternCandidate(null);
    setResumeScreen(null);
    setResumeDraftMeal(null);
  }, []);

  return {
    options: mealAddMethodOptions,
    preferredMethodKey,
    preferredOption: getMethodOptionByKey(preferredMethodKey),
    handleDirectStart,
    showResumeModal,
    resumeDraftMeal,
    handleOptionPress,
    handleContinueDraft,
    handleDiscardDraft,
    closeResumeModal,
    knownPatternCandidate,
    knownPatternBusy,
    handleKnownPatternReview,
    handleKnownPatternDismiss,
  };
}
