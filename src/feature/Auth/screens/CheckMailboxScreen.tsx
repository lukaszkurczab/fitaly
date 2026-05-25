import { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { ErrorBox, ScreenCornerNavButton } from "@/components";
import { GlobalActionButtons } from "@/components/GlobalActionButtons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import AppIcon from "@/components/AppIcon";
import { AuthScreenLayout } from "@/feature/Auth/components/AuthScreenLayout";
import { getFirebaseAuth } from "@/FirebaseConfig";
import { authSendPasswordReset } from "@/feature/Auth/services/authService";
import { isOfflineNetState } from "@/services/core/networkState";
import type { RootStackParamList } from "@/navigation/navigate";

type CheckMailboxRoute = RouteProp<RootStackParamList, "CheckMailbox">;
type CheckMailboxNavigation = StackNavigationProp<RootStackParamList>;
type Props = {
  navigation: CheckMailboxNavigation;
};

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export default function CheckMailboxScreen({ navigation }: Props) {
  const { t } = useTranslation(["resetPassword", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const route = useRoute<CheckMailboxRoute>();

  const email =
    route?.params?.email && typeof route.params.email === "string"
      ? route.params.email
      : "";
  const sanitizedEmail = email.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const [sending, setSending] = useState(false);
  const [sendAgainDisabled, setSendAgainDisabled] = useState(true);
  const [timer, setTimer] = useState(60);
  const [noInternet, setNoInternet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sendAgainDisabled) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimer(60);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sendAgainDisabled]);

  useEffect(() => {
    if (timer === 0) setSendAgainDisabled(false);
  }, [timer]);

  useEffect(() => {
    const check = async () => {
      const net = await NetInfo.fetch();
      setNoInternet(isOfflineNetState(net));
    };

    check();

    const unsub = NetInfo.addEventListener((state) => {
      setNoInternet(isOfflineNetState(state));
    });

    return () => unsub();
  }, []);

  const handleSendAgain = async () => {
    if (sending || !email) return;

    setSending(true);
    setError(null);

    try {
      await getFirebaseAuth();
      await authSendPasswordReset(email.trim().toLowerCase());
      setSendAgainDisabled(true);
      setTimer(60);
    } catch (err: unknown) {
      const code = getErrorCode(err);

      if (code === "auth/network-request-failed" || noInternet) {
        setError(t("errorNoInternet"));
      } else if (code === "auth/user-not-found") {
        setError(t("errorNotFound") ?? "User not found");
      } else {
        setError(t("errorDefault"));
      }
    }

    setSending(false);
  };

  return (
    <AuthScreenLayout
      testID="check-mailbox-screen"
      brand={t("common:app_title")}
      title={t("checkMailboxTitle")}
      description={t("successGeneric")}
      topAction={
        <ScreenCornerNavButton
          testID="check-mailbox-close-button"
          icon="close"
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate("Login")
          }
          accessibilityLabel={t("common:close", { defaultValue: "Close" })}
          containerStyle={styles.topLeftAction}
        />
      }
      banner={
        error || noInternet ? (
          <ErrorBox
            message={error ?? t("errorNoInternet")}
            style={styles.errorSpacing}
          />
        ) : null
      }
      bottomAction={
        <GlobalActionButtons
          primaryTestID="check-mailbox-login-button"
          label={t("backToLogin")}
          onPress={() => navigation.navigate("Login")}
          primaryStyle={styles.primaryAction}
          secondaryLabel={
            sendAgainDisabled
              ? t("sendAgainInfo", { seconds: timer })
              : t("sendAgain")
          }
          secondaryOnPress={handleSendAgain}
          secondaryTestID="check-mailbox-send-again-button"
          secondaryDisabled={sending || sendAgainDisabled || noInternet}
          secondaryLoading={sending}
          secondaryStyle={styles.secondaryAction}
          containerStyle={styles.actionSpacing}
        />
      }
    >
      <View style={styles.mailCard}>
        <View style={styles.iconBadge}>
          <AppIcon name="email" size={28} color={theme.primary} />
        </View>
        <View style={styles.mailCopy}>
          <Text style={styles.mailTitle}>
            {t("checkMailboxDesc", { email: sanitizedEmail })}
          </Text>
          <Text style={styles.mailHint}>{t("checkMailboxHint")}</Text>
        </View>
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    topLeftAction: {
      top: theme.spacing.xs,
      left: 0,
      right: undefined,
    },
    mailCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      backgroundColor: theme.surfaceElevated,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: theme.spacing.cardPaddingLarge,
      ...theme.depth.raised,
    },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: theme.rounded.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.primarySoft,
    },
    mailCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    mailTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    mailHint: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    errorSpacing: {
      marginBottom: theme.spacing.md,
    },
    actionSpacing: {
      marginBottom: theme.spacing.md,
    },
    primaryAction: {
      width: "100%",
    },
    secondaryAction: {
      width: "100%",
    },
  });
