import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  GlobalActionButtons,
  LongTextInput,
  SelectableGroup,
  TextInput,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import {
  ALLERGY_OPTIONS,
  CHRONIC_DISEASE_OPTIONS,
} from "@/feature/Onboarding/constants";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import type { Allergy, ChronicDisease } from "@/types";

type Props = {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  errors: Partial<
    Record<
      keyof OnboardingFormData | "chronicDiseasesOther" | "allergiesOther",
      string
    >
  >;
  setErrors: React.Dispatch<
    React.SetStateAction<
      Partial<
        Record<
          keyof OnboardingFormData | "chronicDiseasesOther" | "allergiesOther",
          string
        >
      >
    >
  >;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
  submitting?: boolean;
};

export default function Step3Health({
  form,
  setForm,
  errors,
  setErrors,
  onContinue,
  onBack,
  onSkip,
  submitting = false,
}: Props) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  const hasChronicOther = (form.chronicDiseases ?? []).includes("other");
  const hasAllergyOther = (form.allergies ?? []).includes("other");
  const hasHealthInput =
    (form.chronicDiseases?.length ?? 0) > 0 ||
    !!form.chronicDiseasesOther?.trim() ||
    (form.allergies?.length ?? 0) > 0 ||
    !!form.allergiesOther?.trim() ||
    !!form.lifestyle?.trim();

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
          <View style={styles.optionalBadge}>
            <Text style={styles.optionalBadgeText}>{t("optional")}</Text>
          </View>
          <Text style={styles.title}>{t("step3.title")}</Text>
          <Text style={styles.subtitle}>{t("step3.description")}</Text>
        </View>

        <View style={styles.panel}>
          <SelectableGroup
            label={t("step3.conditionsLabel")}
            options={CHRONIC_DISEASE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            values={form.chronicDiseases ?? []}
            onChange={(nextValue) => {
              setForm((current) => {
                const currentValues = current.chronicDiseases ?? [];
                const hasValue = currentValues.includes(nextValue);
                const nextValues = hasValue
                  ? currentValues.filter((item) => item !== nextValue)
                  : [...currentValues, nextValue];

                return {
                  ...current,
                  chronicDiseases: nextValues as ChronicDisease[],
                  chronicDiseasesOther: nextValues.includes("other")
                    ? (current.chronicDiseasesOther ?? "")
                    : "",
                };
              });
              setErrors((current) => ({
                ...current,
                chronicDiseasesOther: undefined,
              }));
            }}
            selectionMode="multiple"
            variant="chip"
          />

          {hasChronicOther ? (
            <TextInput
              label={t("step3.conditionsOtherLabel")}
              value={form.chronicDiseasesOther ?? ""}
              onChangeText={(nextValue) => {
                setForm((current) => ({
                  ...current,
                  chronicDiseasesOther: nextValue,
                }));
                setErrors((current) => ({
                  ...current,
                  chronicDiseasesOther: undefined,
                }));
              }}
              placeholder={t("healthProfile.disease.otherPlaceholder")}
              error={errors.chronicDiseasesOther}
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <SelectableGroup
            label={t("step3.allergiesLabel")}
            options={ALLERGY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            values={form.allergies ?? []}
            onChange={(nextValue) => {
              setForm((current) => {
                const currentValues = current.allergies ?? [];
                const hasValue = currentValues.includes(nextValue);
                const nextValues = hasValue
                  ? currentValues.filter((item) => item !== nextValue)
                  : [...currentValues, nextValue];

                return {
                  ...current,
                  allergies: nextValues as Allergy[],
                  allergiesOther: nextValues.includes("other")
                    ? (current.allergiesOther ?? "")
                    : "",
                };
              });
              setErrors((current) => ({
                ...current,
                allergiesOther: undefined,
              }));
            }}
            selectionMode="multiple"
            variant="chip"
          />

          {hasAllergyOther ? (
            <TextInput
              label={t("step3.allergiesOtherLabel")}
              value={form.allergiesOther ?? ""}
              onChangeText={(nextValue) => {
                setForm((current) => ({
                  ...current,
                  allergiesOther: nextValue,
                }));
                setErrors((current) => ({
                  ...current,
                  allergiesOther: undefined,
                }));
              }}
              placeholder={t("healthProfile.allergy.otherPlaceholder")}
              error={errors.allergiesOther}
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <LongTextInput
            label={t("step3.notesLabel")}
            value={form.lifestyle ?? ""}
            onChangeText={(nextValue) => {
              setForm((current) => ({
                ...current,
                lifestyle: nextValue,
              }));
            }}
            placeholder={t("step3.notesPlaceholder")}
            maxLength={220}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GlobalActionButtons
          label={hasHealthInput ? t("step3.primaryCta") : t("step3.skipCta")}
          onPress={hasHealthInput ? onContinue : onSkip}
          loading={submitting}
          secondaryLabel={t("common:back")}
          secondaryOnPress={onBack}
        />
      </View>
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
    optionalBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    optionalBadgeText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
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
    footer: {
      paddingTop: theme.spacing.md,
    },
  });
