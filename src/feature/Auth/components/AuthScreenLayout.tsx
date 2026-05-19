import { useMemo, type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Layout } from "@/components";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { useTheme } from "@/theme/useTheme";

type AuthScreenLayoutProps = {
  brand: string;
  title: string;
  description?: string;
  testID?: string;
  banner?: ReactNode;
  bottomAction?: ReactNode;
  footer?: ReactNode;
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
  children,
}: AuthScreenLayoutProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
              <Text style={styles.wordmark}>{brand}</Text>

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

            <View style={styles.form}>{children}</View>
          </View>

          {bottomAction || footer ? (
            <View style={styles.bottomBlock}>
              {bottomAction}
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
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
      justifyContent: "space-between",
    },
    content: {
      paddingTop: theme.spacing.xl,
    },
    hero: {
      alignItems: "center",
      paddingBottom: theme.spacing.sectionGap,
    },
    wordmark: {
      color: theme.primary,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.displayM,
      lineHeight: theme.typography.lineHeight.displayL,
      textAlign: "center",
    },
    headingGroup: {
      marginTop: theme.spacing.xs,
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
      marginBottom: theme.spacing.lg,
    },
    form: {
      width: "100%",
      flexGrow: 1,
    },
    bottomBlock: {
      paddingTop: theme.spacing.sectionGapLarge,
      paddingBottom: theme.spacing.sm,
    },
    footer: {
      marginTop: theme.spacing.md,
    },
  });
