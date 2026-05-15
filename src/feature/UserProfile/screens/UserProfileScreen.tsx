import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  InfoBlock,
  Layout,
  Modal,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import AvatarBadge from "@/components/AvatarBadge";
import { usePremiumContext } from "@/context/PremiumContext";
import { AccountIdentityCard } from "@/feature/UserProfile/components/AccountIdentityCard";
import { useUserProfileState } from "@/feature/UserProfile/hooks/useUserProfileState";

type ProfileNavigation = StackNavigationProp<RootStackParamList, "Profile">;

type UserProfileScreenProps = {
  navigation: ProfileNavigation;
};

export default function UserProfileScreen({
  navigation,
}: UserProfileScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const state = useUserProfileState({ navigation });
  const { isPremium } = usePremiumContext();
  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);

  const closeLogoutModal = () => setLogoutModalVisible(false);

  const confirmLogout = () => {
    closeLogoutModal();
    void state.handleLogout();
  };

  if (state.loadingUser) {
    return (
      <Layout>
        <View style={styles.emptyStateWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.emptyStateDescription}>
            {t("common:loading")}
          </Text>
        </View>
      </Layout>
    );
  }

  if (!state.userData) {
    return (
      <Layout>
        <View style={styles.emptyStateWrap}>
          <Text style={styles.emptyStateTitle}>
            {t("profileUnavailableTitle")}
          </Text>
          <Text style={styles.emptyStateDescription}>
            {state.isOnline
              ? t("profileUnavailableDesc")
              : t("profileUnavailableOfflineDesc")}
          </Text>
          <Button
            label={t("common:retry")}
            onPress={() => {
              void state.handleRetryProfileLoad();
            }}
            style={styles.emptyStateAction}
          />
        </View>
      </Layout>
    );
  }

  const planLabel =
    isPremium === true
      ? t("manageSubscription.premium")
      : isPremium === null
        ? t("manageSubscription.subscriptionUnknown", {
            defaultValue: "Cannot confirm premium",
          })
        : t("manageSubscription.free");
  return (
    <Layout>
      <View style={styles.content}>
        <View style={styles.hero}>
          <AccountIdentityCard
            avatar={
              <AvatarBadge
                size={72}
                uri={state.avatarSrc || undefined}
                badges={state.safeBadges}
                overrideColor={state.overrideColor}
                overrideEmoji={state.overrideEmoji}
                fallbackIcon={
                  <AppIcon
                    name="person"
                    size={36}
                    color={theme.textSecondary}
                  />
                }
                accessibilityLabel={t("profilePicture")}
              />
            }
            title={state.userData.username}
            subtitle={state.userData.email}
            badge={<Text style={styles.identityBadge}>{planLabel}</Text>}
            onPress={() => navigation.navigate("EditUserData")}
          />

          {state.syncState !== "synced" ? (
            <View style={styles.syncStack}>
              <InfoBlock
                title={
                  state.syncState === "pending"
                    ? t("sync.pendingTitle")
                    : t("sync.conflictTitle")
                }
                body={
                  state.syncState === "pending"
                    ? t("sync.pending")
                    : t("sync.conflict")
                }
                tone={state.syncState === "pending" ? "info" : "warning"}
                icon={
                  <AppIcon
                    name={state.syncState === "pending" ? "info" : "refresh"}
                    size={18}
                    color={
                      state.syncState === "pending"
                        ? theme.info.text
                        : theme.warning.text
                    }
                  />
                }
              />

              {state.syncState === "conflict" ? (
                <Button
                  label={t("sync.retry")}
                  variant="secondary"
                  fullWidth={false}
                  loading={state.retryingProfileSync}
                  onPress={() => {
                    void state.retryProfileSync();
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <SettingsSection title={t("profileSectionTitle")}>
          <SettingsRow
            title={t("profileDetailsLabel")}
            testID="account-profile-details-row"
            onPress={() => navigation.navigate("EditUserData")}
          />
          <SettingsRow
            title={t("updateHealthSurvey")}
            onPress={() =>
              navigation.navigate("Onboarding", { mode: "refill" })
            }
          />
        </SettingsSection>

        <SettingsSection title={t("membershipSectionTitle")}>
          <SettingsRow
            title={t("manageSubscription.title")}
            testID="account-manage-subscription-row"
            onPress={() => navigation.navigate("ManageSubscription")}
          />
        </SettingsSection>

        <SettingsSection title={t("legalPrivacySectionTitle")}>
          <SettingsRow
            title={t("legalPrivacyHubRowTitle")}
            testID="account-legal-privacy-row"
            onPress={() => navigation.navigate("LegalPrivacyHub")}
          />
        </SettingsSection>

        <SettingsSection title={t("helpFeedbackSectionTitle")}>
          <SettingsRow
            title={t("helpFeedbackHubRowTitle")}
            testID="account-help-feedback-row"
            onPress={() => navigation.navigate("HelpFeedback")}
          />
        </SettingsSection>

        <SettingsSection title={t("appSettingsSectionTitle")}>
          <SettingsRow
            title={t("appSettingsHubRowTitle")}
            testID="account-app-settings-row"
            onPress={() => navigation.navigate("AppSettings")}
          />
        </SettingsSection>

        <SettingsSection title={t("accountActionsSectionTitle")}>
          <SettingsRow
            title={t("logOut")}
            testID="account-logout-row"
            onPress={() => setLogoutModalVisible(true)}
            showChevron={false}
          />
          <SettingsRow
            title={t("deleteAccount")}
            testID="account-delete-account-row"
            onPress={() => navigation.navigate("DeleteAccount")}
          />
        </SettingsSection>

        <Text style={styles.version}>{t("appVersion")} 1.0.1</Text>
      </View>

      <Modal
        visible={isLogoutModalVisible}
        title={t("logOutConfirmTitle")}
        message={t("logOutConfirmMessage")}
        onClose={closeLogoutModal}
        primaryAction={{
          label: t("logOutConfirmAction"),
          onPress: confirmLogout,
          tone: "destructive",
          testID: "account-logout-confirm-button",
        }}
        secondaryAction={{
          label: t("cancel"),
          onPress: closeLogoutModal,
          testID: "account-logout-cancel-button",
        }}
      />
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
      paddingBottom: theme.spacing.sectionGap,
    },
    hero: {
      gap: theme.spacing.lg,
    },
    screenTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
    },
    identityBadge: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    syncStack: {
      gap: theme.spacing.sm,
    },
    version: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      textAlign: "center",
      paddingTop: theme.spacing.sm,
    },
    emptyStateWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.display,
    },
    emptyStateTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      textAlign: "center",
    },
    emptyStateDescription: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      textAlign: "center",
      maxWidth: 320,
    },
    emptyStateAction: {
      marginTop: theme.spacing.sm,
    },
  });
