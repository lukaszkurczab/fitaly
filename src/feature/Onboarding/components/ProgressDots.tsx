import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  step: number;
  total: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const SEGMENT_HEIGHT = 5;

const ProgressDots: React.FC<Props> = ({ step, total, label, style }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const safeTotal = Math.max(0, total);
  const clampedStep =
    safeTotal === 0 ? 0 : Math.min(Math.max(step, 1), safeTotal);

  const getSegmentStyle = (index: number) => {
    const position = index + 1;
    if (position === clampedStep) return styles.segmentActive;
    if (position < clampedStep) return styles.segmentComplete;
    return styles.segmentInactive;
  };

  return (
    <View style={[styles.wrap, style]}>
      <View
        accessibilityLabel={label}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: safeTotal > 0 ? 1 : 0,
          max: safeTotal,
          now: clampedStep,
        }}
        testID="onboarding-progress-track"
        style={styles.row}
      >
        {Array.from({ length: safeTotal }).map((_, i) => (
          <View
            key={i}
            testID="onboarding-progress-segment"
            style={[styles.segment, getSegmentStyle(i)]}
          />
        ))}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

export default ProgressDots;

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      gap: theme.spacing.xs,
    },
    label: {
      alignSelf: "flex-end",
      color: theme.isDark
        ? "rgba(255, 253, 248, 0.58)"
        : "rgba(87, 91, 82, 0.78)",
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    segment: {
      flexGrow: 1,
      height: SEGMENT_HEIGHT,
      borderRadius: theme.rounded.full,
    },
    segmentActive: {
      backgroundColor: theme.primary,
      opacity: 0.92,
    },
    segmentComplete: {
      backgroundColor: theme.isDark
        ? "rgba(155, 184, 150, 0.46)"
        : "rgba(111, 138, 105, 0.38)",
    },
    segmentInactive: {
      backgroundColor: theme.isDark
        ? "rgba(255, 253, 248, 0.16)"
        : "rgba(207, 197, 184, 0.44)",
    },
  });
