import { useMemo, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

export type InfoBlockTone = "neutral" | "info" | "success" | "warning" | "error";

export type InfoBlockProps = {
  title: string;
  body: string;
  icon?: ReactNode;
  tone?: InfoBlockTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function InfoBlock({
  title,
  body,
  icon,
  tone = "neutral",
  style,
  testID,
}: InfoBlockProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const palette = getTonePalette(theme, tone);

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: palette.iconBackground,
            },
          ]}
        >
          {icon}
        </View>
      ) : null}

      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
        <Text style={[styles.body, { color: palette.body }]}>{body}</Text>
      </View>
    </View>
  );
}

function getTonePalette(theme: ReturnType<typeof useTheme>, tone: InfoBlockTone) {
  switch (tone) {
    case "info":
      return {
        background: theme.info.surface,
        border: theme.info.main,
        iconBackground: theme.surfaceElevated,
        title: theme.info.text,
        body: theme.textSecondary,
      };
    case "success":
      return {
        background: theme.success.surface,
        border: theme.success.main,
        iconBackground: theme.surfaceElevated,
        title: theme.success.text,
        body: theme.textSecondary,
      };
    case "warning":
      return {
        background: theme.warning.surface,
        border: theme.warning.main,
        iconBackground: theme.surfaceElevated,
        title: theme.warning.text,
        body: theme.textSecondary,
      };
    case "error":
      return {
        background: theme.error.surface,
        border: theme.error.border,
        iconBackground: theme.surfaceElevated,
        title: theme.error.text,
        body: theme.textSecondary,
      };
    case "neutral":
    default:
      return {
        background: theme.surfaceAlt,
        border: theme.borderSoft,
        iconBackground: theme.surfaceElevated,
        title: theme.text,
        body: theme.textSecondary,
      };
  }
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: theme.spacing.cardPaddingLarge,
      borderWidth: 1,
      borderRadius: theme.rounded.lg,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    title: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    body: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });

export default InfoBlock;
