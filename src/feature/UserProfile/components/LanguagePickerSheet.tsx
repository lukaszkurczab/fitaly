import { useMemo, useState } from "react";
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type LanguagePickerSheetProps = {
  visible: boolean;
  currentLanguage: string | null | undefined;
  onClose: () => void;
  onChangeLanguage: (code: string) => Promise<void>;
};

type LanguageOption = {
  code: "en" | "pl";
  label: string;
};

const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
];

export function LanguagePickerSheet({
  visible,
  currentLanguage,
  onClose,
  onChangeLanguage,
}: LanguagePickerSheetProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const handleSelect = async (code: string) => {
    if (savingCode) return;
    if (code === currentLanguage) {
      onClose();
      return;
    }

    setSavingCode(code);

    try {
      await onChangeLanguage(code);
      onClose();
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("closeLanguagePicker", {
            defaultValue: "Close language picker",
          })}
        />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>
            {t("language", { defaultValue: "Language" })}
          </Text>
          <Text style={styles.intro}>
            {t("languageScreenIntro", {
              defaultValue:
                "Choose the language used across your account and the rest of the app.",
            })}
          </Text>

          <SettingsSection
            title={t("languageOptionsTitle", {
              defaultValue: "Available languages",
            })}
          >
            {LANGUAGES.map((option) => {
              const selected = option.code === currentLanguage;
              const saving = savingCode === option.code;

              return (
                <SettingsRow
                  key={option.code}
                  title={option.label}
                  subtitle={
                    selected
                      ? t("languageCurrentLabel", {
                          defaultValue: "Current language",
                        })
                      : undefined
                  }
                  testID={`language-option-${option.code}`}
                  onPress={() => {
                    void handleSelect(option.code);
                  }}
                  loading={saving}
                  showChevron={false}
                  trailing={
                    selected && !saving ? (
                      <AppIcon
                        name="check"
                        size={18}
                        color={theme.primary}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </SettingsSection>
        </View>
      </View>
    </RNModal>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.48)"
        : "rgba(47, 49, 43, 0.34)",
    },
    sheet: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.screenPadding,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.background,
      borderTopLeftRadius: theme.rounded.xl,
      borderTopRightRadius: theme.rounded.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
    },
    intro: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
  });

export default LanguagePickerSheet;
