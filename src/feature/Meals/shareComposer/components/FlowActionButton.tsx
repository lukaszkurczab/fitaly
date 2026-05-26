import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";

type FlowActionButtonProps = {
  label: string;
  primary: boolean;
  loading: boolean;
  onPress: () => void;
  testID?: string;
};

export default function FlowActionButton({
  label,
  primary,
  loading,
  onPress,
  testID,
}: FlowActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.flowButton,
        {
          backgroundColor: primary
            ? theme.button.primary.background
            : theme.button.secondary.background,
          borderColor: primary
            ? theme.button.primary.border
            : theme.button.secondary.border,
          opacity: pressed ? 0.88 : 1,
        },
        primary ? theme.depth.cta : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={primary ? theme.button.primary.text : theme.button.secondary.text}
        />
      ) : (
        <Text
          style={[
            styles.flowButtonLabel,
            {
              color: primary ? theme.button.primary.text : theme.button.secondary.text,
              fontFamily: theme.typography.fontFamily.semiBold,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flowButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  flowButtonLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
});
