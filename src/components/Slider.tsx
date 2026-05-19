import { useEffect, useMemo, useState } from "react";
import { View, Pressable, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/theme/useTheme";

type SliderProps = {
  value: number;
  onValueChange: (val: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  disabled?: boolean;
  testID?: string;
};

const THUMB_SIZE = 24;
const THUMB_RADIUS = THUMB_SIZE / 2;
const TRACK_HEIGHT = 6;

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  disabled = false,
  testID,
}: SliderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [trackWidth, setTrackWidth] = useState(1);
  const trackWidthAnim = useSharedValue(1);
  const thumbX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);

  useEffect(() => {
    if (!trackWidth) return;
    const ratio = (value - minimumValue) / (maximumValue - minimumValue);
    const px = Math.max(0, Math.min(trackWidth, ratio * trackWidth));
    thumbX.value = withTiming(px);
  }, [value, trackWidth, minimumValue, maximumValue, thumbX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - THUMB_RADIUS }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value,
  }));

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      gestureStartX.value = thumbX.value;
    })
    .onUpdate((event) => {
      if (disabled) return;

      let x = gestureStartX.value + event.translationX;
      x = Math.max(0, Math.min(trackWidthAnim.value, x));
      thumbX.value = x;

      let ratio = x / trackWidthAnim.value;
      ratio = Math.max(0, Math.min(1, ratio));

      let val = minimumValue + ratio * (maximumValue - minimumValue);
      val = Math.round(val / step) * step;
      val = Math.max(minimumValue, Math.min(maximumValue, val));

      runOnJS(onValueChange)(val);
    });

  const handleTrackPress = (evt: { nativeEvent: { locationX: number } }) => {
    if (disabled || !trackWidth) return;

    const x = Math.max(0, Math.min(trackWidth, evt.nativeEvent.locationX));

    let ratio = x / trackWidth;
    ratio = Math.max(0, Math.min(1, ratio));

    let val = minimumValue + ratio * (maximumValue - minimumValue);
    val = Math.round(val / step) * step;
    val = Math.max(minimumValue, Math.min(maximumValue, val));

    thumbX.value = withTiming(x);
    onValueChange(val);
  };

  const onTrackLayout = (evt: LayoutChangeEvent) => {
    const w = evt.nativeEvent.layout.width;
    setTrackWidth(w);
    trackWidthAnim.value = w;

    const ratio = (value - minimumValue) / (maximumValue - minimumValue);
    thumbX.value = withTiming(Math.max(0, Math.min(w, ratio * w)));
  };

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        accessibilityRole="button"
        style={[styles.track, disabled && styles.trackDisabled]}
        onPress={handleTrackPress}
        onLayout={onTrackLayout}
        disabled={disabled}
      >
        <Animated.View style={[styles.filled, fillStyle]} />

        <View style={styles.trackOverlay}>
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                styles.thumb,
                thumbStyle,
                disabled && styles.thumbDisabled,
              ]}
              pointerEvents={disabled ? "none" : "auto"}
            />
          </GestureDetector>
        </View>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      width: "100%",
      height: 40,
      justifyContent: "center",
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      overflow: "visible",
      width: "100%",
      justifyContent: "center",
      backgroundColor: theme.borderSoft,
    },
    trackDisabled: {
      opacity: 0.5,
    },
    filled: {
      position: "absolute",
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      left: 0,
      top: 0,
      backgroundColor: theme.primary,
    },
    trackOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "flex-start",
    },
    thumb: {
      position: "absolute",
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_RADIUS,
      top: -(THUMB_RADIUS - TRACK_HEIGHT / 2),
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.surfaceElevated,
      elevation: 2,
      shadowColor: "#000000",
      shadowOpacity: theme.isDark ? 0.22 : 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    thumbDisabled: {
      borderColor: theme.disabled.border,
      backgroundColor: theme.disabled.background,
    },
  });
