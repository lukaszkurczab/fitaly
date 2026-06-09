import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useNetInfo } from "@react-native-community/netinfo";
import { v4 as uuidv4 } from "uuid";
import { Button, Modal } from "@/components";
import { Layout } from "@/components/Layout";
import { useAuthContext } from "@/context/AuthContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useAccessContext } from "@/context/AccessContext";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import type { RootStackParamList } from "@/navigation/navigate";
import { ChatHeader } from "../components/ChatHeader";
import { ChatIntroCard } from "../components/ChatIntroCard";
import { SuggestedStarterGrid } from "../components/SuggestedStarterGrid";
import { ChatMessageList } from "../components/ChatMessageList";
import { ChatComposer } from "../components/ChatComposer";
import { ChatHistorySheet } from "../components/ChatHistorySheet";
import { ChatStatusBanner } from "../components/ChatStatusBanner";
import { formatLocalDateTime } from "@/utils/formatLocalDateTime";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import type { UserAiConsent } from "@/types";

const activeThreadStorageKey = (uid: string) => `chat-active-thread-${uid}`;

function isAiConsentActive(aiConsent: UserAiConsent | null | undefined): boolean {
  return (
    aiConsent?.status === "granted" &&
    Boolean(aiConsent.grantedAt) &&
    aiConsent.revokedAt === null
  );
}

