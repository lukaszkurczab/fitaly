import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useUserContext } from "@/context/UserContext";
import type { OnboardingMode, UserData, UserNutritionProfile, UserProfile } from "@/types";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import type { RootStackParamList } from "@/navigation/navigate";
import { calculateCalorieTarget } from "@/feature/Onboarding/utils/calculateCalorieTarget";
import { assertNoUndefined } from "@/utils/findUndefined";
import { cmToFtIn, kgToLbs } from "@/utils/units";
import { trackOnboardingCompleted } from "@/services/telemetry/telemetryInstrumentation";
import {
  completeUserOnboardingRemote,
  type UserOnboardingCompletePayload,
} from "@/services/user/userProfileRepository";
import {
  INITIAL_FORM,
  ONBOARDING_TOTAL_STEPS,
  resetOptionalHealthFields,
} from "@/feature/Onboarding/constants";

type OnboardingNavigation = StackNavigationProp<
  RootStackParamList,
  "Onboarding"
>;

type OnboardingErrorKey =
  | keyof OnboardingFormData
  | "chronicDiseasesOther"
  | "allergiesOther";

type OnboardingErrors = Partial<Record<OnboardingErrorKey, string>>;

type ModalState =
  | { type: "skip_step"; step: 3 }
  | { type: "exit_refill" }
  | null;

