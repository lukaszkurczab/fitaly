import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { GlobalActionButtons, NumberInput, RowPicker } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from "@/utils/units";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import { SEX_OPTIONS, UNITS_OPTIONS } from "@/feature/Onboarding/constants";

type Props = {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  errors: Partial<Record<keyof OnboardingFormData, string>>;
  setErrors: React.Dispatch<
    React.SetStateAction<Partial<Record<keyof OnboardingFormData, string>>>
  >;
  onContinue: () => void;
  onSecondaryAction: () => void;
  showSecondaryAction?: boolean;
  submitting?: boolean;
};

function getString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export default function Step1BasicData({
  form,
  setForm,
  errors,
  setErrors,
  onContinue,
  onSecondaryAction,
  showSecondaryAction = true,
  submitting = false,
}: Props) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  const heightCm = Number(form.height || 0);
  const weightKg = Number(form.weight || 0);
  const { ft: displayFt, inch: displayInch } = heightCm
    ? cmToFtIn(heightCm)
    : { ft: 0, inch: 0 };
  const displayLbs = weightKg ? kgToLbs(weightKg) : 0;

  const clearError = (field: keyof OnboardingFormData) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleHeightFeetChange = (rawValue: string) => {
    const nextFeet = Number(rawValue.replace(/[^0-9]/g, "")) || 0;
    const nextInch = Number(getString(form.heightInch)) || 0;
    setForm((current) => ({
      ...current,
      height: String(ftInToCm(nextFeet, nextInch)),
      heightInch: String(nextInch),
    }));
    clearError("height");
  };

  const handleHeightInchChange = (rawValue: string) => {
    const nextInch = Number(rawValue.replace(/[^0-9]/g, "")) || 0;
    const nextFeet = displayFt || 0;
    setForm((current) => ({
      ...current,
      height: String(ftInToCm(nextFeet, nextInch)),
      heightInch: String(nextInch),
    }));
    clearError("heightInch");
  };

  const handleWeightLbsChange = (rawValue: string) => {
    const nextLbs = Number(rawValue.replace(/[^0-9]/g, "")) || 0;
    setForm((current) => ({
      ...current,
      weight: String(lbsToKg(nextLbs)),
    }));
    clearError("weight");
  };

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
          <Text style={styles.title}>{t("step1.title")}</Text>
          <Text style={styles.subtitle}>{t("step1.description")}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.topRow}>
            <RowPicker
              label={t("step1.unitsLabel")}
              options={UNITS_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={form.unitsSystem}
              onChange={(nextUnitsSystem) => {
                setForm((current) => ({
                  ...current,
                  unitsSystem: nextUnitsSystem,
                }));
              }}
              style={styles.topRowItem}
            />
          </View>

          <View style={styles.topRow}>
            <RowPicker
              label={t("step1.sexLabel")}
              options={SEX_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={form.sex}
              onChange={(nextSex) => {
                setForm((current) => ({
                  ...current,
                  sex: nextSex,
                }));
                clearError("sex");
              }}
              error={errors.sex}
              style={styles.topRowItem}
            />
          </View>

          <NumberInput
            label={t("age")}
            value={getString(form.age)}
            onChangeText={(nextAge) => {
              setForm((current) => ({
                ...current,
                age: nextAge,
              }));
              clearError("age");
            }}
            keyboardType="number-pad"
            maxDecimals={0}
            allowEmptyOnBlur
            error={errors.age}
            accessibilityLabel={t("age")}
            returnKeyType="done"
          />

          {form.unitsSystem === "metric" ? (
            <NumberInput
              label={t("height")}
              value={getString(form.height)}
              onChangeText={(nextHeight) => {
                setForm((current) => ({
                  ...current,
                  height: nextHeight,
                }));
                clearError("height");
              }}
              keyboardType="number-pad"
              maxDecimals={0}
              allowEmptyOnBlur
              rightLabel="cm"
              error={errors.height}
              accessibilityLabel={t("height")}
            />
          ) : (
            <View style={styles.row}>
              <NumberInput
                label={t("heightFt")}
                value={displayFt ? String(displayFt) : ""}
                onChangeText={handleHeightFeetChange}
                keyboardType="number-pad"
                maxDecimals={0}
                allowEmptyOnBlur
                rightLabel="ft"
                error={errors.height}
                accessibilityLabel={t("heightFt")}
                style={styles.rowItem}
              />
              <NumberInput
                label={t("heightIn")}
                value={String(displayInch || "")}
                onChangeText={handleHeightInchChange}
                keyboardType="number-pad"
                maxDecimals={0}
                allowEmptyOnBlur
                rightLabel="in"
                error={errors.heightInch}
                accessibilityLabel={t("heightIn")}
                style={styles.rowItem}
              />
            </View>
          )}

          <NumberInput
            label={t("weight")}
            value={
              form.unitsSystem === "metric"
                ? getString(form.weight)
                : displayLbs
                  ? String(displayLbs)
                  : ""
            }
            onChangeText={
              form.unitsSystem === "metric"
                ? (nextWeight) => {
                    setForm((current) => ({
                      ...current,
                      weight: nextWeight,
                    }));
                    clearError("weight");
                  }
                : handleWeightLbsChange
            }
            keyboardType="number-pad"
            maxDecimals={0}
            allowEmptyOnBlur
            rightLabel={form.unitsSystem === "metric" ? "kg" : "lb"}
            error={errors.weight}
            accessibilityLabel={t("weight")}
          />
        </View>
      </ScrollView>

      <GlobalActionButtons
        label={t("step1.primaryCta")}
        onPress={onContinue}
        loading={submitting}
        secondaryLabel={showSecondaryAction ? t("common:cancel") : undefined}
        secondaryOnPress={onSecondaryAction}
        secondaryTone="secondary"
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
      gap: theme.spacing.md,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.16 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    topRowItem: {
      flex: 1,
    },
    rowItem: {
      flex: 1,
    },
    footer: {
      paddingTop: theme.spacing.md,
    },
  });
