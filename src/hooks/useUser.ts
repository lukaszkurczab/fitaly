import { useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useUserExport } from "@/hooks/useUserExport";
import i18n from "@/i18n";
import { normalizeLanguageCode } from "@/hooks/useUserProfile";

export function useUser(uid: string) {
  const {
    userData,
    loading,
    profileBootstrapState,
    profileBootstrapError,
    syncState,
    hasAvatarUploadDeadLetter,
    retryingProfileSync,
    language,
    getUserProfile,
    fetchUserFromCloud,
    updateUserProfile,
    applyServerProfile,
    syncUserProfile,
    retryProfileSync,
    discardAvatarUploadDeadLetter,
    mirrorProfileLocally,
    refreshProfileSyncState,
    pushPendingChanges,
    setUserData,
  } = useUserProfile(uid);

  const avatar = useUserAvatar({
    uid,
    userData,
    setUserData,
    mirrorProfileLocally,
    pushPendingChanges,
    refreshProfileSyncState,
  });

  const account = useUserAccount({
    uid,
    setUserData,
    mirrorProfileLocally,
  });

  const exportAndPrefs = useUserExport({
    uid,
    changeLanguage: async (newLang: string) => {
      if (!uid) {
        const nextLanguage = normalizeLanguageCode(newLang);
        await i18n.changeLanguage(nextLanguage);
        return;
      }
      if (!userData?.profile) return;
      return updateUserProfile({
        profile: {
          ...userData.profile,
          language: normalizeLanguageCode(newLang),
        },
      });
    },
  });

  return useMemo(
    () => ({
      userData,
      loading,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      hasAvatarUploadDeadLetter,
      retryingProfileSync,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
      discardAvatarUploadDeadLetter,
      ...avatar,
      ...account,
      ...exportAndPrefs,
      language,
    }),
    [
      userData,
      loading,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      hasAvatarUploadDeadLetter,
      retryingProfileSync,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
      discardAvatarUploadDeadLetter,
      avatar,
      account,
      exportAndPrefs,
      language,
    ]
  );
}
