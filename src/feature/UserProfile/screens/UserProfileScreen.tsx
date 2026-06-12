import { useMemo, useState, type ReactNode } from "react";
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
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import AvatarBadge from "@/components/AvatarBadge";
import { usePremiumContext } from "@/context/PremiumContext";
import { AccountIdentityCard } from "@/feature/UserProfile/components/AccountIdentityCard";
import { useUserProfileState } from "@/feature/UserProfile/hooks/useUserProfileState";
import type { ProfileSyncState } from "@/hooks/useUserProfile";

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
        <View style={styles.emptyStateWrap} testID="account-loading-state">
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateSpinnerWrap}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
            <Text style={styles.emptyStateDescription}>
              {t("common:loading")}
            </Text>
          </View>
        </View>
      </Layout>
    );
  }

  if (!state.userData) {
    return (
      <Layout>
        <View style={styles.emptyStateWrap} testID="account-empty-state">
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>
              {t("profileUnavailableTitle")}
            </Text>
            <Text style={styles.emptyStateDescription}>
              {state.isOnline
                ? t("profileUnavailableDesc")
                : t("profileUnavailableOfflineDesc")}
            </Text>
            <Button
              testID="account-empty-retry-button"
              label={t("common:retry")}
              onPress={() => {
                void state.handleRetryProfileLoad();
              }}
              style={styles.emptyStateAction}
            />
          </View>
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
  const accountRowProps = {
    style: styles.accountRow,
    chevronSize: 20,
  };
  const syncNotice =
    state.syncState === "synced"
      ? null
      : getProfileSyncNotice({
          syncState: state.syncState,
          hasAvatarUploadDeadLetter: state.hasAvatarUploadDeadLetter,
          theme,
        });

  return (
    <Layout>
      <View style={styles.content} testID="account-screen">
        <View style={styles.hero}>
          <AccountIdentityCard
            testID="account-identity-card"
            style={styles.identityCard}
            titleStyle={styles.identityTitle}
            subtitleStyle={styles.identitySubtitle}
            avatar={
              <AvatarBadge
                size={64}
                uri={state.avatarSrc || undefined}
                badges={state.safeBadges}
                overrideColor={state.overrideColor}
                overrideEmoji={state.overrideEmoji}
                fallbackIcon={
                  <AppIcon
                    name="person"
                    size={32}
                    color={theme.textSecondary}
                  />
                }
                accessibilityLabel={t("profilePicture")}
              />
            }
            title={state.userData.username}
            subtitle={state.userData.email}
            badge={
              <View style={styles.identityBadge}>
                <Text style={styles.identityBadgeText}>{planLabel}</Text>
              </View>
            }
            accessory={
              <AppIcon
                name="chevron"
                rotation="180deg"
                size={20}
                color={theme.textSecondary}
              />
            }
            onPress={() => navigation.navigate("EditUserData")}
          />

          {syncNotice ? (
            <View style={styles.syncStack}>
              <InfoBlock
                testID={`account-sync-${state.syncState}-notice`}
                title={t(syncNotice.titleKey)}
                body={t(syncNotice.bodyKey)}
                tone={syncNotice.tone}
                icon={
                  <AppIcon
                    name={syncNotice.icon}
                    size={18}
                    color={syncNotice.iconColor}
                  />
                }
              />

              {state.syncState === "dead-letter" ? (
                <View style={styles.syncActionRow}>
                  {state.hasAvatarUploadDeadLetter ? (
                    <Button
                      testID="account-sync-avatar-discard-button"
                      label={t("sync.discardAvatarUpload")}
                      variant="secondary"
                      fullWidth={false}
                      loading={state.retryingProfileSync}
                      onPress={() => {
                        void state.discardAvatarUploadDeadLetter();
                      }}
                    />
                  ) : null}
                  <Button
                    testID="account-sync-retry-button"
                    label={t("sync.retry")}
                    variant="secondary"
                    fullWidth={false}
                    loading={state.retryingProfileSync}
                    onPress={() => {
                      void state.retryProfileSync();
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <AccountOverviewSection
          styles={styles}
          title={t("profileSectionTitle")}
        >
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "palette", theme.accentWarmStrong)}
            title={t("updateHealthSurvey")}
            titleNumberOfLines={2}
            onPress={() =>
              navigation.navigate("OnboardingRefill", { mode: "refill" })
            }
          />
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "star", theme.primaryStrong)}
            title={t("manageSubscription.title")}
            testID="account-manage-subscription-row"
            onPress={() => navigation.navigate("ManageSubscription")}
          />
        </AccountOverviewSection>

        <AccountOverviewSection
          styles={styles}
          title={t("legalPrivacySectionTitle")}
        >
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "lock", theme.primaryStrong)}
            title={t("legalPrivacyHubRowTitle")}
            subtitle={t("legalPrivacyHubRowSubtitle")}
            subtitleNumberOfLines={2}
            testID="account-legal-privacy-row"
            onPress={() => navigation.navigate("LegalPrivacyHub")}
          />
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "help", theme.accentWarmStrong)}
            title={t("helpFeedbackHubRowTitle")}
            subtitle={t("helpFeedbackHubRowSubtitle")}
            subtitleNumberOfLines={2}
            testID="account-help-feedback-row"
            onPress={() => navigation.navigate("HelpFeedback")}
          />
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "settings", theme.primaryStrong)}
            title={t("appSettingsHubRowTitle")}
            subtitle={t("appSettingsHubRowSubtitle")}
            testID="account-app-settings-row"
            onPress={() => navigation.navigate("AppSettings")}
          />
        </AccountOverviewSection>

        <AccountOverviewSection
          styles={styles}
          title={t("accountActionsSectionTitle")}
        >
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "arrow", theme.textSecondary)}
            title={t("logOut")}
            subtitle={t("logOutSubtitle")}
            testID="account-logout-row"
            onPress={() => setLogoutModalVisible(true)}
            showChevron={false}
          />
          <SettingsRow
            {...accountRowProps}
            leading={renderRowIcon(styles, "delete", theme.error.text)}
            title={t("deleteAccount")}
            subtitle={t("deleteAccountSubtitle")}
            testID="account-delete-account-row"
            onPress={() => navigation.navigate("DeleteAccount")}
          />
        </AccountOverviewSection>

        <Text style={styles.version}>{t("appVersion")} 1.0.1</Text>
      </View>

      <Modal
        testID="account-logout-modal"
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

