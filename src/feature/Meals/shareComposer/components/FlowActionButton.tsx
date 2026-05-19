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
          backgroundColor: primary ? theme.primary : "#FBF8F2",
          borderColor: primary ? theme.primary : theme.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? "#FBF8F2" : "#393128"} />
      ) : (
        <Text
          style={[
            styles.flowButtonLabel,
            {
              color: primary ? "#FBF8F2" : "#393128",
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
