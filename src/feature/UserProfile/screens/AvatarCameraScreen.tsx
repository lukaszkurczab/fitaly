import { useRef, useState, useMemo } from "react";
import { View, StyleSheet, Pressable, Text, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { Layout, PhotoPreview, ScreenCornerNavButton } from "@/components";
import AppIcon from "@/components/AppIcon";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logError, logWarning } from "@/services/core/errorLogger";

const SHUTTER = 72;
const SWITCH = 50;
const GAP = 24;

type AvatarCameraScreenProps = {
  onPhotoTaken?: (uri: string) => void;
} & StackScreenProps<RootStackParamList, "AvatarCamera">;

export default function AvatarCameraScreen({
  onPhotoTaken,
  route,
  navigation,
}: AvatarCameraScreenProps) {
  const { t } = useTranslation(["common", "profile"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { setAvatar } = useUserProfileContext();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const returnDepth = route.params?.returnDepth ?? 0;
  const topLeftActionStyle = useMemo(
    () => ({
      top: insets.top + theme.spacing.xs,
      left: insets.left + theme.spacing.sm,
    }),
    [insets.left, insets.top, theme.spacing.sm, theme.spacing.xs],
  );

  const handleTakePicture = async () => {
    if (isTakingPhoto || !isCameraReady || !cameraRef.current) return;
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        onPhotoTaken?.(photo.uri);
      }
    } catch (err) {
      logError("take picture failed", null, err);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  if (!permission) {
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.backgroundFill} />
      </Layout>
    );
  }

  if (!permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <Layout showNavigation={false} disableScroll style={styles.layout}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>
            {t("common:camera_permission_title", {
              defaultValue: "Camera requires permission",
            })}
          </Text>

          <Text style={styles.permissionText}>
            {blocked
              ? t("profile:camera_permission_blocked_message", {
                  defaultValue:
                    "Camera access is currently disabled. You can enable it in system Settings.",
                })
              : t("common:camera_permission_message", {
                  defaultValue:
                    "Fitaly uses the camera to scan meals and barcodes and to take profile photos.",
                })}
          </Text>

          <Pressable
            onPress={blocked ? () => Linking.openSettings() : requestPermission}
            style={styles.permissionButton}
            accessibilityRole="button"
            accessibilityLabel={t("common:continue", { defaultValue: "Continue" })}
          >
            <Text style={styles.permissionButtonText}>
              {t("common:continue", { defaultValue: "Continue" })}
            </Text>
          </Pressable>
        </View>
      </Layout>
    );
  }

  if (photoUri) {
    return (
      <PhotoPreview
        photoUri={photoUri}
        onRetake={() => {
          if (!isUploading) setPhotoUri(null);
        }}
        onAccept={async () => {
          setIsUploading(true);
          try {
            await setAvatar(photoUri);
            if (returnDepth > 0 && navigation.canGoBack()) {
              navigation.pop(returnDepth);
            } else if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("Profile");
            }
          } catch (err) {
            logWarning("avatar camera error", null, err);
          } finally {
            setIsUploading(false);
          }
        }}
        isLoading={isUploading}
        primaryText={t("profile:avatarPreview_title")}
        secondaryText={t("profile:avatarPreview_subtitle")}
      />
    );
  }

  return (
    <Layout showNavigation={false} disableScroll style={styles.layout}>
      <View style={styles.backgroundFill}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraFill}
          facing={facing}
          onCameraReady={() => setIsCameraReady(true)}
        />
        <View style={StyleSheet.absoluteFill}>
          <ScreenCornerNavButton
            icon="close"
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate("Profile")
            }
            accessibilityLabel={t("common:close", { defaultValue: "Close" })}
            containerStyle={topLeftActionStyle}
          />
          <View style={styles.controlsWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.shutterButton,
                pressed && styles.shutterButtonPressed,
              ]}
              onPress={handleTakePicture}
              disabled={isTakingPhoto}
              accessibilityRole="button"
              accessibilityLabel={t("common:camera_take_photo", {
                defaultValue: "Take photo",
              })}
            />
            <Pressable
              style={({ pressed }) => [
                styles.switchButton,
                pressed && styles.switchButtonPressed,
              ]}
              onPress={() =>
                setFacing((f) => (f === "back" ? "front" : "back"))
              }
              accessibilityRole="button"
              accessibilityLabel={t("common:switch_camera") || "Switch camera"}
            >
              <AppIcon name="flip-camera" size={26} color={theme.cta.primaryText} />
            </Pressable>
          </View>
        </View>
      </View>
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
    backgroundFill: { flex: 1, backgroundColor: theme.background },
    cameraFill: { flex: 1 },
    permissionContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
    },
    permissionTitle: {
      fontSize: theme.typography.size.title,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.text,
    },
    permissionText: {
      fontSize: theme.typography.size.bodyL,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
      opacity: 0.9,
      color: theme.text,
    },
    permissionButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.surfaceElevated,
    },
    permissionButtonText: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyL,
      color: theme.text,
    },
    controlsWrapper: {
      position: "absolute",
      bottom: theme.spacing.xl,
      left: 0,
      right: 0,
      height: SHUTTER,
      justifyContent: "center",
    },
    shutterButton: {
      position: "absolute",
      width: SHUTTER,
      height: SHUTTER,
      borderRadius: SHUTTER / 2,
      borderWidth: 4,
      borderColor: theme.cta.primaryText,
      backgroundColor: "transparent",
      left: "50%",
      transform: [{ translateX: -SHUTTER / 2 }],
    },
    shutterButtonPressed: { opacity: 0.7 },
    switchButton: {
      position: "absolute",
      width: SWITCH,
      height: SWITCH,
      borderRadius: SWITCH / 2,
      borderWidth: 2,
      borderColor: theme.cta.primaryText,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      left: "50%",
      transform: [{ translateX: SHUTTER / 2 + GAP }],
    },
    switchButtonPressed: { opacity: 0.7 },
  });
