import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type DockActiveLayerHeaderProps = {
  metaLabel?: string | null;
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
  const showMetaLabel = Boolean(metaLabel?.trim());

  return (
    <View
      style={[
        styles.activeLayerHeader,
        {
          borderBottomColor: theme.isDark
            ? "rgba(166,189,160,0.16)"
            : "rgba(79,104,75,0.12)",
        },
      ]}
    >
      <View style={styles.titleBlock}>
        {showMetaLabel ? (
          <Text
            numberOfLines={1}
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
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.activeLayerTitle,
            !showMetaLabel ? styles.activeLayerTitleSingle : null,
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
          testID="share-remove-layer-button"
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
    minHeight: 32,
    borderBottomWidth: 1,
    paddingHorizontal: 2,
    paddingTop: 1,
    paddingBottom: 5,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  metaLabel: {
    fontSize: 9,
    lineHeight: 11,
    textTransform: "uppercase",
  },
  activeLayerTitle: {
    fontSize: 13.5,
    lineHeight: 16,
    marginTop: 1,
  },
  activeLayerTitleSingle: {
    fontSize: 15,
    lineHeight: 18,
    marginTop: 0,
  },
  localAction: {
    height: 25,
    minWidth: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  localActionLabel: {
    fontSize: 10.5,
    lineHeight: 12,
  },
});
