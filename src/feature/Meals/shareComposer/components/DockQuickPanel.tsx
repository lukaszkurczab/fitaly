import { StyleSheet, View } from "react-native";
import { QUICK_PRESET_OPTIONS } from "@/feature/Meals/shareComposer/presets";
import type {
  ShareNutrition,
  SharePresetId,
} from "@/feature/Meals/shareComposer/types";
import PresetThumb from "@/feature/Meals/shareComposer/components/PresetThumb";

type DockQuickPanelProps = {
  selectedPreset: SharePresetId;
  mealPhotoUri: string;
  nutrition: ShareNutrition;
  presetAccessibilityLabels: Record<SharePresetId, string>;
  onPresetSelect: (presetId: SharePresetId) => void;
};

export default function DockQuickPanel({
  selectedPreset,
  mealPhotoUri,
  nutrition,
  presetAccessibilityLabels,
  onPresetSelect,
}: DockQuickPanelProps) {
  return (
    <View style={styles.quickPanel}>
      <View style={styles.presetRow}>
        {QUICK_PRESET_OPTIONS.map((preset) => (
          <PresetThumb
            key={preset.id}
            presetId={preset.id}
            mealPhotoUri={mealPhotoUri}
            nutrition={nutrition}
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
    width: "100%",
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
    paddingHorizontal: 3,
  },
});
