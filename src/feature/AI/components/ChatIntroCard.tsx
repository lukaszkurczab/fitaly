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
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xs,
      ...theme.depth.raised,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
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
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      minWidth: 160,
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
