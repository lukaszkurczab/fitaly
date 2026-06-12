import { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  FormScreenShell,
  InfoBlock,
  LongTextInput,
  SettingsRow,
  SettingsSection,
  UnsavedChangesModal,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { useAuthContext } from "@/context/AuthContext";
import { sendFeedback } from "@/services/feedback/feedbackService";
import { isOfflineNetState } from "@/services/core/networkState";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

type SendFeedbackNavigation = StackNavigationProp<
  RootStackParamList,
  "SendFeedback"
>;

type SendFeedbackScreenProps = {
  navigation: SendFeedbackNavigation;
};

type FeedbackStatus = {
  kind: "generic" | "attachment";
  tone: "warning" | "error";
  title: string;
  body: string;
} | null;

export default function SendFeedbackScreen({
  navigation,
}: SendFeedbackScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["profile", "common"]);
  const { firebaseUser: user } = useAuthContext();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>(null);

  const trimmedMessage = message.trim();
  const hasUnsavedChanges = !sent && (trimmedMessage.length > 0 || !!attachment);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("HelpFeedback");
  };

  const guard = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    onExit: handleBack,
  });

  const handlePickAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAttachment(result.assets[0].uri);
        setStatus(null);
      }
    } catch {
      setStatus({
        kind: "generic",
        tone: "error",
        title: t("feedbackAttachmentErrorTitle", {
          defaultValue: "Couldn’t open your photo library",
        }),
        body: t("feedbackAttachmentErrorBody", {
          defaultValue: "Please try again if you want to attach a screenshot.",
        }),
      });
    }
  };

  const handleAttachmentPreviewError = () => {
    setStatus({
      kind: "attachment",
      tone: "error",
      title: t("feedbackAttachmentPreviewFailedTitle"),
      body: t("feedbackAttachmentPreviewFailedBody"),
    });
  };

  const handleSend = async () => {
    if (!trimmedMessage) {
      return;
    }

    setStatus(null);

    const net = await NetInfo.fetch();
    if (isOfflineNetState(net)) {
      setStatus({
        kind: "generic",
        tone: "warning",
        title: t("noInternet", { defaultValue: "No internet connection" }),
        body: t("checkConnection", {
          defaultValue: "Please check your connection and try again.",
        }),
      });
      return;
    }

    setSending(true);

    try {
      await sendFeedback({
        message: trimmedMessage,
        attachmentUri: attachment,
        userUid: user?.uid ?? null,
        email: user?.email ?? null,
        deviceInfo: {
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
        },
      });
      setSent(true);
      setMessage("");
      setAttachment(null);
    } catch {
      setStatus(
        attachment
          ? {
              kind: "attachment",
              tone: "error",
              title: t("feedbackAttachmentSendFailedTitle"),
              body: t("feedbackAttachmentSendFailedBody"),
            }
          : {
              kind: "generic",
              tone: "error",
              title: t("error", { defaultValue: "Error" }),
              body: t("feedbackSendError", {
                defaultValue: "Failed to send feedback. Try again later.",
              }),
            },
      );
    } finally {
      setSending(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setStatus((current) => (current?.kind === "attachment" ? null : current));
  };

  const resetFeedbackForm = () => {
    setSent(false);
    setStatus(null);
  };

  return (
    <>
      <FormScreenShell
        testID="send-feedback-screen"
        title={t("sendFeedback", { defaultValue: "Send feedback" })}
        intro={
          sent
            ? t("feedbackSentIntro", {
                defaultValue:
                  "Your message has been sent through Fitaly’s in-app feedback channel.",
              })
            : t("feedbackScreenIntro", {
                defaultValue:
                  "Use feedback for product ideas, suggestions, or bug reports you want to send from inside the app.",
              })
        }
        onBack={guard.requestExit}
        actionLabel={
          sent
            ? t("feedbackDoneAction", {
                defaultValue: "Back to help",
              })
            : t("send", { defaultValue: "Send" })
        }
        onActionPress={() => {
          if (sent) {
            handleBack();
            return;
          }

          void handleSend();
        }}
        actionLoading={sending}
        actionDisabled={sent ? false : !trimmedMessage || sending}
        actionTestID="send-feedback-submit"
        secondaryActionLabel={
          sent
            ? t("feedbackSendAnotherAction", {
                defaultValue: "Send another message",
              })
            : undefined
        }
        secondaryActionPress={sent ? resetFeedbackForm : undefined}
        secondaryActionDisabled={sending}
      >
        <View style={styles.content}>
          {sent ? (
            <InfoBlock
              title={t("feedbackThankYou", {
                defaultValue: "Thank you for your feedback!",
              })}
              body={t("feedbackThankYouBody", {
                defaultValue:
                  "We’ve received your message. If you need a direct reply about an account or technical issue, use Contact support.",
              })}
              tone="success"
              icon={
                <AppIcon name="check" size={18} color={theme.success.text} />
              }
            />
          ) : (
            <>
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

              <LongTextInput
                label={t("feedbackMessageLabel", {
                  defaultValue: "Message",
                })}
                placeholder={t("feedbackPlaceholder", {
                  defaultValue: "Type your message here...",
                })}
                value={message}
                onChangeText={setMessage}
                style={styles.textarea}
                inputStyle={styles.textareaInput}
                maxLength={500}
                testID="send-feedback-message"
              />

              <SettingsSection
                title={t("feedbackAttachmentSectionTitle", {
                  defaultValue: "Optional attachment",
                })}
                footer={t("feedbackAppInfo", {
                  defaultValue:
                    "Your app version and device info will be sent automatically to help us improve Fitaly.",
                })}
              >
                <SettingsRow
                  title={
                    attachment
                      ? t("feedbackReplaceAttachment", {
                          defaultValue: "Replace attachment",
                        })
                      : t("addAttachment", {
                          defaultValue: "Add attachment",
                        })
                  }
                  onPress={() => {
                    void handlePickAttachment();
                  }}
                  testID="send-feedback-attachment-picker"
                  leading={
                    <AppIcon
                      name={attachment ? "image" : "add-photo"}
                      size={18}
                      color={theme.textSecondary}
                    />
                  }
                />
              </SettingsSection>

              {attachment ? (
                <View style={styles.attachmentCard}>
                  <Image
                    testID="send-feedback-attachment-preview"
                    source={{ uri: attachment }}
                    style={styles.attachmentImage}
                    onError={handleAttachmentPreviewError}
                  />

                  <Button
                    label={t("removeAttachment", { defaultValue: "Remove" })}
                    variant="secondary"
                    fullWidth={false}
                    onPress={handleRemoveAttachment}
                    testID="send-feedback-remove-attachment"
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </FormScreenShell>

      <UnsavedChangesModal
        visible={guard.confirmVisible}
        title={t("unsaved_changes_title", { ns: "common" })}
        message={t("unsaved_changes_message", { ns: "common" })}
        discardLabel={t("discard", { ns: "common" })}
        continueEditingLabel={t("continue_editing", { ns: "common" })}
        onDiscard={guard.confirmExit}
        onContinueEditing={guard.cancelExit}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
    textarea: {
      marginBottom: 0,
    },
    textareaInput: {
      minHeight: 180,
      textAlignVertical: "top",
    },
    attachmentCard: {
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.cardPadding,
      alignItems: "flex-start",
    },
    attachmentImage: {
      width: 120,
      height: 120,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
    },
  });
