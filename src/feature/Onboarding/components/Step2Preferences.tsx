import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  CheckboxDropdown,
  Dropdown,
  GlobalActionButtons,
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
  const styles = useMemo(() => makeStyles(theme), [theme]);
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

  return (
    <View style={styles.container}>
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
          />
          <Text style={styles.helperText}>{t("step2.preferencesHelper")}</Text>
        </View>

        <View style={styles.panel}>
          <Dropdown
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
            label={t("step2.goalLabel")}
            options={GOAL_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
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

      <GlobalActionButtons
        label={t("step2.primaryCta")}
        onPress={onContinue}
        loading={submitting}
        secondaryLabel={t("common:back")}
        secondaryOnPress={onBack}
        containerStyle={styles.footer}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.xl,
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
    },
    panel: {
      padding: theme.spacing.cardPaddingLarge,
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      gap: theme.spacing.lg,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.16 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    helperText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    adjustmentWrap: {
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
    footer: {
      paddingTop: theme.spacing.md,
    },
  });
