import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  StatusBar,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTheme } from "@/theme/useTheme";
import {
  BottomTabBar,
  BOTTOM_TAB_BAR_BASE_HEIGHT,
  BOTTOM_TAB_BAR_BOTTOM_OFFSET,
} from "@/components/BottomTabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useE2ENetInfo } from "@/services/e2e/connectivity";
import { isOfflineNetState } from "@/services/core/networkState";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";

type LayoutProps = {
  children: ReactNode;
  showNavigation?: boolean;
  disableScroll?: boolean;
  style?: StyleProp<ViewStyle>;
  showOfflineBanner?: boolean;
  keyboardAvoiding?: boolean;
  backgroundGradient?: BackgroundGradientLayer | BackgroundGradientLayer[];
};

export type BackgroundGradientLayer = {
  colors: [string, string, ...string[]];
  locations?: number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

function buildDefaultMaterialBackground(
  theme: ReturnType<typeof useTheme>,
): BackgroundGradientLayer[] {
  return theme.isDark
    ? [
        {
          colors: [theme.background, "#181D18", theme.backgroundSecondary],
          locations: [0, 0.52, 1],
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        },
        {
          colors: [
            "rgba(127, 160, 122, 0.10)",
            "rgba(127, 160, 122, 0.00)",
            "rgba(199, 126, 97, 0.045)",
          ],
          locations: [0, 0.56, 1],
          start: { x: 1, y: 0 },
          end: { x: 0, y: 1 },
        },
      ]
    : [
        {
          colors: ["#F8F0E4", theme.background, theme.surfaceAlt],
          locations: [0, 0.56, 1],
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        },
        {
          colors: [
            "rgba(255, 253, 248, 0.56)",
            "rgba(255, 253, 248, 0.08)",
            "rgba(111, 138, 105, 0.075)",
          ],
          locations: [0, 0.6, 1],
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        },
      ];
}

export const Layout = ({
  children,
  showNavigation = true,
  disableScroll = false,
  style,
  showOfflineBanner = showNavigation,
  keyboardAvoiding = true,
  backgroundGradient,
}: LayoutProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const netInfo = useE2ENetInfo();

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [offlineDismissed, setOfflineDismissed] = useState(false);

  useEffect(() => {
    const showEventName =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEventName =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEventName, () =>
      setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEventName, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const shouldShowTabBar = showNavigation && !isKeyboardVisible;
  const bottomPadding = shouldShowTabBar
    ? BOTTOM_TAB_BAR_BASE_HEIGHT + BOTTOM_TAB_BAR_BOTTOM_OFFSET
    : isKeyboardVisible
      ? 0
      : insets.bottom + 8;
  const surfaceBottomPadding = disableScroll ? bottomPadding : 0;
  const scrollContentBottomPadding = disableScroll ? 0 : bottomPadding;
  const isOffline = isOfflineNetState(netInfo);
  const shouldShowOffline = showOfflineBanner && isOffline && !offlineDismissed;

  useEffect(() => {
    if (!isOffline) {
      setOfflineDismissed(false);
    }
  }, [isOffline]);

  const defaultMaterialBackground = useMemo(
    () => buildDefaultMaterialBackground(theme),
    [theme],
  );
  const resolvedBackgroundGradient =
    backgroundGradient === undefined
      ? defaultMaterialBackground
      : backgroundGradient;
  const backgroundGradientLayers = Array.isArray(resolvedBackgroundGradient)
    ? resolvedBackgroundGradient
    : resolvedBackgroundGradient
      ? [resolvedBackgroundGradient]
      : [];
  const rootBackgroundColor =
    backgroundGradientLayers[0]?.colors[0] ?? theme.background;

  const content = (
    <View style={[styles.root, { backgroundColor: rootBackgroundColor }]}>
      {backgroundGradientLayers.map((layer, index) => (
        <LinearGradient
          key={`background-gradient-${index}`}
          pointerEvents="none"
          colors={layer.colors}
          locations={layer.locations}
          start={layer.start ?? { x: 0, y: 0 }}
          end={layer.end ?? { x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ))}
      <View
        style={[
          styles.surface,
          {
            backgroundColor: backgroundGradientLayers.length
              ? "transparent"
              : theme.background,
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: surfaceBottomPadding,
            paddingLeft: insets.left + theme.spacing.screenPadding,
            paddingRight: insets.right + theme.spacing.screenPadding,
          },
          style,
        ]}
      >
        <StatusBar
          barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
          backgroundColor={rootBackgroundColor}
        />

        {shouldShowOffline && (
          <View
            pointerEvents="box-none"
            style={[
              styles.offlineBannerWrap,
              {
                top: theme.spacing.hero,
                left: theme.spacing.md,
                right: theme.spacing.md,
              },
            ]}
          >
            <OfflineBanner
              compact
              dismissible
              onDismiss={() => setOfflineDismissed(true)}
              style={styles.offlineBanner}
            />
          </View>
        )}

        {disableScroll ? (
          <View style={styles.content}>{children}</View>
        ) : (
          <KeyboardAwareScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollContentBottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </KeyboardAwareScrollView>
        )}
      </View>
      {shouldShowTabBar && <BottomTabBar />}
    </View>
  );

  if (!keyboardAvoiding) {
    return content;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "height" : undefined}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  surface: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  offlineBannerWrap: {
    position: "absolute",
    zIndex: 20,
    elevation: 4,
  },
  offlineBanner: { margin: 0 },
});
