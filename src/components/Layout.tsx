import { useEffect, useState, type ReactNode } from "react";
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
import type { BackgroundGradientLayer } from "@/theme/themes";
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

export type { BackgroundGradientLayer } from "@/theme/themes";

type LayoutProps = {
  children: ReactNode;
  showNavigation?: boolean;
  disableScroll?: boolean;
  style?: StyleProp<ViewStyle>;
  showOfflineBanner?: boolean;
  keyboardAvoiding?: boolean;
  backgroundGradient?: BackgroundGradientLayer | BackgroundGradientLayer[];
};

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

  const resolvedBackgroundGradient =
    backgroundGradient === undefined
      ? theme.material.backgroundGradient
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
