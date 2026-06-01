import { StyleSheet, Text, View } from "react-native";
import { QUICK_PRESET_OPTIONS } from "@/feature/Meals/shareComposer/presets";
import type {
  ShareNutrition,
  SharePresetId,
} from "@/feature/Meals/shareComposer/types";
import { useTheme } from "@/theme/useTheme";
import PresetThumb from "@/feature/Meals/shareComposer/components/PresetThumb";

type DockQuickPanelProps = {
  selectedPreset: SharePresetId;
  mealPhotoUri: string;
  nutrition: ShareNutrition;
  macroLabels: {
    protein: string;
    carbs: string;
    fat: string;
  };
  presetsLabel: string;
  presetAccessibilityLabels: Record<SharePresetId, string>;
  onPresetSelect: (presetId: SharePresetId) => void;
};

export default function DockQuickPanel({
  selectedPreset,
  mealPhotoUri,
  nutrition,
  macroLabels,
  presetsLabel,
  presetAccessibilityLabels,
  onPresetSelect,
}: DockQuickPanelProps) {
  const theme = useTheme();

  return (
    <View style={styles.quickPanel}>
      <Text
        style={[
          styles.sectionLabel,
          {
            color: theme.isDark ? theme.text : "#393128",
            fontFamily: theme.typography.fontFamily.semiBold,
            backgroundColor: theme.isDark
              ? "rgba(30,34,30,0.74)"
              : "rgba(255,253,248,0.78)",
            borderColor: theme.isDark
              ? "rgba(166,189,160,0.22)"
              : "rgba(79,104,75,0.16)",
          },
        ]}
      >
        {presetsLabel}
      </Text>
      <View style={styles.presetRow}>
        {QUICK_PRESET_OPTIONS.map((preset) => (
          <PresetThumb
            key={preset.id}
            presetId={preset.id}
            mealPhotoUri={mealPhotoUri}
            nutrition={nutrition}
            macroLabels={macroLabels}
            accessibilityLabel={presetAccessibilityLabels[preset.id]}
            active={selectedPreset === preset.id}
            onPress={() => onPresetSelect(preset.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickPanel: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: 3,
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
    paddingHorizontal: 3,
  },
});
