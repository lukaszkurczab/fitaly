import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { StackScreenProps } from "@react-navigation/stack";
import { AppIcon, Layout, Modal } from "@/components";
import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/navigate";
import ProgressDots from "@/feature/Onboarding/components/ProgressDots";
import Step1BasicData from "@/feature/Onboarding/components/Step1BasicData";
import Step2Preferences from "@/feature/Onboarding/components/Step2Preferences";
import Step3Health from "@/feature/Onboarding/components/Step3Health";
import Step4AIAssistantPreferences from "@/feature/Onboarding/components/Step4AIAssistantPreferences";
import { useOnboardingFlow } from "@/feature/Onboarding/hooks/useOnboardingFlow";

type OnboardingScreenProps =
  | StackScreenProps<RootStackParamList, "Onboarding">
  | StackScreenProps<RootStackParamList, "OnboardingRefill">;

export default function OnboardingScreen({
  navigation,
  route,
}: OnboardingScreenProps) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mode = route.params?.mode ?? "first";
  const isRefill = mode === "refill";

  const state = useOnboardingFlow({
    mode,
    navigation,
  });

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: isRefill,
    });
  }, [isRefill, navigation]);

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

  const isSkipConfirmation = state.modalState?.type === "skip_step";

  if (!state.isLoaded) {
    return (
      <Layout
        showNavigation={false}
        disableScroll
        style={styles.layout}
      >
        <View style={styles.loadingWrap} testID="onboarding-loading-state">
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loadingText}>{t("common:loading")}</Text>
        </View>
      </Layout>
    );
  }

  return (
    <>
      <Layout
        showNavigation={false}
        disableScroll
        style={styles.layout}
      >
        <View testID="onboarding-screen" style={styles.screenMarker}>
          <View style={styles.topRow}>
            <ProgressDots
              step={state.step}
              total={state.totalSteps}
              label={state.progressLabel}
              style={isRefill ? styles.progressWithClose : styles.progress}
            />
            {isRefill ? (
              <Pressable
                testID="onboarding-refill-close-button"
                accessibilityRole="button"
                accessibilityLabel={t("exitRefillModal.closeA11y")}
                accessibilityState={{ disabled: state.submitting }}
                disabled={state.submitting}
                hitSlop={8}
                onPress={state.handleCloseRefill}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed ? styles.closeButtonPressed : null,
                  state.submitting ? styles.closeButtonDisabled : null,
                ]}
              >
                <AppIcon name="close" size={18} color={theme.text} />
              </Pressable>
            ) : null}
          </View>

          {state.step === 1 ? (
            <Step1BasicData
              form={state.form}
              setForm={state.setForm}
              errors={state.errors}
              setErrors={state.setErrors}
              onContinue={state.handlePrimaryAction}
              onSecondaryAction={state.handleStep1SecondaryAction}
              showSecondaryAction={false}
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
        </View>
      </Layout>

      <Modal
        testID="onboarding-confirm-modal"
        visible={!!state.modalState}
        title={modalCopy?.title}
        message={modalCopy?.message}
        onClose={isSkipConfirmation ? undefined : state.handleModalClose}
        closeOnBackdropPress={!isSkipConfirmation}
        primaryAction={{
          testID: "onboarding-confirm-primary-button",
          label: modalCopy?.primaryLabel ?? "",
          onPress:
            state.modalState?.type === "exit_refill"
              ? state.handleSaveAndExit
              : state.handleSkipConfirm,
          loading: state.submitting,
        }}
        secondaryAction={{
          testID: "onboarding-confirm-secondary-button",
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
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    progress: {
      flex: 1,
    },
    progressWithClose: {
      flex: 1,
      paddingTop: theme.spacing.xs,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.16 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    closeButtonPressed: {
      opacity: 0.72,
    },
    closeButtonDisabled: {
      opacity: 0.48,
    },
    screenMarker: {
      flex: 1,
    },
  });
