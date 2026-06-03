import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  FormScreenShell,
  InfoBlock,
  Modal,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";
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
        onBack={handleBack}
      >
        <View style={styles.content}>
          <InfoBlock
            title={t("legalPrivacyHubInfoTitle", {
              defaultValue: "Privacy & documents",
            })}
            body={t("legalPrivacyHubInfoBody", {
              defaultValue:
                "Use these screens for the current legal documents, data-use summary, and account-data export actions.",
            })}
            tone="neutral"
            style={styles.infoBlock}
            icon={<AppIcon name="lock" size={18} color={theme.textSecondary} />}
          />

          <SettingsSection
            title={t("legalPrivacyDocumentsTitle", {
              defaultValue: "Legal documents",
            })}
            contentStyle={styles.sectionGroup}
          >
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon name="lock" size={20} color={theme.primaryStrong} />
                </View>
              }
              title={t("privacyPolicy")}
              subtitle={t("privacyPolicySubtitle")}
              subtitleNumberOfLines={3}
              testID="legal-privacy-policy-row"
              onPress={() => navigation.navigate("Privacy")}
            />
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon
                    name="document"
                    size={20}
                    color={theme.primaryStrong}
                  />
                </View>
              }
              title={t("termsOfService")}
              subtitle={t("termsOfServiceSubtitle")}
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
            contentStyle={styles.sectionGroup}
          >
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon
                    name="assistant"
                    size={20}
                    color={theme.accentWarmStrong}
                  />
                </View>
              }
              title={t("dataAiClarityTitle", {
                defaultValue: "Data & AI clarity",
              })}
              subtitle={t("dataAiClaritySubtitle")}
              subtitleNumberOfLines={3}
              testID="legal-data-ai-row"
              onPress={() => navigation.navigate("DataAiClarity")}
            />
            <SettingsRow
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon
                    name="download"
                    size={20}
                    color={theme.primaryStrong}
                  />
                </View>
              }
              title={t("downloadYourData")}
              subtitle={t("downloadYourDataSubtitle")}
              testID="legal-download-data-row"
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
