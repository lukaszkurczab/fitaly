import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  title: string;
  subtitle: string;
  creditsText?: string;
};

export function ChatIntroCard({ title, subtitle, creditsText }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {creditsText ? (
        <View style={styles.creditsChip}>
          <Text style={styles.creditsLabel}>{creditsText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.isDark ? theme.surfaceElevated : theme.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.bold,
    },
    subtitle: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    creditsChip: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.xs,
      borderRadius: theme.rounded.sm,
      backgroundColor: theme.isDark ? theme.disabled.background : theme.surfaceAlt,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      alignItems: "center",
      justifyContent: "center",
    },
    creditsLabel: {
      color: theme.primarySoft,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
