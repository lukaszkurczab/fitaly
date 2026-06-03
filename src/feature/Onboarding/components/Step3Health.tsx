import { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomActionBar,
  TextInput,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import {
  ALLERGY_OPTIONS,
  CHRONIC_DISEASE_OPTIONS,
} from "@/feature/Onboarding/constants";
import { createOnboardingMaterialStyles } from "@/feature/Onboarding/components/onboardingMaterial";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import type { Allergy, ChronicDisease } from "@/types";

type HealthChipOption<T extends string> = {
  value: T;
  label: string;
  testID?: string;
};

type HealthChipGroupProps<T extends string> = {
  label: string;
  helperText: string;
  options: HealthChipOption<T>[];
  values: T[];
  onChange: (value: T) => void;
};

function HealthChipGroup<T extends string>({
  label,
  helperText,
  options,
  values,
  onChange,
}: HealthChipGroupProps<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeChipStyles(theme), [theme]);

  return (
    <View>
      <Text style={styles.groupLabel}>{label}</Text>
      <Text style={styles.groupHelper}>{helperText}</Text>

      <View style={styles.chipWrap}>
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(option.value)}
              testID={option.testID}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                pressed ? styles.chipPressed : null,
              ]}
            >
              {selected ? (
                <View style={styles.checkMark}>
                  <AppIcon
                    name="check"
                    size={12}
                    color={theme.isDark ? theme.text : theme.textInverse}
                  />
                </View>
              ) : null}
              <Text
                style={[styles.chipText, selected ? styles.chipTextSelected : null]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
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
  const conditionOptions = useMemo(
    () =>
      CHRONIC_DISEASE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
        testID: `onboarding-condition-${option.value}`,
      })),
    [t],
  );
  const allergyOptions = useMemo(
    () =>
      ALLERGY_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
        testID: `onboarding-allergy-${option.value}`,
      })),
    [t],
  );

  const toggleChronicDisease = (nextValue: ChronicDisease) => {
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
  };

  const toggleAllergy = (nextValue: Allergy) => {
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
  };

  return (
    <View style={styles.container} testID="onboarding-step-3">
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
          <HealthChipGroup
            label={t("step3.conditionsLabel")}
            helperText={t("step3.conditionsHelper")}
            options={conditionOptions}
            values={form.chronicDiseases ?? []}
            onChange={toggleChronicDisease}
          />

          {hasChronicOther ? (
            <TextInput
              testID="onboarding-conditions-other-input"
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
              fieldStyle={styles.inputField}
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <HealthChipGroup
            label={t("step3.allergiesLabel")}
            helperText={t("step3.allergiesHelper")}
            options={allergyOptions}
            values={form.allergies ?? []}
            onChange={toggleAllergy}
          />

          {hasAllergyOther ? (
            <TextInput
              testID="onboarding-allergies-other-input"
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
              fieldStyle={styles.inputField}
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <TextInput
            testID="onboarding-lifestyle-notes-input"
            label={t("step3.notesLabel")}
            value={form.lifestyle ?? ""}
            onChangeText={(nextValue) => {
              setForm((current) => ({
                ...current,
                lifestyle: nextValue,
              }));
            }}
            placeholder={t("step3.notesPlaceholder")}
            multiline
            maxLength={220}
            numberOfLines={2}
            inputStyle={styles.notesInput}
            fieldStyle={styles.notesField}
            autoCapitalize="sentences"
            autoCorrect
          />
        </View>
      </ScrollView>

      <BottomActionBar
        placement="docked"
        bottomInset={footerBottomInset}
        horizontalPadding={theme.spacing.screenPadding}
        horizontalBleed={theme.spacing.screenPadding}
        actionsLayout="row"
        linkAction={
          hasHealthInput
            ? {
                testID: "onboarding-step-3-skip-button",
                label: t("step3.skipCta"),
                onPress: onSkip,
                disabled: submitting,
              }
            : undefined
        }
        secondaryAction={{
          testID: "onboarding-step-3-back-button",
          label: t("common:back"),
          onPress: onBack,
          variant: "secondary",
        }}
        primaryAction={{
          testID:
            hasHealthInput
              ? "onboarding-step-3-next-button"
              : "onboarding-step-3-skip-button",
          label: hasHealthInput ? t("step3.primaryCta") : t("step3.skipCta"),
          onPress: hasHealthInput ? onContinue : onSkip,
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
    optionalBadge: {
      ...material.optionalBadge,
    },
    optionalBadgeText: {
      ...material.optionalBadgeText,
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
      gap: theme.spacing.md,
    },
    notesInput: {
      minHeight: 58,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    notesField: {
      ...material.inputField,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.10)"
        : "rgba(207, 197, 184, 0.58)",
      backgroundColor: theme.isDark
        ? "rgba(30, 35, 30, 0.68)"
        : "rgba(255, 253, 248, 0.64)",
    },
  });
};

const makeChipStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    groupLabel: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    groupHelper: {
      marginTop: theme.spacing.xxs,
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    chip: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.rounded.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.12)"
        : "rgba(207, 197, 184, 0.62)",
      backgroundColor: theme.isDark
        ? "rgba(30, 35, 30, 0.66)"
        : "rgba(255, 253, 248, 0.60)",
    },
    chipSelected: {
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.52)"
        : "rgba(79, 104, 75, 0.38)",
      backgroundColor: theme.isDark
        ? "rgba(137, 162, 132, 0.20)"
        : "rgba(111, 138, 105, 0.14)",
    },
    chipPressed: {
      opacity: 0.86,
    },
    checkMark: {
      width: 18,
      height: 18,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark ? theme.primarySoft : theme.primary,
    },
    chipText: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipTextSelected: {
      color: theme.isDark ? theme.primaryStrong : theme.primaryStrong,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
