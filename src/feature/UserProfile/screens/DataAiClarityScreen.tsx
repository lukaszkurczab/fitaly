import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  FormScreenShell,
  InfoBlock,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";

type DataAiClarityNavigation = StackNavigationProp<
  RootStackParamList,
  "DataAiClarity"
>;

type DataAiClarityScreenProps = {
  navigation: DataAiClarityNavigation;
};

export default function DataAiClarityScreen({
  navigation,
}: DataAiClarityScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("LegalPrivacyHub");
  };

  return (
    <FormScreenShell
      testID="data-ai-clarity-screen"
      title={t("dataAiClarityTitle", {
        defaultValue: "Data & AI clarity",
      })}
      intro={t("dataAiClarityIntro", {
        defaultValue:
          "This screen summarizes how Fitaly uses your data and where AI is involved. It does not replace the full Privacy Policy.",
      })}
      onBack={handleBack}
    >
      <View style={styles.content}>
        <InfoBlock
          title={t("dataAiClaritySummaryTitle", {
            defaultValue: "Plain-language summary",
          })}
          body={t("dataAiClaritySummaryBody", {
            defaultValue:
              "Fitaly uses the information you add to provide meal logging, nutrition history, and the AI features you choose to use.",
          })}
          tone="info"
          icon={<AppIcon name="assistant" size={18} color={theme.info.text} />}
        />

        <SettingsSection
          title={t("dataAiClarityCollectedTitle", {
            defaultValue: "What data you add",
          })}
        >
          <SettingsRow
            title={t("dataAiClarityCollectedAccountTitle", {
              defaultValue: "Account and profile details",
            })}
            subtitle={t("dataAiClarityCollectedAccountBody", {
              defaultValue:
                "Your email address and profile details such as weight, height, age, gender, and nutrition goal.",
            })}
          />
          <SettingsRow
            title={t("dataAiClarityCollectedMealsTitle", {
              defaultValue: "Meals and meal photos",
            })}
            subtitle={t("dataAiClarityCollectedMealsBody", {
              defaultValue:
                "Your meal history and any meal photos you upload for tracking or analysis.",
            })}
          />
        </SettingsSection>

        <SettingsSection
          title={t("dataAiClarityAiTitle", {
            defaultValue: "Where AI is involved",
          })}
        >
          <SettingsRow
            title={t("dataAiClarityAiPhotoTitle", {
              defaultValue: "Meal photo analysis",
            })}
            subtitle={t("dataAiClarityAiPhotoBody", {
              defaultValue:
                "Meal photos are sent through Fitaly’s backend AI flow to estimate nutritional information.",
            })}
          />
          <SettingsRow
            title={t("dataAiClarityAiSuggestionTitle", {
              defaultValue: "Suggestions and text features",
            })}
            subtitle={t("dataAiClarityAiSuggestionBody", {
              defaultValue:
                "When you use diet-related AI features, only the needed context is sent through Fitaly’s backend to generate responses.",
            })}
          />
          <SettingsRow
            title={t("dataAiClarityAiTrainingTitle", {
              defaultValue: "Model training",
            })}
            subtitle={t("dataAiClarityAiTrainingBody", {
              defaultValue:
                "Fitaly does not use this data to train its own models. Data sent to providers is used to deliver the features you request.",
            })}
          />
        </SettingsSection>

        <SettingsSection
          title={t("dataAiClarityProcessorsTitle", {
            defaultValue: "Other processors and analytics",
          })}
        >
          <SettingsRow
            title={t("dataAiClarityProcessorsFirebaseTitle", {
              defaultValue: "Firebase",
            })}
            subtitle={t("dataAiClarityProcessorsFirebaseBody", {
              defaultValue:
                "Used for authentication, database storage, and app analytics.",
            })}
          />
          <SettingsRow
            title={t("dataAiClarityProcessorsOpenAiTitle", {
              defaultValue: "OpenAI via Fitaly backend",
            })}
            subtitle={t("dataAiClarityProcessorsOpenAiBody", {
              defaultValue:
                "Used as a model provider for meal-photo analysis and diet-related AI features when you request them.",
            })}
          />
        </SettingsSection>

        <SettingsSection
          title={t("dataAiClarityControlsTitle", {
            defaultValue: "Your controls",
          })}
          footer={t("dataAiClarityControlsFooter", {
            defaultValue:
              "For the full legal wording and contact details, open the Privacy Policy from Legal & privacy.",
          })}
        >
          <SettingsRow
            title={t("dataAiClarityControlsExportTitle", {
              defaultValue: "Download or delete your data",
            })}
            subtitle={t("dataAiClarityControlsExportBody", {
              defaultValue:
                "You can export your account data and use the delete-account flow directly from your account area.",
            })}
          />
          <SettingsRow
            title={t("privacyPolicy")}
            subtitle={t("dataAiClarityControlsPrivacyBody", {
              defaultValue:
                "Open the full Privacy Policy for the complete legal document.",
            })}
            onPress={() => navigation.navigate("Privacy")}
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
