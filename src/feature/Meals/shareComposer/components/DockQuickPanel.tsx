import { StyleSheet, Text, View } from "react-native";
import { QUICK_PRESET_OPTIONS } from "@/feature/Meals/shareComposer/presets";
import type { SharePresetId } from "@/feature/Meals/shareComposer/types";
import { useTheme } from "@/theme/useTheme";
import PresetThumb from "@/feature/Meals/shareComposer/components/PresetThumb";

type DockQuickPanelProps = {
  selectedPreset: SharePresetId;
  mealPhotoUri: string;
  presetsLabel: string;
  onPresetSelect: (presetId: SharePresetId) => void;
};

export default function DockQuickPanel({
  selectedPreset,
  mealPhotoUri,
  presetsLabel,
  onPresetSelect,
}: DockQuickPanelProps) {
  const theme = useTheme();

  return (
    <View style={styles.quickPanel}>
      <Text
        style={[
          styles.sectionLabel,
          {
            color: theme.text,
            fontFamily: theme.typography.fontFamily.semiBold,
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
    fontSize: 13,
    lineHeight: 15,
    paddingHorizontal: 8,
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 4,
  },
});
