import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useAuthContext } from "./AuthContext";
import {
  changeEmailService,
  changePasswordService,
  changeUsernameService,
  deleteAccountService,
} from "@/services/user/userService";
import { useUserExport } from "@/hooks/useUserExport";
import { createServiceError } from "@/services/contracts/serviceError";

export type UserAccountContextType = {
  deleteUser: (password?: string) => Promise<void>;
  changeUsername: (newUsername: string, password: string) => Promise<void>;
  changeEmail: (newEmail: string, password: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  exportUserData: () => Promise<void>;
};

const UserAccountContext = createContext<UserAccountContextType>({
  deleteUser: async () => {},
  changeUsername: async () => {},
  changeEmail: async () => {},
  changePassword: async () => {},
  exportUserData: async () => {
    throw createServiceError({
      code: "user/export-unavailable",
      source: "UserAccountContext",
      retryable: false,
      message: "User account context is unavailable.",
    });
  },
});

const noOpChangeLanguage = async (): Promise<void> => {};

export const UserAccountProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { uid: authUid } = useAuthContext();
  const uid = authUid || "";

  const deleteUser = useCallback(async (password?: string) => {
    if (!uid) return;
    await deleteAccountService({ uid, password: password || "" });
  }, [uid]);

  const changeUsername = useCallback(
    async (newUsername: string, password: string) => {
      if (!uid) return;
      await changeUsernameService({ uid, newUsername, password });
    },
    [uid]
  );

  const changeEmail = useCallback(
    async (newEmail: string, password: string) => {
      if (!uid) return;
      await changeEmailService({ newEmail, password });
    },
    [uid]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changePasswordService({ currentPassword, newPassword });
    },
    []
  );
  const { exportUserData } = useUserExport({
    uid,
    changeLanguage: noOpChangeLanguage,
  });

  const value = useMemo<UserAccountContextType>(
    () => ({
      deleteUser,
      changeUsername,
      changeEmail,
      changePassword,
      exportUserData,
    }),
    [deleteUser, changeUsername, changeEmail, changePassword, exportUserData]
  );

  return (
    <UserAccountContext.Provider value={value}>
      {children}
    </UserAccountContext.Provider>
  );
};

export const useUserAccountContext = () => useContext(UserAccountContext);
