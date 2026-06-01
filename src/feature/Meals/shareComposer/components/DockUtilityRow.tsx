import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { AppIconName } from "@/components/AppIcon";

type DockUtilityRowProps = {
  textLabel: string;
  chartLabel: string;
  cardLabel: string;
  photoLabel: string;
  resetLabel: string;
  hasChart: boolean;
  hasCard: boolean;
  hasPhoto: boolean;
  onAddTextLayer: () => void;
  onEnsureChartLayer: () => void;
  onEnsureCardLayer: () => void;
  onAddOrReplaceAdditionalPhoto: () => void;
  onResetComposition: () => void;
};

type UtilityActionProps = {
  testID: string;
  label: string;
  icon: AppIconName;
  active?: boolean;
  secondary?: boolean;
  onPress: () => void;
};

function UtilityAction({
  testID,
  label,
  icon,
  active = false,
  secondary = false,
  onPress,
}: UtilityActionProps) {
  const theme = useTheme();
  const colors = resolveUtilityActionColors(theme, active, secondary);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.utilityAction,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <AppIcon name={icon} size={14} color={colors.iconColor} />
      <Text
        numberOfLines={1}
        style={[
          styles.utilityLabel,
          {
            color: colors.labelColor,
            fontFamily: theme.typography.fontFamily.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function resolveUtilityActionColors(
  theme: ReturnType<typeof useTheme>,
  active: boolean,
  secondary: boolean,
) {
  if (!theme.isDark) {
    return {
      backgroundColor: active
        ? theme.focusRing
        : secondary
          ? theme.surfaceElevated
          : theme.focusRing,
      borderColor: active ? theme.primarySoft : theme.borderSoft,
      iconColor: secondary ? theme.textSecondary : theme.primaryStrong,
      labelColor: theme.textSecondary,
    };
  }

  if (active) {
    return {
      backgroundColor: "rgba(111, 138, 105, 0.34)",
      borderColor: theme.primaryStrong,
      iconColor: "#D9E6D5",
      labelColor: theme.text,
    };
  }

  if (secondary) {
    return {
      backgroundColor: "rgba(30, 34, 30, 0.9)",
      borderColor: "rgba(158, 152, 142, 0.3)",
      iconColor: theme.textSecondary,
      labelColor: theme.textSecondary,
    };
  }

  return {
    backgroundColor: "rgba(38, 43, 38, 0.98)",
    borderColor: "rgba(166, 189, 160, 0.3)",
    iconColor: theme.primaryStrong,
    labelColor: theme.text,
  };
}

export default function DockUtilityRow({
  textLabel,
  chartLabel,
  cardLabel,
  photoLabel,
  resetLabel,
  hasChart,
  hasCard,
  hasPhoto,
  onAddTextLayer,
  onEnsureChartLayer,
  onEnsureCardLayer,
  onAddOrReplaceAdditionalPhoto,
  onResetComposition,
}: DockUtilityRowProps) {
  return (
    <View style={styles.utilityRow} testID="share-utility-row">
      <UtilityAction
        testID="share-add-text-button"
        label={textLabel}
        icon="text"
        onPress={onAddTextLayer}
      />
      <UtilityAction
        testID="share-add-chart-button"
        label={chartLabel}
        icon="stats"
        active={hasChart}
        onPress={onEnsureChartLayer}
      />
      <UtilityAction
        testID="share-add-card-button"
        label={cardLabel}
        icon="card"
        active={hasCard}
        onPress={onEnsureCardLayer}
      />
      <UtilityAction
        testID="share-add-photo-button"
        label={photoLabel}
        icon="add-photo"
        active={hasPhoto}
        onPress={onAddOrReplaceAdditionalPhoto}
      />
      <UtilityAction
        testID="share-reset-button"
        label={resetLabel}
        icon="refresh"
        secondary
        onPress={onResetComposition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  utilityAction: {
    width: 52,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
  },
  utilityLabel: {
    fontSize: 9,
    lineHeight: 10,
    textAlign: "center",
  },
});
