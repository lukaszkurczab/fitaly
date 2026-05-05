import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useAuthContext } from "./AuthContext";
import { useUser } from "@hooks/useUser";
import type { UserData } from "@/types";
import type { UserProfileBootstrapState } from "@/hooks/useUserProfile";
import { runMigrations } from "@/services/offline/db";
import { startSyncLoop, stopSyncLoop } from "@/services/offline/sync.engine";
import { cleanupTransientOfflineAssets } from "@/services/offline/fileCleanup";
import { emit, on } from "@/services/core/events";
import { shouldRenderProductStack } from "@/navigation/appNavigatorState";

export type UserProfileContextType = {
  userData: UserData | null;
  loadingUser: boolean;
  profileBootstrapState: UserProfileBootstrapState;
  profileBootstrapError: unknown | null;
  syncState: "synced" | "pending" | "conflict";
  retryingProfileSync: boolean;
  refreshUser: () => Promise<UserData | null>;
  getUserData: () => Promise<UserData | null>;
  updateUser: (data: Partial<UserData>) => Promise<void>;
  applyServerProfile: (profile: UserData) => Promise<UserData | null>;
  retryProfileSync: () => Promise<void>;
  syncUserProfile: () => Promise<void>;
  setAvatar: (photoUri: string) => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextType>({
  userData: null,
  loadingUser: true,
  profileBootstrapState: "profileLoading",
  profileBootstrapError: null,
  syncState: "pending",
  retryingProfileSync: false,
  refreshUser: async () => null,
  getUserData: async () => null,
  updateUser: async () => {},
  applyServerProfile: async () => null,
  retryProfileSync: async () => {},
  syncUserProfile: async () => {},
  setAvatar: async () => {},
});

export const UserProfileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { firebaseUser: authUser } = useAuthContext();
  const uid = authUser?.uid || "";

  const {
    userData,
    loading: loadingUser,
    profileBootstrapState,
    profileBootstrapError,
    syncState,
    retryingProfileSync,
    getUserProfile,
    fetchUserFromCloud,
    updateUserProfile,
    applyServerProfile,
    retryProfileSync,
    syncUserProfile,
    setAvatar,
  } = useUser(uid);

  const refreshUser = useCallback(async () => {
    return fetchUserFromCloud();
  }, [fetchUserFromCloud]);
  const canRunUserScopedRuntime = shouldRenderProductStack(
    profileBootstrapState,
    userData?.readiness?.status,
  );

  useEffect(() => {
    try {
      runMigrations();
    } catch {
      // Migration bootstrap is best-effort.
    }
    void cleanupTransientOfflineAssets();
  }, []);

  useEffect(() => {
    if (!uid || !canRunUserScopedRuntime) {
      stopSyncLoop();
      return;
    }

    startSyncLoop(uid);
    return () => {
      stopSyncLoop();
    };
  }, [canRunUserScopedRuntime, uid]);

  useEffect(() => {
    const unsub = on<{ uid?: string; cloudId?: string | null }>(
      "meal:conflict:ambiguous",
      (event) => {
        if (!uid || event?.uid !== uid) return;
        emit("ui:toast", {
          key: "sync_conflict_resolved",
          ns: "common",
        });
      },
    );
    return () => {
      unsub();
    };
  }, [uid]);

  const value = useMemo<UserProfileContextType>(
    () => ({
      userData,
      loadingUser,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      retryingProfileSync,
      refreshUser,
      getUserData: getUserProfile,
      updateUser: updateUserProfile,
      applyServerProfile,
      retryProfileSync,
      syncUserProfile,
      setAvatar,
    }),
    [
      userData,
      loadingUser,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      retryingProfileSync,
      refreshUser,
      getUserProfile,
      updateUserProfile,
      applyServerProfile,
      retryProfileSync,
      syncUserProfile,
      setAvatar,
    ]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfileContext = () => useContext(UserProfileContext);
