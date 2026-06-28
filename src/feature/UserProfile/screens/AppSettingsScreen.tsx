import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { useAppSettingsContext } from "@/context/AppSettingsContext";
import {
  FormScreenShell,
  InfoBlock,
  SettingsRow,
  SettingsSection,
  ButtonToggle,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { LanguagePickerSheet } from "@/feature/UserProfile/components/LanguagePickerSheet";
import { isRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";

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
  const smartMemoryEnabled = isRuntimeFeatureEnabled("smartMemory");

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
        onBack={handleBack}
      >
        <View style={styles.content}>
          <InfoBlock
            title={t("appSettingsInfoTitle", {
              defaultValue: "App preferences",
            })}
            body={t("appSettingsInfoBody", {
              defaultValue:
                "These settings apply to how Fitaly looks and how it sends reminders on this device.",
            })}
            tone="neutral"
            style={styles.infoBlock}
            icon={
              <AppIcon name="settings" size={18} color={theme.textSecondary} />
            }
          />

          <SettingsSection
            title={t("appearanceSectionTitle", {
              defaultValue: "Appearance",
            })}
            contentStyle={styles.sectionGroup}
          >
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon name="palette" size={20} color={theme.primaryStrong} />
                </View>
              }
              title={t("toggleDarkMode")}
              subtitle={t("darkModeSubtitle")}
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
            contentStyle={styles.sectionGroup}
          >
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon name="text" size={20} color={theme.primaryStrong} />
                </View>
              }
              title={t("language")}
              subtitle={t("languageSubtitle")}
              value={getLanguageLabel(language)}
              testID="app-settings-language-row"
              onPress={() => setLanguageSheetVisible(true)}
            />
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon
                    name="notification"
                    size={20}
                    color={theme.accentWarmStrong}
                  />
                </View>
              }
              title={t("manageNotifications")}
              subtitle={t("notificationsSubtitle")}
              testID="app-settings-notifications-row"
              onPress={() => navigation.navigate("Notifications")}
            />
            {smartMemoryEnabled ? (
              <SettingsRow
                leading={
                  <View style={styles.rowIcon}>
                    <AppIcon
                      name="sparkles"
                      size={20}
                      color={theme.primaryStrong}
                    />
                  </View>
                }
                title={t("memoryCenter.rowTitle")}
                subtitle={t("memoryCenter.rowSubtitle")}
                subtitleNumberOfLines={2}
                testID="app-settings-memory-center-row"
                accessibilityHint={t("memoryCenter.rowHint")}
                onPress={() => navigation.navigate("MemoryCenter")}
              />
            ) : null}
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
    infoBlock: {
      ...theme.depth.raised,
    },
    sectionGroup: {
      ...theme.depth.raised,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
  });
