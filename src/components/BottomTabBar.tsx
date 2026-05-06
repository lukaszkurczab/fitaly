import React, { useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useTheme } from "@/theme/useTheme";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import type { RootStackParamList } from "@/navigation/navigate";
import AvatarBadge from "@/components/AvatarBadge";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useBadges } from "@/hooks/useBadges";
import { useAuthContext } from "@/context/AuthContext";
import { usePremiumContext } from "@/context/PremiumContext";
import { useTranslation } from "react-i18next";

const TAB_BUTTON_SIZE = 56;
const TAB_BAR_VERTICAL_PADDING = 12;

export const BOTTOM_TAB_BAR_BASE_HEIGHT =
  TAB_BUTTON_SIZE + TAB_BAR_VERTICAL_PADDING * 2;
export const BOTTOM_TAB_BAR_BOTTOM_OFFSET = 0;

type TabKey = "Home" | "Statistics" | "Chat" | "Profile";

function getActiveTab(routeName?: keyof RootStackParamList): TabKey | null {
  if (!routeName) return null;

  if (routeName === "Home" || routeName === "WeeklyReport") return "Home";
  if (routeName === "Statistics") return "Statistics";
  if (routeName === "Chat") return "Chat";

  if (
    [
      "Profile",
      "EditUserData",
      "ProfilePhotoPreview",
      "DeleteAccount",
      "AvatarCamera",
      "UsernameChange",
      "ChangeEmail",
      "ChangeEmailCheckMailbox",
      "ChangePassword",
      "LegalPrivacyHub",
      "DataAiClarity",
      "HelpFeedback",
      "ContactSupport",
      "AppSettings",
      "Language",
      "SendFeedback",
      "ManageSubscription",
      "Notifications",
    ].includes(routeName)
  ) {
    return "Profile";
  }

  return null;
}

export const BottomTabBar: React.FC = () => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentRouteName = useNavigationState(
    (state) =>
      state.routes[state.index]?.name as keyof RootStackParamList | undefined,
  );
  const { uid } = useAuthContext();
  const { userData } = useUserProfileContext();
  const { isPremium } = usePremiumContext();
  const { badges } = useBadges(uid);
  const { t } = useTranslation("common");

  const avatarSrc = userData?.avatarLocalPath || userData?.avatarUrl || "";
  const safeBadges = Array.isArray(badges) ? badges : [];
  const profileBadges = safeBadges.filter((badge) => badge.type !== "premium");
  const activeTab = getActiveTab(currentRouteName);

  let borderColor: string;
  if (isPremium) {
    borderColor = theme.chart.fat;
  } else if (safeBadges.some((b) => b.type === "streak")) {
    const streakBadges = safeBadges.filter((b) => b.type === "streak");
    streakBadges.sort(
      (a, b) => (b.milestone as number) - (a.milestone as number),
    );
    borderColor = streakBadges[0]?.color ?? theme.border;
  } else {
    borderColor = theme.border;
  }

  type TabItem = {
    key: string;
    icon: AppIconName;
    onPress: () => void;
    isFab?: boolean;
    activeKey?: TabKey;
  };

  const tabs: TabItem[] = [
    {
      key: "Home",
      icon: "home",
      onPress: () => navigation.navigate("Home"),
      activeKey: "Home",
    },
    {
      key: "Statistics",
      icon: "stats",
      onPress: () => navigation.navigate("Statistics"),
      activeKey: "Statistics",
    },
    {
      key: "Add",
      icon: "add",
      isFab: true,
      onPress: () =>
        navigation.navigate("MealAddMethod", {
          selectionMode: "temporary",
        }),
    },
    {
      key: "Chat",
      icon: "assistant",
      onPress: () => navigation.navigate("Chat"),
      activeKey: "Chat",
    },
    {
      key: "Profile",
      icon: "person",
      onPress: () => navigation.navigate("Profile"),
      activeKey: "Profile",
    },
  ];

  const testIdForTab = (key: string): string => {
    if (key === "Add") return "tab-add-meal";
    if (key === "Chat") return "tab-chat";
    if (key === "Statistics") return "tab-statistics";
    return `tab-${key.toLowerCase()}`;
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          if (tab.isFab) {
            return (
              <Pressable
                key={tab.key}
                onPress={tab.onPress}
                style={styles.fab}
                testID={testIdForTab(tab.key)}
              >
                <AppIcon
                  name={tab.icon}
                  size={32}
                  color={theme.cta.primaryText}
                  style={styles.iconCentered}
                />
              </Pressable>
            );
          }

          const isProfile = tab.key.toLowerCase() === "profile";
          const isActive = tab.activeKey === activeTab;

          return (
            <Pressable
              key={tab.key}
              onPress={tab.onPress}
              style={styles.tab}
              testID={testIdForTab(tab.key)}
              accessibilityState={{ selected: isActive }}
            >
              {isProfile ? (
                <View style={styles.tabInner}>
                  <AvatarBadge
                    size={34}
                    uri={avatarSrc || undefined}
                    badges={profileBadges}
                    overrideColor={isActive ? theme.primary : borderColor}
                    overrideEmoji={undefined}
                    fallbackIcon={
                      <AppIcon
                        name="person"
                        size={20}
                        color={isActive ? theme.primary : theme.textSecondary}
                      />
                    }
                    accessibilityLabel={t("tabs.profile_accessibility")}
                  />
                  <View
                    style={[
                      styles.indicator,
                      isActive && styles.indicatorActive,
                    ]}
                  />
                </View>
              ) : (
                <View style={styles.tabInner}>
                  <AppIcon
                    name={tab.icon}
                    size={26}
                    color={isActive ? theme.primary : theme.textSecondary}
                    style={styles.iconCentered}
                  />
                  <View
                    style={[
                      styles.indicator,
                      isActive && styles.indicatorActive,
                    ]}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrapper: {
      position: "absolute",
      bottom: 0,
      alignItems: "center",
    },
    container: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.surfaceElevated,
      borderTopEndRadius: theme.rounded.xl,
      borderTopStartRadius: theme.rounded.xl,
    },
    tab: {
      width: 56,
      height: 56,
      justifyContent: "center",
      alignItems: "center",
    },
    fab: {
      width: 56,
      height: 56,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.cta.primaryBackground,
      borderRadius: theme.rounded.full,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.24 : 0.14,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
      borderWidth: 1,
      borderColor: theme.primaryStrong,
    },
    iconCentered: {
      alignSelf: "center",
    },
    tabInner: {
      alignItems: "center",
      gap: 4,
    },
    indicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: "transparent",
    },
    indicatorActive: {
      backgroundColor: theme.primary,
    },
  });

export default BottomTabBar;
