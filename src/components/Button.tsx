import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  TextStyle,
  ViewStyle,
  type PressableProps,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export type ButtonProps = {
  label?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
} & PressableProps;

export const Button: React.FC<ButtonProps> = ({
  label,
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
  accessibilityLabel,
  onPress,
  ...rest
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tokens = theme.button[variant];
  const isDisabled = disabled || loading;
  const shouldElevate =
    !isDisabled && (variant === "primary" || variant === "destructive");
  const resolveTextColor = (pressed: boolean) =>
    isDisabled
      ? tokens.disabledText
      : pressed
        ? tokens.pressedText
        : tokens.text;
  const content = children ?? label;
  const isTextContent =
    typeof content === "string" || typeof content === "number";
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? (typeof content === "string" ? content : undefined);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={!isDisabled ? { color: theme.overlay } : undefined}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? styles.fullWidth : styles.autoWidth,
        shouldElevate ? theme.depth.cta : null,
        {
          backgroundColor: isDisabled
            ? tokens.disabledBackground
            : pressed
              ? tokens.pressedBackground
              : tokens.background,
          borderColor: isDisabled
            ? tokens.disabledBorder
            : pressed
              ? tokens.pressedBorder
              : tokens.border,
        },
        style,
      ]}
      {...rest}
    >
      {({ pressed }) =>
        loading ? (
          <ActivityIndicator size="small" color={resolveTextColor(false)} />
        ) : !isTextContent ? (
          <View style={styles.customContent}>{content}</View>
        ) : (
          <Text
            style={[
              styles.label,
              { color: resolveTextColor(pressed) },
              textStyle,
            ]}
          >
            {content}
          </Text>
        )
      }
    </Pressable>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    button: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    fullWidth: {
      alignSelf: "stretch",
      width: "100%",
    },
    autoWidth: {
      alignSelf: "flex-start",
    },
    label: {
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    customContent: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
    },
  });
