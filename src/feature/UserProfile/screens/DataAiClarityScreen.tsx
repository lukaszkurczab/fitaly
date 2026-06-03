import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
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
import type { AppIconName } from "@/components/AppIcon";
import { getTermsUrl } from "@/utils/legalUrls";

type DataAiClarityNavigation = StackNavigationProp<
  RootStackParamList,
  "DataAiClarity"
>;

type DataAiClarityScreenProps = {
  navigation: DataAiClarityNavigation;
};

type DetailTopicId =
  | "added-data"
  | "ai-use"
  | "account-record"
  | "controls"
  | "legal-docs";

type DetailBullet = {
  title: string;
  body: string;
};

type DetailTopic = {
  id: DetailTopicId;
  icon: AppIconName;
  iconTone: "primary" | "warm";
  title: string;
  summary: string;
  detailTitle: string;
  paragraphs: string[];
  bullets: DetailBullet[];
};

export default function DataAiClarityScreen({
  navigation,
}: DataAiClarityScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeTopicId, setActiveTopicId] = useState<DetailTopicId | null>(null);
  const termsUrl = getTermsUrl();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("LegalPrivacyHub");
  };

  const topics = useMemo<DetailTopic[]>(
    () => [
      {
        id: "added-data",
        icon: "person",
        iconTone: "primary",
        title: t("dataAiClarityAddedDataTitle", {
          defaultValue: "What data you add",
        }),
        summary: t("dataAiClarityAddedDataSummary", {
          defaultValue:
            "Profile, meals, and photos you choose to save or analyze.",
        }),
        detailTitle: t("dataAiClarityAddedDataDetailTitle", {
          defaultValue: "Data you add",
        }),
        paragraphs: [
          t("dataAiClarityAddedDataDetailIntro", {
            defaultValue:
              "Fitaly works from the account, profile, and meal information you provide in the app.",
          }),
        ],
        bullets: [
          {
            title: t("dataAiClarityAddedDataAccountTitle", {
              defaultValue: "Account and profile",
            }),
            body: t("dataAiClarityAddedDataAccountBody", {
              defaultValue:
                "Email address, username, health profile fields, nutrition goal, and preferences you enter.",
            }),
          },
          {
            title: t("dataAiClarityAddedDataMealsTitle", {
              defaultValue: "Meals and photos",
            }),
            body: t("dataAiClarityAddedDataMealsBody", {
              defaultValue:
                "Meal history, nutrition entries, saved meals, and photos you upload for logging or analysis.",
            }),
          },
        ],
      },
      {
        id: "ai-use",
        icon: "assistant",
        iconTone: "warm",
        title: t("dataAiClarityAiUseTitle", {
          defaultValue: "Where AI is used",
        }),
        summary: t("dataAiClarityAiUseSummary", {
          defaultValue:
            "Photo analysis, text meal logging, and chat when you choose them.",
        }),
        detailTitle: t("dataAiClarityAiUseDetailTitle", {
          defaultValue: "AI in Fitaly",
        }),
        paragraphs: [
          t("dataAiClarityAiUseDetailIntro", {
            defaultValue:
              "AI is used for specific actions you start. It supports logging and guidance; it is not a background monitoring system.",
          }),
          t("dataAiClarityAiUseDetailProvider", {
            defaultValue:
              "Requests go through Fitaly’s backend to the configured model provider for the feature you requested.",
          }),
        ],
        bullets: [
          {
            title: t("dataAiClarityAiUsePhotoTitle", {
              defaultValue: "Photo analysis",
            }),
            body: t("dataAiClarityAiUsePhotoBody", {
              defaultValue:
                "Meal photos can be analyzed to estimate ingredients and nutrition values.",
            }),
          },
          {
            title: t("dataAiClarityAiUseTextTitle", {
              defaultValue: "Text and chat",
            }),
            body: t("dataAiClarityAiUseTextBody", {
              defaultValue:
                "Meal descriptions and nutrition questions can use relevant account or meal context to generate a response.",
            }),
          },
        ],
      },
      {
        id: "account-record",
        icon: "saved-items",
        iconTone: "primary",
        title: t("dataAiClarityAccountRecordTitle", {
          defaultValue: "What stays on account",
        }),
        summary: t("dataAiClarityAccountRecordSummary", {
          defaultValue:
            "Meals, profile, preferences, and account history remain saved.",
        }),
        detailTitle: t("dataAiClarityAccountRecordDetailTitle", {
          defaultValue: "Account record",
        }),
        paragraphs: [
          t("dataAiClarityAccountRecordDetailIntro", {
            defaultValue:
              "Fitaly keeps the data needed to run your account, restore your history, and sync your app experience.",
          }),
        ],
        bullets: [
          {
            title: t("dataAiClarityAccountRecordStoredTitle", {
              defaultValue: "Stored app data",
            }),
            body: t("dataAiClarityAccountRecordStoredBody", {
              defaultValue:
                "Meal history, saved meals, profile settings, subscription-related state, and app preferences.",
            }),
          },
          {
            title: t("dataAiClarityAccountRecordAnalyticsTitle", {
              defaultValue: "Service and analytics data",
            }),
            body: t("dataAiClarityAccountRecordAnalyticsBody", {
              defaultValue:
                "Firebase supports authentication, database storage, analytics, and app reliability.",
            }),
          },
        ],
      },
      {
        id: "controls",
        icon: "settings",
        iconTone: "primary",
        title: t("dataAiClarityControlsShortTitle", {
          defaultValue: "What you can control",
        }),
        summary: t("dataAiClarityControlsShortSummary", {
          defaultValue:
            "Data export, settings, and account deletion stay in your control.",
        }),
        detailTitle: t("dataAiClarityControlsDetailTitle", {
          defaultValue: "Your controls",
        }),
        paragraphs: [
          t("dataAiClarityControlsDetailIntro", {
            defaultValue:
              "These controls do not change in this screen. It only explains where to find them.",
          }),
        ],
        bullets: [
          {
            title: t("dataAiClarityControlsExportTitle", {
              defaultValue: "Download your data",
            }),
            body: t("dataAiClarityControlsExportBody", {
              defaultValue:
                "You can export a copy of your account data from Legal & privacy.",
            }),
          },
          {
            title: t("dataAiClarityControlsDeleteTitle", {
              defaultValue: "Delete account",
            }),
            body: t("dataAiClarityControlsDeleteBody", {
              defaultValue:
                "You can permanently delete your account and saved data from the account area.",
            }),
          },
        ],
      },
      {
        id: "legal-docs",
        icon: "lock",
        iconTone: "primary",
        title: t("dataAiClarityLegalDocsTitle", {
          defaultValue: "Legal documents",
        }),
        summary: t("dataAiClarityLegalDocsSummary", {
          defaultValue:
            "Open the full Privacy Policy and Terms.",
        }),
        detailTitle: t("dataAiClarityLegalDocsDetailTitle", {
          defaultValue: "Full legal documents",
        }),
        paragraphs: [
          t("dataAiClarityLegalDocsDetailIntro", {
            defaultValue:
              "This screen is a practical summary. The full documents remain the source for legal wording, rights, safeguards, and contact details.",
          }),
        ],
        bullets: [],
      },
    ],
    [t],
  );
  const activeTopic =
    topics.find((topic) => topic.id === activeTopicId) ?? null;

  const closeDetail = () => setActiveTopicId(null);

  const openPrivacyPolicy = () => {
    closeDetail();
    navigation.navigate("Privacy");
  };

  const openTerms = async () => {
    closeDetail();

    if (termsUrl) {
      await Linking.openURL(termsUrl);
      return;
    }

    navigation.navigate("Terms");
  };

  return (
    <>
      <FormScreenShell
        testID="data-ai-clarity-screen"
        title={t("dataAiClarityTitle", {
          defaultValue: "Data & AI clarity",
        })}
        onBack={handleBack}
      >
        <View style={styles.content}>
          <InfoBlock
            title={t("dataAiClarityOverviewTitle", {
              defaultValue: "How Fitaly uses data",
            })}
            body={t("dataAiClarityOverviewBody", {
              defaultValue:
                "Data you add, where AI appears, and where full legal documents live.",
            })}
            tone="neutral"
            style={styles.infoBlock}
            icon={
              <AppIcon name="lock" size={18} color={theme.textSecondary} />
            }
          />

          <SettingsSection
            title={t("dataAiClarityQuickAnswersTitle", {
              defaultValue: "Quick answers",
            })}
            contentStyle={styles.sectionGroup}
          >
            {topics.map((topic) => (
              <SettingsRow
                key={topic.id}
                leading={
                  <View style={styles.rowIcon}>
                    <AppIcon
                      name={topic.icon}
                      size={20}
                      color={
                        topic.iconTone === "warm"
                          ? theme.accentWarmStrong
                          : theme.primaryStrong
                      }
                    />
                  </View>
                }
                title={topic.title}
                titleNumberOfLines={1}
                subtitle={topic.summary}
                subtitleNumberOfLines={2}
                chevronSize={20}
                style={styles.topicRow}
                titleStyle={styles.topicTitle}
                subtitleStyle={styles.topicSubtitle}
                testID={`data-ai-topic-${topic.id}`}
                onPress={() => setActiveTopicId(topic.id)}
              />
            ))}
          </SettingsSection>
        </View>
      </FormScreenShell>

      <Modal
        visible={Boolean(activeTopic)}
        testID="data-ai-detail-modal"
        title={activeTopic?.detailTitle}
        onClose={closeDetail}
        closeButtonTestID="data-ai-detail-close-icon"
        primaryAction={{
          label: t("close", { ns: "common", defaultValue: "Close" }),
          onPress: closeDetail,
          testID: "data-ai-detail-close",
        }}
      >
        {activeTopic ? (
          <View testID={`data-ai-detail-${activeTopic.id}`} style={styles.detail}>
            {activeTopic.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.detailParagraph}>
                {paragraph}
              </Text>
            ))}

            {activeTopic.bullets.length > 0 ? (
              <View style={styles.detailBullets}>
                {activeTopic.bullets.map((bullet) => (
                  <View key={bullet.title} style={styles.detailBullet}>
                    <View style={styles.detailBulletDot} />
                    <View style={styles.detailBulletCopy}>
                      <Text style={styles.detailBulletTitle}>
                        {bullet.title}
                      </Text>
                      <Text style={styles.detailBulletBody}>{bullet.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {activeTopic.id === "legal-docs" ? (
              <View style={styles.legalLinks}>
                <SettingsRow
                  leading={
                    <View style={styles.rowIcon}>
                      <AppIcon
                        name="lock"
                        size={20}
                        color={theme.primaryStrong}
                      />
                    </View>
                  }
                  title={t("privacyPolicy")}
                  subtitle={t("privacyPolicySubtitle")}
                  subtitleNumberOfLines={2}
                  testID="data-ai-legal-privacy"
                  onPress={openPrivacyPolicy}
                />
                <SettingsRow
                  leading={
                    <View style={styles.rowIcon}>
                      <AppIcon
                        name="info"
                        size={20}
                        color={theme.primaryStrong}
                      />
                    </View>
                  }
                  title={t("termsOfService")}
                  subtitle={t("termsOfServiceSubtitle")}
                  subtitleNumberOfLines={2}
                  testID="data-ai-legal-terms"
                  onPress={() => {
                    void openTerms();
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </Modal>
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
      width: 38,
      height: 38,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    topicRow: {
      minHeight: 56,
      paddingVertical: theme.spacing.sm,
    },
    topicTitle: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    topicSubtitle: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    detail: {
      gap: theme.spacing.md,
    },
    detailParagraph: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    detailBullets: {
      gap: theme.spacing.sm,
    },
    detailBullet: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "flex-start",
    },
    detailBulletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primaryStrong,
      marginTop: 7,
    },
    detailBulletCopy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    detailBulletTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    detailBulletBody: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    legalLinks: {
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
    },
  });
