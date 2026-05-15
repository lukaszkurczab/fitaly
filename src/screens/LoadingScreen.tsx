import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button, Layout } from "@/components";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useTheme } from "@/theme/useTheme";

export default function LoadingScreen() {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {
    profileBootstrapState,
    profileBootstrapError,
    refreshUser,
  } = useUserProfileContext();
  const [retrying, setRetrying] = useState(false);
  const isBootstrapFailed = profileBootstrapState === "bootstrapFailed";
  const handleRetry = () => {
    setRetrying(true);
    void (async () => {
      try {
        await refreshUser();
      } catch {
        // The profile hook keeps bootstrapFailed state and exposes retry again.
      } finally {
        setRetrying(false);
      }
    })();
  };

  return (
    <Layout showNavigation={false} disableScroll>
      <View style={styles.centerBoth}>
        {isBootstrapFailed ? (
          <View style={styles.errorWrap}>
            <Text style={styles.title}>{t("profileLoadError.title")}</Text>
            <Text style={styles.message}>
              {profileBootstrapError
                ? t("profileLoadError.body")
                : t("profileLoadError.offlineBody")}
            </Text>
            <Button
              label={t("retry")}
              loading={retrying}
              onPress={handleRetry}
              style={styles.retryButton}
            />
          </View>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} />
        )}
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    centerBoth: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorWrap: {
      alignSelf: "stretch",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      textAlign: "center",
    },
    message: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      textAlign: "center",
    },
    retryButton: {
      marginTop: theme.spacing.sm,
    },
  });
