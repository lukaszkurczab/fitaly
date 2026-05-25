import { useMemo, useState } from "react";
import {
  Image,
  View,
  StyleSheet,
  Pressable,
  Text,
  Linking,
  PanResponder,
} from "react-native";
import { CameraView } from "expo-camera";
import * as Device from "expo-device";
import { useTranslation } from "react-i18next";
import {
  Button,
  Layout,
  PhotoPreview,
  ScreenCornerNavButton,
} from "@/components";
import { Modal } from "@/components/Modal";
import { AiCreditsBadge } from "@/components/AiCreditsBadge";
import type {
  MealAddScreenProps,
  MealAddSimulatorCreditsState,
} from "@/feature/Meals/feature/MapMealAddScreens";
import { useMealCameraState } from "@/feature/Meals/hooks/useMealCameraState";
import {
  MealAddPhotoScaffold,
  MealAddTextLink,
} from "@/feature/Meals/components/MealAddPhotoScaffold";
import { getE2EFixtureState } from "@/services/e2e/fixtures";
import { useTheme } from "@/theme/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@/components/AppIcon";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SAMPLE_MEAL_PREVIEW = require("../../../../../assets/sampleMeal.jpg");

export default function MealCameraScreen({
  navigation,
  flow,
  params,
}: MealAddScreenProps<"CameraDefault">) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { t: tCommon } = useTranslation("common");
  const { t: tMeals } = useTranslation("meals");
  const { t: tChat } = useTranslation("chat");
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);
  const canStepBack = flow.canGoBack();
  const isSimulatorPreview =
    typeof __DEV__ !== "undefined" && __DEV__ && !Device.isDevice;
  const simulatorCreditsState = params.simulatorCreditsState ?? "ok";
  const e2eAiSeed = getE2EFixtureState()?.ai;
  const e2ePhotoSimulation =
    e2eAiSeed === "photoSuccess" || e2eAiSeed === "photoSlow";

  const previewTopInset = useMemo(
    () =>
      Math.max(
        theme.spacing.xxl,
        Math.round(insets.top * 0.65) + theme.spacing.xs,
      ),
    [insets.top, theme.spacing.xs, theme.spacing.xxl],
  );

  const {
    permission,
    requestPermission,
    cameraRef,
    isTakingPhoto,
    photoUri,
    premiumModal,
    canUsePhotoAi,
    credits,
    skipDetection,
    setIsCameraReady,
    handleTakePicture,
    handleAccept,
    handleRetake,
    closePremiumModal,
    goManagePremium,
  } = useMealCameraState({ navigation, flow, params });

  const handleTopLeftPress = () => {
    if (canStepBack) {
      flow.goBack();
      return;
    }
    navigation.goBack();
  };

  const handleChangeMethod = () => {
    navigation.navigate("MealAddMethod", {
      selectionMode: "temporary",
      origin: "mealAddFlow",
    });
  };

  const photoCost = credits?.costs.photo ?? 5;
  const rawBadgeLabel = tChat(
    photoCost === 1 ? "credits.costSingle" : "credits.costMultiple",
    photoCost === 1 ? undefined : { count: photoCost },
  );
  const badgeText = `✦ ${String(rawBadgeLabel)}`;

  const remainingAfterPhoto = credits ? credits.balance - photoCost : null;
  const actualCreditsState: MealAddSimulatorCreditsState =
    !skipDetection && Boolean(credits) && !canUsePhotoAi
      ? "none"
      : !skipDetection &&
          canUsePhotoAi &&
          remainingAfterPhoto !== null &&
          remainingAfterPhoto <= 2
        ? "low"
        : "ok";
  const useSimulatorCreditPreview =
    isSimulatorPreview && !skipDetection && credits === null;
  const cameraCreditsState = useSimulatorCreditPreview
    ? simulatorCreditsState
    : actualCreditsState;
  const previewRemainingAfterPhoto = useSimulatorCreditPreview
    ? cameraCreditsState === "ok"
      ? 74
      : cameraCreditsState === "low"
        ? 2
        : 0
    : remainingAfterPhoto;
  const showNoCreditsState = !skipDetection && cameraCreditsState === "none";
  const isLowCredits = !skipDetection && cameraCreditsState === "low";
  const canUseFullscreenCamera = !showNoCreditsState;

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          canUseFullscreenCamera &&
          gesture.dy > 10 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderRelease: (_event, gesture) => {
          if (canUseFullscreenCamera && gesture.dy > 44) {
            setIsCameraFullscreen(true);
          }
        },
      }),
    [canUseFullscreenCamera],
  );

  const title = showNoCreditsState
    ? tMeals("camera_no_credits_title", {
        defaultValue: "No credits left for photo",
      })
    : tMeals("camera_default_title", {
        defaultValue: "Take a clear photo",
      });
  const description = showNoCreditsState
    ? tMeals("camera_no_credits_subtitle", {
        defaultValue:
          "You need 1 credit to continue. Choose another path below.",
      })
    : skipDetection
      ? tMeals("camera_replace_subtitle", {
          defaultValue: "Take a new photo to update the current draft.",
        })
      : tMeals("camera_default_subtitle", {
          defaultValue:
            "Center the full meal in the frame. One photo is enough to start.",
        });
  const footerNote = showNoCreditsState
    ? tMeals("camera_no_credits_note", {
        defaultValue: "0 left. Manual, barcode, and saved still work.",
      })
    : skipDetection || previewRemainingAfterPhoto === null
      ? undefined
      : isLowCredits
        ? tMeals("camera_low_credits_note", {
            count: Math.max(previewRemainingAfterPhoto, 0),
            defaultValue: "Only {{count}} credits left after this photo",
          })
        : tMeals("camera_credits_remaining_note", {
            count: Math.max(previewRemainingAfterPhoto, 0),
            defaultValue: "✦ {{count}} credits remaining",
          });

  if (!permission && !e2ePhotoSimulation) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.flexBackground} testID="add-meal-photo-loading-state" />
      </Layout>
    );
  }

  if (!e2ePhotoSimulation && !permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.permissionWrap} testID="add-meal-photo-permission-state">
          <Text style={styles.permissionTitle}>
            {tCommon("camera_permission_title")}
          </Text>
          <Text style={styles.permissionSubtitle}>
            {blocked
              ? tMeals("camera_permission_blocked_message")
              : tCommon("camera_permission_message")}
          </Text>
          <Pressable
            testID="add-meal-photo-permission-button"
            onPress={blocked ? () => Linking.openSettings() : requestPermission}
            style={styles.permissionButton}
            accessibilityRole="button"
            accessibilityLabel={tCommon("continue")}
          >
            <Text style={styles.permissionButtonLabel}>
              {tCommon("continue")}
            </Text>
          </Pressable>
        </View>
      </Layout>
    );
  }

  if (photoUri) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <PhotoPreview
          photoUri={photoUri}
          onRetake={handleRetake}
          onAccept={handleAccept}
          secondaryText={tCommon("camera_retake")}
          primaryText={tCommon("camera_use_photo")}
        />
      </Layout>
    );
  }

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.fill} testID="add-meal-photo-screen">
        <MealAddPhotoScaffold
          topInset={previewTopInset}
          previewFillsAvailable={isCameraFullscreen}
          preview={
            e2ePhotoSimulation ? (
              <Image
                testID="add-meal-photo-e2e-preview"
                source={SAMPLE_MEAL_PREVIEW}
                style={styles.camera}
                resizeMode="cover"
              />
            ) : (
              <CameraView
                testID="add-meal-photo-camera-preview"
                ref={cameraRef}
                style={styles.camera}
                onCameraReady={() => setIsCameraReady(true)}
              />
            )
          }
          previewOverlay={
            isCameraFullscreen ? (
              <View style={styles.fullCameraOverlay} pointerEvents="box-none">
                <View style={styles.fullCameraControls} pointerEvents="box-none">
                  <Pressable
                    testID="add-meal-photo-show-controls-button"
                    accessibilityRole="button"
                    accessibilityLabel={tMeals("camera_show_controls", {
                      defaultValue: "Show photo options",
                    })}
                    onPress={() => setIsCameraFullscreen(false)}
                    style={({ pressed }) => [
                      styles.showControlsButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.showControlsLabel}>
                      {tMeals("camera_show_controls", {
                        defaultValue: "Show options",
                      })}
                    </Text>
                  </Pressable>

                  {!showNoCreditsState ? (
                    <Pressable
                      testID="add-meal-photo-fullscreen-capture-button"
                      accessibilityRole="button"
                      accessibilityLabel={tCommon("camera_take_photo", {
                        defaultValue: "Take photo",
                      })}
                      disabled={isTakingPhoto}
                      onPress={handleTakePicture}
                      style={({ pressed }) => [
                        styles.fullCameraCaptureButton,
                        isTakingPhoto ? styles.fullCameraCaptureButtonDisabled : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <AppIcon
                        name="camera"
                        size={26}
                        color={theme.textInverse}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : undefined
          }
          topAction={
            <ScreenCornerNavButton
              icon={canStepBack ? "back" : "close"}
              onPress={handleTopLeftPress}
              accessibilityLabel={tCommon(canStepBack ? "back" : "close", {
                defaultValue: canStepBack ? "Back" : "Close",
              })}
              containerStyle={styles.screenCornerNavStyle}
            />
          }
          eyebrow={tMeals("camera_default_label", {
            defaultValue: "Photo",
          })}
          title={title}
          description={description}
          accessory={
            !skipDetection ? (
              <AiCreditsBadge text={badgeText} tone="success" />
            ) : undefined
          }
          sheetVisible={!isCameraFullscreen}
          showSheetHandle={canUseFullscreenCamera}
          sheetPanHandlers={
            canUseFullscreenCamera ? sheetPanResponder.panHandlers : undefined
          }
          content={
            <>
              {!showNoCreditsState ? (
                <Button
                  testID="add-meal-photo-capture-button"
                  label={tCommon("camera_take_photo", {
                    defaultValue: "Take photo",
                  })}
                  onPress={handleTakePicture}
                  disabled={isTakingPhoto}
                  style={styles.captureButton}
                />
              ) : null}

              {footerNote ? (
                <Text
                  style={[
                    styles.inlineNote,
                    isLowCredits ? styles.inlineNoteWarning : null,
                  ]}
                >
                  {footerNote}
                </Text>
              ) : null}

              {!skipDetection ? (
                <MealAddTextLink
                  testID="add-meal-photo-change-method-button"
                  label={tMeals("change_method", {
                    defaultValue: "Change add method",
                  })}
                  onPress={handleChangeMethod}
                />
              ) : null}
            </>
          }
        />
      </View>

      <Modal
        testID="add-meal-photo-premium-modal"
        visible={premiumModal}
        title={tChat("limit.reachedTitle")}
        message={tChat("limit.photoRequired", {
          cost: photoCost,
        })}
        onClose={closePremiumModal}
        primaryAction={{
          testID: "add-meal-photo-premium-upgrade-button",
          label: tChat("limit.upgradeCta"),
          onPress: goManagePremium,
        }}
        secondaryAction={{
          testID: "add-meal-photo-premium-cancel-button",
          label: tCommon("cancel"),
          onPress: closePremiumModal,
        }}
      />
    </Layout>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    layout: {
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    fill: {
      flex: 1,
      backgroundColor: theme.background,
    },
    camera: {
      flex: 1,
    },
    fullCameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.08)"
        : "rgba(18, 21, 18, 0.04)",
    },
    fullCameraControls: {
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    showControlsButton: {
      minHeight: 38,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark
        ? "rgba(36, 41, 36, 0.86)"
        : "rgba(255, 253, 248, 0.9)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      ...theme.depth.raised,
    },
    showControlsLabel: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    fullCameraCaptureButton: {
      width: 74,
      height: 74,
      borderRadius: 37,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      borderWidth: 4,
      borderColor: theme.isDark
        ? "rgba(246, 243, 237, 0.28)"
        : "rgba(255, 253, 248, 0.92)",
      ...theme.depth.cta,
    },
    fullCameraCaptureButtonDisabled: {
      opacity: 0.56,
    },
    pressed: {
      opacity: 0.82,
    },
    flexBackground: {
      flex: 1,
      backgroundColor: theme.background,
    },
    permissionWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.background,
    },
    permissionTitle: {
      fontSize: theme.typography.size.bodyM,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
      color: theme.text,
      fontFamily: theme.typography.fontFamily.bold,
    },
    permissionSubtitle: {
      fontSize: theme.typography.size.bodyL,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
      color: theme.text,
      opacity: 0.9,
    },
    permissionButton: {
      paddingVertical: theme.spacing.sm + theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg + theme.spacing.xs,
      borderRadius: theme.rounded.lg,
      backgroundColor: theme.surfaceElevated,
    },
    permissionButtonLabel: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyL,
      color: theme.text,
    },
    captureButton: {
      minHeight: 48,
      borderRadius: theme.rounded.lg,
    },
    inlineNote: {
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: "center",
      marginTop: theme.spacing.xs,
    },
    inlineNoteWarning: {
      color: theme.accentWarm,
    },
    screenCornerNavStyle: {
      top: 0,
    },
  });
