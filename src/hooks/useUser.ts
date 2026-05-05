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
    retryingProfileSync,
    language,
    getUserProfile,
    fetchUserFromCloud,
    updateUserProfile,
    applyServerProfile,
    syncUserProfile,
    retryProfileSync,
    mirrorProfileLocally,
    refreshProfileSyncState,
    pushPendingChanges,
    setUserData,
    setLanguage,
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
        setLanguage(nextLanguage);
        await i18n.changeLanguage(nextLanguage);
        return;
      }
      return updateUserProfile({ language: normalizeLanguageCode(newLang) });
    },
  });

  return useMemo(
    () => ({
      userData,
      loading,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      retryingProfileSync,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
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
      retryingProfileSync,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
      avatar,
      account,
      exportAndPrefs,
      language,
    ]
  );
}
