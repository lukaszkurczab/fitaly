import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { PressableProps, ViewProps } from "react-native";
import { TextButton } from "@/components";
import { useTheme } from "@/theme/useTheme";

type MealAddPhotoScaffoldProps = {
  topInset?: number;
  previewHeight?: number;
  preview: ReactNode;
  previewOverlay?: ReactNode;
  previewFillsAvailable?: boolean;
  previewFullBleed?: boolean;
  topAction?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  accessory?: ReactNode;
  content?: ReactNode;
  contentFillsAvailable?: boolean;
  sheetVisible?: boolean;
  sheetFitContent?: boolean;
  contentPlacement?: "start" | "end";
  showSheetHandle?: boolean;
  sheetTestID?: string;
  sheetTouchHandlers?: Pick<ViewProps, "onTouchEnd" | "onTouchStart">;
  footerNote?: string;
  footerTone?: "default" | "warning";
};

type MealAddTextLinkProps = Pick<
  PressableProps,
  "onPress" | "disabled" | "testID" | "accessibilityRole"
> & {
  label: string;
  tone?: "default" | "muted" | "link";
  size?: "md" | "sm";
};

type MealAddStatusBannerProps = {
  label: string;
  loading?: boolean;
};

const DEFAULT_PREVIEW_HEIGHT = 360;

export function MealAddPhotoScaffold({
  topInset,
  previewHeight,
  preview,
  previewOverlay,
  previewFillsAvailable = false,
  previewFullBleed = false,
  topAction,
  eyebrow,
  title,
  description,
  accessory,
  content,
  contentFillsAvailable = false,
  sheetVisible = true,
  sheetFitContent = false,
  contentPlacement = "end",
  showSheetHandle = false,
  sheetTestID,
  sheetTouchHandlers,
  footerNote,
  footerTone = "default",
}: MealAddPhotoScaffoldProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      style={[
        styles.screen,
        topInset !== undefined ? { paddingTop: topInset } : null,
        previewFullBleed ? styles.screenFullBleed : null,
      ]}
    >
      <View
        style={[
          styles.previewWrap,
          previewFillsAvailable ? styles.previewWrapFill : null,
          previewFullBleed
            ? styles.previewWrapFullBleed
            : {
                flex: 0,
                height: previewHeight ?? DEFAULT_PREVIEW_HEIGHT,
              },
        ]}
      >
        {preview}
        {previewOverlay}
        {topAction}
      </View>

      {sheetVisible ? (
        <View
          testID={sheetTestID}
          style={[styles.sheet, sheetFitContent ? styles.sheetFitContent : null]}
          {...sheetTouchHandlers}
        >
          {showSheetHandle ? <View style={styles.sheetHandle} /> : null}

          <View style={styles.header}>
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              {accessory}
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          {content || footerNote ? (
            <View
              style={[
                styles.bottomSection,
                contentPlacement === "start" ? styles.bottomSectionStart : null,
              ]}
            >
              {content ? (
                <View
                  style={[
                    styles.content,
                    contentFillsAvailable ? styles.contentFill : null,
                  ]}
                >
                  {content}
                </View>
              ) : null}

              {footerNote ? (
                <Text
                  style={[
                    styles.footerNote,
                    footerTone === "warning" ? styles.footerNoteWarning : null,
                  ]}
                >
                  {footerNote}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MealAddTextLink({
  label,
  onPress,
  disabled = false,
  testID,
  accessibilityRole = "button",
  tone = "link",
}: MealAddTextLinkProps) {
  return (
    <TextButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole={accessibilityRole}
      tone={tone}
    />
  );
}

export function MealAddStatusBanner({
  label,
  loading = false,
}: MealAddStatusBannerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStatusStyles(theme), [theme]);
  const dotProgress = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!loading) {
      dotProgress.forEach((value) => value.setValue(0));
      return;
    }

    const animations = dotProgress.map((value) =>
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
    );
    const loop = Animated.loop(Animated.stagger(130, animations));
    loop.start();

    return () => loop.stop();
  }, [dotProgress, loading]);

  return (
    <View style={styles.banner}>
      {loading ? (
        <View style={styles.loadingDots} accessibilityElementsHidden>
          {dotProgress.map((value, index) => (
            <Animated.View
              key={`status-dot-${index}`}
              style={[
                styles.loadingDot,
                {
                  opacity: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.42, 1],
                  }),
                  transform: [
                    {
                      translateY: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -3],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.dot} />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingBottom: 0,
      gap: theme.spacing.sm,
      backgroundColor: theme.background,
    },
    screenFullBleed: {
      paddingTop: 0,
      paddingHorizontal: 0,
      gap: 0,
      backgroundColor: "#121512",
    },
    previewWrap: {
      borderRadius: theme.rounded.xxl,
      overflow: "hidden",
      backgroundColor: "#121512",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      ...theme.depth.raised,
    },
    previewWrapFill: {
      flex: 1,
      height: undefined,
      minHeight: 300,
    },
    previewWrapFullBleed: {
      flex: 1,
      height: undefined,
      minHeight: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: "transparent",
    },
    sheet: {
      flex: 1,
      borderRadius: theme.rounded.xxl,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      ...theme.depth.floating,
    },
    sheetFitContent: {
      flex: 0,
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
      alignSelf: "center",
      marginBottom: theme.spacing.sm,
    },
    header: {
      gap: 0,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    eyebrow: {
      flexShrink: 1,
      color: theme.primarySoft,
      fontSize: theme.typography.size.caption,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    title: {
      marginTop: theme.spacing.xs,
      color: theme.text,
      fontSize: theme.typography.size.displayM,
      lineHeight: 32,
      fontFamily: theme.typography.fontFamily.bold,
      letterSpacing: 0,
    },
    description: {
      marginTop: theme.spacing.sm,
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
      letterSpacing: 0,
    },
    bottomSection: {
      flex: 1,
      justifyContent: "flex-end",
      paddingTop: theme.spacing.xl,
    },
    bottomSectionStart: {
      flex: 0,
      justifyContent: "flex-start",
      paddingTop: theme.spacing.xl,
    },
    content: {
      gap: theme.spacing.sm,
    },
    contentFill: {
      flex: 1,
    },
    footerNote: {
      marginTop: theme.spacing.md,
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    footerNoteWarning: {
      color: theme.accentWarm,
    },
  });

const makeStatusStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    banner: {
      minHeight: 52,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.success.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      ...theme.depth.raised,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    loadingDots: {
      width: 30,
      height: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    loadingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    label: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
  });
