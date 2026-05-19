import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";
import { Button } from "@/components/Button";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  actionTestID?: string;
};

export const EmptyState: React.FC<Props> = ({
  title,
  eyebrow,
  description,
  actionLabel,
  onAction,
  testID,
  actionTestID,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.iconBox}>
        <View style={styles.iconInner}>
          <AppIcon name="empty-meals" size={30} color={theme.textTertiary} />
        </View>
      </View>

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          testID={actionTestID}
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxxl,
      borderRadius: theme.rounded.xxl,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.18 : 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: theme.isDark ? 0 : 2,
    },
    iconBox: {
      width: 88,
      height: 88,
      borderRadius: theme.rounded.full,
      marginBottom: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    iconInner: {
      width: 58,
      height: 58,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    eyebrow: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
    },
    description: {
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: theme.spacing.xl,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
      maxWidth: 260,
    },
    action: {
      minWidth: 200,
      paddingHorizontal: theme.spacing.xl,
    },
  });
