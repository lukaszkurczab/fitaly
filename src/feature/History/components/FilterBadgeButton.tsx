import React, { useMemo } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";

type Props = { onPress: () => void; activeCount?: number };

export const FilterBadgeButton: React.FC<Props> = ({
  onPress,
  activeCount = 0,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasActive = activeCount > 0;

  return (
    <View style={styles.root} testID="history-filter-button-root">
      <Pressable
        testID="history-filter-button"
        onPress={onPress}
        style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}
        accessibilityRole="button"
        accessibilityLabel={t("filters")}
      >
        <AppIcon name="filter" size={18} color={theme.textTertiary} />
      </Pressable>

      {hasActive ? (
        <View pointerEvents="none" style={styles.badge} testID="history-filter-badge">
          <Text style={styles.badgeLabel}>{activeCount}</Text>
        </View>
      ) : null}
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      width: 44,
      height: 44,
      position: "relative",
      overflow: "visible",
    },
    btn: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      backgroundColor: theme.surface,
      borderColor: theme.borderSoft,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.14 : 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: theme.isDark ? 0 : 1,
    },
    btnPressed: {
      opacity: 0.82,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xxs + 1,
      position: "absolute",
      top: -(theme.spacing.xxs + 1),
      right: -(theme.spacing.xxs + 1),
      backgroundColor: theme.primary,
    },
    badgeLabel: {
      color: theme.cta.primaryText,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.bold,
    },
  });
