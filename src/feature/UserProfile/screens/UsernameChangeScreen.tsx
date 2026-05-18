import { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { ErrorBox, FormScreenShell, TextInput } from "@/components";
import { useUserAccountContext } from "@/context/UserAccountContext";
import { useUserProfileContext } from "@/context/UserProfileContext";
import {
  isUsernameAvailable,
  normalizeUsername,
} from "@/services/user/usernameService";

function mapFirebaseErrorToKey(code: string): string {
  switch (code) {
    case "auth/wrong-password":
      return "invalid_password";
    case "auth/too-many-requests":
      return "too_many_requests";
    case "auth/user-not-found":
      return "invalid_email_or_password";
    case "auth/not-logged-in":
      return "invalid_password";
    case "username/unavailable":
      return "usernameTaken";
    case "username/invalid":
      return "usernameTooShort";
    default:
      return "default_error";
  }
}

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

type UsernameChangeNavigation = StackNavigationProp<
  RootStackParamList,
  "UsernameChange"
>;

type UsernameChangeScreenProps = {
  navigation: UsernameChangeNavigation;
};

export default function UsernameChangeScreen({
  navigation,
}: UsernameChangeScreenProps) {
  const { t } = useTranslation(["profile", "login", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { changeUsername } = useUserAccountContext();
  const { userData } = useUserProfileContext();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);
  const availabilityRequestRef = useRef(0);

  const runAvailabilityCheck = async (rawValue: string) => {
    const candidate = normalizeUsername(rawValue);
    if (!candidate || candidate.length < 3) {
      setErrors((current) => ({ ...current, username: undefined }));
      setAvailabilityHint(null);
      return;
    }

    if (candidate === normalizeUsername(userData?.username || "")) {
      setErrors((current) => ({
        ...current,
        username: t("usernameCurrentHelper", {
        }),
      }));
      setAvailabilityHint(
        t("usernameCurrentHelper", {
        }),
      );
      return;
    }

    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    setCheckingAvailability(true);
    setAvailabilityHint(null);

    try {
      const available = await isUsernameAvailable(candidate, userData?.uid);
      if (availabilityRequestRef.current !== requestId) {
        return;
      }

      if (available) {
        setErrors((current) => ({ ...current, username: undefined }));
        setAvailabilityHint(t("usernameAvailable"));
      } else {
        setErrors((current) => ({
          ...current,
          username: t("usernameTaken"),
        }));
      }
    } catch {
      if (availabilityRequestRef.current === requestId) {
        setAvailabilityHint(null);
      }
    } finally {
      if (availabilityRequestRef.current === requestId) {
        setCheckingAvailability(false);
      }
    }
  };

  const validate = async () => {
    const newErrors: { username?: string; password?: string } = {};
    const candidate = normalizeUsername(username);

    if (!candidate) {
      newErrors.username = t("usernameRequired");
    } else if (candidate.length < 3) {
      newErrors.username = t("usernameTooShort");
    } else if (candidate === normalizeUsername(userData?.username || "")) {
      newErrors.username = t("usernameCurrentHelper", {
      });
    } else {
      const available = await isUsernameAvailable(candidate, userData?.uid);
      if (!available) {
        newErrors.username = t("usernameTaken");
      }
    }

    if (!password) {
      newErrors.password = t("passwordRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length ? newErrors : null;
  };

  const onSubmit = async () => {
    setTouched({ username: true, password: true });
    setCriticalError(null);
    setLoading(true);

    const validationErrors = await validate();
    if (validationErrors) {
      setLoading(false);
      return;
    }

    try {
      await changeUsername(normalizeUsername(username), password);
      navigation.goBack();
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const errKey = code ? mapFirebaseErrorToKey(code) : "default_error";

      if (errKey === "invalid_password") {
        setErrors((current) => ({
          ...current,
          password: t("invalid_password", { ns: "login" }),
        }));
        setCriticalError(null);
      } else if (errKey === "usernameTaken" || errKey === "usernameTooShort") {
        setErrors((current) => ({
          ...current,
          username: t(errKey),
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

  const usernameHelper =
    touched.username && !errors.username
      ? checkingAvailability
        ? t("checkingUsername")
        : availabilityHint
      : undefined;

  return (
    <FormScreenShell
      testID="username-change-screen"
      title={t("changeUsername")}
      intro={t("changeUsernameIntro", {
      })}
      onBack={() => navigation.goBack()}
      actionLabel={t("save", { ns: "common" })}
      onActionPress={() => {
        void onSubmit();
      }}
      actionLoading={loading}
      actionDisabled={
        loading ||
        checkingAvailability ||
        !username ||
        !password ||
        Boolean(errors.username) ||
        Boolean(errors.password)
      }
      secondaryActionLabel={t("cancel")}
      secondaryActionPress={() => navigation.goBack()}
      secondaryActionDisabled={loading}
    >
      <View style={styles.content}>
        {criticalError ? <ErrorBox message={criticalError} /> : null}

        <TextInput
          label={t("newUsername")}
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setAvailabilityHint(null);
            setErrors((current) => ({ ...current, username: undefined }));
          }}
          onBlur={() => {
            setTouched((current) => ({ ...current, username: true }));
            void runAvailabilityCheck(username);
          }}
          placeholder={t("newUsernamePlaceholder")}
          autoCorrect={false}
          autoCapitalize="none"
          error={touched.username ? errors.username : undefined}
          helperText={usernameHelper ?? undefined}
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
          textContentType="password"
          autoComplete="current-password"
          error={touched.password ? errors.password : undefined}
          disabled={loading}
        />
      </View>
    </FormScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.screenPadding,
    },
  });
