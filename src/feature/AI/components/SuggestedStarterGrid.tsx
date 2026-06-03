import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

export type SuggestedStarter = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  starters: SuggestedStarter[];
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  onSelect: (value: string) => void;
};

export function SuggestedStarterGrid({
  title,
  starters,
  disabled = false,
  compact = false,
  accessibilityHint,
  onSelect,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{title}</Text>

      <View style={[styles.grid, compact ? styles.gridCompact : null]}>
        {starters.map((starter) => (
          <Pressable
            key={starter.label}
            disabled={disabled}
            onPress={() => onSelect(starter.value)}
            style={({ pressed }) => [
              styles.chip,
              compact ? styles.chipCompact : null,
              disabled ? styles.chipDisabled : null,
              pressed && !disabled ? styles.chipPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={starter.label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled }}
          >
            <Text
              style={[
                styles.chipLabel,
                compact ? styles.chipLabelCompact : null,
                disabled ? styles.chipLabelDisabled : null,
              ]}
            >
              {starter.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    sectionLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0.2,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: theme.spacing.xs,
    },
    gridCompact: {
      rowGap: theme.spacing.xs,
    },
    chip: {
      width: "48%",
      minHeight: 50,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.isDark ? theme.surfaceAlt : theme.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      justifyContent: "center",
    },
    chipCompact: {
      minHeight: 48,
      paddingHorizontal: theme.spacing.sm,
    },
    chipLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipLabelCompact: {
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    chipDisabled: {
      backgroundColor: theme.isDark ? theme.disabled.background : theme.surfaceAlt,
      borderColor: theme.borderSoft,
    },
    chipLabelDisabled: {
      color: theme.textTertiary,
    },
    chipPressed: {
      opacity: 0.82,
    },
  });