function getProfileSyncNotice(params: {
  syncState: Exclude<ProfileSyncState, "synced">;
  hasAvatarUploadDeadLetter: boolean;
  theme: ReturnType<typeof useTheme>;
}): {
  titleKey: string;
  bodyKey: string;
  tone: "info" | "warning";
  icon: AppIconName;
  iconColor: string;
} {
  if (params.syncState === "pending") {
    return {
      titleKey: "sync.pendingTitle",
      bodyKey: "sync.pending",
      tone: "info",
      icon: "info",
      iconColor: params.theme.info.text,
    };
  }

  return {
    titleKey: params.hasAvatarUploadDeadLetter
      ? "sync.avatarDeadLetterTitle"
      : "sync.deadLetterTitle",
    bodyKey: params.hasAvatarUploadDeadLetter
      ? "sync.avatarDeadLetter"
      : "sync.deadLetter",
    tone: "warning",
    icon: "refresh",
    iconColor: params.theme.warning.text,
  };
}

const renderRowIcon = (
  styles: ReturnType<typeof makeStyles>,
  name: AppIconName,
  color: string,
) => (
  <View style={styles.rowIcon}>
    <AppIcon name={name} size={18} color={color} />
  </View>
);

const AccountOverviewSection = ({
  styles,
  title,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  children: ReactNode;
}) => {
  return (
    <SettingsSection
      title={title}
      style={styles.accountSection}
      contentStyle={styles.sectionGroup}
    >
      {children}
    </SettingsSection>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
      paddingBottom: theme.spacing.sectionGap,
    },
    hero: {
      gap: theme.spacing.md,
    },
    identityCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.cardPadding,
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(207, 197, 184, 0.52)",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.74)"
        : "rgba(255, 253, 248, 0.72)",
    },
    identityTitle: {
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    identitySubtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    sectionGroup: {
      borderColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(207, 197, 184, 0.46)",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.68)"
        : "rgba(255, 253, 248, 0.58)",
    },
    accountSection: {
      gap: theme.spacing.sm,
    },
    accountRow: {
      minHeight: 64,
      borderBottomColor: theme.isDark
        ? "rgba(255, 253, 248, 0.08)"
        : "rgba(207, 197, 184, 0.42)",
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    screenTitle: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
    },
    identityBadge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
    },
    identityBadgeText: {
      overflow: "hidden",
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    syncStack: {
      gap: theme.spacing.sm,
    },
    syncActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
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
      paddingVertical: theme.spacing.display,
    },
    emptyStateCard: {
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.bottomSheetPadding,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.92)"
        : "rgba(255, 253, 248, 0.88)",
      ...theme.depth.raised,
    },
    emptyStateSpinnerWrap: {
      width: 48,
      height: 48,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
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
