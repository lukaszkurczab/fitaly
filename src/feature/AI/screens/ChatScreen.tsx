import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
import { acceptAiHealthDataConsentRemote } from "@/services/user/userProfileRepository";
import { useProductReadiness } from "@/hooks/useProductReadiness";
import type { ReadinessStatus } from "@/types";

export default function ChatScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { firebaseUser: user } = useAuthContext();
  const { userData, loadingUser, refreshUser } = useUserProfileContext();
  const { isProductReady, canRenderProductStack } = useProductReadiness();
  const { accessState } = useAccessContext();
  const credits = accessState?.credits ?? null;
  const net = useNetInfo();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation("chat");

  const uid = user?.uid || "";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [threadId, setThreadId] = useState<string>(() => `local-${uuidv4()}`);
  const [readinessStatusOverride, setReadinessStatusOverride] =
    useState<ReadinessStatus | null>(null);
  const [legalAckSubmitting, setLegalAckSubmitting] = useState(false);
  const [legalAckError, setLegalAckError] = useState(false);
  const readinessStatus =
    readinessStatusOverride ??
    userData?.profile.readiness.status ??
    "needs_profile";
  const serverConfirmedReady =
    isProductReady || readinessStatusOverride === "ready";
  const chatUid = serverConfirmedReady ? uid : "";

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
  const limitReached =
    !canSend || sendErrorType === "AI_CREDITS_EXHAUSTED";
  const renewalDateLabel = formatLocalDateTime(credits?.periodEndAt, {
    locale: i18n?.language,
  });
  const hasAiHealthDataConsent = readinessStatus === "ready";
  const legalGateActive = !hasAiHealthDataConsent || legalAckSubmitting;
  const profileReadyForAi =
    !loadingUser && (canRenderProductStack || serverConfirmedReady);
  const legalAckVisible =
    Boolean(uid) && profileReadyForAi && readinessStatus === "needs_ai_consent";
  const chatDisabled = sendErrorType === "AI_CHAT_DISABLED";
  const composerDisabled =
    sending ||
    limitReached ||
    chatDisabled ||
    isOffline ||
    legalGateActive ||
    !profileReadyForAi;

  useEffect(() => {
    setReadinessStatusOverride(null);
    setLegalAckSubmitting(false);
    setLegalAckError(false);
  }, [uid]);

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

  const acknowledgeLegal = useCallback(async () => {
    if (!uid || !canRenderProductStack) {
      return;
    }

    setLegalAckSubmitting(true);
    setLegalAckError(false);
    try {
      const response = await acceptAiHealthDataConsentRemote(uid);
      const nextStatus =
        response.consent.readiness.status ??
        response.profile?.profile.readiness.status ??
        null;
      setReadinessStatusOverride(nextStatus);
    } catch {
      setLegalAckError(true);
    } finally {
      setLegalAckSubmitting(false);
    }
  }, [canRenderProductStack, uid]);

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
    if (sendErrorType === "AI_CHAT_TIMEOUT") return t("errors.timeout");
    if (sendErrorType === "AI_CHAT_DISABLED") return t("errors.disabled");
    if (sendErrorType === "AI_CHAT_PROVIDER_UNAVAILABLE")
      return t("errors.serviceUnavailable");
    if (sendErrorType === "AI_CHAT_CONTEXT_UNAVAILABLE")
      return t("errors.contextUnavailable");
    if (sendErrorType === "AI_CHAT_INTERNAL_ERROR")
      return t("errors.internal");
    if (sendErrorType === "AI_CHAT_IDEMPOTENCY_CONFLICT")
      return t("errors.idempotencyConflict");
    if (sendErrorType === "AI_CHAT_CONSENT_REQUIRED")
      return t("errors.consentRequired");
    if (sendErrorType === "AI_CREDITS_EXHAUSTED")
      return t("errors.creditsExhausted");
    if (sendErrorType === "auth") return t("errors.authRequired");
    if (sendErrorType === "unknown") return t("errors.fetchFailed");
    return undefined;
  }, [sendErrorType, sending, t]);

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

  const composerPlaceholder = limitReached
    ? t("composer.lockedCredits")
    : chatDisabled
      ? t("composer.lockedDisabled")
    : isOffline
      ? t("composer.lockedOffline")
      : legalGateActive
        ? t("legal.composerLocked")
        : t("composer.placeholder");

  const handleSend = useCallback(
    async (text: string) => {
      if (isOffline || !canSend || legalGateActive || !profileReadyForAi)
        return;
      const createdThreadId = await send(text);
      if (createdThreadId) setThreadId(createdThreadId);
    },
    [canSend, isOffline, legalGateActive, profileReadyForAi, send],
  );

  const handleRetry = useCallback(() => {
    void retryLastSend();
  }, [retryLastSend]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const emptyState = (
    <View style={styles.emptyStateWrap}>
      <ChatIntroCard
        title={isOffline ? t("offline.title") : t("empty.title")}
        subtitle={isOffline ? t("offline.subtitle") : t("empty.subtitle")}
        creditsText={
          isOffline
            ? undefined
            : t("empty.creditsLeft", {
                count: credits?.balance ?? 0,
              })
        }
      />

      {!isOffline ? (
        <SuggestedStarterGrid
          title={t("empty.suggestedLabel")}
          starters={starters}
          disabled={composerDisabled}
          onSelect={(value) => {
            void handleSend(value);
          }}
        />
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
      <ChatHeader
        title={t("header.title")}
        subtitle={t("header.subtitle")}
        onOpenHistory={() => {
          if (legalGateActive) return;
          setHistoryOpen(true);
        }}
        historyButtonLabel={t("history.open")}
      />

      {hasMessages && !isOffline && limitReached ? (
        <ChatStatusBanner
          variant="credits"
          title={t("lock.creditsTitle")}
          body={t("limit.body", {
            balance: credits?.balance ?? 0,
            allocation: credits?.allocation ?? 0,
            renewalDate:
              renewalDateLabel ??
              t("credits.renewalUnknown"),
          })}
          actionLabel={t("lock.creditsAction")}
          onActionPress={() => navigation.navigate("ManageSubscription")}
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

      <View style={styles.body}>
        <ChatMessageList
          messages={messages}
          typing={typing && !limitReached && !isOffline}
          loading={loading}
          emptyState={emptyState}
          onLoadMore={loadMore}
          dateLabel={t("conversation.todayLabel")}
          typingLabel={t("typingIndicator")}
        />
      </View>

      <ChatComposer
        placeholder={composerPlaceholder}
        sendLabel={t("input.send")}
        disabled={composerDisabled}
        onSend={handleSend}
        helperText={helperText}
        helperActionLabel={retryEnabled ? t("retryLast") : undefined}
        onHelperActionPress={retryEnabled ? handleRetry : undefined}
        helperActionDisabled={!retryEnabled}
      />

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        userUid={chatUid}
        activeThreadId={threadId}
        onSelectThread={(id) => setThreadId(id)}
      />

      <Modal
        visible={legalAckVisible}
        title={t("legal.title")}
        secondaryAction={{
          label: t("legal.back"),
          onPress: handleBack,
          tone: "secondary",
          testID: "chat-legal-back",
        }}
        primaryAction={{
          label: t("legal.accept"),
          onPress: () => {
            void acknowledgeLegal();
          },
          loading: legalAckSubmitting,
          disabled: legalAckSubmitting || isOffline,
          testID: "chat-legal-accept",
        }}
        closeOnBackdropPress={false}
      >
        <View style={styles.legalCopy}>
          <View testID="chat-legal-info" style={styles.legalInfo}>
            <Text style={styles.legalParagraph}>{t("legal.informational")}</Text>
            <Text style={styles.legalParagraph}>{t("legal.medical")}</Text>
            {legalAckError ? (
              <Text style={styles.legalError}>{t("legal.saveFailed")}</Text>
            ) : null}
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
    emptyStateWrap: {
      flex: 1,
      paddingTop: theme.spacing.xxl,
      gap: theme.spacing.xl,
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
    legalError: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    legalLinks: {
      gap: theme.spacing.xs,
    },
  });
