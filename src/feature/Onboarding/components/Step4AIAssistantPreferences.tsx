import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  GlobalActionButtons,
  SelectableGroup,
} from "@/components";
import { useTheme } from "@/theme/useTheme";
import {
  AI_PERSONA_OPTIONS,
} from "@/feature/Onboarding/constants";
import type { OnboardingFormData } from "@/feature/Onboarding/types";

type Props = {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  onContinue: () => void;
  onBack: () => void;
  submitting?: boolean;
};

export default function Step4AIAssistantPreferences({
  form,
  setForm,
  onContinue,
  onBack,
  submitting = false,
}: Props) {
  const { t } = useTranslation("onboarding");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  return (
    <View style={styles.container} testID="onboarding-step-4">
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
          <Text style={styles.title}>{t("step4.title")}</Text>
          <Text style={styles.subtitle}>{t("step4.description")}</Text>
        </View>

        <View style={styles.panel}>
          <SelectableGroup
            label={t("step4.toneLabel")}
            options={AI_PERSONA_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              description: t(option.descriptionKey),
            }))}
            value={form.aiPersona ?? "calm_guide"}
            onChange={(nextPersona) => {
              setForm((current) => ({
                ...current,
                aiPersona: nextPersona,
              }));
            }}
            variant="card"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GlobalActionButtons
          primaryTestID="onboarding-step-4-submit-button"
          label={t("step4.primaryCta")}
          onPress={onContinue}
          loading={submitting}
          secondaryLabel={t("common:back")}
          secondaryOnPress={onBack}
          secondaryTestID="onboarding-step-4-back-button"
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
      gap: theme.spacing.md,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.16 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    disclaimer: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    footer: {
      paddingTop: theme.spacing.md,
    },
  });
