import { useMemo, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

export type AccountIdentityCardProps = {
  avatar?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  accessory?: ReactNode;
  showChevron?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
} & Pick<PressableProps, "onPress" | "testID" | "accessibilityLabel">;

export function AccountIdentityCard({
  avatar,
  title,
  subtitle,
  badge,
  accessory,
  showChevron,
  disabled = false,
  onPress,
  style,
  titleStyle,
  subtitleStyle,
  testID,
  accessibilityLabel,
}: AccountIdentityCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isPressable = typeof onPress === "function";
  const resolvedAccessory =
    accessory ??
    ((showChevron ?? isPressable) ? (
      <AppIcon
        name="chevron"
        rotation="180deg"
        size={24}
        color={disabled ? theme.textTertiary : theme.textSecondary}
      />
    ) : null);

  const content = (
    <>
      {avatar ? <View style={styles.avatar}>{avatar}</View> : null}

      <View style={styles.copy}>
        <Text
          style={[styles.title, titleStyle, disabled ? styles.mutedText : null]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              subtitleStyle,
              disabled ? styles.mutedText : null,
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>

      {resolvedAccessory ? (
        <View style={styles.accessory}>{resolvedAccessory}</View>
      ) : null}
    </>
  );

  if (!isPressable) {
    return (
      <View
        style={[styles.card, disabled ? styles.disabled : null, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.cardPaddingLarge,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
    },
    pressed: {
      backgroundColor: theme.surfaceAlt,
    },
    disabled: {
      opacity: 0.56,
    },
    avatar: {
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    subtitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    badge: {
      marginTop: theme.spacing.xs,
      alignSelf: "flex-start",
    },
    accessory: {
      alignItems: "center",
      justifyContent: "center",
    },
    mutedText: {
      color: theme.textTertiary,
    },
  });

export default AccountIdentityCard;
