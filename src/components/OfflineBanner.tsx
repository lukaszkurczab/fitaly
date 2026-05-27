import React, { useMemo, useRef, useCallback } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";

type Props = {
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
};

export const OfflineBanner: React.FC<Props> = ({
  title,
  subtitle,
  style,
  compact = false,
  dismissible = false,
  onDismiss,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["chat", "common"]);
  const translateX = useRef(new Animated.Value(0)).current;
  const touchStartX = useRef<number | null>(null);
  const dismissingRef = useRef(false);
  const canDismiss = dismissible && Boolean(onDismiss);

  const dismiss = useCallback(
    (direction: number = 1) => {
      if (!canDismiss) return;
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      Animated.timing(translateX, {
        toValue: direction * 420,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDismiss?.();
      });
    },
    [canDismiss, onDismiss, translateX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          canDismiss &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= 48) {
            dismiss(gesture.dx >= 0 ? 1 : -1);
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 4,
          }).start();
        },
      }),
    [canDismiss, dismiss, translateX],
  );

  const resolvedTitle = title ?? t("offline.title", { ns: "chat" });

  const resolvedSubtitle =
    subtitle ??
    t("offline.subtitle", {
      ns: "chat",
    });

  return (
    <Animated.View
      testID="offline-banner"
      style={[
        styles.banner,
        compact ? styles.bannerCompact : styles.bannerRegular,
        canDismiss ? styles.bannerDismissible : null,
        { transform: [{ translateX }] },
        style,
      ]}
      accessibilityLiveRegion="polite"
      {...(canDismiss ? panResponder.panHandlers : {})}
      onTouchStart={
        canDismiss
          ? (event) => {
              touchStartX.current = event.nativeEvent.pageX;
            }
          : undefined
      }
      onTouchEnd={
        canDismiss
          ? (event) => {
              const startX = touchStartX.current;
              touchStartX.current = null;
              if (startX === null) return;
              const deltaX = event.nativeEvent.pageX - startX;
              if (Math.abs(deltaX) >= 48) {
                dismiss(deltaX >= 0 ? 1 : -1);
              }
            }
          : undefined
      }
    >
      <View style={styles.iconBubble}>
        <AppIcon
          name="wifi-off"
          size={compact ? 16 : 18}
          color={theme.primaryStrong}
        />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{resolvedTitle}</Text>
        {!compact ? <Text style={styles.desc}>{resolvedSubtitle}</Text> : null}
      </View>

      {canDismiss ? (
        <Pressable
          testID="offline-banner-dismiss-button"
          accessibilityRole="button"
          accessibilityLabel={t("dismiss", {
            ns: "common",
            defaultValue: "Dismiss",
          })}
          hitSlop={10}
          onPress={() => onDismiss?.()}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed ? styles.dismissPressed : null,
          ]}
        >
          <AppIcon name="close" size={14} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    banner: {
      borderWidth: 1,
      alignItems: "center",
      flexDirection: "row",
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      ...theme.depth.raised,
    },
    bannerDismissible: {
      paddingRight: 10,
    },
    bannerCompact: {
      minHeight: 46,
      paddingVertical: 6,
      paddingHorizontal: 10,
      margin: 8,
    },
    bannerRegular: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      margin: 12,
    },
    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.sm,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    textWrap: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: theme.text,
      textAlign: "left",
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    desc: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "left",
    },
    dismissButton: {
      width: 32,
      height: 32,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing.xs,
    },
    dismissPressed: {
      backgroundColor: theme.surfaceAlt,
    },
  });

export default OfflineBanner;
