import React, { useMemo } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { IconButton } from "@/components/IconButton";
import AppIcon from "@/components/AppIcon";
import { GlobalActionButtons } from "@/components/GlobalActionButtons";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { useTranslation } from "react-i18next";

const WINDOW_HEIGHT = Dimensions.get("window").height;
const MODAL_MAX_WIDTH = 500;

export type ModalActionTone = "primary" | "secondary" | "ghost" | "destructive";

export type ModalAction = {
  label: string;
  onPress?: () => void;
  tone?: ModalActionTone;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

export type ModalProps = {
  visible: boolean;
  testID?: string;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  onClose?: () => void;
  fullScreen?: boolean;
  footer?: React.ReactNode;
  stackActions?: boolean;
  contentPaddingBottom?: number;
  closeOnBackdropPress?: boolean;
};

export const Modal: React.FC<ModalProps> = ({
  visible,
  testID,
  title,
  message,
  children,
  primaryAction,
  secondaryAction,
  onClose,
  fullScreen = false,
  footer,
  stackActions = false,
  contentPaddingBottom,
  closeOnBackdropPress = true,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("common");

  const contentBottomPadding = contentPaddingBottom ?? 0;

  const handleBackdropPress = () => {
    if (!closeOnBackdropPress) return;
    onClose?.();
  };

  const actionsSideBySide =
    !fullScreen && !stackActions && !!primaryAction && !!secondaryAction;
  const hasBodyContent = !!message || !!children;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={fullScreen ? "slide" : "fade"}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoiding}
      >
        <View
          style={[
            styles.centeredView,
            fullScreen && styles.centeredViewFullscreen,
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.overlay} onPress={handleBackdropPress} />

          <View
            style={[
              styles.dialogFrame,
              fullScreen ? styles.dialogFrameFullScreen : null,
            ]}
            pointerEvents="box-none"
          >
            <View
              testID={testID}
              style={[
                styles.modalContainer,
                {
                  borderColor: theme.borderSoft,
                  maxHeight: fullScreen
                    ? WINDOW_HEIGHT * 0.96
                    : WINDOW_HEIGHT * 0.8,
                },
                fullScreen && styles.modalContainerFullScreen,
              ]}
            >
              {onClose ? (
                <View style={styles.closeButton}>
                  <IconButton
                    icon={
                      <AppIcon
                        name="close"
                        size={18}
                        color={theme.textSecondary}
                      />
                    }
                    onPress={onClose}
                    size={32}
                    iconColor={theme.textSecondary}
                    accessibilityLabel={t("close")}
                  />
                </View>
              ) : null}

              {title ? <Text style={styles.title}>{title}</Text> : null}

              {hasBodyContent ? (
                <KeyboardAwareScrollView
                  style={[
                    styles.scrollView,
                    title ? styles.scrollViewWithTitle : null,
                  ]}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: contentBottomPadding },
                  ]}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.contentStack}>
                    {message ? <Text style={styles.message}>{message}</Text> : null}
                    {children}
                  </View>
                </KeyboardAwareScrollView>
              ) : null}

              {footer ? (
                <View style={styles.footer}>{footer}</View>
              ) : primaryAction || secondaryAction ? (
                actionsSideBySide ? (
                  <GlobalActionButtons
                    label={primaryAction?.label ?? ""}
                    onPress={primaryAction?.onPress}
                    loading={primaryAction?.loading}
                    disabled={primaryAction?.disabled}
                    testID={primaryAction?.testID}
                    tone={primaryAction?.tone ?? "primary"}
                    secondaryLabel={secondaryAction?.label}
                    secondaryOnPress={secondaryAction?.onPress}
                    secondaryLoading={secondaryAction?.loading}
                    secondaryDisabled={secondaryAction?.disabled}
                    secondaryTestID={secondaryAction?.testID}
                    secondaryTone={secondaryAction?.tone ?? "secondary"}
                    layout="row"
                    rowOrder="secondary-primary"
                    containerStyle={styles.actionsRow}
                  />
                ) : (
                  <GlobalActionButtons
                    label={primaryAction?.label ?? ""}
                    onPress={primaryAction?.onPress}
                    loading={primaryAction?.loading}
                    disabled={primaryAction?.disabled}
                    testID={primaryAction?.testID}
                    tone={primaryAction?.tone ?? "primary"}
                    secondaryLabel={secondaryAction?.label}
                    secondaryOnPress={secondaryAction?.onPress}
                    secondaryLoading={secondaryAction?.loading}
                    secondaryDisabled={secondaryAction?.disabled}
                    secondaryTestID={secondaryAction?.testID}
                    secondaryTone={secondaryAction?.tone ?? "secondary"}
                    containerStyle={styles.actionsColumn}
                  />
                )
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.48)"
        : "rgba(47, 49, 43, 0.42)",
      zIndex: 0,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    centeredView: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    centeredViewFullscreen: {
      minHeight: WINDOW_HEIGHT,
      justifyContent: "flex-start",
    },
    dialogFrame: {
      width: "100%",
      paddingHorizontal: theme.spacing.screenPadding,
      alignItems: "center",
    },
    dialogFrameFullScreen: {
      flex: 1,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.nav,
    },
    modalContainer: {
      width: "100%",
      minWidth: 260,
      maxWidth: MODAL_MAX_WIDTH,
      position: "relative",
      borderWidth: 1,
      borderRadius: theme.rounded.xl,
      backgroundColor: theme.surfaceElevated,
      padding: theme.spacing.xl,
      ...theme.depth.modal,
    },
    modalContainerFullScreen: {
      flex: 1,
    },
    closeButton: {
      position: "absolute",
      right: theme.spacing.md,
      top: theme.spacing.md,
      zIndex: 10,
    },
    title: {
      color: theme.text,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "left",
      paddingRight: theme.spacing.xxl,
    },
    scrollView: {
      flexGrow: 0,
      width: "100%",
    },
    scrollViewWithTitle: {
      marginTop: theme.spacing.sm,
    },
    scrollContent: {
      width: "100%",
    },
    contentStack: {
      gap: theme.spacing.sm,
    },
    message: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyL,
      lineHeight: theme.typography.lineHeight.bodyL,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "left",
    },
    footer: {
      marginTop: theme.spacing.lg,
    },
    actionsRow: {
      marginTop: theme.spacing.lg,
    },
    actionsColumn: {
      marginTop: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
  });
