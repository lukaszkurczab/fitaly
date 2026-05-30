import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";
import { Button } from "@/components/Button";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "archive" | "compact";
  testID?: string;
  actionTestID?: string;
};

export const EmptyState: React.FC<Props> = ({
  title,
  eyebrow,
  description,
  actionLabel,
  onAction,
  variant = "archive",
  testID,
  actionTestID,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isCompact = variant === "compact";

  return (
    <View
      style={[styles.container, isCompact ? styles.cardCompact : null]}
      testID={testID}
    >
      {isCompact ? (
        <View
          style={styles.compactIconBox}
          testID="history-empty-compact-accent"
        >
          <AppIcon name="search" size={22} color={theme.textTertiary} />
        </View>
      ) : (
        <View
          style={styles.archiveGraphicFrame}
          testID="history-empty-archive-graphic"
        >
          <Image
            source={require("../../../../assets/images/image.png")}
            resizeMode="cover"
            style={styles.archiveGraphicImage}
            testID="history-empty-archive-image"
          />
          <View style={styles.archiveGraphicWash} />
        </View>
      )}

      <View
        style={[styles.copyBlock, isCompact ? styles.copyBlockCompact : null]}
      >
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>
          {title}
        </Text>

        {description ? (
          <Text
            style={[
              styles.description,
              isCompact ? styles.descriptionCompact : null,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button
          testID={actionTestID}
          label={actionLabel}
          onPress={onAction}
          style={isCompact ? styles.actionCompact : styles.actionArchive}
        />
      ) : null}
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      alignSelf: "stretch",
      gap: theme.spacing.md,
    },
    cardCompact: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.1 : 0.03,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: theme.isDark ? 0 : 1,
      overflow: "hidden",
    },
    archiveGraphicFrame: {
      width: "100%",
      height: 266,
      borderRadius: theme.rounded.xxl,
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.04)"
        : "rgba(255, 253, 248, 0.58)",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      overflow: "hidden",
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.22 : 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: theme.isDark ? 0 : 2,
    },
    archiveGraphicImage: {
      width: "100%",
      height: "100%",
    },
    archiveGraphicWash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(13, 17, 13, 0.34)"
        : "rgba(255, 253, 248, 0.04)",
    },
    compactIconBox: {
      width: 52,
      height: 52,
      borderRadius: theme.rounded.lg,
      marginBottom: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    copyBlock: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    copyBlockCompact: {
      paddingHorizontal: 0,
    },
    eyebrow: {
      color: theme.primaryStrong,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.h2,
      lineHeight: theme.typography.lineHeight.h2,
      fontFamily: theme.typography.fontFamily.semiBold,
      marginBottom: theme.spacing.xs,
      textAlign: "center",
      maxWidth: 300,
    },
    titleCompact: {
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
    },
    description: {
      color: theme.textSecondary,
      textAlign: "center",
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
      maxWidth: 300,
    },
    descriptionCompact: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      maxWidth: 280,
    },
    actionArchive: {
      marginTop: theme.spacing.xs,
      alignSelf: "stretch",
    },
    actionCompact: {
      minWidth: 220,
      paddingHorizontal: theme.spacing.xl,
    },
  });
