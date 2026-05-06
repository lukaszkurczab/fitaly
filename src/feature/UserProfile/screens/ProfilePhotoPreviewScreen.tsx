import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { FormScreenShell, SettingsRow, SettingsSection } from "@/components";
import AppIcon from "@/components/AppIcon";
import AvatarBadge from "@/components/AvatarBadge";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { AccountIdentityCard } from "@/feature/UserProfile/components/AccountIdentityCard";

type ProfilePhotoPreviewNavigation = StackNavigationProp<
  RootStackParamList,
  "ProfilePhotoPreview"
>;

type ProfilePhotoPreviewScreenProps = {
  navigation: ProfilePhotoPreviewNavigation;
};

export default function ProfilePhotoPreviewScreen({
  navigation,
}: ProfilePhotoPreviewScreenProps) {
  const { t } = useTranslation(["profile", "common"]);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { userData, setAvatar } = useUserProfileContext();
  const [isUploading, setIsUploading] = useState(false);

  const avatarSrc = userData?.avatarLocalPath || userData?.avatarUrl || "";

  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    setIsUploading(true);

    try {
      await setAvatar(result.assets[0].uri);
      navigation.goBack();
    } catch {
      // Keep the existing avatar if upload fails.
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <FormScreenShell
        title={t("photoSourceTitle")}
        intro={t("profilePhotoScreenIntro", {
          defaultValue:
            "Choose how you want to update the photo shown on your account.",
        })}
        onBack={() => navigation.goBack()}
      >
        <View style={styles.content}>
          <AccountIdentityCard
            avatar={
              <AvatarBadge
                size={88}
                uri={avatarSrc || undefined}
                badges={[]}
                fallbackIcon={
                  <AppIcon
                    name="person"
                    size={40}
                    color={theme.textSecondary}
                  />
                }
                accessibilityLabel={t("profilePicture")}
              />
            }
            title={userData?.username || t("accountTitle")}
            subtitle={userData?.email || t("profilePicture")}
            showChevron={false}
          />

          <SettingsSection
            title={t("profilePhotoSectionTitle", {
              defaultValue: "Photo actions",
            })}
          >
            <SettingsRow
              title={t("makePhoto")}
              onPress={() =>
                navigation.navigate("AvatarCamera", { returnDepth: 2 })
              }
            />
            <SettingsRow
              title={t("addFromGallery")}
              onPress={() => {
                void handlePickFromGallery();
              }}
            />
          </SettingsSection>
        </View>
      </FormScreenShell>

      {isUploading ? (
        <View style={styles.uploadOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
    uploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.overlay,
      zIndex: 40,
    },
  });
