import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";

type DockChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
};

export default function DockChip({
  label,
  active,
  onPress,
  compact = false,
}: DockChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        compact ? styles.chipCompact : null,
        {
          backgroundColor: active ? theme.primary : "#F7F2EA",
          borderColor: active ? theme.primary : theme.borderSoft,
          opacity: pressed ? 0.85 : 1,
        },
        !active ? { backgroundColor: theme.surfaceAlt } : null,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
            {
            color: active ? theme.cta.primaryText : theme.textSecondary,
            fontFamily: active
              ? theme.typography.fontFamily.semiBold
              : theme.typography.fontFamily.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCompact: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  chipLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
});
