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
};

export const Layout = ({
  children,
  showNavigation = true,
  disableScroll = false,
  style,
  showOfflineBanner = showNavigation,
  keyboardAvoiding = true,
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
  const isOffline = isOfflineNetState(netInfo);
  const shouldShowOffline = showOfflineBanner && isOffline && !offlineDismissed;

  useEffect(() => {
    if (!isOffline) {
      setOfflineDismissed(false);
    }
  }, [isOffline]);

  const content = (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.surface,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: bottomPadding,
            paddingLeft: insets.left + theme.spacing.screenPadding,
            paddingRight: insets.right + theme.spacing.screenPadding,
          },
          style,
        ]}
      >
        <StatusBar
          barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
          backgroundColor={theme.background}
        />

        {shouldShowOffline && (
          <View
            pointerEvents="box-none"
            style={[
              styles.offlineBannerWrap,
              {
                bottom: shouldShowTabBar
                  ? bottomPadding + theme.spacing.sm
                  : insets.bottom + theme.spacing.md,
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
            contentContainerStyle={styles.scrollContent}
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
