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
import { GlobalActionButtons } from "@/components/GlobalActionButtons";
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

  const actions = hasActions ? (
    <View
      style={[
        styles.actions,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
        actionContainerStyle,
      ]}
    >
      <GlobalActionButtons
        label={actionLabel ?? ""}
        onPress={onActionPress}
        tone={actionTone}
        primaryLoading={actionLoading}
        primaryDisabled={actionDisabled || !actionLabel}
        primaryTestID={actionTestID}
        secondaryLabel={secondaryActionLabel}
        secondaryOnPress={secondaryActionPress}
        secondaryLoading={secondaryActionLoading}
        secondaryDisabled={secondaryActionDisabled}
        secondaryTone={secondaryActionTone}
        secondaryTestID={secondaryActionTestID}
        layout={actionsLayout}
        rowOrder={actionsRowOrder}
      />
    </View>
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
          contentContainerStyle={[styles.scrollContent, contentStyle]}
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
      paddingBottom: theme.spacing.sectionGap,
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
    actions: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSoft,
      backgroundColor: theme.background,
      paddingTop: theme.spacing.md,
    },
  });

export default FormScreenShell;
