import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type Props = {
  onPress: () => void;
  days: number;
};

export function StatisticsPremiumBanner({ onPress, days }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["statistics"]);

  return (
    <View style={styles.card} testID="statistics-premium-banner">
      <View style={styles.content}>
        <View style={styles.eyebrowPill}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowText}>{t("statistics:limitedHistory.eyebrow")}</Text>
        </View>

        <Text style={styles.title}>{t("statistics:limitedHistory.title")}</Text>
        <Text style={styles.body}>{t("statistics:limitedHistory.body", { days })}</Text>

        <Pressable
          testID="statistics-premium-banner-cta-button"
          accessibilityRole="button"
          accessibilityLabel={t("statistics:limitedHistory.cta")}
          onPress={onPress}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed ? styles.ctaPressed : null,
          ]}
        >
          <Text style={styles.ctaLabel}>{t("statistics:limitedHistory.cta")}</Text>
        </Pressable>
      </View>

      <View style={styles.motifWrap}>
        <AppIcon name="trend-up" size={28} color={theme.primary} />
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surface,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    content: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    eyebrowPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: theme.rounded.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
    },
    eyebrowDot: {
      width: theme.spacing.xxs + 2,
      height: theme.spacing.xxs + 2,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
    },
    eyebrowText: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
    },
    body: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    ctaButton: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    ctaPressed: {
      opacity: 0.9,
    },
    ctaLabel: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    motifWrap: {
      width: 66,
      height: 66,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
  });
