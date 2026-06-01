import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ColorPicker, { HueSlider, OpacitySlider, Panel1 } from "reanimated-color-picker";
import { useTheme } from "@/theme/useTheme";

type DockColorPickerModalProps = {
  visible: boolean;
  closeLabel: string;
  doneLabel: string;
  title: string;
  colorValue: string;
  normalizedColorValue: string;
  showOpacity: boolean;
  onClose: () => void;
  onApplyColor: (color: string) => void;
};

export default function DockColorPickerModal({
  visible,
  closeLabel,
  doneLabel,
  title,
  colorValue,
  normalizedColorValue,
  showOpacity,
  onClose,
  onApplyColor,
}: DockColorPickerModalProps) {
  const theme = useTheme();

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.colorPickerModalRoot} testID="share-color-picker-modal">
        <Pressable
          style={[
            styles.colorPickerBackdrop,
            {
              backgroundColor: theme.isDark
                ? "rgba(15,18,15,0.20)"
                : "rgba(57,49,40,0.10)",
            },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          style={[
            styles.colorPickerSheet,
            {
              borderColor: theme.border,
              backgroundColor: theme.surfaceElevated,
            },
          ]}
        >
          <View style={styles.colorPickerHeader}>
            <View style={styles.colorPickerTitleGroup}>
              <View
                accessible
                accessibilityLabel={normalizedColorValue}
                style={[
                  styles.colorPreviewSwatch,
                  {
                    borderColor: theme.borderSoft,
                    backgroundColor: colorValue,
                  },
                ]}
              />
              <Text
                style={[
                  styles.colorPickerTitle,
                  {
                    color: theme.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                  },
                ]}
              >
                {title}
              </Text>
            </View>
            <Pressable
              testID="share-color-picker-done-button"
              onPress={onClose}
              style={[
                styles.colorPickerDone,
                {
                  borderColor: theme.isDark
                    ? "rgba(214, 229, 209, 0.78)"
                    : theme.primary,
                  backgroundColor: theme.isDark ? theme.primaryStrong : theme.primary,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={doneLabel}
            >
              <Text
                style={[
                  styles.colorPickerDoneLabel,
                  {
                    color: theme.isDark ? theme.textInverse : theme.cta.primaryText,
                    fontFamily: theme.typography.fontFamily.semiBold,
                  },
                ]}
              >
                {doneLabel}
              </Text>
            </Pressable>
          </View>

          <ColorPicker
            value={colorValue}
            onChangeJS={({ hex, rgba }) => onApplyColor(showOpacity ? (rgba || hex) : hex)}
            style={styles.colorPicker}
          >
            <Panel1 style={styles.colorPickerPanel} />
            <HueSlider style={styles.colorPickerHue} />
            {showOpacity ? <OpacitySlider style={styles.colorPickerOpacity} /> : null}
          </ColorPicker>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  colorPickerModalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  colorPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  colorPickerSheet: {
    alignSelf: "center",
    width: "82%",
    maxWidth: 300,
    borderRadius: 16,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 5,
    borderWidth: 1,
  },
  colorPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  colorPickerTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorPickerTitle: {
    fontSize: 14,
    lineHeight: 17,
    flexShrink: 1,
  },
  colorPickerDone: {
    minHeight: 24,
    minWidth: 72,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  colorPickerDoneLabel: {
    fontSize: 11.5,
    lineHeight: 13,
  },
  colorPreviewSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  colorPicker: {
    gap: 5,
  },
  colorPickerPanel: {
    borderRadius: 11,
    height: 72,
  },
  colorPickerHue: {
    borderRadius: 7,
    height: 12,
  },
  colorPickerOpacity: {
    borderRadius: 7,
    height: 12,
  },
});
