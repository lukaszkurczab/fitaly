import { useMemo, useState, useEffect } from "react";
import { Keyboard, View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { Button, TextInput, ErrorBox, LinkText } from "@/components";
import NetInfo from "@react-native-community/netinfo";
import { validateEmail } from "@/utils/validation";
import AppIcon from "@/components/AppIcon";
import { useLogin } from "@/feature/Auth/hooks/useLogin";
import { AuthScreenLayout } from "@/feature/Auth/components/AuthScreenLayout";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";

type LoginNavigation = StackNavigationProp<RootStackParamList, "Login">;

type LoginScreenProps = {
  navigation: LoginNavigation;
};

function isDisconnectedNetState(state: { isConnected: boolean | null }): boolean {
  return state.isConnected === false;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { t } = useTranslation(["login", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [internetError, setInternetError] = useState(false);

  const { login, loading, errors, criticalError, reset } = useLogin();

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    reset();
  }, [email, password, reset]);

  useEffect(() => {
    let active = true;

    const checkConnection = async () => {
      const state = await NetInfo.fetch();
      if (active) {
        setInternetError(isDisconnectedNetState(state));
      }
    };

    void checkConnection();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setInternetError(isDisconnectedNetState(state));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const normalizedEmail = email.trim();

  const emailError =
    touched.email && !validateEmail(normalizedEmail)
      ? t("invalid_email")
      : errors.email
        ? t(errors.email, { defaultValue: t("invalid_email") })
        : undefined;

  const passwordError =
    touched.password && password.length < 6
      ? t("invalid_password")
      : errors.password
        ? t(errors.password, { defaultValue: t("invalid_password") })
        : undefined;

  const isFormValid = validateEmail(normalizedEmail) && password.length >= 6;

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!isFormValid) return;

    setInternetError(false);
    Keyboard.dismiss();
    await login(normalizedEmail, password);
  };

  const mapCritical = (key: string | null): string | null => {
    if (!key) return null;
    if (key === "no_internet") return t("common:no_internet");
    if (key === "too_many_requests") return t("too_many_requests");
    if (key === "login_failed") return t("login_failed");
    return t("login_failed");
  };

  const displayCriticalError: string | null = internetError
    ? t("common:no_internet")
    : mapCritical(criticalError);

  const isLoginDisabled = !isFormValid || loading;

  return (
    <AuthScreenLayout
      testID="login-screen"
      brand={t("common:app_title")}
      title={t("welcome_back")}
      compactOnKeyboardVisible
      formStyle={styles.authFormSpacing}
      compactFormStyle={styles.authFormSpacingCompact}
      banner={
        displayCriticalError ? (
          <ErrorBox
            message={displayCriticalError}
            testID="login-error-banner"
          />
        ) : null
      }
      bottomAction={
        <Button
          testID="login-submit-button"
          label={t("login")}
          onPress={handleLogin}
          disabled={isLoginDisabled}
          loading={loading}
        />
      }
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("dont_have_account")} </Text>
          <LinkText
            testID="login-register-link"
            onPress={() => navigation.replace("Register")}
            disabled={loading}
            hitSlop={12}
          >
            {t("sign_up")}
          </LinkText>
        </View>
      }
    >
      <View style={styles.formBlock}>
        <TextInput
          testID="login-email-input"
          label={t("email")}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={emailError}
          editable={!loading}
          placeholder={t("enter_email")}
          accessibilityLabel={t("email")}
          icon={<AppIcon name="email" />}
          iconPosition="right"
          style={styles.emailField}
        />

        <View style={styles.passwordSection}>
          <TextInput
            testID="login-password-input"
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            error={passwordError}
            errorTestID="login-password-error"
            editable={!loading}
            placeholder={t("enter_password")}
            accessibilityLabel={t("password")}
            style={styles.passwordField}
            left={
              <AppIcon name="lock" size={20} color={theme.textSecondary} />
            }
            right={
              <Pressable
                testID="login-password-visibility-toggle"
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={t("toggle_password_visibility")}
              >
                <AppIcon
                  name={showPassword ? "eye" : "eye-off"}
                  size={22}
                  color={theme.textSecondary}
                />
              </Pressable>
            }
          />

          <LinkText
            testID="login-forgot-password-link"
            onPress={() => navigation.navigate("ResetPassword")}
            disabled={loading}
            style={styles.forgotPasswordLink}
          >
            {t("forgot_password")}
          </LinkText>
        </View>
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    authFormSpacing: {
      paddingTop: theme.spacing.sectionGap,
    },
    authFormSpacingCompact: {
      paddingTop: theme.spacing.sm,
    },
    formBlock: {
      width: "100%",
    },
    emailField: {
      marginBottom: theme.spacing.lg,
    },
    passwordSection: {
      marginBottom: theme.spacing.sectionGap,
    },
    passwordField: {
      marginBottom: theme.spacing.xxs,
    },
    forgotPasswordLink: {
      alignSelf: "flex-end",
      marginTop: theme.spacing.sm,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    footerText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });
