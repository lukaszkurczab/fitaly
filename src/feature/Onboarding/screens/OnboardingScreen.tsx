import { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackScreenProps } from "@react-navigation/stack";
import { Layout, Modal } from "@/components";
import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/navigate";
import ProgressDots from "@/feature/Onboarding/components/ProgressDots";
import Step1BasicData from "@/feature/Onboarding/components/Step1BasicData";
import Step2Preferences from "@/feature/Onboarding/components/Step2Preferences";
import Step3Health from "@/feature/Onboarding/components/Step3Health";
import Step4AIAssistantPreferences from "@/feature/Onboarding/components/Step4AIAssistantPreferences";
import { useOnboardingFlow } from "@/feature/Onboarding/hooks/useOnboardingFlow";
import { useProductReadiness } from "@/hooks/useProductReadiness";

type OnboardingScreenProps = StackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({
  navigation,
  route,
}: OnboardingScreenProps) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mode = route.params?.mode ?? "first";
  const profileRecovery = route.params?.profileRecovery === true;
  const { canRenderProductStack } = useProductReadiness();

  const state = useOnboardingFlow({
    mode,
    navigation,
  });

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: mode === "refill",
    });
  }, [mode, navigation]);

  useEffect(() => {
    if (mode !== "first" || !canRenderProductStack) return;
    navigation.replace("Home");
  }, [canRenderProductStack, mode, navigation]);

  const modalCopy = useMemo(() => {
    if (!state.modalState) return null;

    if (state.modalState.type === "skip_step") {
      return {
        title: t("skipStepModal.title"),
        message:
          state.modalState.step === 3
            ? t("skipStepModal.step3Body")
            : t("skipStepModal.step4Body"),
        primaryLabel: t("skipStepModal.primaryCta"),
        secondaryLabel: t("skipStepModal.secondaryCta"),
      };
    }

    return {
      title: t("exitRefillModal.title"),
      message: t("exitRefillModal.body"),
      primaryLabel: t("exitRefillModal.primaryCta"),
      secondaryLabel: t("exitRefillModal.secondaryCta"),
    };
  }, [state.modalState, t]);

  if (!state.isLoaded) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loadingText}>{t("common:loading")}</Text>
        </View>
      </Layout>
    );
  }

  return (
    <>
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <ProgressDots
          step={state.step}
          total={state.totalSteps}
          label={state.progressLabel}
          style={styles.progress}
        />

        {state.step === 1 ? (
          <Step1BasicData
            form={state.form}
            setForm={state.setForm}
            errors={state.errors}
            setErrors={state.setErrors}
            onContinue={state.handlePrimaryAction}
            onSecondaryAction={state.handleStep1SecondaryAction}
            showSecondaryAction={mode === "refill" && !profileRecovery}
            submitting={state.submitting}
          />
        ) : null}

        {state.step === 2 ? (
          <Step2Preferences
            form={state.form}
            setForm={state.setForm}
            errors={state.errors}
            setErrors={state.setErrors}
            onContinue={state.handlePrimaryAction}
            onBack={state.handleBack}
            submitting={state.submitting}
          />
        ) : null}

        {state.step === 3 ? (
          <Step3Health
            form={state.form}
            setForm={state.setForm}
            errors={state.errors}
            setErrors={state.setErrors}
            onContinue={state.handlePrimaryAction}
            onBack={state.handleBack}
            onSkip={state.handleSkipStep}
            submitting={state.submitting}
          />
        ) : null}

        {state.step === 4 ? (
          <Step4AIAssistantPreferences
            form={state.form}
            setForm={state.setForm}
            onContinue={state.handlePrimaryAction}
            onBack={state.handleBack}
            submitting={state.submitting}
          />
        ) : null}
      </Layout>

      <Modal
        visible={!!state.modalState}
        title={modalCopy?.title}
        message={modalCopy?.message}
        onClose={state.handleModalClose}
        primaryAction={{
          label: modalCopy?.primaryLabel ?? "",
          onPress:
            state.modalState?.type === "exit_refill"
              ? state.handleSaveAndExit
              : state.handleSkipConfirm,
          loading: state.submitting,
        }}
        secondaryAction={{
          label: modalCopy?.secondaryLabel ?? "",
          onPress:
            state.modalState?.type === "exit_refill"
              ? state.handleDiscardAndExit
              : state.handleModalClose,
          tone:
            state.modalState?.type === "exit_refill"
              ? "destructive"
              : "secondary",
        }}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      flex: 1,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    progress: {
      marginBottom: theme.spacing.xl,
    },
  });