function normalizeStringArray(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function normalizeFormForCompare(form: OnboardingFormData) {
  return {
    unitsSystem: form.unitsSystem,
    age: form.age,
    sex: form.sex,
    height: form.height,
    heightInch: form.heightInch ?? "",
    weight: form.weight,
    preferences: normalizeStringArray(form.preferences),
    activityLevel: form.activityLevel,
    goal: form.goal,
    calorieAdjustment: form.calorieAdjustment ?? null,
    chronicDiseases: normalizeStringArray(form.chronicDiseases),
    chronicDiseasesOther: form.chronicDiseasesOther ?? "",
    allergies: normalizeStringArray(form.allergies),
    allergiesOther: form.allergiesOther ?? "",
    lifestyle: form.lifestyle ?? "",
    aiPersona: form.aiPersona ?? "calm_guide",
  };
}

function buildInitialForm(userData: UserData | null): OnboardingFormData {
  if (!userData) return INITIAL_FORM;
  return {
    ...INITIAL_FORM,
    ...userData.profile.nutritionProfile,
    aiPersona: userData.profile.aiPreferences.stylePersona,
  };
}

function validateStep1(
  form: OnboardingFormData,
  t: (key: string) => string,
): OnboardingErrors {
  const nextErrors: OnboardingErrors = {};

  if (!form.age) {
    nextErrors.age = t("errors.ageRequired");
  } else if (
    !/^\d+$/.test(form.age) ||
    Number(form.age) < 16 ||
    Number(form.age) > 120
  ) {
    nextErrors.age = t("errors.ageInvalid");
  }

  if (!form.sex) {
    nextErrors.sex = t("errors.sexRequired");
  }

  if (form.unitsSystem === "metric") {
    if (!form.height) {
      nextErrors.height = t("errors.heightRequired");
    } else if (
      !/^\d{2,3}$/.test(form.height) ||
      Number(form.height) < 90 ||
      Number(form.height) > 250
    ) {
      nextErrors.height = t("errors.heightInvalid");
    }

    if (!form.weight) {
      nextErrors.weight = t("errors.weightRequired");
    } else if (
      !/^\d+$/.test(form.weight) ||
      Number(form.weight) < 30 ||
      Number(form.weight) > 300
    ) {
      nextErrors.weight = t("errors.weightInvalid");
    }

    return nextErrors;
  }

  const { ft } = cmToFtIn(Number(form.height || 0));
  const inch = Number(form.heightInch || 0);
  const lbs = kgToLbs(Number(form.weight || 0));

  if (!form.height) {
    nextErrors.height = t("errors.heightRequired");
  } else if (ft < 3 || ft > 8) {
    nextErrors.height = t("errors.heightInvalid");
  }

  if (inch < 0 || inch > 11) {
    nextErrors.heightInch = t("errors.heightInchInvalid");
  }

  if (!form.weight) {
    nextErrors.weight = t("errors.weightRequired");
  } else if (lbs < 70 || lbs > 660) {
    nextErrors.weight = t("errors.weightInvalid");
  }

  return nextErrors;
}

function validateStep2(
  form: OnboardingFormData,
  t: (key: string) => string,
): OnboardingErrors {
  const nextErrors: OnboardingErrors = {};

  if (!form.activityLevel) {
    nextErrors.activityLevel = t("errors.selectActivity");
  }

  if (!form.goal) {
    nextErrors.goal = t("errors.selectGoal");
  }

  if (
    (form.goal === "lose" || form.goal === "increase") &&
    typeof form.calorieAdjustment !== "number"
  ) {
    nextErrors.calorieAdjustment =
      form.goal === "lose" ? t("errors.selectDeficit") : t("errors.selectSurplus");
  }

  return nextErrors;
}

function validateStep3(
  form: OnboardingFormData,
  t: (key: string) => string,
): OnboardingErrors {
  const nextErrors: OnboardingErrors = {};

  if (
    (form.chronicDiseases ?? []).includes("other") &&
    !form.chronicDiseasesOther?.trim()
  ) {
    nextErrors.chronicDiseasesOther = t("validation.otherRequired");
  }

  if (
    (form.allergies ?? []).includes("other") &&
    !form.allergiesOther?.trim()
  ) {
    nextErrors.allergiesOther = t("validation.otherRequired");
  }

  return nextErrors;
}

function validateStep4(): OnboardingErrors {
  return {};
}

function findFirstInvalidStep(
  form: OnboardingFormData,
  t: (key: string) => string,
) {
  const step1Errors = validateStep1(form, t);
  if (Object.keys(step1Errors).length > 0)
    return { step: 1 as const, errors: step1Errors };

  const step2Errors = validateStep2(form, t);
  if (Object.keys(step2Errors).length > 0)
    return { step: 2 as const, errors: step2Errors };

  const step3Errors = validateStep3(form, t);
  if (Object.keys(step3Errors).length > 0)
    return { step: 3 as const, errors: step3Errors };

  const step4Errors = validateStep4();
  if (Object.keys(step4Errors).length > 0)
    return { step: 4 as const, errors: step4Errors };

  return null;
}

function toNutritionProfile(form: OnboardingFormData): UserNutritionProfile {
  return {
    unitsSystem: form.unitsSystem,
    age: form.age,
    sex: form.sex,
    height: form.height,
    heightInch: form.heightInch ?? "",
    weight: form.weight,
    preferences: form.preferences,
    activityLevel: form.activityLevel,
    goal: form.goal,
    chronicDiseases: form.chronicDiseases ?? [],
    chronicDiseasesOther: form.chronicDiseasesOther ?? "",
    allergies: form.allergies ?? [],
    allergiesOther: form.allergiesOther ?? "",
    lifestyle: form.lifestyle ?? "",
    calorieTarget: calculateCalorieTarget(form),
  };
}

function buildCompletionPayload(
  form: OnboardingFormData,
): UserOnboardingCompletePayload {
  const payload = {
    unitsSystem: form.unitsSystem,
    age: form.age,
    sex: form.sex,
    height: form.height,
    heightInch: form.heightInch ?? "",
    weight: form.weight,
    preferences: form.preferences,
    activityLevel: form.activityLevel,
    goal: form.goal,
    calorieAdjustment:
      form.goal === "lose" || form.goal === "increase"
        ? form.calorieAdjustment
        : null,
    chronicDiseases: form.chronicDiseases ?? [],
    chronicDiseasesOther: form.chronicDiseasesOther ?? "",
    allergies: form.allergies ?? [],
    allergiesOther: form.allergiesOther ?? "",
    lifestyle: form.lifestyle ?? "",
    aiPersona: form.aiPersona ?? "calm_guide",
  } satisfies UserOnboardingCompletePayload;

  assertNoUndefined(payload, "onboarding completion payload");
  return payload;
}

function buildPartialSavePatch(
  form: OnboardingFormData,
  currentProfile: UserProfile,
): Partial<UserData> {
  const payload = {
    profile: {
      ...currentProfile,
      nutritionProfile: toNutritionProfile(form),
      aiPreferences: {
        ...currentProfile.aiPreferences,
        stylePersona: form.aiPersona ?? "calm_guide",
      },
    },
    avatarLocalPath: form.avatarLocalPath ?? "",
  } satisfies Partial<UserData>;

  assertNoUndefined(payload, "onboarding partial payload");
  return payload;
}

export function useOnboardingFlow(params: {
  mode: OnboardingMode;
  navigation: OnboardingNavigation;
}) {
  const { t } = useTranslation("onboarding");
  const { userData, updateUser, syncUserProfile, applyServerProfile } =
    useUserContext();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingFormData>(INITIAL_FORM);
  const [initialForm, setInitialForm] =
    useState<OnboardingFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasConfirmedOptionalSkip, setHasConfirmedOptionalSkip] =
    useState(false);

  useEffect(() => {
    const nextInitialForm = buildInitialForm(userData);
    setForm(nextInitialForm);
    setInitialForm(nextInitialForm);
    setIsLoaded(true);
  }, [userData]);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(normalizeFormForCompare(form)) !==
      JSON.stringify(normalizeFormForCompare(initialForm))
    );
  }, [form, initialForm]);

  const progressLabel = t("progress", {
    current: step,
    total: ONBOARDING_TOTAL_STEPS,
  });

  const validateCurrentStep = useCallback(
    (currentStep: number) => {
      const nextErrors =
        currentStep === 1
          ? validateStep1(form, t)
          : currentStep === 2
            ? validateStep2(form, t)
            : currentStep === 3
              ? validateStep3(form, t)
              : validateStep4();

      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [form, t],
  );

  const goToProfile = useCallback(() => {
    params.navigation.navigate("Profile");
  }, [params.navigation]);

  const finishOnboarding = useCallback(
    async (nextForm?: OnboardingFormData) => {
      const resolvedForm = nextForm ?? form;
      setSubmitting(true);
      try {
        if (params.mode === "first") {
          const response = await completeUserOnboardingRemote(
            buildCompletionPayload(resolvedForm),
          );
          await applyServerProfile(response.profile);
          void trackOnboardingCompleted({ mode: params.mode });
          params.navigation.replace("Home");
          return;
        }

      if (!userData?.profile) return;
      await updateUser(buildPartialSavePatch(resolvedForm, userData.profile));
        await syncUserProfile();
        void trackOnboardingCompleted({ mode: params.mode });
        goToProfile();
      } finally {
        setSubmitting(false);
      }
    },
    [
      form,
      goToProfile,
      params.mode,
      params.navigation,
      applyServerProfile,
      syncUserProfile,
      updateUser,
      userData?.profile,
    ],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (!validateCurrentStep(step)) return;

    if (step === ONBOARDING_TOTAL_STEPS) {
      await finishOnboarding();
      return;
    }

    setErrors({});
    setStep((current) => Math.min(ONBOARDING_TOTAL_STEPS, current + 1));
  }, [finishOnboarding, step, validateCurrentStep]);

  const handleBack = useCallback(() => {
    if (step <= 1) return;
    setErrors({});
    setStep((current) => Math.max(1, current - 1));
  }, [step]);

  const handleStep1SecondaryAction = useCallback(() => {
    if (params.mode === "first") {
      return;
    }

    if (!isDirty) {
      goToProfile();
      return;
    }

    setModalState({ type: "exit_refill" });
  }, [goToProfile, isDirty, params.mode]);

  const handleCloseRefill = useCallback(() => {
    if (params.mode !== "refill") return;
    if (!isDirty) {
      goToProfile();
      return;
    }
    setModalState({ type: "exit_refill" });
  }, [goToProfile, isDirty, params.mode]);

  const applyOptionalStepSkip = useCallback(
    async (skipStep: 3) => {
      setErrors({});

      if (skipStep === 3) {
        setForm((current) => resetOptionalHealthFields(current));
        setStep(4);
      }
    },
    [],
  );

  const handleSkipStep = useCallback(async () => {
    if (step !== 3) return;

    if (hasConfirmedOptionalSkip) {
      await applyOptionalStepSkip(3);
      return;
    }

    setModalState({ type: "skip_step", step: 3 });
  }, [applyOptionalStepSkip, hasConfirmedOptionalSkip, step]);

  const handleModalClose = useCallback(() => {
    setModalState(null);
  }, []);

  const handleSkipConfirm = useCallback(async () => {
    if (!modalState) return;

    if (modalState.type !== "skip_step") return;

    setHasConfirmedOptionalSkip(true);
    setModalState(null);
    await applyOptionalStepSkip(modalState.step);
  }, [applyOptionalStepSkip, modalState]);

  const handleSaveAndExit = useCallback(async () => {
    const invalidStep = findFirstInvalidStep(form, t);
    if (invalidStep) {
      setModalState(null);
      setErrors(invalidStep.errors);
      setStep(invalidStep.step);
      return;
    }

    setSubmitting(true);
    try {
      if (!userData?.profile) return;
      await updateUser(buildPartialSavePatch(form, userData.profile));
      await syncUserProfile();
      goToProfile();
    } finally {
      setSubmitting(false);
    }
  }, [form, goToProfile, syncUserProfile, t, updateUser, userData?.profile]);

  const handleDiscardAndExit = useCallback(() => {
    setModalState(null);
    goToProfile();
  }, [goToProfile]);

  return {
    errors,
    form,
    handleBack,
    handleCloseRefill,
    handleDiscardAndExit,
    handleModalClose,
    handlePrimaryAction,
    handleSaveAndExit,
    handleSkipConfirm,
    handleSkipStep,
    handleStep1SecondaryAction,
    initialForm,
    isDirty,
    isLoaded,
    modalState,
    progressLabel,
    setErrors,
    setForm,
    step,
    submitting,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };
}
