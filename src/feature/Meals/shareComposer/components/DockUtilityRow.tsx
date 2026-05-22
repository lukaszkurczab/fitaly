import { Pressable, StyleSheet, View } from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";

type DockUtilityRowProps = {
  textLabel: string;
  chartLabel: string;
  cardLabel: string;
  photoLabel: string;
  resetLabel: string;
  onAddTextLayer: () => void;
  onEnsureChartLayer: () => void;
  onEnsureCardLayer: () => void;
  onAddOrReplaceAdditionalPhoto: () => void;
  onResetComposition: () => void;
};

export default function DockUtilityRow({
  textLabel,
  chartLabel,
  cardLabel,
  photoLabel,
  resetLabel,
  onAddTextLayer,
  onEnsureChartLayer,
  onEnsureCardLayer,
  onAddOrReplaceAdditionalPhoto,
  onResetComposition,
}: DockUtilityRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.utilityRow} testID="share-utility-row">
      <Pressable
        testID="share-add-text-button"
        onPress={onAddTextLayer}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={textLabel}
      >
        <AppIcon name="text" size={16} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        testID="share-add-chart-button"
        onPress={onEnsureChartLayer}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={chartLabel}
      >
        <AppIcon name="stats" size={16} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        testID="share-add-card-button"
        onPress={onEnsureCardLayer}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={cardLabel}
      >
        <AppIcon name="card" size={16} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        testID="share-add-photo-button"
        onPress={onAddOrReplaceAdditionalPhoto}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={photoLabel}
      >
        <AppIcon name="add-photo" size={16} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        testID="share-reset-button"
        onPress={onResetComposition}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={resetLabel}
      >
        <AppIcon name="refresh" size={16} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  utilityAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#F7F2EA",
    alignItems: "center",
    justifyContent: "center",
  },
});