export default function ChatScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { firebaseUser: user } = useAuthContext();
  const { userData, loadingUser, refreshUser } = useUserProfileContext();
  const { canRenderProductStack } = useProductReadiness();
  const { accessState } = useAccessContext();
  const credits = accessState?.credits ?? null;
  const net = useNetInfo();
  const keyboardInset = useKeyboardInset();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("chat");

  const uid = user?.uid || "";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [threadId, setThreadId] = useState<string>(() => `local-${uuidv4()}`);
  const hasActiveAiConsent = isAiConsentActive(userData?.profile.aiConsent);
  const chatUid = canRenderProductStack && hasActiveAiConsent ? uid : "";

  const {
    messages,
    loading,
    sending,
    typing,
    sendErrorType,
    canSend,
    send,
    retryLastSend,
    cancelInFlightSend,
    loadMore,
  } = useChatHistory(chatUid, threadId);

  const isOffline = net.isConnected === false;
  const hasMessages = messages.length > 0;
  const isKeyboardVisible = keyboardInset > 0;
  const aiChatFeature = accessState?.features.aiChat ?? null;
  const limitReached =
    aiChatFeature?.reason === "insufficient_credits" ||
    sendErrorType === "AI_CREDITS_EXHAUSTED";
  const renewalDateLabel = formatLocalDateTime(credits?.periodEndAt, {
    locale: i18n?.language,
  });
  const legalGateActive = !hasActiveAiConsent;
  const profileReadyForAi = !loadingUser && canRenderProductStack;
  const aiConsentLockVisible =
    Boolean(uid) && profileReadyForAi && !hasActiveAiConsent;
  const chatDisabled = sendErrorType === "AI_CHAT_DISABLED";
  const composerDisabled =
    sending ||
    limitReached ||
    chatDisabled ||
    isOffline ||
    legalGateActive ||
    !profileReadyForAi;
  const starterPromptsUnlockSubscription =
    limitReached && !legalGateActive && !chatDisabled && profileReadyForAi;

  useEffect(() => {
    let cancelled = false;

    async function restoreActiveThread() {
      if (!uid || !canRenderProductStack || !hasActiveAiConsent) return;
      const storedThreadId = await AsyncStorage.getItem(
        activeThreadStorageKey(uid),
      );
      if (!cancelled && storedThreadId) {
        setThreadId((current) =>
          current.startsWith("local-") ? storedThreadId : current,
        );
      }
    }

    void restoreActiveThread().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [canRenderProductStack, hasActiveAiConsent, uid]);

  useFocusEffect(
    useCallback(() => {
      async function refreshServerConsentOnFocus() {
        if (!uid || !canRenderProductStack || loadingUser) return;
        await refreshUser();
      }

      void refreshServerConsentOnFocus().catch(() => undefined);

      return undefined;
    }, [canRenderProductStack, loadingUser, refreshUser, uid]),
  );

  const openLegalDetails = useCallback(() => {
    navigation.navigate("DataAiClarity");
  }, [navigation]);

  const openLegalPrivacyHub = useCallback(() => {
    navigation.navigate("LegalPrivacyHub");
  }, [navigation]);

  const openPrivacyAiSettings = useCallback(() => {
    navigation.navigate("PrivacyAiSettings");
  }, [navigation]);

  const starters = useMemo(
    () => [
      { label: t("empty.starters.week"), value: t("empty.values.week") },
      {
        label: t("empty.starters.protein"),
        value: t("empty.values.protein"),
      },
      { label: t("empty.starters.dinner"), value: t("empty.values.dinner") },
      { label: t("empty.starters.track"), value: t("empty.values.track") },
    ],
    [t],
  );

  const helperText = useMemo(() => {
    if (sending) return t("sending");
    if (sendErrorType === "offline") return t("errors.offline");
    if (sendErrorType === "AI_CHAT_DISABLED") return t("errors.disabled");
    if (sendErrorType === "AI_CHAT_IDEMPOTENCY_CONFLICT")
      return t("errors.idempotencyConflict");
    if (sendErrorType === "AI_CONSENT_REQUIRED")
      return t("errors.consentRequired");
    if (sendErrorType === "AI_CREDITS_EXHAUSTED") return undefined;
    if (sendErrorType === "auth") return t("errors.authRequired");
    return undefined;
  }, [sendErrorType, sending, t]);

  const failedAssistantResponseErrorText = useMemo(() => {
    if (
      sendErrorType === "AI_CHAT_TIMEOUT" ||
      sendErrorType === "AI_CHAT_PROVIDER_UNAVAILABLE" ||
      sendErrorType === "AI_CHAT_CONTEXT_UNAVAILABLE" ||
      sendErrorType === "AI_CHAT_INTERNAL_ERROR" ||
      sendErrorType === "unknown"
    ) {
      return t("errors.fetchFailed");
    }

    return undefined;
  }, [sendErrorType, t]);

  const retryEnabled =
    !sending &&
    canSend &&
    !chatDisabled &&
    !isOffline &&
    !legalGateActive &&
    (sendErrorType === "offline" ||
      sendErrorType === "AI_CHAT_TIMEOUT" ||
      sendErrorType === "AI_CHAT_PROVIDER_UNAVAILABLE" ||
      sendErrorType === "AI_CHAT_CONTEXT_UNAVAILABLE" ||
      sendErrorType === "AI_CHAT_INTERNAL_ERROR" ||
      sendErrorType === "unknown");
  const showConversationRetryState =
    hasMessages && Boolean(failedAssistantResponseErrorText);

  const composerPlaceholder = limitReached
    ? t("composer.lockedCredits")
    : chatDisabled
      ? t("composer.lockedDisabled")
    : isOffline
      ? t("composer.lockedOffline")
      : legalGateActive
        ? t("legal.composerLocked")
        : t("composer.placeholder");
  const creditLockBody = renewalDateLabel
    ? t("limit.body", {
        balance: credits?.balance ?? 0,
        allocation: credits?.allocation ?? 0,
        renewalDate: renewalDateLabel,
      })
    : t("limit.bodyNoRenewal", {
        balance: credits?.balance ?? 0,
        allocation: credits?.allocation ?? 0,
      });

  const openSubscription = useCallback(() => {
    navigation.navigate("ManageSubscription");
  }, [navigation]);

  const handleSend = useCallback(
    async (text: string) => {
      if (isOffline || !canSend || legalGateActive || !profileReadyForAi)
        return;
      const createdThreadId = await send(text);
      if (createdThreadId) {
        setThreadId(createdThreadId);
        if (uid) {
          void AsyncStorage.setItem(
            activeThreadStorageKey(uid),
            createdThreadId,
          ).catch(() => undefined);
        }
      }
    },
    [canSend, isOffline, legalGateActive, profileReadyForAi, send, uid],
  );

  const handleStarterSelect = useCallback(
    (value: string) => {
      if (starterPromptsUnlockSubscription) {
        openSubscription();
        return;
      }

      void handleSend(value);
    },
    [handleSend, openSubscription, starterPromptsUnlockSubscription],
  );

  const handleRetry = useCallback(() => {
    void retryLastSend();
  }, [retryLastSend]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const emptyState = (
    <View
      style={[
        styles.emptyStateWrap,
        isKeyboardVisible ? styles.emptyStateWrapCompact : null,
      ]}
    >
      {!isKeyboardVisible ? (
        <ChatIntroCard
          title={isOffline ? t("offline.title") : t("empty.title")}
          subtitle={isOffline ? t("offline.subtitle") : t("empty.subtitle")}
          creditsText={
            isOffline || limitReached
              ? undefined
              : t("empty.creditsLeft", {
                  count: credits?.balance ?? 0,
                })
          }
        />
      ) : null}

      {!isOffline && !isKeyboardVisible ? (
        <View
          style={[
            styles.starterDock,
            isKeyboardVisible ? styles.starterDockCompact : null,
          ]}
        >
          <SuggestedStarterGrid
            title={
              starterPromptsUnlockSubscription
                ? t("empty.lockedSuggestedLabel")
                : t("empty.suggestedLabel")
            }
            starters={starters}
            disabled={composerDisabled && !starterPromptsUnlockSubscription}
            compact={isKeyboardVisible}
            accessibilityHint={
              starterPromptsUnlockSubscription
                ? t("empty.lockedStarterAccessibilityHint")
                : undefined
            }
            onSelect={handleStarterSelect}
          />
        </View>
      ) : null}
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        cancelInFlightSend();
      };
    }, [cancelInFlightSend]),
  );

  return (
    <Layout
      disableScroll
      showOfflineBanner={false}
      style={styles.layout}
      keyboardAvoiding
    >
      <View testID="chat-screen" style={styles.screenMarker}>
        <ChatHeader
          title={t("header.title")}
          subtitle={t("header.subtitle")}
          onOpenHistory={() => {
            if (legalGateActive) return;
            setHistoryOpen(true);
          }}
          historyButtonLabel={t("history.open")}
        />
      </View>

      {!isOffline && limitReached ? (
        <ChatStatusBanner
          testID="chat-credits-banner"
          variant="credits"
          title={t("lock.creditsTitle")}
          body={creditLockBody}
          actionLabel={t("lock.creditsAction")}
          onActionPress={openSubscription}
        />
      ) : null}

      {hasMessages && isOffline ? (
        <ChatStatusBanner
          testID="offline-banner"
          variant="offline"
          title={t("lock.offlineTitle")}
          body={t("lock.offlineBody")}
        />
      ) : null}

      {chatDisabled ? (
        <ChatStatusBanner
          testID="chat-disabled-banner"
          variant="info"
          title={t("lock.disabledTitle")}
          body={t("lock.disabledBody")}
        />
      ) : null}

      {hasMessages && sendErrorType === "AI_CHAT_CONTEXT_UNAVAILABLE" ? (
        <ChatStatusBanner
          testID="chat-context-unavailable-banner"
          variant="info"
          title={t("lock.contextUnavailableTitle")}
          body={t("lock.contextUnavailableBody")}
        />
      ) : null}

      <Pressable
        testID="chat-keyboard-dismiss-zone"
        accessible={false}
        onPress={Keyboard.dismiss}
        style={styles.body}
      >
        <ChatMessageList
          messages={messages}
          typing={typing && !limitReached && !isOffline}
          loading={loading}
          emptyState={emptyState}
          onLoadMore={loadMore}
          dateLabel={t("conversation.todayLabel")}
          typingLabel={t("typingIndicator")}
          errorText={
            showConversationRetryState
              ? failedAssistantResponseErrorText
              : undefined
          }
          errorActionLabel={retryEnabled ? t("retryLast") : undefined}
          onErrorActionPress={retryEnabled ? handleRetry : undefined}
          errorActionDisabled={!retryEnabled}
        />
      </Pressable>

      <ChatComposer
        placeholder={composerPlaceholder}
        sendLabel={t("input.send")}
        disabled={composerDisabled}
        onSend={handleSend}
        helperText={helperText}
      />

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        userUid={chatUid}
        activeThreadId={threadId}
        onSelectThread={(id) => {
          setThreadId(id);
          if (uid) {
            void AsyncStorage.setItem(activeThreadStorageKey(uid), id).catch(
              () => undefined,
            );
          }
        }}
      />

      <Modal
        testID="chat-legal-modal"
        visible={aiConsentLockVisible}
        title={t("legal.title")}
        secondaryAction={{
          label: t("legal.back"),
          onPress: handleBack,
          tone: "secondary",
          testID: "chat-legal-back",
        }}
        primaryAction={{
          label: t("legal.manageConsent"),
          onPress: openPrivacyAiSettings,
          testID: "chat-legal-accept",
        }}
        closeOnBackdropPress={false}
      >
        <View style={styles.legalCopy}>
          <View testID="chat-legal-info" style={styles.legalInfo}>
            <Text style={styles.legalParagraph}>{t("legal.informational")}</Text>
            <Text style={styles.legalParagraph}>{t("legal.medical")}</Text>
          </View>

          <View testID="chat-legal-links" style={styles.legalLinks}>
            <Text style={styles.legalParagraph}>{t("legal.moreInfo")}</Text>
            <Button
              testID="chat-legal-link-privacy"
              label={t("legal.privacy")}
              variant="ghost"
              onPress={openLegalPrivacyHub}
              fullWidth={false}
              style={styles.legalButton}
            />
            <Button
              testID="chat-legal-link-data-ai"
              label={t("legal.learnMore")}
              variant="ghost"
              onPress={openLegalDetails}
              fullWidth={false}
              style={styles.legalButton}
            />
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingLeft: 0,
      paddingRight: 0,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    screenMarker: {},
    emptyStateWrap: {
      flex: 1,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + theme.spacing.xs,
      gap: theme.spacing.display + theme.spacing.xl,
      justifyContent: "flex-end",
    },
    emptyStateWrapCompact: {
      paddingTop: theme.spacing.sm,
      paddingBottom: 0,
      gap: theme.spacing.sm,
      justifyContent: "flex-end",
    },
    starterDock: {
      paddingTop: 0,
    },
    starterDockCompact: {
      marginTop: 0,
      paddingTop: 0,
    },
    legalButton: {
      alignSelf: "flex-start",
      minHeight: 0,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: 0,
    },
    legalCopy: {
      gap: theme.spacing.md,
    },
    legalInfo: {
      gap: theme.spacing.sm,
    },
    legalParagraph: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    legalLinks: {
      gap: theme.spacing.xs,
    },
  });
