import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { FormScreenShell, SettingsRow, SettingsSection } from "@/components";

type HelpFeedbackNavigation = StackNavigationProp<
  RootStackParamList,
  "HelpFeedback"
>;

type HelpFeedbackHubScreenProps = {
  navigation: HelpFeedbackNavigation;
};

export default function HelpFeedbackHubScreen({
  navigation,
}: HelpFeedbackHubScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Profile");
  };

  return (
    <FormScreenShell
      testID="help-feedback-screen"
      title={t("helpFeedbackHubTitle", {
        defaultValue: "Help & feedback",
      })}
      intro={t("helpFeedbackHubIntro", {
        defaultValue:
          "Choose the path that best matches what you need: support for account or technical issues, and feedback for product ideas or bug reports.",
      })}
      onBack={handleBack}
    >
      <View style={styles.content}>
        <SettingsSection
          title={t("helpFeedbackHubSectionTitle", {
            defaultValue: "Get help",
          })}
        >
          <SettingsRow
            title={t("contactSupportTitle", {
              defaultValue: "Contact support",
            })}
            testID="help-contact-support-row"
            onPress={() => navigation.navigate("ContactSupport")}
          />
          <SettingsRow
            title={t("sendFeedback")}
            testID="help-send-feedback-row"
            onPress={() => navigation.navigate("SendFeedback")}
          />
        </SettingsSection>
      </View>
    </FormScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
  });
