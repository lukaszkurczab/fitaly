import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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
} from "@/components";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
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
        <View style={styles.emptyStateWrap} testID="account-loading-state">
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
        <View style={styles.emptyStateWrap} testID="account-empty-state">
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
    titleStyle: styles.accountRowTitle,
    subtitleStyle: styles.accountRowSubtitle,
    chevronSize: 20,
  };

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
            badge={<Text style={styles.identityBadge}>{planLabel}</Text>}
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
                  testID="account-sync-retry-button"
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
  const items = Children.toArray(children).filter(
    (child) => child !== null && child !== undefined,
  );

  return (
    <View style={styles.accountSection}>
      <Text style={styles.accountSectionTitle} accessibilityRole="header">
        {title}
      </Text>

      <View style={styles.sectionGroup}>
        {items.map((child, index) => {
          if (!isValidElement(child)) {
            return child;
          }

          const element = child as ReactElement<{ showDivider?: boolean }>;
          if (element.props.showDivider !== undefined) {
            return cloneElement(element, {
              key: element.key ?? `account-overview-section-item-${index}`,
            });
          }

          return cloneElement(element, {
            key: element.key ?? `account-overview-section-item-${index}`,
            showDivider: index < items.length - 1,
          });
        })}
      </View>
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.sectionGap,
    },
    hero: {
      gap: theme.spacing.md,
    },
    identityCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.cardPadding,
      ...theme.depth.raised,
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
      ...theme.depth.raised,
    },
    accountSection: {
      gap: theme.spacing.xs,
    },
    accountSectionTitle: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      paddingHorizontal: theme.spacing.sm,
    },
    accountRow: {
      minHeight: 54,
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm - 2,
    },
    accountRowTitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    accountRowSubtitle: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: theme.rounded.sm,
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
      overflow: "hidden",
      color: theme.primaryStrong,
      backgroundColor: theme.success.surface,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.rounded.full,
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
