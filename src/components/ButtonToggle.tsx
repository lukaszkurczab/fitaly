import React, { useRef, useEffect } from "react";
import { Pressable, Animated, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";

type ButtonToggleProps = {
  value: boolean;
  onToggle: (value: boolean) => void;
  accessibilityLabel?: string;
  trackColor?: string;
  thumbColor?: string;
  borderColor?: string;
  disabled?: boolean;
  testID?: string;
};

export const ButtonToggle: React.FC<ButtonToggleProps> = ({
  value,
  onToggle,
  accessibilityLabel,
  trackColor,
  thumbColor,
  borderColor,
  disabled = false,
  testID,
}) => {
  const theme = useTheme();
  const resolvedActiveTrack = trackColor ?? theme.primary;
  const resolvedInactiveTrack = borderColor ?? theme.border;
  const resolvedDisabledTrack = theme.input.backgroundDisabled;
  const resolvedThumb = thumbColor ?? theme.surfaceElevated;
  const resolvedDisabledThumb = theme.surface;
  const resolvedBorder = value ? resolvedActiveTrack : resolvedInactiveTrack;
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const thumbTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 24],
  });

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (!disabled) onToggle(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.switch,
        {
          backgroundColor: disabled
            ? resolvedDisabledTrack
            : value
              ? resolvedActiveTrack
              : resolvedInactiveTrack,
          borderColor: disabled ? theme.input.borderDisabled : resolvedBorder,
          opacity: pressed && !disabled ? 0.84 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: disabled ? resolvedDisabledThumb : resolvedThumb,
            transform: [{ translateX: thumbTranslate }],
          },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  switch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: "absolute",
    top: 3,
    left: 4,
  },
});
