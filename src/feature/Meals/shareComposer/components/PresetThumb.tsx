import { Image, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { SharePresetId } from "@/feature/Meals/shareComposer/types";

function presetAccessibilityLabel(presetId: SharePresetId) {
  if (presetId === "quickSidebar") return "Sidebar preset";
  if (presetId === "quickFooter") return "Footer preset";
  return "Top card preset";
}

type PresetThumbProps = {
  presetId: SharePresetId;
  mealPhotoUri: string;
  active: boolean;
  onPress: () => void;
};

export default function PresetThumb({
  presetId,
  mealPhotoUri,
  active,
  onPress,
}: PresetThumbProps) {
  const theme = useTheme();
  const macroBars = [
    { color: theme.macro.protein, width: 18 },
    { color: theme.macro.carbs, width: 19 },
    { color: theme.macro.fat, width: 16 },
  ];

  return (
    <Pressable
      testID={`share-preset-${presetId}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={presetAccessibilityLabel(presetId)}
      style={({ pressed }) => [
        styles.presetThumb,
        {
          borderColor: active ? theme.primary : theme.border,
          borderWidth: active ? 1.5 : 1,
          backgroundColor: theme.surfaceAlt,
          opacity: pressed ? 0.86 : 1,
        },
        active ? theme.depth.raised : null,
      ]}
    >
      {mealPhotoUri.trim() ? (
        <Image source={{ uri: mealPhotoUri }} resizeMode="cover" style={styles.presetPreviewPhoto} />
      ) : (
        <View
          style={[
            styles.presetPreviewPhotoFallback,
            { backgroundColor: theme.surfaceAlt },
          ]}
        />
      )}

      {presetId === "quickSidebar" ? (
        <>
          <View style={[styles.presetPreviewCard, styles.presetPreviewCardSidebar]} />
          <View style={[styles.presetHeadline, styles.presetHeadlineSidebar]} />
          <View style={styles.presetSidebarLines}>
            {macroBars.map((bar) => (
              <View
                key={bar.color}
                style={[
                  styles.presetLine,
                  {
                    width: 16,
                    backgroundColor: bar.color,
                  },
                ]}
              />
            ))}
          </View>
        </>
      ) : presetId === "quickFooter" ? (
        <>
          <View style={[styles.presetPreviewCard, styles.presetPreviewCardFooter]} />
          <View style={[styles.presetHeadline, styles.presetHeadlineFooter]} />
          <View style={styles.presetFooterLines}>
            {macroBars.map((bar) => (
              <View
                key={bar.color}
                style={[
                  styles.presetLine,
                  {
                    width: bar.width,
                    backgroundColor: bar.color,
                  },
                ]}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.presetPreviewCard, styles.presetPreviewCardTop]} />
          <View style={[styles.presetHeadline, styles.presetHeadlineTop]} />
          <View style={styles.presetTopLines}>
            {macroBars.map((bar) => (
              <View
                key={bar.color}
                style={[
                  styles.presetLine,
                  {
                    width: bar.width,
                    backgroundColor: bar.color,
                  },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presetThumb: {
    width: 91,
    height: 46,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
  },
  presetPreviewPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  presetPreviewPhotoFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  presetPreviewCard: {
    position: "absolute",
    backgroundColor: "rgba(251,248,242,0.92)",
  },
  presetPreviewCardTop: {
    left: 11,
    right: 11,
    top: 1,
    height: 14,
    borderRadius: 6,
  },
  presetPreviewCardSidebar: {
    top: 1,
    bottom: 1,
    left: 1,
    width: 26,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  presetPreviewCardFooter: {
    left: 1,
    right: 1,
    bottom: 1,
    height: 13,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  presetHeadline: {
    position: "absolute",
    backgroundColor: "#393128",
    borderRadius: 2,
    height: 4,
  },
  presetHeadlineTop: {
    width: 22,
    top: 5,
    left: 35,
  },
  presetHeadlineSidebar: {
    width: 16,
    top: 5,
    left: 6,
  },
  presetHeadlineFooter: {
    width: 22,
    top: 36,
    left: 4,
  },
  presetLine: {
    height: 3,
    borderRadius: 2,
  },
  presetTopLines: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    left: 18,
    top: 12,
  },
  presetSidebarLines: {
    position: "absolute",
    left: 6,
    top: 12,
    gap: 2,
  },
  presetFooterLines: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    right: 6,
    top: 37,
  },
});
