import { useMemo, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BackTitleHeader,
  type BackTitleHeaderProps,
} from "@/components/BackTitleHeader";
import { BottomActionBar } from "@/components/BottomActionBar";
import { Layout } from "@/components/Layout";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { useTheme } from "@/theme/useTheme";

type ActionTone = "primary" | "secondary" | "ghost" | "destructive";

export type FormScreenShellProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  intro?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  actionContainerStyle?: StyleProp<ViewStyle>;
  actionLabel?: string;
  onActionPress?: () => void;
  actionLoading?: boolean;
  actionDisabled?: boolean;
  actionTone?: ActionTone;
  actionTestID?: string;
  secondaryActionLabel?: string;
  secondaryActionPress?: () => void;
  secondaryActionLoading?: boolean;
  secondaryActionDisabled?: boolean;
  secondaryActionTone?: ActionTone;
  secondaryActionTestID?: string;
  actionsLayout?: "column" | "row";
  actionsRowOrder?: "primary-secondary" | "secondary-primary";
  stickyActions?: boolean;
  keyboardAvoiding?: boolean;
  showOfflineBanner?: boolean;
  trailingAction?: BackTitleHeaderProps["trailingAction"];
  testID?: string;
};

export function FormScreenShell({
  title,
  onBack,
  children,
  intro,
  style,
  contentStyle,
  actionContainerStyle,
  actionLabel,
  onActionPress,
  actionLoading = false,
  actionDisabled = false,
  actionTone = "primary",
  actionTestID,
  secondaryActionLabel,
  secondaryActionPress,
  secondaryActionLoading = false,
  secondaryActionDisabled = false,
  secondaryActionTone = "secondary",
  secondaryActionTestID,
  actionsLayout = "column",
  actionsRowOrder = "primary-secondary",
  stickyActions = true,
  keyboardAvoiding = true,
  showOfflineBanner = false,
  trailingAction,
  testID,
}: FormScreenShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasActions = !!actionLabel || !!secondaryActionLabel;
  const footerBottomInset = Math.max(insets.bottom, theme.spacing.sm);
  const stickyScrollPadding = hasActions && stickyActions
    ? theme.spacing.xxxl + 112 + footerBottomInset
    : theme.spacing.sectionGap;
  const actionsPlacement = stickyActions ? "fixed" : "inline";
  const bottomActionLayout = actionsLayout === "row" ? "row" : "stack";

  const actions = hasActions ? (
    <BottomActionBar
      placement={actionsPlacement}
      bottomInset={stickyActions ? footerBottomInset : 0}
      horizontalPadding={stickyActions ? theme.spacing.lg : 0}
      horizontalBleed={stickyActions ? theme.spacing.screenPadding : 0}
      actionsLayout={bottomActionLayout}
      actionsRowOrder={actionsRowOrder}
      style={actionContainerStyle}
      primaryAction={{
        label: actionLabel ?? "",
        onPress: onActionPress,
        variant: actionTone,
        loading: actionLoading,
        disabled: actionDisabled || !actionLabel,
        testID: actionTestID,
      }}
      secondaryAction={
        secondaryActionLabel
          ? {
              label: secondaryActionLabel,
              onPress: secondaryActionPress,
              variant: secondaryActionTone,
              loading: secondaryActionLoading,
              disabled: secondaryActionDisabled,
              testID: secondaryActionTestID,
            }
          : undefined
      }
    />
  ) : null;

  return (
    <Layout
      showNavigation={false}
      disableScroll
      keyboardAvoiding={keyboardAvoiding}
      showOfflineBanner={showOfflineBanner}
    >
      <View style={[styles.root, style]} testID={testID}>
        <BackTitleHeader
          title={title}
          onBack={onBack}
          trailingAction={trailingAction}
          titleSize="h2"
        />

        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: stickyScrollPadding },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
          <View style={styles.content}>{children}</View>
          {!stickyActions ? actions : null}
        </KeyboardAwareScrollView>

        {stickyActions ? actions : null}
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    intro: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      marginBottom: theme.spacing.lg,
    },
    content: {
      gap: theme.spacing.sectionGap,
    },
  });

export default FormScreenShell;
