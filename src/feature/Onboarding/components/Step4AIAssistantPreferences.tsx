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
import { BottomActionBar } from "@/components/BottomActionBar";
import { useTheme } from "@/theme/useTheme";
import {
  AI_PERSONA_OPTIONS,
} from "@/feature/Onboarding/constants";
import type { OnboardingFormData } from "@/feature/Onboarding/types";
import { createOnboardingMaterialStyles } from "@/feature/Onboarding/components/onboardingMaterial";
import type { AiPersona } from "@/types";

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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const selectedPersona = form.aiPersona ?? "calm_guide";
  const toneOptions = useMemo(
    () =>
      AI_PERSONA_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
        description: t(option.descriptionKey),
      })),
    [t],
  );
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const handlePersonaPress = (nextPersona: AiPersona) => {
    setForm((current) => ({
      ...current,
      aiPersona: nextPersona,
    }));
  };

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
          <View style={styles.toneList}>
            {toneOptions.map((option) => {
              const selected = option.value === selectedPersona;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected, selected }}
                  onPress={() => handlePersonaPress(option.value)}
                  testID={`onboarding-ai-persona-${option.value}`}
                  style={({ pressed }) => [
                    styles.toneCard,
                    selected ? styles.toneCardSelected : null,
                    pressed ? styles.toneCardPressed : null,
                  ]}
                >
                  <View style={styles.toneBody}>
                    <Text
                      style={[
                        styles.toneTitle,
                        selected ? styles.toneTitleSelected : null,
                      ]}
                    >
                      {option.label}
                    </Text>

                    <Text
                      style={[
                        styles.toneDescription,
                        selected ? styles.toneDescriptionSelected : null,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <BottomActionBar
        placement="docked"
        bottomInset={footerBottomInset}
        horizontalPadding={theme.spacing.screenPadding}
        horizontalBleed={theme.spacing.screenPadding}
        actionsLayout="row"
        secondaryAction={{
          testID: "onboarding-step-4-back-button",
          label: t("common:back"),
          onPress: onBack,
          variant: "secondary",
        }}
        primaryAction={{
          testID: "onboarding-step-4-submit-button",
          label: t("step4.primaryCta"),
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
    toneList: {
      gap: theme.spacing.xs,
    },
    toneCard: {
      minHeight: 76,
      flexDirection: "row",
      overflow: "hidden",
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.12)"
        : "rgba(207, 197, 184, 0.62)",
      backgroundColor: theme.isDark
        ? "rgba(30, 35, 30, 0.66)"
        : "rgba(255, 253, 248, 0.66)",
      shadowOpacity: 0,
      elevation: 0,
    },
    toneCardSelected: {
      borderColor: theme.isDark
        ? "rgba(166, 189, 160, 0.58)"
        : "rgba(79, 104, 75, 0.40)",
      backgroundColor: theme.isDark
        ? "rgba(137, 162, 132, 0.18)"
        : "rgba(111, 138, 105, 0.11)",
    },
    toneCardPressed: {
      opacity: 0.9,
    },
    toneBody: {
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.xxs,
    },
    toneTitle: {
      flex: 1,
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    toneTitleSelected: {
      color: theme.isDark ? theme.primaryStrong : theme.primaryStrong,
    },
    toneDescription: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    toneDescriptionSelected: {
      color: theme.isDark ? theme.text : theme.textSecondary,
    },
    disclaimer: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
};
