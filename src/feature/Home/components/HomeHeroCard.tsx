import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
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
  const cardAccentColors: [string, string, string] = theme.isDark
    ? [
        "rgba(255, 253, 248, 0.03)",
        isSuccess ? "rgba(127, 160, 122, 0.07)" : "rgba(111, 138, 105, 0.05)",
        "rgba(199, 126, 97, 0.02)",
      ]
    : [
        "rgba(255, 253, 248, 0.56)",
        isSuccess ? "rgba(111, 138, 105, 0.05)" : "rgba(111, 138, 105, 0.025)",
        "rgba(199, 126, 97, 0.016)",
      ];

  return (
    <View
      testID="home-hero-card"
      style={[styles.card, isSuccess ? styles.cardSuccess : styles.cardDefault]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={cardAccentColors}
        locations={[0, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardWash}
      />
      <View
        pointerEvents="none"
        style={styles.assetSlot}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          source={require("../../../../assets/images/image.png")}
          resizeMode="contain"
          style={styles.assetImage}
        />
      </View>

      <View style={styles.header}>
        <Text
          testID="home-hero-title"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.title, isSuccess ? styles.titleSuccess : null]}
        >
          {title}
        </Text>
        <View style={styles.metaBlock}>
          <Text testID="home-hero-meta" numberOfLines={1} style={styles.meta}>
            {meta}
          </Text>
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

      {supportText ? (
        <Text numberOfLines={2} style={styles.supportText}>
          {supportText}
        </Text>
      ) : null}

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
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={styles.ctaLabel}
            >
              {ctaLabel}
            </Text>
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
            <View style={styles.methodIconWrap}>
              <AppIcon name="assistant" size={22} color={theme.primaryStrong} />
            </View>
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
                rotation="180deg"
                size={24}
                color={theme.textTertiary}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.rounded.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      minHeight: 230,
      paddingHorizontal: theme.spacing.cardPaddingLarge,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
      overflow: "hidden",
      position: "relative",
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.2 : 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: theme.isDark ? 3 : 2,
    },
    cardDefault: {
      backgroundColor: theme.surfaceElevated,
    },
    cardSuccess: {
      backgroundColor: theme.success.surface,
      borderColor: theme.success.main,
    },
    cardWash: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    assetSlot: {
      position: "absolute",
      top: theme.spacing.md,
      right: -theme.spacing.xl,
      height: 172,
      width: 172,
      alignItems: "center",
      justifyContent: "center",
      opacity: theme.isDark ? 0.78 : 0.96,
      zIndex: 1,
      transform: [{ translateY: -8 }, { scaleX: -1 }],
    },
    assetImage: {
      height: "100%",
      width: "100%",
    },
    header: {
      width: "67%",
      minHeight: 64,
      gap: theme.spacing.xs,
      zIndex: 2,
    },
    metaBlock: {
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h1,
      lineHeight: theme.typography.lineHeight.h1,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    titleSuccess: {
      color: theme.primary,
    },
    meta: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      alignSelf: "flex-start",
      maxWidth: "100%",
    },
    progressTrack: {
      height: 6,
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
      zIndex: 2,
    },
    cta: {
      alignSelf: "flex-start",
      width: "62%",
      minHeight: 48,
      borderRadius: theme.rounded.lg,
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
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
      flexShrink: 1,
      textAlign: "center",
    },
    methodSelector: {
      minHeight: 48,
      borderRadius: theme.rounded.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.14 : 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: theme.isDark ? 2 : 1,
    },
    methodSelectorPressed: {
      opacity: 0.88,
    },
    methodIconWrap: {
      width: 28,
      height: 28,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
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
      width: "58%",
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
      zIndex: 2,
    },
  });

export default HomeHeroCard;
