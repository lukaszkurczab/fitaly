import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Keyboard,
  Pressable,
  Linking,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  TextInput,
  ErrorBox,
  LinkText,
  Checkbox,
  ScreenCornerNavButton,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { useRegister } from "@/feature/Auth/hooks/useRegister";
import { getTermsUrl } from "@/utils/legalUrls";
import { AuthScreenLayout } from "@/feature/Auth/components/AuthScreenLayout";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  validateRegisterEmail,
  validateRegisterPassword,
  validateRegisterPasswordConfirmation,
  validateRegisterUsername,
} from "@/feature/Auth/utils/registerValidation";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";

type RegisterNavigation = StackNavigationProp<RootStackParamList, "Register">;

type RegisterScreenProps = {
  navigation: RegisterNavigation;
};

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { t } = useTranslation(["login", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const { register, loading, errors, clearError } = useRegister();

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!isOfflineNetState(state));
    });
    return () => unsubscribe();
  }, []);

  const clearFieldError = (
    key: "email" | "username" | "password" | "confirmPassword" | "terms",
  ) => {
    clearError(key);
    clearError("general");
  };

  const usernameIsValid = validateRegisterUsername(username);
  const emailIsValid = validateRegisterEmail(email.trim());
  const passwordIsValid = validateRegisterPassword(password);
  const confirmPasswordIsValid = validateRegisterPasswordConfirmation(
    password,
    confirmPassword,
  );

  const usernameError =
    touched.username && !usernameIsValid
      ? t("username_too_short")
      : errors.username
        ? t(errors.username)
        : undefined;

  const emailError =
    touched.email && !emailIsValid
      ? t("invalid_email")
      : errors.email
        ? t(errors.email)
        : undefined;

  const passwordError =
    touched.password && !passwordIsValid
      ? t("password_too_weak")
      : errors.password
        ? t(errors.password)
        : undefined;

  const confirmPasswordError =
    touched.confirmPassword && confirmPassword && !confirmPasswordIsValid
      ? t("passwords_dont_match")
      : errors.confirmPassword
        ? t(errors.confirmPassword)
        : undefined;

  const isFormDisabled =
    !usernameIsValid ||
    !emailIsValid ||
    !passwordIsValid ||
    !confirmPassword ||
    !confirmPasswordIsValid ||
    !termsAccepted ||
    loading ||
    !isConnected;

  const handleSubmit = () => {
    setTouched({
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (isFormDisabled) return;
    Keyboard.dismiss();
    register(
      email.trim(),
      password,
      confirmPassword,
      username.trim(),
      termsAccepted,
    );
  };

  const renderEyeIcon = (
    show: boolean,
    toggle: () => void,
    testID: string,
  ) => (
    <Pressable
      testID={testID}
      onPress={toggle}
      accessibilityLabel={t("toggle_password_visibility")}
      hitSlop={8}
    >
      <AppIcon
        name={!show ? "eye-off" : "eye"}
        size={22}
        color={theme.textSecondary}
      />
    </Pressable>
  );

  return (
    <AuthScreenLayout
      brand={t("common:app_title")}
      title={t("create_account")}
      compactOnKeyboardVisible
      formStyle={styles.authFormSpacing}
      compactFormStyle={styles.authFormSpacingCompact}
      topAction={
        <ScreenCornerNavButton
          icon="back"
          onPress={() => navigation.replace("Login")}
          accessibilityLabel={t("common:back", { defaultValue: "Wróć" })}
          testID="register-back-button"
          containerStyle={styles.backButton}
        />
      }
      banner={
        !isConnected ? (
          <ErrorBox
            message={t("common:no_internet")}
            testID="register-error-banner"
          />
        ) : errors.general ? (
          <ErrorBox
            message={t(errors.general)}
            testID="register-error-banner"
          />
        ) : null
      }
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.helperText}>{t("already_have_account")} </Text>
          <LinkText
            text={t("sign_in")}
            onPress={() => navigation.replace("Login")}
            disabled={loading}
          />
        </View>
      }
      bottomAction={
        <Button
          testID="register-submit-button"
          label={t("sign_up")}
          onPress={handleSubmit}
          disabled={isFormDisabled}
          loading={loading}
        />
      }
    >
      <View style={styles.formBlock}>
        <TextInput
          testID="register-username-input"
          label={t("username")}
          value={username}
          autoComplete="username"
          textContentType="username"
          placeholder={t("enter_username")}
          onChangeText={(val) => {
            setUsername(val);
            clearFieldError("username");
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
          error={usernameError}
          accessibilityLabel={t("username")}
          editable={!loading}
          icon={<AppIcon name="person" />}
          iconPosition="right"
          style={styles.field}
        />

        <TextInput
          testID="register-email-input"
          label={t("email", { ns: "login" })}
          value={email}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder={t("enter_email", { ns: "login" })}
          onChangeText={(val) => {
            setEmail(val);
            clearFieldError("email");
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          error={emailError}
          accessibilityLabel={t("email", { ns: "login" })}
          editable={!loading}
          icon={<AppIcon name="email" />}
          iconPosition="right"
          style={styles.field}
        />

        <TextInput
          testID="register-password-input"
          label={t("password", { ns: "login" })}
          value={password}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t("enter_password", { ns: "login" })}
          secureTextEntry={!showPassword}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          onChangeText={(val) => {
            setPassword(val);
            clearFieldError("password");
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={passwordError}
          accessibilityLabel={t("password", { ns: "login" })}
          left={<AppIcon name="lock" size={20} color={theme.textSecondary} />}
          right={renderEyeIcon(
            showPassword,
            () => setShowPassword((v) => !v),
            "register-password-visibility-toggle",
          )}
          editable={!loading}
          style={styles.field}
        />

        <TextInput
          testID="register-confirm-password-input"
          label={t("confirm_password")}
          value={confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t("enter_confirm_password")}
          secureTextEntry={!showConfirm}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          onChangeText={(val) => {
            setConfirmPassword(val);
            clearFieldError("confirmPassword");
          }}
          onBlur={() =>
            setTouched((prev) => ({ ...prev, confirmPassword: true }))
          }
          error={confirmPasswordError}
          accessibilityLabel={t("confirm_password")}
          left={<AppIcon name="lock" size={20} color={theme.textSecondary} />}
          right={renderEyeIcon(
            showConfirm,
            () => setShowConfirm((v) => !v),
            "register-confirm-password-visibility-toggle",
          )}
          editable={!loading}
          style={styles.confirmField}
        />

        <View style={styles.legalSection}>
          <View style={styles.termsRow}>
            <Checkbox
              testID="register-terms-checkbox"
              checked={termsAccepted}
              onChange={(checked) => {
                setTermsAccepted(checked);
                clearFieldError("terms");
              }}
              disabled={loading}
              error={Boolean(errors.terms)}
              accessibilityLabel={
                errors.terms ? t(errors.terms) : t("accept_terms_full")
              }
              style={styles.termsCheckbox}
            />
            <View style={styles.termsCopy}>
              <View style={styles.termsLine}>
                <Text
                  style={[
                    styles.helperText,
                    errors.terms ? styles.termsTextError : null,
                  ]}
                >
                  {t("accept_terms")}{" "}
                </Text>
                <LinkText
                  text={t("terms")}
                  style={errors.terms ? styles.termsLinkError : undefined}
                  onPress={() => {
                    const url = getTermsUrl();
                    if (url) void Linking.openURL(url);
                  }}
                />
                <Text
                  style={[
                    styles.helperText,
                    errors.terms ? styles.termsTextError : null,
                  ]}
                >
                  {` ${t("terms_conjunction")} `}
                </Text>
                <LinkText
                  text={t("privacy_policy")}
                  style={errors.terms ? styles.termsLinkError : undefined}
                  onPress={() => navigation.navigate("Privacy")}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    authFormSpacing: {
      paddingTop: theme.spacing.lg,
    },
    authFormSpacingCompact: {
      paddingTop: theme.spacing.sm,
    },
    backButton: {
      top: theme.spacing.xs,
      left: 0,
      right: undefined,
    },
    formBlock: {
      width: "100%",
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    field: {
      marginBottom: theme.spacing.lg,
    },
    confirmField: {
      marginBottom: theme.spacing.sectionGap,
    },
    legalSection: {
      marginBottom: theme.spacing.sm,
    },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      width: "100%",
    },
    termsCheckbox: {
      marginRight: theme.spacing.sm,
      marginTop: theme.spacing.xxs,
    },
    termsCopy: {
      flex: 1,
    },
    termsLine: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    helperText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    termsTextError: {
      color: theme.error.text,
    },
    termsLinkError: {
      color: theme.error.text,
    },
  });
