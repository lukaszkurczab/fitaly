import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { useAppSettingsContext } from "@/context/AppSettingsContext";
import {
  FormScreenShell,
  SettingsRow,
  SettingsSection,
  ButtonToggle,
} from "@/components";
import { LanguagePickerSheet } from "@/feature/UserProfile/components/LanguagePickerSheet";

type AppSettingsNavigation = StackNavigationProp<
  RootStackParamList,
  "AppSettings"
>;

type AppSettingsScreenProps = {
  navigation: AppSettingsNavigation;
};

function getLanguageLabel(language: string | null | undefined): string {
  if (language === "pl") return "Polski";
  return "English";
}

export default function AppSettingsScreen({
  navigation,
}: AppSettingsScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { language, changeLanguage } = useAppSettingsContext();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Profile");
  };

  return (
    <>
      <FormScreenShell
        testID="app-settings-screen"
        title={t("appSettingsTitle", { defaultValue: "App settings" })}
        intro={t("appSettingsIntro", {
          defaultValue:
            "Manage app-level preferences like appearance, language, and notification settings.",
        })}
        onBack={handleBack}
      >
        <View style={styles.content}>
          <SettingsSection
            title={t("appearanceSectionTitle", {
              defaultValue: "Appearance",
            })}
          >
            <SettingsRow
              title={t("toggleDarkMode")}
              trailing={
                <ButtonToggle
                  testID="app-settings-dark-mode-toggle"
                  value={theme.mode === "dark"}
                  onToggle={(newValue) => {
                    theme.setMode(newValue ? "dark" : "light");
                  }}
                  accessibilityLabel={t("toggleDarkMode")}
                />
              }
            />
          </SettingsSection>

          <SettingsSection
            title={t("preferencesSectionTitle", {
              defaultValue: "Preferences",
            })}
          >
            <SettingsRow
              title={t("language")}
              value={getLanguageLabel(language)}
              testID="app-settings-language-row"
              onPress={() => setLanguageSheetVisible(true)}
            />
            <SettingsRow
              title={t("manageNotifications")}
              testID="app-settings-notifications-row"
              onPress={() => navigation.navigate("Notifications")}
            />
          </SettingsSection>
        </View>
      </FormScreenShell>

      <LanguagePickerSheet
        visible={languageSheetVisible}
        currentLanguage={language}
        onClose={() => setLanguageSheetVisible(false)}
        onChangeLanguage={changeLanguage}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
  });
