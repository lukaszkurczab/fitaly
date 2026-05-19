import { useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

export type SettingsRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  showDivider?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  valueTestID?: string;
} & Pick<
  PressableProps,
  "onPress" | "testID" | "accessibilityLabel" | "accessibilityHint"
>;

export function SettingsRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  showChevron,
  showDivider = false,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
  valueTestID,
  accessibilityLabel,
  accessibilityHint,
}: SettingsRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isPressable = typeof onPress === "function";
  const isInactive = disabled || loading;
  const shouldShowChevron = showChevron ?? isPressable;

  const accessory = useMemo(() => {
    if (loading) {
      return <ActivityIndicator size="small" color={theme.textSecondary} />;
    }

    if (trailing) {
      return trailing;
    }

    if (shouldShowChevron) {
      return (
        <AppIcon
          name="chevron"
          rotation="180deg"
          size={24}
          color={isInactive ? theme.textTertiary : theme.textSecondary}
        />
      );
    }

    return null;
  }, [
    isInactive,
    loading,
    shouldShowChevron,
    theme.textSecondary,
    theme.textTertiary,
    trailing,
  ]);

  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.copy}>
        <Text
          style={[styles.title, isInactive ? styles.copyDisabled : null]}
          numberOfLines={subtitle ? 2 : 1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, isInactive ? styles.copyDisabled : null]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value || accessory ? (
        <View style={styles.trailingWrap}>
          {value ? (
            <Text
              testID={valueTestID}
              style={[styles.value, isInactive ? styles.copyDisabled : null]}
              numberOfLines={2}
            >
              {value}
            </Text>
          ) : null}
          {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
        </View>
      ) : null}
    </>
  );

  if (!isPressable) {
    return (
      <View
        style={[
          styles.base,
          showDivider ? styles.divider : null,
          isInactive ? styles.rowDisabled : null,
          style,
        ]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        showDivider ? styles.divider : null,
        pressed && !isInactive ? styles.pressed : null,
        isInactive ? styles.rowDisabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    base: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.cardPadding,
      paddingVertical: theme.spacing.md,
      backgroundColor: "transparent",
    },
    pressed: {
      backgroundColor: theme.surfaceAlt,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    rowDisabled: {
      opacity: 0.48,
    },
    leading: {
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    subtitle: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    value: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      textAlign: "right",
      maxWidth: 120,
    },
    trailingWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginLeft: theme.spacing.xs,
    },
    accessory: {
      alignItems: "center",
      justifyContent: "center",
    },
    copyDisabled: {
      color: theme.textTertiary,
    },
  });

export default SettingsRow;
