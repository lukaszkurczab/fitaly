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
import FitalyMarkIcon from "@assets/icons/fitaly-mark.svg";

type AuthScreenLayoutProps = {
  brand: string;
  title: string;
  description?: string;
  testID?: string;
  banner?: ReactNode;
  topAction?: ReactNode;
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
  topAction,
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
  const brandSuffix =
    brand.toLocaleLowerCase().startsWith("f") && brand.length > 1
      ? brand.slice(1)
      : brand;
  const styles = useMemo(
    () => makeStyles(theme, isKeyboardCompact),
    [isKeyboardCompact, theme],
  );

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.container} testID={testID}>
        {topAction}
        <View pointerEvents="none" style={styles.backdrop}>
          <View style={styles.brandWash} />
          <View style={styles.terracottaThread} />
        </View>

        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.hero}>
              {isKeyboardCompact ? null : (
                <View style={styles.brandGroup}>
                  <FitalyMarkIcon
                    width={52}
                    height={52}
                    style={styles.brandMark}
                  />
                  <Text style={styles.wordmark}>{brandSuffix}</Text>
                </View>
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
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      overflow: "hidden",
    },
    brandWash: {
      position: "absolute",
      top: isKeyboardCompact ? -120 : 42,
      left: -70,
      width: 190,
      height: 136,
      borderRadius: theme.rounded.xxl,
      borderTopRightRadius: 96,
      borderBottomRightRadius: 96,
      backgroundColor: theme.isDark
        ? "rgba(111, 138, 105, 0.08)"
        : "rgba(111, 138, 105, 0.10)",
      transform: [{ rotate: "-26deg" }],
    },
    terracottaThread: {
      position: "absolute",
      right: -56,
      bottom: 42,
      width: 180,
      height: 58,
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(199, 126, 97, 0.16)"
        : "rgba(199, 126, 97, 0.18)",
      transform: [{ rotate: "-20deg" }],
      opacity: isKeyboardCompact ? 0 : 1,
    },
    scroll: {
      flex: 1,
      zIndex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: isKeyboardCompact ? "flex-start" : "space-between",
    },
    content: {
      paddingTop: isKeyboardCompact ? theme.spacing.sm : theme.spacing.display,
    },
    hero: {
      alignItems: "center",
      paddingBottom: isKeyboardCompact
        ? theme.spacing.sm
        : theme.spacing.xl,
    },
    brandGroup: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xxs,
    },
    brandMark: {
      marginRight: -4,
    },
    wordmark: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.displayL,
      lineHeight: theme.typography.lineHeight.displayL,
      textAlign: "center",
      marginTop: 8,
    },
    headingGroup: {
      marginTop: isKeyboardCompact ? 0 : theme.spacing.xs,
      width: "100%",
      alignItems: "center",
    },
    title: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
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
    },
    formSurface: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderRadius: 0,
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    formSurfaceCompact: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    inlineAction: {
      marginTop: theme.spacing.lg,
    },
    bottomBlock: {
      paddingTop: isKeyboardCompact
        ? theme.spacing.md
        : theme.spacing.sectionGap,
      paddingBottom: theme.spacing.sm,
    },
    footer: {
      marginTop: 0,
    },
  });
