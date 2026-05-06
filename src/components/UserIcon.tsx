import React, { useState, useEffect, useMemo } from "react";
import { View, Image, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { useTranslation } from "react-i18next";

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  avatarLocalPath?: string | null;
  avatarUrl?: string | null;
  isPremium?: boolean;
};

export const UserIcon: React.FC<Props> = ({
  size = 120,
  style,
  accessibilityLabel,
  isPremium = false,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { userData } = useUserProfileContext();
  const { t } = useTranslation("common");

  const borderColor = isPremium ? theme.macro.fat : theme.surfaceElevated;
  const borderWidth = isPremium ? 4 : 2;
  const sourceUri = userData
    ? userData.avatarLocalPath || userData.avatarUrl || null
    : null;
  const [error, setError] = useState(false);
  const containerStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth,
      borderColor,
    }),
    [size, borderWidth, borderColor],
  );
  const imageStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  const premiumBadgeStyle = useMemo(
    () => ({
      borderRadius: size * 0.18,
      padding: size * 0.06,
    }),
    [size],
  );

  const computedLabel = accessibilityLabel ?? t("user.avatar_accessibility");

  useEffect(() => {
    setError(false);
  }, [sourceUri]);

  return (
    <View
      style={[styles.container, containerStyle, style]}
      accessible
      accessibilityLabel={computedLabel}
    >
      {sourceUri && !error ? (
        <Image
          source={{ uri: sourceUri }}
          style={imageStyle}
          onError={() => setError(true)}
        />
      ) : (
        <AppIcon name="person" size={size * 0.66} color={theme.textSecondary} />
      )}

      {isPremium && (
        <View
          style={[styles.premiumBadge, premiumBadgeStyle]}
          accessible
          accessibilityLabel={t("user.premium_badge_accessibility")}
        >
          <AppIcon name="star" size={size * 0.22} color={theme.macro.fat} />
        </View>
      )}
    </View>
  );
};

export default UserIcon;

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.surfaceElevated,
      position: "relative",
    },
    premiumBadge: {
      position: "absolute",
      bottom: theme.spacing.sm,
      right: theme.spacing.sm,
      backgroundColor: theme.surfaceElevated,
      elevation: 3,
    },
  });
