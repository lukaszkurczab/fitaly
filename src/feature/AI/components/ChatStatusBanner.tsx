import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Variant = "offline" | "credits" | "warning" | "info";

type Props = {
  variant: Variant;
  title: string;
  body?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
  testID?: string;
};

export function ChatStatusBanner({
  variant,
  title,
  body,
  actionLabel,
  onActionPress,
  actionDisabled = false,
  testID,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const showAction = Boolean(actionLabel && onActionPress);
  const isPrimaryAction = variant === "credits";

  const containerStyle =
    variant === "warning"
      ? styles.warningContainer
      : variant === "info"
        ? styles.infoContainer
        : styles.neutralContainer;

  return (
    <View testID={testID} style={[styles.container, containerStyle]}>
      <View style={styles.leadingWrap}>
        {variant === "offline" ? <View style={styles.dot} /> : null}

        <View style={styles.copyWrap}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>
      </View>

      {showAction ? (
        <Pressable
          onPress={onActionPress}
          disabled={actionDisabled}
          testID={
            testID && isPrimaryAction ? `${testID}-action-button` : undefined
          }
          style={({ pressed }) => [
            isPrimaryAction ? styles.primaryAction : styles.linkAction,
            pressed && !actionDisabled ? styles.actionPressed : null,
            actionDisabled ? styles.actionDisabled : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text
            style={
              isPrimaryAction ? styles.primaryActionText : styles.linkActionText
            }
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    neutralContainer: {
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderSoft,
    },
    warningContainer: {
      backgroundColor: theme.warning.surface,
      borderColor: theme.warning.main,
    },
    infoContainer: {
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.border,
    },
    leadingWrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      flex: 1,
      gap: theme.spacing.xs,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primarySoft,
      marginTop: 6,
    },
    copyWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    body: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    primaryAction: {
      minHeight: 34,
      minWidth: 88,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.primary,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryActionText: {
      color: theme.textInverse,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    linkAction: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    linkActionText: {
      color: theme.link,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
      textDecorationLine: "underline",
    },
    actionPressed: {
      opacity: 0.78,
    },
    actionDisabled: {
      opacity: 0.42,
    },
  });
