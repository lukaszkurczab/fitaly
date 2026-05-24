import React from "react";
import { View, Pressable, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/theme/useTheme";

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: "default" | "stat" | "outlined";
  elevation?: number;
};

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = "default",
  elevation = 2,
}) => {
  const theme = useTheme();
  const depthStyle = variant === "outlined" ? null : theme.depth.raised;

  const cardStyle: ViewStyle = {
    backgroundColor:
      variant === "outlined" ? theme.background : theme.surfaceElevated,
    borderRadius: variant === "stat" ? theme.rounded.sm : theme.rounded.md,
    borderWidth: variant === "outlined" ? 1 : 0,
    borderColor: variant === "outlined" ? theme.border : undefined,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...(variant === "stat"
      ? {
          width: 100,
          aspectRatio: 1,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 0,
        }
      : {}),
    ...(depthStyle ?? {}),
    ...(variant !== "outlined" ? { elevation } : {}),
  };

  const Content = <View style={[cardStyle, style]}>{children}</View>;

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          cardStyle,
          style,
          {
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        onPress={onPress}
        android_ripple={
          variant !== "outlined"
            ? { color: theme.overlay, borderless: false }
            : undefined
        }
      >
        {children}
      </Pressable>
    );
  }
  return Content;
};
