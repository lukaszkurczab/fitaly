import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { FormScreenShell, SettingsRow, SettingsSection } from "@/components";
import AppIcon from "@/components/AppIcon";
import AvatarBadge from "@/components/AvatarBadge";
import { useUserProfileContext } from "@/context/UserProfileContext";

type EditUserDataNavigation = StackNavigationProp<
  RootStackParamList,
  "EditUserData"
>;

type EditUserDataScreenProps = {
  navigation: EditUserDataNavigation;
};

const PASSWORD_MASK = "••••••••";

export default function EditUserDataScreen({
  navigation,
}: EditUserDataScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const { userData } = useUserProfileContext();

  const avatarSrc = userData?.avatarLocalPath || userData?.avatarUrl || "";

  return (
    <FormScreenShell
      title={t("profileDetailsTitle", { defaultValue: "Profile details" })}
      intro={t("profileDetailsIntro", {
        defaultValue: "Update how your account appears and how you sign in.",
      })}
      onBack={() => navigation.goBack()}
    >
      <SettingsSection
        title={t("profileSectionTitle", { defaultValue: "Profile" })}
      >
        <SettingsRow
          title={t("profilePhotoLabel", { defaultValue: "Profile photo" })}
          testID="profile-details-photo-row"
          leading={
            <AvatarBadge
              size={44}
              uri={avatarSrc || undefined}
              badges={[]}
              fallbackIcon={
                <AppIcon name="person" size={20} color={theme.textSecondary} />
              }
              accessibilityLabel={t("profilePicture")}
            />
          }
          onPress={() => navigation.navigate("ProfilePhotoPreview")}
        />
        <SettingsRow
          title={t("usernameLabel", { defaultValue: "Username" })}
          value={userData?.username ?? ""}
          testID="profile-details-username-row"
          onPress={() => navigation.navigate("UsernameChange")}
        />
      </SettingsSection>

      <SettingsSection
        title={t("securitySectionTitle", { defaultValue: "Security" })}
      >
        <SettingsRow
          title={t("emailLabel", { defaultValue: "Email" })}
          value={userData?.email ?? ""}
          testID="profile-details-email-row"
          onPress={() => navigation.navigate("ChangeEmail")}
        />
        <SettingsRow
          title={t("passwordLabel", { defaultValue: "Password" })}
          value={PASSWORD_MASK}
          testID="profile-details-password-row"
          onPress={() => navigation.navigate("ChangePassword")}
        />
      </SettingsSection>
    </FormScreenShell>
  );
}
