import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type DockActiveLayerHeaderProps = {
  metaLabel: string;
  title: string;
  showRemove: boolean;
  removeLabel: string;
  onRemove: () => void;
};

export default function DockActiveLayerHeader({
  metaLabel,
  title,
  showRemove,
  removeLabel,
  onRemove,
}: DockActiveLayerHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.activeLayerHeader}>
      <View>
        <Text
          style={[
            styles.metaLabel,
            {
              color: theme.textTertiary,
              fontFamily: theme.typography.fontFamily.medium,
            },
          ]}
        >
          {metaLabel}
        </Text>
        <Text
          style={[
            styles.activeLayerTitle,
            {
              color: theme.text,
              fontFamily: theme.typography.fontFamily.semiBold,
            },
          ]}
        >
          {title}
        </Text>
      </View>
      {showRemove ? (
        <Pressable
          onPress={onRemove}
          style={[
            styles.localAction,
            {
              backgroundColor: theme.error.surface,
              borderColor: theme.error.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
        >
          <Text
            style={[
            styles.localActionLabel,
            {
              color: theme.error.text,
              fontFamily: theme.typography.fontFamily.medium,
            },
          ]}
          >
            {removeLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeLayerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  metaLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  activeLayerTitle: {
    fontSize: 15,
    lineHeight: 18,
    marginTop: 2,
  },
  localAction: {
    height: 24,
    minWidth: 68,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  localActionLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
});
