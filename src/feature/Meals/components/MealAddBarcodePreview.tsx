import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type MealAddBarcodePreviewProps = {
  children?: ReactNode;
  label: string;
  detectedCode?: string | null;
};

export function MealAddBarcodePreview({
  children,
  label,
  detectedCode,
}: MealAddBarcodePreviewProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.root}>
      {children}

      <View pointerEvents="none" style={styles.overlay}>
        <View testID="barcode-preview-status-badge" style={styles.badge}>
          <View
            style={[
              styles.badgeContent,
              detectedCode ? styles.badgeContentDetected : null,
            ]}
          >
            {detectedCode ? (
              <>
                <Text style={styles.badgeLabelDetected}>{label}</Text>
                <Text
                  testID="barcode-preview-detected-code"
                  style={styles.badgeValue}
                >
                  {detectedCode}
                </Text>
              </>
            ) : (
              <Text style={styles.badgeLabelReady}>{label}</Text>
            )}
          </View>
        </View>

        <View style={styles.frame}>
          <View
            style={[
              styles.barcodeGuide,
              detectedCode ? styles.barcodeGuideDetected : null,
            ]}
          >
            {[8, 18, 10, 24, 14, 28, 10, 20, 16, 26, 8, 18].map(
              (height, index) => (
                <View
                  key={`${height}-${index}`}
                  style={[styles.barcodeGuideBar, { height }]}
                />
              ),
            )}
          </View>
          <View style={[styles.cornerH, styles.cornerTopLeftH]} />
          <View style={[styles.cornerV, styles.cornerTopLeftV]} />
          <View style={[styles.cornerH, styles.cornerTopRightH]} />
          <View style={[styles.cornerV, styles.cornerTopRightV]} />
          <View style={[styles.cornerH, styles.cornerBottomLeftH]} />
          <View style={[styles.cornerV, styles.cornerBottomLeftV]} />
          <View style={[styles.cornerH, styles.cornerBottomRightH]} />
          <View style={[styles.cornerV, styles.cornerBottomRightV]} />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: "#171A16",
      borderRadius: theme.rounded.xxl,
    },
    bandTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 126,
      backgroundColor: "rgba(42, 45, 40, 0.28)",
    },
    bandMiddle: {
      position: "absolute",
      top: 126,
      left: 0,
      right: 0,
      height: 112,
      backgroundColor: "rgba(15, 18, 14, 0.16)",
    },
    bandBottom: {
      position: "absolute",
      top: 238,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(30, 34, 28, 0.22)",
    },
    halo: {
      position: "absolute",
      top: 38,
      left: -26,
      width: 425,
      height: 425,
      borderRadius: 220,
      backgroundColor: "rgba(0, 0, 0, 0.12)",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 38,
      width: 253,
      minHeight: 40,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: "#283029",
      borderWidth: 1,
      borderColor: "rgba(111, 138, 105, 0.22)",
    },
    badgeContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      width: "100%",
    },
    badgeContentDetected: {
      justifyContent: "space-between",
    },
    badgeLabelReady: {
      color: "#FFF7EB",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.medium,
      textAlign: "center",
    },
    badgeLabelDetected: {
      color: "#A9BEA1",
      fontSize: 12,
      lineHeight: 16,
      fontFamily: theme.typography.fontFamily.medium,
      flexShrink: 0,
    },
    badgeValue: {
      color: "#FFF7EB",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontVariant: ["tabular-nums"],
      letterSpacing: 0,
      flexShrink: 1,
      textAlign: "right",
    },
    frame: {
      marginTop: 64,
      width: 286,
      height: 132,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: "rgba(165, 185, 157, 0.72)",
      alignItems: "center",
      justifyContent: "center",
    },
    barcodeGuide: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      opacity: 0.58,
    },
    barcodeGuideDetected: {
      opacity: 0.32,
    },
    barcodeGuideBar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: "#FFF7EB",
    },
    bars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    bar: {
      borderRadius: 1,
      backgroundColor: "#FFF7EB",
    },
    cornerH: {
      position: "absolute",
      width: 22,
      height: 4,
      borderRadius: 2,
      backgroundColor: "#A5B99D",
    },
    cornerV: {
      position: "absolute",
      width: 4,
      height: 22,
      borderRadius: 2,
      backgroundColor: "#A5B99D",
    },
    cornerTopLeftH: {
      top: -1.5,
      left: -1.5,
    },
    cornerTopLeftV: {
      top: -1.5,
      left: -1.5,
    },
    cornerTopRightH: {
      top: -1.5,
      right: -1.5,
    },
    cornerTopRightV: {
      top: -1.5,
      right: -1.5,
    },
    cornerBottomLeftH: {
      bottom: -1.5,
      left: -1.5,
    },
    cornerBottomLeftV: {
      bottom: -1.5,
      left: -1.5,
    },
    cornerBottomRightH: {
      bottom: -1.5,
      right: -1.5,
    },
    cornerBottomRightV: {
      bottom: -1.5,
      right: -1.5,
    },
  });
