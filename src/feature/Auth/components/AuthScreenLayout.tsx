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
import OliveBranchOrnament from "@assets/icons/olive-branch-ornament.svg";

const BRAND_MARK_GREEN = "#66684A";

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
  const brandMarkSize = isKeyboardCompact ? 40 : 52;

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.container} testID={testID}>
        {topAction}
        <View pointerEvents="none" style={styles.backdrop}>
          <OliveBranchOrnament
            width={170}
            height={200}
            color={theme.primary}
            opacity={theme.isDark ? 0.035 : 0.07}
            style={styles.oliveBranchStart}
          />
          <OliveBranchOrnament
            width={160}
            height={188}
            color={theme.accentWarm}
            opacity={theme.isDark ? 0.055 : 0.075}
            style={styles.oliveBranchEnd}
          />
        </View>

        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.hero}>
              <View
                style={[
                  styles.brandGroup,
                  isKeyboardCompact ? styles.brandGroupCompact : null,
                ]}
              >
                <FitalyMarkIcon
                  width={brandMarkSize}
                  height={brandMarkSize}
                  style={styles.brandMark}
                />
                <Text
                  style={[
                    styles.wordmark,
                    isKeyboardCompact ? styles.wordmarkCompact : null,
                  ]}
                >
                  {brandSuffix}
                </Text>
              </View>

              {isKeyboardCompact ? null : (
                <View style={styles.headingGroup}>
                  <Text style={styles.title} accessibilityRole="header">
                    {title}
                  </Text>
                  {description ? (
                    <Text style={styles.description}>{description}</Text>
                  ) : null}
                </View>
              )}
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
      left: -theme.spacing.screenPaddingWide,
      right: -theme.spacing.screenPaddingWide,
      overflow: "hidden",
    },
    oliveBranchStart: {
      position: "absolute",
      top: isKeyboardCompact ? 38 : 78,
      left: -4,
      transform: [{ rotate: "45deg" }],
    },
    oliveBranchEnd: {
      position: "absolute",
      right: 10,
      bottom: isKeyboardCompact ? -90 : -20,
      transform: [{ rotate: "-75deg" }],
    },
    scroll: {
      flex: 1,
      zIndex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "space-between",
    },
    content: {
      paddingTop: isKeyboardCompact ? theme.spacing.lg : theme.spacing.display,
    },
    hero: {
      alignItems: "center",
      paddingBottom: isKeyboardCompact ? theme.spacing.sm : theme.spacing.xl,
    },
    brandGroup: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xxs,
    },
    brandGroupCompact: {
      marginTop: 0,
    },
    brandMark: {
      marginRight: -4,
    },
    wordmark: {
      color: BRAND_MARK_GREEN,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.displayL,
      lineHeight: theme.typography.lineHeight.displayL,
      textAlign: "center",
      marginTop: 8,
    },
    wordmarkCompact: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      marginTop: 6,
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
      marginTop: "auto",
      paddingTop: isKeyboardCompact
        ? theme.spacing.md
        : theme.spacing.sectionGap,
      paddingBottom: isKeyboardCompact ? theme.spacing.xl : theme.spacing.sm,
    },
    footer: {
      marginTop: 0,
    },
  });
