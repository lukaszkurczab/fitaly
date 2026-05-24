import { useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Layout } from "@/components";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/theme/useTheme";

type AuthScreenLayoutProps = {
  brand: string;
  title: string;
  description?: string;
  testID?: string;
  banner?: ReactNode;
  bottomAction?: ReactNode;
  footer?: ReactNode;
  compactOnKeyboardVisible?: boolean;
  formStyle?: StyleProp<ViewStyle>;
  compactFormStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function AuthScreenLayout({
  brand,
  title,
  description,
  testID,
  banner,
  bottomAction,
  footer,
  compactOnKeyboardVisible = false,
  formStyle,
  compactFormStyle,
  children,
}: AuthScreenLayoutProps) {
  const theme = useTheme();
  const keyboardInset = useKeyboardInset({ enabled: compactOnKeyboardVisible });
  const isKeyboardCompact = compactOnKeyboardVisible && keyboardInset > 0;
  const styles = useMemo(
    () => makeStyles(theme, isKeyboardCompact),
    [isKeyboardCompact, theme],
  );

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.container} testID={testID}>
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.hero}>
              {isKeyboardCompact ? null : (
                <Text style={styles.wordmark}>{brand}</Text>
              )}

              <View style={styles.headingGroup}>
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
                {description ? (
                  <Text style={styles.description}>{description}</Text>
                ) : null}
              </View>
            </View>

            {banner ? <View style={styles.banner}>{banner}</View> : null}

            <View
              style={[
                styles.form,
                formStyle,
                isKeyboardCompact ? compactFormStyle : null,
              ]}
            >
              <View
                style={[
                  styles.formSurface,
                  isKeyboardCompact ? styles.formSurfaceCompact : null,
                ]}
              >
                {children}
                {bottomAction ? (
                  <View style={styles.inlineAction}>{bottomAction}</View>
                ) : null}
              </View>
            </View>
          </View>

          {footer ? (
            <View style={styles.bottomBlock}>
              <View style={styles.footer}>{footer}</View>
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </Layout>
  );
}

const makeStyles = (
  theme: ReturnType<typeof useTheme>,
  isKeyboardCompact: boolean,
) =>
  StyleSheet.create({
    layout: {
      paddingLeft: theme.spacing.screenPaddingWide,
      paddingRight: theme.spacing.screenPaddingWide,
      flex: 1,
    },
    container: {
      flex: 1,
      minHeight: 0,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: isKeyboardCompact ? "flex-start" : "space-between",
    },
    content: {
      paddingTop: isKeyboardCompact ? theme.spacing.sm : theme.spacing.xl,
    },
    hero: {
      alignItems: "center",
      paddingBottom: isKeyboardCompact
        ? theme.spacing.sm
        : theme.spacing.sectionGap,
    },
    wordmark: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayL,
      textAlign: "center",
    },
    headingGroup: {
      marginTop: isKeyboardCompact ? 0 : theme.spacing.xs,
      width: "100%",
      alignItems: "center",
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.h2,
      textAlign: "center",
    },
    description: {
      marginTop: theme.spacing.sm,
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      textAlign: "center",
    },
    banner: {
      marginBottom: isKeyboardCompact ? theme.spacing.sm : theme.spacing.lg,
    },
    form: {
      width: "100%",
      flexGrow: 1,
    },
    formSurface: {
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.cardPaddingLarge,
      paddingVertical: theme.spacing.cardPaddingLarge,
      ...theme.depth.raised,
    },
    formSurfaceCompact: {
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.cardPadding,
      paddingVertical: theme.spacing.cardPadding,
    },
    inlineAction: {
      marginTop: theme.spacing.md,
    },
    bottomBlock: {
      paddingTop: isKeyboardCompact
        ? theme.spacing.md
        : theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    footer: {
      marginTop: 0,
    },
  });
