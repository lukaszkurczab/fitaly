import React, { useMemo } from "react";
import { View, ViewStyle, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  step: number;
  total: number;
  label?: string;
  style?: ViewStyle;
};

const DOT_SIZE = 8;
const DOT_SPACING = 8;

const ProgressDots: React.FC<Props> = ({ step, total, label, style }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const getDotStyle = (index: number) => ({
    backgroundColor:
      index + 1 <= step ? theme.primary : theme.textSecondary,
    opacity: index + 1 === step ? 1 : 0.6,
  });

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.dot, getDotStyle(i)]} />
        ))}
      </View>
    </View>
  );
};

export default ProgressDots;

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      gap: theme.spacing.sm,
    },
    label: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },
    row: {
      flexDirection: "row",
      gap: DOT_SPACING,
    },
    dot: {
      flexGrow: 1,
      height: DOT_SIZE,
      borderRadius: theme.rounded.full,
    },
  });
