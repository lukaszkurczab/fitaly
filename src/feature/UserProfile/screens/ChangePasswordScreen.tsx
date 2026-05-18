import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { ErrorBox, FormScreenShell, TextInput } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useUserAccountContext } from "@/context/UserAccountContext";
import { isOfflineNetState } from "@/services/core/networkState";

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

type ChangePasswordNavigation = StackNavigationProp<
  RootStackParamList,
  "ChangePassword"
>;

type ChangePasswordScreenProps = {
  navigation: ChangePasswordNavigation;
};

export default function ChangePasswordScreen({
  navigation,
}: ChangePasswordScreenProps) {
  const { t } = useTranslation(["profile", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { changePassword } = useUserAccountContext();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({
    old: false,
    next: false,
    confirm: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [noInternet, setNoInternet] = useState(false);

  useEffect(() => {
    void NetInfo.fetch().then((state) => {
      setNoInternet(isOfflineNetState(state));
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setNoInternet(isOfflineNetState(state));
    });

    return () => unsubscribe();
  }, []);

  const validate = () => {
    if (!oldPassword) return t("enter_current_password");
    if (!newPassword) return t("enter_new_password");
    if (newPassword.length < 8) {
      return t("password_min_length", { count: 8 });
    }
    if (newPassword !== confirmPassword) {
      return t("passwords_do_not_match");
    }
    if (oldPassword === newPassword) {
      return t("new_password_must_be_different");
    }
    return null;
  };

  const handleSubmit = async () => {
    setTouched({ old: true, next: true, confirm: true });
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      navigation.goBack();
    } catch (err: unknown) {
      const code = getErrorCode(err);
      let message = t("default_error", { ns: "common" });

      if (code === "auth/wrong-password") {
        message = t("invalid_current_password");
      } else if (code === "auth/weak-password") {
        message = t("weak_password");
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderVisibilityToggle = (isVisible: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isVisible
          ? t("hide_password", { ns: "common", defaultValue: "Hide password" })
          : t("show_password", { ns: "common", defaultValue: "Show password" })
      }
    >
      <AppIcon
        name={isVisible ? "eye-off" : "eye"}
        size={20}
        color={theme.textSecondary}
      />
    </Pressable>
  );

  return (
    <FormScreenShell
      testID="password-change-screen"
      title={t("change_password")}
      intro={t("changePasswordIntro", {
        defaultValue:
          "Choose a new password for your account. You’ll need your current one to confirm.",
      })}
      onBack={() => navigation.goBack()}
      actionLabel={t("save", { ns: "common" })}
      onActionPress={() => {
        void handleSubmit();
      }}
      actionLoading={loading}
      actionDisabled={
        loading ||
        noInternet ||
        !oldPassword ||
        !newPassword ||
        !confirmPassword
      }
      secondaryActionLabel={t("cancel")}
      secondaryActionPress={() => navigation.goBack()}
      secondaryActionDisabled={loading}
    >
      <View style={styles.content}>
        {noInternet ? (
          <ErrorBox message={t("no_internet", { ns: "common" })} />
        ) : null}
        {error ? <ErrorBox message={error} /> : null}

        <TextInput
          label={t("old_password")}
          value={oldPassword}
          onChangeText={setOldPassword}
          onBlur={() => setTouched((current) => ({ ...current, old: true }))}
          placeholder={t("enter_current_password")}
          secureTextEntry={!showOldPassword}
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          error={
            touched.old && !oldPassword
              ? t("enter_current_password")
              : undefined
          }
          right={renderVisibilityToggle(showOldPassword, () =>
            setShowOldPassword((current) => !current),
          )}
        />

        <TextInput
          label={t("new_password")}
          value={newPassword}
          onChangeText={setNewPassword}
          onBlur={() => setTouched((current) => ({ ...current, next: true }))}
          placeholder={t("enter_new_password")}
          secureTextEntry={!showNewPassword}
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          error={
            touched.next && !newPassword ? t("enter_new_password") : undefined
          }
          right={renderVisibilityToggle(showNewPassword, () =>
            setShowNewPassword((current) => !current),
          )}
        />

        <TextInput
          label={t("confirm_new_password")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={() =>
            setTouched((current) => ({ ...current, confirm: true }))
          }
          placeholder={t("repeat_new_password")}
          secureTextEntry={!showConfirmPassword}
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          error={
            touched.confirm && confirmPassword !== newPassword
              ? t("passwords_do_not_match")
              : undefined
          }
          right={renderVisibilityToggle(showConfirmPassword, () =>
            setShowConfirmPassword((current) => !current),
          )}
        />
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
