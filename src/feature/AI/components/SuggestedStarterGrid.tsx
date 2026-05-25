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
  onSelect: (value: string) => void;
};

export function SuggestedStarterGrid({
  title,
  starters,
  disabled = false,
  compact = false,
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
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.semiBold,
      letterSpacing: 0.6,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: theme.spacing.md,
    },
    gridCompact: {
      rowGap: theme.spacing.xs,
    },
    chip: {
      width: "48%",
      minHeight: 66,
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: theme.spacing.md,
      justifyContent: "center",
      ...theme.depth.raised,
    },
    chipCompact: {
      minHeight: 52,
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.sm,
      shadowOpacity: 0.08,
      elevation: 1,
    },
    chipLabel: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipLabelCompact: {
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    chipDisabled: {
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.borderSoft,
      shadowOpacity: 0,
      elevation: 0,
    },
    chipLabelDisabled: {
      color: theme.textTertiary,
    },
    chipPressed: {
      opacity: 0.82,
    },
  });
