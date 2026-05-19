import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";

type ErrorBoxProps = {
  message: string;
  style?: ViewStyle;
  testID?: string;
};

export const ErrorBox: React.FC<ErrorBoxProps> = ({ message, style, testID }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!message) return null;

  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityRole="alert"
      testID={testID}
    >
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    box: {
      width: "100%",
      alignItems: "flex-start",
      borderWidth: 1,
      backgroundColor: theme.error.surface,
      borderColor: theme.error.border,
      borderRadius: theme.rounded.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    message: {
      color: theme.error.text,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });
