import { Pressable, StyleSheet, Text, View } from "react-native";
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
        <Text style={[styles.utilityActionLabel, { fontFamily: theme.typography.fontFamily.medium }]}>
          {textLabel}
        </Text>
      </Pressable>
      <Pressable
        testID="share-add-chart-button"
        onPress={onEnsureChartLayer}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={chartLabel}
      >
        <AppIcon name="stats" size={16} color={theme.textSecondary} />
        <Text style={[styles.utilityActionLabel, { fontFamily: theme.typography.fontFamily.medium }]}>
          {chartLabel}
        </Text>
      </Pressable>
      <Pressable
        testID="share-add-card-button"
        onPress={onEnsureCardLayer}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={cardLabel}
      >
        <AppIcon name="card" size={16} color={theme.textSecondary} />
        <Text style={[styles.utilityActionLabel, { fontFamily: theme.typography.fontFamily.medium }]}>
          {cardLabel}
        </Text>
      </Pressable>
      <Pressable
        testID="share-add-photo-button"
        onPress={onAddOrReplaceAdditionalPhoto}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={photoLabel}
      >
        <AppIcon name="add-photo" size={16} color={theme.textSecondary} />
        <Text style={[styles.utilityActionLabel, { fontFamily: theme.typography.fontFamily.medium }]}>
          {photoLabel}
        </Text>
      </Pressable>
      <Pressable
        testID="share-reset-composition-button"
        onPress={onResetComposition}
        style={[styles.utilityAction, { borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={resetLabel}
      >
        <AppIcon name="refresh" size={16} color={theme.textSecondary} />
        <Text style={[styles.utilityActionLabel, { fontFamily: theme.typography.fontFamily.medium }]}>
          {resetLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 4,
  },
  utilityAction: {
    minHeight: 30,
    minWidth: 58,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#F7F2EA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    flexDirection: "row",
    gap: 4,
  },
  utilityActionLabel: {
    color: "#393128",
    fontSize: 10,
    lineHeight: 12,
  },
});
