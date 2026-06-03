import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomActionBar,
  CheckboxDropdown,
  Dropdown,
  RowPicker,
  Slider,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import type { Preference } from "@/types";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  PREFERENCE_CONFLICTS,
  PREFERENCE_OPTIONS,
} from "@/feature/Onboarding/constants";
import { createOnboardingMaterialStyles } from "@/feature/Onboarding/components/onboardingMaterial";

type Props = {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  errors: Partial<Record<keyof OnboardingFormData, string>>;
  setErrors: React.Dispatch<
    React.SetStateAction<Partial<Record<keyof OnboardingFormData, string>>>
  >;
  onContinue: () => void;
  onBack: () => void;
  submitting?: boolean;
};

const MIN_CALORIE_ADJUSTMENT = 0.1;
const MAX_CALORIE_ADJUSTMENT = 0.5;

export default function Step2Preferences({
  form,
  setForm,
  errors,
  setErrors,
  onContinue,
  onBack,
  submitting = false,
}: Props) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  const disabledPreferences = useMemo(() => {
    const blocked = new Set<Preference>();
    for (const selectedPreference of form.preferences ?? []) {
      for (const conflict of PREFERENCE_CONFLICTS[selectedPreference] ?? []) {
        blocked.add(conflict);
      }
    }
    return blocked;
  }, [form.preferences]);

  const calorieAdjustmentValue = form.calorieAdjustment ?? 0.2;
  const calorieAdjustmentError = errors.calorieAdjustment;
  const selectedPreferenceLabels = useMemo(
    () =>
      PREFERENCE_OPTIONS.filter((option) =>
        (form.preferences ?? []).includes(option.value),
      ).map((option) => t(option.labelKey)),
    [form.preferences, t],
  );

  return (
    <View style={styles.container} testID="onboarding-step-2">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("step2.title")}</Text>
          <Text style={styles.subtitle}>{t("step2.description")}</Text>
        </View>

        <View style={styles.panel}>
          <CheckboxDropdown
            testID="onboarding-preferences-dropdown"
            label={t("step2.preferencesLabel")}
            options={PREFERENCE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              disabled: disabledPreferences.has(option.value),
            }))}
            values={form.preferences}
            onChange={(nextPreferences) => {
              setForm((current) => ({
                ...current,
                preferences: nextPreferences as Preference[],
              }));
            }}
            disabledValues={[...disabledPreferences]}
            surfaceTone="soft"
          />
          {selectedPreferenceLabels.length > 0 ? (
            <View style={styles.selectedPreferenceRow}>
              {selectedPreferenceLabels.map((label) => (
                <View key={label} style={styles.selectedPreferenceTag}>
                  <Text style={styles.selectedPreferenceText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>{t("step2.preferencesHelper")}</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Dropdown
            testID="onboarding-activity-dropdown"
            label={t("step2.activityLabel")}
            options={ACTIVITY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            value={form.activityLevel || null}
            onChange={(nextActivityLevel) => {
              if (!nextActivityLevel) return;
              setForm((current) => ({
                ...current,
                activityLevel: nextActivityLevel,
              }));
              setErrors((current) => ({
                ...current,
                activityLevel: undefined,
              }));
            }}
            error={errors.activityLevel}
            surfaceTone="soft"
          />
          {form.activityLevel ? (
            <Text style={styles.helperText}>
              {
                t(
                  ACTIVITY_OPTIONS.find((option) => option.value === form.activityLevel)
                    ?.descriptionKey ?? "activity.moderate",
                )
              }
            </Text>
          ) : null}
        </View>

        <View style={styles.panel}>
          <RowPicker
            testID="onboarding-goal-picker"
            label={t("step2.goalLabel")}
            options={GOAL_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              testID: `onboarding-goal-${option.value}`,
            }))}
            value={form.goal || null}
            onChange={(nextGoal) => {
              setForm((current) => ({
                ...current,
                goal: nextGoal,
                calorieAdjustment: current.calorieAdjustment ?? 0.2,
              }));
              setErrors((current) => ({
                ...current,
                goal: undefined,
                calorieAdjustment: undefined,
              }));
            }}
            error={errors.goal}
            size="compact"
            surfaceTone="soft"
          />
          {form.goal ? (
            <Text style={styles.helperText}>
              {
                t(
                  GOAL_OPTIONS.find((option) => option.value === form.goal)
                    ?.descriptionKey ?? "goalDescription.maintain",
                )
              }
            </Text>
          ) : null}

          {form.goal && form.goal !== "maintain" ? (
            <View style={styles.adjustmentWrap}>
              <Text style={styles.adjustmentLabel}>
                {t("step2.calorieAdjustmentLabel", {
                  percentage: Math.round(calorieAdjustmentValue * 100),
                })}
              </Text>
              <Text style={styles.adjustmentHelper}>
                {form.goal === "increase"
                  ? t("step2.calorieIncreaseHelper")
                  : t("step2.calorieDecreaseHelper")}
              </Text>
              <Slider
                testID="onboarding-calorie-adjustment-slider"
                value={calorieAdjustmentValue}
                minimumValue={MIN_CALORIE_ADJUSTMENT}
                maximumValue={MAX_CALORIE_ADJUSTMENT}
                step={0.01}
                onValueChange={(nextValue) => {
                  setForm((current) => ({
                    ...current,
                    calorieAdjustment:
                      current.goal === "lose" || current.goal === "increase"
                        ? nextValue
                        : current.calorieAdjustment,
                  }));
                  setErrors((current) => ({
                    ...current,
                    calorieAdjustment: undefined,
                  }));
                }}
              />
              {calorieAdjustmentError ? (
                <Text style={styles.errorText}>{calorieAdjustmentError}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomActionBar
        placement="docked"
        bottomInset={footerBottomInset}
        horizontalPadding={theme.spacing.screenPadding}
        horizontalBleed={theme.spacing.screenPadding}
        actionsLayout="row"
        secondaryAction={{
          testID: "onboarding-step-2-back-button",
          label: t("common:back"),
          onPress: onBack,
          variant: "secondary",
        }}
        primaryAction={{
          testID: "onboarding-step-2-next-button",
          label: t("step2.primaryCta"),
          onPress: onContinue,
          loading: submitting,
        }}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) => {
  const material = createOnboardingMaterialStyles(theme);

  return StyleSheet.create({
    ...material,
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    header: {
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
    },
    panel: {
      ...material.panel,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    helperText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    selectedPreferenceRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    selectedPreferenceTag: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(137, 162, 132, 0.38)"
        : "rgba(111, 138, 105, 0.26)",
      backgroundColor: theme.isDark
        ? "rgba(137, 162, 132, 0.14)"
        : "rgba(111, 138, 105, 0.11)",
    },
    selectedPreferenceText: {
      color: theme.isDark ? theme.primaryStrong : theme.primary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    adjustmentWrap: {
      padding: theme.spacing.sm,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(207, 197, 184, 0.44)",
      backgroundColor: theme.isDark
        ? "rgba(30, 35, 30, 0.56)"
        : "rgba(239, 231, 218, 0.26)",
      gap: theme.spacing.sm,
    },
    adjustmentLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    adjustmentHelper: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    errorText: {
      color: theme.error.text,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
};
