import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { FormScreenShell, InfoBlock } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useAuthContext } from "@/context/AuthContext";
import { buildSupportMailto, getSupportEmail } from "@/utils/supportContact";

type ContactSupportNavigation = StackNavigationProp<
  RootStackParamList,
  "ContactSupport"
>;

type ContactSupportScreenProps = {
  navigation: ContactSupportNavigation;
};

type SupportStatus = {
  tone: "error" | "warning";
  title: string;
  body: string;
} | null;

export default function ContactSupportScreen({
  navigation,
}: ContactSupportScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { firebaseUser } = useAuthContext();
  const supportEmail = getSupportEmail();
  const [openingEmail, setOpeningEmail] = useState(false);
  const [status, setStatus] = useState<SupportStatus>(null);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("HelpFeedback");
  };

  const handleEmailSupport = async () => {
    setOpeningEmail(true);
    setStatus(null);

    const url = buildSupportMailto({
      userEmail: firebaseUser?.email ?? null,
      userUid: firebaseUser?.uid ?? null,
      context: "Account support",
    });

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        setStatus({
          tone: "warning",
          title: t("contactSupportUnavailableTitle", {
            defaultValue: "No email app available",
          }),
          body: t("contactSupportUnavailableBody", {
            defaultValue:
              "We couldn’t open an email app on this device. You can still contact support at {{email}}.",
            email: supportEmail,
          }),
        });
        return;
      }

      await Linking.openURL(url);
    } catch {
      setStatus({
        tone: "error",
        title: t("contactSupportErrorTitle", {
          defaultValue: "Couldn’t open your email app",
        }),
        body: t("contactSupportErrorBody", {
          defaultValue:
            "Please try again or email {{email}} directly from your preferred email app.",
          email: supportEmail,
        }),
      });
    } finally {
      setOpeningEmail(false);
    }
  };

  return (
    <FormScreenShell
      testID="contact-support-screen"
      title={t("contactSupportTitle", {
        defaultValue: "Contact support",
      })}
      intro={t("contactSupportIntro", {
        defaultValue:
          "Use support for account, billing, privacy, or technical issues that need a direct reply.",
      })}
      onBack={handleBack}
      actionLabel={t("contactSupportAction", {
        defaultValue: "Email support",
      })}
      onActionPress={() => {
        void handleEmailSupport();
      }}
      actionLoading={openingEmail}
    >
      <View style={styles.content}>
        <InfoBlock
          title={t("contactSupportInfoTitle", {
            defaultValue: "How support works",
          })}
          body={t("contactSupportInfoBody", {
            defaultValue:
              "Tapping the button opens your email app with a draft addressed to the support contact already listed in Fitaly’s legal documents.",
          })}
          tone="info"
          icon={<AppIcon name="email" size={18} color={theme.info.text} />}
        />

        {status ? (
          <InfoBlock
            title={status.title}
            body={status.body}
            tone={status.tone}
            icon={
              <AppIcon
                name={status.tone === "warning" ? "info" : "close"}
                size={18}
                color={
                  status.tone === "warning"
                    ? theme.warning.text
                    : theme.error.text
                }
              />
            }
          />
        ) : null}
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
