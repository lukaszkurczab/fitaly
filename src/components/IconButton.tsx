import React, { useMemo } from "react";
import { Pressable, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";

type IconButtonProps = {
  icon: React.ReactElement<{ size?: number; color?: string }>;
  onPress: () => void;
  size?: number;
  variant?: "solid" | "ghost";
  backgroundColor?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 40,
  variant = "solid",
  backgroundColor,
  iconColor,
  style,
  disabled = false,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const resolvedBg =
    variant === "solid"
      ? backgroundColor || theme.surfaceElevated
      : "transparent";

  const resolvedBorderColor =
    variant === "solid" ? theme.borderSoft : "transparent";

  const resolvedIconColor =
    iconColor || (variant === "solid" ? theme.text : theme.textSecondary);

  const iconSize = Math.round(size * 0.5);

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      android_ripple={!disabled ? { color: theme.overlay } : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resolvedBg,
          borderColor: resolvedBorderColor,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        variant === "ghost" ? styles.ghostButton : styles.solidButton,
        style,
      ]}
    >
      {React.cloneElement(icon, {
        size: icon.props.size ?? iconSize,
        color: icon.props.color ?? resolvedIconColor,
      })}
    </Pressable>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    button: {
      alignItems: "center",
      justifyContent: "center",
    },
    solidButton: {
      borderWidth: 1,
      ...theme.depth.raised,
    },
    ghostButton: {
      minWidth: 40,
      minHeight: 40,
    },
  });
