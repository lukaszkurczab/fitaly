import React, { useMemo } from "react";
import type { UserProfileContextType } from "./UserProfileContext";
import { UserProfileProvider, useUserProfileContext } from "./UserProfileContext";
import type { UserAccountContextType } from "./UserAccountContext";
import { UserAccountProvider, useUserAccountContext } from "./UserAccountContext";
import type { AppSettingsContextType } from "./AppSettingsContext";
import { AppSettingsProvider, useAppSettingsContext } from "./AppSettingsContext";

export type UserContextType = UserProfileContextType &
  UserAccountContextType &
  AppSettingsContextType;

export const UserProvider = ({ children }: { children: React.ReactNode }) => (
  <UserProfileProvider>
    <UserAccountProvider>
      <AppSettingsProvider>{children}</AppSettingsProvider>
    </UserAccountProvider>
  </UserProfileProvider>
);

// Convenience compatibility API for legacy aggregate consumers.
// New core surfaces should prefer granular hooks to avoid fan-out rerenders:
// `useUserProfileContext`, `useUserAccountContext`, `useAppSettingsContext`.
export const useUserContext = (): UserContextType => {
  const userProfileContext = useUserProfileContext();
  const userAccountContext = useUserAccountContext();
  const appSettingsContext = useAppSettingsContext();

  return useMemo(
    () => ({
      ...userProfileContext,
      ...userAccountContext,
      ...appSettingsContext,
    }),
    [userProfileContext, userAccountContext, appSettingsContext]
  );
};
