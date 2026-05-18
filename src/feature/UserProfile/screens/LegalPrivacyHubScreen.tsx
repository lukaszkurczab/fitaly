import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  FormScreenShell,
  Modal,
  SettingsRow,
  SettingsSection,
} from "@/components";
import { useUserAccountContext } from "@/context/UserAccountContext";
import { getTermsUrl } from "@/utils/legalUrls";

type LegalPrivacyHubNavigation = StackNavigationProp<
  RootStackParamList,
  "LegalPrivacyHub"
>;

type LegalPrivacyHubScreenProps = {
  navigation: LegalPrivacyHubNavigation;
};

export default function LegalPrivacyHubScreen({
  navigation,
}: LegalPrivacyHubScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { exportUserData } = useUserAccountContext();
  const [exporting, setExporting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const termsUrl = getTermsUrl();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Profile");
  };

  const handleOpenTerms = async () => {
    if (termsUrl) {
      await Linking.openURL(termsUrl);
      return;
    }

    navigation.navigate("Terms");
  };

  const handleExportData = async () => {
    setExporting(true);

    try {
      const fileUri = await exportUserData();
      const outputPath = typeof fileUri === "string" ? fileUri : "";
      const fileName = outputPath.split("/").pop() ?? "fitaly_user_data.pdf";

      setModalTitle(t("downloadYourData"));
      setModalMessage(
        `${t("exportSavedSuccess", { filename: fileName })}\n${t(
          "exportSavedPathHint",
          { path: outputPath || "-" },
        )}`,
      );
    } catch {
      setModalTitle(t("downloadYourData"));
      setModalMessage(t("exportError"));
    } finally {
      setExporting(false);
      setModalVisible(true);
    }
  };

  return (
    <>
      <FormScreenShell
        testID="legal-privacy-screen"
        title={t("legalPrivacyHubTitle", {
          defaultValue: "Legal & privacy",
        })}
        intro={t("legalPrivacyHubIntro", {
          defaultValue:
            "Review the documents and plain-language summaries that explain how Fitaly handles your account, data, and AI features.",
        })}
        onBack={handleBack}
      >
        <View style={styles.content}>
          <SettingsSection
            title={t("legalPrivacyDocumentsTitle", {
              defaultValue: "Legal documents",
            })}
          >
            <SettingsRow
              title={t("privacyPolicy")}
              testID="legal-privacy-policy-row"
              onPress={() => navigation.navigate("Privacy")}
            />
            <SettingsRow
              title={t("termsOfService")}
              testID="legal-terms-row"
              onPress={() => {
                void handleOpenTerms();
              }}
            />
          </SettingsSection>

          <SettingsSection
            title={t("legalPrivacyDataTitle", {
              defaultValue: "Data transparency",
            })}
          >
            <SettingsRow
              title={t("dataAiClarityTitle", {
                defaultValue: "Data & AI clarity",
              })}
              testID="legal-data-ai-row"
              onPress={() => navigation.navigate("DataAiClarity")}
            />
            <SettingsRow
              title={t("downloadYourData")}
              onPress={() => {
                void handleExportData();
              }}
              disabled={exporting}
              loading={exporting}
              showChevron={false}
            />
          </SettingsSection>
        </View>
      </FormScreenShell>

      <Modal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
        primaryAction={{
          label: t("close", { ns: "common", defaultValue: "Close" }),
          onPress: () => setModalVisible(false),
        }}
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
