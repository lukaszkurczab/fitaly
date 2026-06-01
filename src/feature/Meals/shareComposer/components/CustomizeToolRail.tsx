import { Pressable, StyleSheet, View } from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import type { AppIconName } from "@/components/AppIcon";
import type { ShareLayerId } from "@/feature/Meals/shareComposer/types";

type CustomizeToolRailProps = {
  textLabel: string;
  chartLabel: string;
  cardLabel: string;
  photoLabel: string;
  resetLabel: string;
  hasChart: boolean;
  hasCard: boolean;
  hasPhoto: boolean;
  selectedLayerId: ShareLayerId | null;
  onAddTextLayer: () => void;
  onEnsureChartLayer: () => void;
  onEnsureCardLayer: () => void;
  onAddOrReplaceAdditionalPhoto: () => void;
  onResetComposition: () => void;
};

type ToolRailActionProps = {
  testID: string;
  label: string;
  icon: AppIconName;
  active?: boolean;
  present?: boolean;
  secondary?: boolean;
  onPress: () => void;
};

function resolveActionColors(
  theme: ReturnType<typeof useTheme>,
  active: boolean,
  present: boolean,
  secondary: boolean,
) {
  if (active) {
    return {
      backgroundColor: theme.primary,
      borderColor: theme.primaryStrong,
      iconColor: theme.cta.primaryText,
      indicatorColor: "transparent",
    };
  }

  if (present) {
    return {
      backgroundColor: theme.isDark
        ? "rgba(111,138,105,0.18)"
        : "rgba(111,138,105,0.10)",
      borderColor: theme.isDark
        ? "rgba(214,229,209,0.46)"
        : "rgba(79,104,75,0.34)",
      iconColor: theme.primaryStrong,
      indicatorColor: theme.primaryStrong,
    };
  }

  if (theme.isDark) {
    return {
      backgroundColor: secondary
        ? "rgba(30,34,30,0.78)"
        : "rgba(255,253,248,0.10)",
      borderColor: secondary
        ? "rgba(158,152,142,0.28)"
        : "rgba(255,253,248,0.18)",
      iconColor: secondary ? theme.textSecondary : theme.text,
      indicatorColor: "transparent",
    };
  }

  return {
    backgroundColor: secondary
      ? "rgba(247,242,234,0.78)"
      : "rgba(255,253,248,0.88)",
    borderColor: secondary ? theme.borderSoft : "rgba(79,104,75,0.18)",
    iconColor: secondary ? theme.textSecondary : theme.primaryStrong,
    indicatorColor: "transparent",
  };
}

function ToolRailAction({
  testID,
  label,
  icon,
  active = false,
  present = false,
  secondary = false,
  onPress,
}: ToolRailActionProps) {
  const theme = useTheme();
  const colors = resolveActionColors(theme, active, present, secondary);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <AppIcon name={icon} size={18} color={colors.iconColor} />
      {present && !active ? (
        <View
          pointerEvents="none"
          style={[
            styles.presentIndicator,
            { backgroundColor: colors.indicatorColor },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

export default function CustomizeToolRail({
  textLabel,
  chartLabel,
  cardLabel,
  photoLabel,
  resetLabel,
  hasChart,
  hasCard,
  hasPhoto,
  selectedLayerId,
  onAddTextLayer,
  onEnsureChartLayer,
  onEnsureCardLayer,
  onAddOrReplaceAdditionalPhoto,
  onResetComposition,
}: CustomizeToolRailProps) {
  const theme = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
      testID="share-customize-tool-rail"
    >
      <View
        style={[
          styles.rail,
          {
            backgroundColor: theme.isDark
              ? "rgba(30,34,30,0.78)"
              : "rgba(255,253,248,0.84)",
            borderColor: theme.isDark
              ? "rgba(255,253,248,0.14)"
              : "rgba(79,104,75,0.16)",
          },
        ]}
        testID="share-utility-row"
      >
        <ToolRailAction
          testID="share-add-text-button"
          label={textLabel}
          icon="text"
          active={selectedLayerId?.startsWith("text:") ?? false}
          onPress={onAddTextLayer}
        />
        <ToolRailAction
          testID="share-add-chart-button"
          label={chartLabel}
          icon="stats"
          active={selectedLayerId === "chartWidget"}
          present={hasChart}
          onPress={onEnsureChartLayer}
        />
        <ToolRailAction
          testID="share-add-card-button"
          label={cardLabel}
          icon="card"
          active={selectedLayerId === "cardWidget"}
          present={hasCard}
          onPress={onEnsureCardLayer}
        />
        <ToolRailAction
          testID="share-add-photo-button"
          label={photoLabel}
          icon="add-photo"
          active={selectedLayerId === "additionalPhoto"}
          present={hasPhoto}
          onPress={onAddOrReplaceAdditionalPhoto}
        />
        <ToolRailAction
          testID="share-reset-button"
          label={resetLabel}
          icon="refresh"
          secondary
          onPress={onResetComposition}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 8,
    top: 82,
    zIndex: 20,
  },
  rail: {
    gap: 5,
    borderRadius: 23,
    borderWidth: 1,
    padding: 4,
    shadowColor: "#393128",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presentIndicator: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
