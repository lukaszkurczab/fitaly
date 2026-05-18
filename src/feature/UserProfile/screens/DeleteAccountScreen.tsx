import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  FormScreenShell,
  InfoBlock,
  Modal,
  TextInput,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { useUserAccountContext } from "@/context/UserAccountContext";

type DeleteAccountNavigation = StackNavigationProp<
  RootStackParamList,
  "DeleteAccount"
>;

type DeleteAccountScreenProps = {
  navigation: DeleteAccountNavigation;
};

export default function DeleteAccountScreen({
  navigation,
}: DeleteAccountScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { deleteUser } = useUserAccountContext();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);

  const handleDelete = async () => {
    if (deleting || !password.trim()) {
      return;
    }

    setDeleting(true);

    try {
      await deleteUser(password);
      setPassword("");
    } catch {
      setErrorVisible(true);
      setPassword("");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <FormScreenShell
        testID="delete-account-screen"
        title={t("deleteAccount")}
        onBack={() => navigation.goBack()}
        actionLabel={t("deleteAccount")}
        onActionPress={() => {
          void handleDelete();
        }}
        actionTone="destructive"
        actionLoading={deleting}
        actionDisabled={!password.trim() || deleting}
        secondaryActionLabel={t("cancel")}
        secondaryActionPress={() => navigation.goBack()}
      >
        <View style={styles.content}>
          <InfoBlock
            title={t("deleteAccount")}
            body={t("deleteAccountWarning")}
            tone="error"
            icon={
              <AppIcon
                name="delete"
                size={18}
                color={theme.error.text}
              />
            }
          />

          <TextInput
            label={t("password")}
            placeholder={t("enterPassword")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCorrect={false}
            textContentType="password"
            accessibilityLabel={t("enterPassword")}
          />
        </View>
      </FormScreenShell>

      <Modal
        visible={errorVisible}
        title={t("deleteAccountError")}
        message={t("wrongPasswordOrUnknownError")}
        primaryAction={{
          label: t("confirm"),
          onPress: () => setErrorVisible(false),
        }}
        onClose={() => setErrorVisible(false)}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
  });
