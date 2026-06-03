import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { RangeKey } from "@/feature/Statistics/types";

type Props = {
  active: RangeKey;
  onChange: (next: RangeKey) => void;
  options: Array<{ key: RangeKey; label: string }>;
};

export function StatisticsRangeSwitcher({ active, onChange, options }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.root} testID="statistics-range-switcher">
      {options.map((option) => {
        const isActive = option.key === active;

        return (
          <Pressable
            key={option.key}
            testID={`statistics-range-${option.key}-button`}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : null,
              pressed ? styles.tabPressed : null,
            ]}
          >
            <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: theme.rounded.md,
      backgroundColor: theme.surfaceAlt,
      padding: theme.spacing.xxs,
      gap: theme.spacing.xxs,
    },
    tab: {
      flex: 1,
      minHeight: theme.spacing.xxl + theme.spacing.xxs,
      borderRadius: theme.rounded.sm,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    tabPressed: {
      opacity: 0.92,
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      color: theme.textSecondary,
    },
    tabLabelActive: {
      color: theme.cta.primaryText,
    },
  });
