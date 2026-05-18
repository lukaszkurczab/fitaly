import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { ErrorBox, FormScreenShell, InfoBlock, TextInput } from "@/components";
import AppIcon from "@/components/AppIcon";
import { useUserAccountContext } from "@/context/UserAccountContext";
import { useUserProfileContext } from "@/context/UserProfileContext";

function mapFirebaseErrorToKey(code: string): string {
  switch (code) {
    case "auth/wrong-password":
      return "invalid_password";
    case "auth/too-many-requests":
      return "too_many_requests";
    case "auth/email-already-in-use":
      return "email_in_use";
    case "auth/invalid-email":
      return "invalid_email";
    case "auth/not-logged-in":
      return "invalid_password";
    default:
      return "default_error";
  }
}

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

type ChangeEmailNavigation = StackNavigationProp<
  RootStackParamList,
  "ChangeEmail"
>;

type ChangeEmailScreenProps = {
  navigation: ChangeEmailNavigation;
};

export default function ChangeEmailScreen({
  navigation,
}: ChangeEmailScreenProps) {
  const { t } = useTranslation(["profile", "login", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { changeEmail } = useUserAccountContext();
  const { userData } = useUserProfileContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      newErrors.email = t("enter_email", { ns: "login" });
    } else if (!validateEmail(normalizedEmail)) {
      newErrors.email = t("invalid_email", { ns: "login" });
    } else if (
      normalizedEmail.toLowerCase() ===
      (userData?.email || "").trim().toLowerCase()
    ) {
      newErrors.email = t("changeEmailSameAddress", {
      });
    }

    if (!password) {
      newErrors.password = t("passwordRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length ? newErrors : null;
  };

  const onSubmit = async () => {
    setTouched({ email: true, password: true });
    setCriticalError(null);
    setLoading(true);

    const validationErrors = validate();
    if (validationErrors) {
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = email.trim();
      await changeEmail(normalizedEmail, password);
      navigation.replace("ChangeEmailCheckMailbox", {
        email: normalizedEmail,
      });
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const errKey = code ? mapFirebaseErrorToKey(code) : "default_error";

      if (errKey === "invalid_password") {
        setErrors((current) => ({
          ...current,
          password: t("invalid_password", { ns: "login" }),
        }));
        setCriticalError(null);
      } else if (errKey === "email_in_use" || errKey === "invalid_email") {
        setErrors((current) => ({
          ...current,
          email: t(errKey, { ns: "login" }),
        }));
        setCriticalError(null);
      } else if (errKey === "too_many_requests") {
        setCriticalError(t("too_many_requests", { ns: "login" }));
      } else {
        setCriticalError(t("default_error", { ns: "common" }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreenShell
      testID="email-change-screen"
      title={t("changeEmail")}
      intro={t("changeEmailIntro", {
      })}
      onBack={() => navigation.goBack()}
      actionLabel={t("continue", { ns: "common" })}
      onActionPress={() => {
        void onSubmit();
      }}
      actionLoading={loading}
      actionDisabled={
        loading ||
        !email ||
        !password ||
        Boolean(errors.email) ||
        Boolean(errors.password)
      }
      secondaryActionLabel={t("cancel")}
      secondaryActionPress={() => navigation.goBack()}
      secondaryActionDisabled={loading}
    >
      <View style={styles.content}>
        {criticalError ? <ErrorBox message={criticalError} /> : null}

        <TextInput
          label={t("newEmail")}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          placeholder={t("enter_email", { ns: "login" })}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={touched.email ? errors.email : undefined}
          disabled={loading}
        />

        <TextInput
          label={t("password")}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          onBlur={() =>
            setTouched((current) => ({ ...current, password: true }))
          }
          placeholder={t("passwordPlaceholder")}
          secureTextEntry
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          error={touched.password ? errors.password : undefined}
          disabled={loading}
        />

        <InfoBlock
          title={t("changeEmailSecurityTitle", {
          })}
          body={t("emailChangeSecurityNote")}
          tone="neutral"
          icon={<AppIcon name="email" size={18} color={theme.textSecondary} />}
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
