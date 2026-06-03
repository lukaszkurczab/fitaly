import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Button, type ButtonProps, type ButtonVariant } from "@/components/Button";
import { TextButton } from "@/components/TextButton";
import { useTheme } from "@/theme/useTheme";

export type BottomActionBarAction = {
  label: string;
  compactLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  variant?: ButtonVariant;
  accessibilityLabel?: string;
  textStyle?: StyleProp<TextStyle>;
};

export type BottomActionBarLinkAction = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

type BottomActionBarProps = {
  primaryAction?: BottomActionBarAction;
  secondaryAction?: BottomActionBarAction;
  linkAction?: BottomActionBarLinkAction;
  linkActions?: BottomActionBarLinkAction[];
  helperText?: string;
  helperTone?: "default" | "warning";
  placement?: "fixed" | "docked" | "inline";
  bottomInset?: number;
  keyboardInset?: number;
  horizontalPadding?: number;
  horizontalBleed?: number;
  actionsLayout?: "stack" | "row";
  actionsRowOrder?: "primary-secondary" | "secondary-primary";
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function BottomActionBar({
  primaryAction,
  secondaryAction,
  linkAction,
  linkActions,
  helperText,
  helperTone = "default",
  placement = "fixed",
  bottomInset = 0,
  keyboardInset = 0,
  horizontalPadding,
  horizontalBleed = 0,
  actionsLayout = "stack",
  actionsRowOrder = "secondary-primary",
  compact = false,
  testID,
  style,
}: BottomActionBarProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderAction = (
    action: BottomActionBarAction | undefined,
    defaultVariant: ButtonVariant,
  ) => {
    if (!action) return null;

    const variant = action.variant ?? defaultVariant;
    const resolvedLabel = compact && action.compactLabel
      ? action.compactLabel
      : action.label;
    const isDisabled = Boolean(action.disabled || action.loading);
    const compactTextColor = isDisabled
      ? theme.button[variant].disabledText
      : theme.button[variant].text;

    return (
      <Button
        testID={action.testID}
        label={compact ? undefined : resolvedLabel}
        accessibilityLabel={action.accessibilityLabel ?? action.label}
        onPress={action.onPress}
        disabled={action.disabled}
        loading={action.loading}
        variant={variant}
        style={[styles.actionButton, compact ? styles.actionButtonCompact : null]}
        textStyle={[
          compact ? styles.actionButtonTextCompact : null,
          action.textStyle,
        ]}
      >
        {compact ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            ellipsizeMode="tail"
            style={[
              styles.actionButtonTextCompact,
              { color: compactTextColor },
              action.textStyle,
            ]}
          >
            {resolvedLabel}
          </Text>
        ) : undefined}
      </Button>
    );
  };

  const primary = renderAction(primaryAction, "primary");
  const secondary = renderAction(secondaryAction, "secondary");
  const hasActionRow = Boolean(primary || secondary);
  const isFixed = placement === "fixed";
  const isDocked = placement === "docked";
  const isKeyboardCompact = compact && keyboardInset > 0;
  const shouldUseActionRow = compact || actionsLayout === "row";
  const actionContainerStyle = compact
    ? styles.actionRowCompact
    : actionsLayout === "row"
      ? styles.actionRow
      : styles.actionStack;
  const resolvedLinkActions = compact
    ? []
    : linkActions ?? (linkAction ? [linkAction] : []);
  const orderedActions = shouldUseActionRow
    ? actionsRowOrder === "primary-secondary"
      ? [primary, secondary]
      : [secondary, primary]
    : [primary, secondary];
  const fixedKeyboardOverlap = theme.spacing.md;
  const resolvedBottomPadding =
    isKeyboardCompact && isFixed
      ? theme.spacing.xl
      : compact
        ? bottomInset > 0
          ? Math.min(bottomInset, theme.spacing.xs)
          : theme.spacing.xxs
        : Math.max(bottomInset, theme.spacing.sm);
  const resolvedKeyboardBottom =
    isKeyboardCompact && isFixed
      ? Math.max(0, keyboardInset - fixedKeyboardOverlap)
      : keyboardInset;
  const shouldShowHelper = Boolean(helperText && !compact);

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        isFixed ? styles.fixed : isDocked ? styles.docked : styles.inline,
        compact ? styles.compact : null,
        isFixed
          ? {
              bottom: resolvedKeyboardBottom,
              left: -horizontalBleed,
              right: -horizontalBleed,
            }
          : null,
        isDocked
          ? {
              marginLeft: -horizontalBleed,
              marginRight: -horizontalBleed,
            }
          : null,
        {
          paddingBottom: resolvedBottomPadding,
          paddingHorizontal: horizontalPadding ?? theme.spacing.lg,
        },
        style,
      ]}
    >
      {shouldShowHelper ? (
        <Text
          style={[
            styles.helperText,
            helperTone === "warning" ? styles.helperTextWarning : null,
          ]}
        >
          {helperText}
        </Text>
      ) : null}

      {hasActionRow ? (
        <View style={actionContainerStyle}>
          {orderedActions.map((action, index) =>
            action ? (
              <View
                key={`action-${index}`}
                style={shouldUseActionRow ? styles.actionItemRow : styles.actionItem}
              >
                {action}
              </View>
            ) : null,
          )}
        </View>
      ) : null}

      {resolvedLinkActions.map((action) => (
        <TextButton
          key={action.testID ?? action.label}
          testID={action.testID}
          label={action.label}
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          tone="link"
          style={styles.linkAction}
        />
      ))}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.sm,
      backgroundColor: theme.surfaceElevated,
      borderTopLeftRadius: theme.rounded.md,
      borderTopRightRadius: theme.rounded.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      overflow: "hidden",
    },
    fixed: {
      position: "absolute",
      paddingTop: theme.spacing.md,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -8 },
      elevation: 10,
    },
    docked: {
      paddingTop: theme.spacing.md,
      shadowColor: theme.isDark ? "#000000" : "#2F312B",
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -8 },
      elevation: 10,
    },
    inline: {
      paddingTop: theme.spacing.sm,
      shadowOpacity: 0,
      elevation: 0,
      borderTopWidth: 0,
      borderTopColor: "transparent",
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: "transparent",
    },
    compact: {
      gap: theme.spacing.xs,
    },
    helperText: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
    },
    helperTextWarning: {
      color: theme.accentWarm,
    },
    actionStack: {
      gap: theme.spacing.sm,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.sm,
    },
    actionRowCompact: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.xs,
    },
    actionItem: {
      alignSelf: "stretch",
    },
    actionItemRow: {
      flex: 1,
      minWidth: 0,
    },
    actionButton: {
      minHeight: 52,
      borderRadius: theme.rounded.md,
    } satisfies ButtonProps["style"],
    actionButtonCompact: {
      minHeight: 42,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.rounded.md,
    } satisfies ButtonProps["style"],
    actionButtonTextCompact: {
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    linkAction: {
      alignSelf: "center",
      marginTop: -theme.spacing.xxs,
    },
  });
