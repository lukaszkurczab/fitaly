import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Button } from "@/components/Button";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type Props = {
  title: string;
  meta: string;
  ctaLabel: string;
  onPressCta: () => void;
  methodLabel?: string;
  methodIcon?: AppIconName;
  onPressMethodSelector?: () => void;
  progress?: number | null;
  supportText?: string;
  tone?: "default" | "success";
};

export function HomeHeroCard({
  title,
  meta,
  ctaLabel,
  onPressCta,
  methodLabel,
  methodIcon,
  onPressMethodSelector,
  progress,
  supportText,
  tone = "default",
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isSuccess = tone === "success";

  return (
    <View
      testID="home-hero-card"
      style={[styles.card, isSuccess ? styles.cardSuccess : styles.cardDefault]}
    >
      <View style={styles.header}>
        <Text
          testID="home-hero-title"
          style={[styles.title, isSuccess ? styles.titleSuccess : null]}
        >
          {title}
        </Text>
        <View style={styles.metaBlock}>
          <Text testID="home-hero-meta" style={styles.meta}>{meta}</Text>
          {typeof progress === "number" ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, Math.min(progress, 1)) * 100}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          accessibilityLabel={ctaLabel}
          onPress={onPressCta}
          style={styles.cta}
          testID="home-hero-primary-cta"
        >
          <View style={styles.ctaContent}>
            {!isSuccess && methodIcon ? (
              <View style={styles.ctaIconSlot}>
                <AppIcon
                  name={methodIcon}
                  size={17}
                  color={theme.cta.primaryText}
                />
              </View>
            ) : null}
            <Text style={styles.ctaLabel}>{ctaLabel}</Text>
          </View>
        </Button>

        {methodLabel && onPressMethodSelector ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={methodLabel}
            onPress={onPressMethodSelector}
            style={({ pressed }) => [
              styles.methodSelector,
              pressed ? styles.methodSelectorPressed : null,
            ]}
            testID="home-method-selector"
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.methodLabel}
            >
              {methodLabel}
            </Text>
            <View style={styles.methodChevronWrap}>
              <AppIcon
                name="chevron"
                rotation="-90deg"
                size={24}
                color={theme.textTertiary}
              />
            </View>
          </Pressable>
        ) : null}

        {supportText ? (
          <Text style={styles.supportText}>{supportText}</Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.rounded.xl,
      paddingHorizontal: theme.spacing.cardPaddingLarge,
      paddingVertical: theme.spacing.bottomSheetPadding,
      gap: theme.spacing.md,
    },
    cardDefault: {
      backgroundColor: theme.surface,
    },
    cardSuccess: {
      backgroundColor: theme.success.surface,
    },
    header: {
      gap: theme.spacing.sm,
    },
    metaBlock: {
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    titleSuccess: {
      color: theme.primary,
    },
    meta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    progressTrack: {
      height: 3,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
    },
    actions: {
      gap: theme.spacing.sm,
    },
    cta: {
      minHeight: 50,
      borderRadius: 14,
    },
    ctaContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
    },
    ctaIconSlot: {
      width: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaLabel: {
      color: theme.cta.primaryText,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
      flexShrink: 1,
    },
    methodSelector: {
      minHeight: 44,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    methodSelectorPressed: {
      opacity: 0.88,
    },
    methodLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      flex: 1,
    },
    methodChevronWrap: {
      width: 16,
      alignItems: "flex-end",
    },
    supportText: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
  });

export default HomeHeroCard;
