import { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Keyboard,
  Platform,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { getFirebaseAuth } from "@/FirebaseConfig";
import { Button, TextInput, LinkText, ErrorBox } from "@/components";
import { validateEmail } from "@/utils/validation";
import { authSendPasswordReset } from "@/feature/Auth/services/authService";
import { AuthScreenLayout } from "@/feature/Auth/components/AuthScreenLayout";
import { isOfflineNetState } from "@/services/core/networkState";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";

type ResetPasswordNavigation = StackNavigationProp<RootStackParamList>;
type Props = {
  navigation: ResetPasswordNavigation;
};

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export default function ResetPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation(["resetPassword", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noInternet, setNoInternet] = useState(false);

  const inputRef = useRef<RNTextInput | null>(null);

  useEffect(() => {
    if (inputRef.current && Platform.OS !== "web") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, []);

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

  const handleBlur = () => {
    setEmail((e) => e.trim().toLowerCase());
    setTouched(true);
  };

  const normalizedEmail = email.trim().toLowerCase();
  const emailValidationError = !normalizedEmail
    ? t("errorRequired")
    : !validateEmail(normalizedEmail)
      ? t("errorInvalid")
      : null;

  const onSubmit = async () => {
    Keyboard.dismiss();
    setTouched(true);

    if (emailValidationError) {
      return;
    }

    setSubmitError(null);
    setLoading(true);

    try {
      await getFirebaseAuth();
      await authSendPasswordReset(normalizedEmail);

      navigation.navigate("CheckMailbox", {
        email: normalizedEmail,
      });
    } catch (err: unknown) {
      const code = getErrorCode(err);

      if (code === "auth/network-request-failed" || noInternet) {
        setSubmitError(t("errorNoInternet"));
      } else if (code === "auth/user-not-found") {
        setSubmitError(t("errorNotFound") ?? "User not found");
      } else {
        setSubmitError(t("errorGeneric") ?? "Unexpected error");
      }
    } finally {
      setLoading(false);
    }
  };

  const bannerError = noInternet ? t("errorNoInternet") : submitError;

  return (
    <AuthScreenLayout
      testID="reset-password-screen"
      brand={t("common:app_title")}
      title={t("title")}
      description={t("description")}
      banner={
        bannerError ? (
          <ErrorBox
            message={bannerError}
            testID="reset-password-error-banner"
          />
        ) : null
      }
      bottomAction={
        <Button
          testID="reset-password-submit-button"
          label={t("resetBtn")}
          onPress={onSubmit}
          loading={loading}
          disabled={loading || noInternet || Boolean(emailValidationError)}
          accessibilityLabel={t("resetBtn")}
        />
      }
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("rememberPassword")} </Text>
          <LinkText
            testID="reset-password-login-link"
            onPress={() => navigation.navigate("Login")}
            accessibilityRole="link"
            disabled={loading}
          >
            {t("login")}
          </LinkText>
        </View>
      }
    >
      <View style={styles.formBlock}>
        <TextInput
          testID="reset-password-email-input"
          ref={inputRef}
          label={t("email")}
          placeholder={t("emailPlaceholder")}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (submitError) setSubmitError(null);
          }}
          onBlur={handleBlur}
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          error={
            touched && emailValidationError ? emailValidationError : undefined
          }
          disabled={loading || noInternet}
          accessibilityLabel={t("email")}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={styles.field}
        />
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    formBlock: {
      width: "100%",
    },
    field: {
      marginBottom: theme.spacing.sm,
    },
    footerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    footerText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
