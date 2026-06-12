import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import type { UserData } from "@/types";
import type { ExportedUserData } from "@/types/user";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  verifyBeforeUpdateEmail,
  updatePassword,
} from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { v4 as uuidv4 } from "uuid";
import { get, post } from "@/services/core/apiClient";
import { logError } from "@/services/core/errorLogger";
import { parseUserData } from "./profile.dto";
import { createServiceError } from "@/services/contracts/serviceError";
import { claimUsername } from "@/services/user/usernameService";
import { resetUserRuntime } from "@/services/session/resetUserRuntime";
import { normalizeLanguageCode } from "@/hooks/useUserProfile";
import {
  fetchUserProfileRemote,
  initializeUserOnboardingRemote,
  mergeUserProfileRemote,
  uploadUserAvatarRemote,
} from "@/services/user/userProfileRepository";

function requireCurrentUser(
  user: FirebaseAuthTypes.User | null
): FirebaseAuthTypes.User {
  if (!user) {
    throw createServiceError({
      code: "auth/not-logged-in",
      source: "UserProfileService",
      retryable: false,
    });
  }
  return user;
}

function normalizeInitialLanguage(language: string | null | undefined): "en" | "pl" {
  const normalized = String(language || "")
    .trim()
    .toLowerCase();
  if (normalized === "pl" || normalized.startsWith("pl-")) return "pl";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return "en";
}

function newProfileMutationId(kind: string, uid?: string | null): string {
  return `profile-direct:${kind}:${uid || "unknown"}:${uuidv4()}`;
}

async function resetAccountDeleteRuntime(
  uid: string,
  primaryError?: unknown,
): Promise<void> {
  try {
    await resetUserRuntime(uid, { reason: "delete_account" });
  } catch (resetError) {
    logError(
      "deleteAccount: failed runtime reset after account delete",
      { uid, preservingPrimaryError: Boolean(primaryError) },
      resetError,
    );
    if (!primaryError) {
      throw resetError;
    }
  }
}

export async function getUserLocal(): Promise<UserData | null> {
  const data = await fetchUserProfileRemote();
  return data ? parseUserData(data) : null;
}

export async function upsertUserLocal(data: UserData): Promise<void> {
  await mergeUserProfileRemote(data, {
    clientMutationId: newProfileMutationId("upsert", data.uid),
  });
}

export async function fetchUserFromCloud(): Promise<UserData | null> {
  const data = await fetchUserProfileRemote();
  return data ? parseUserData(data) : null;
}

export async function updateUserLanguageInFirestore(language: string) {
  const current = await fetchUserProfileRemote();
  if (!current?.profile) return;
  await mergeUserProfileRemote(
    {
      profile: {
        ...current.profile,
        language: normalizeLanguageCode(language),
      },
    },
    {
      clientMutationId: newProfileMutationId("language", current.uid),
    },
  );
}

export async function uploadAndSaveAvatar({
  uid,
  localUri,
}: {
  uid: string;
  localUri: string;
}) {
  const response = await uploadUserAvatarRemote(localUri, {
    clientMutationId: newProfileMutationId("avatar", uid),
  });
  return {
    avatarUrl: response.avatarUrl,
    avatarLocalPath: localUri,
    avatarlastSyncedAt: response.avatarlastSyncedAt,
    avatarRef: response.avatarRef,
  };
}

export async function changeUsernameService({
  uid,
  newUsername,
  password,
}: {
  uid: string;
  newUsername: string;
  password: string;
}) {
  const auth = getAuth(getApp());
  const current = requireCurrentUser(auth.currentUser);
  const cred = EmailAuthProvider.credential(current.email!, password);
  await reauthenticateWithCredential(current, cred);
  await claimUsername(newUsername, uid);
}

export async function changeEmailService({
  newEmail,
  password,
}: {
  newEmail: string;
  password: string;
}) {
  const auth = getAuth(getApp());
  const current = requireCurrentUser(auth.currentUser);
  const cred = EmailAuthProvider.credential(current.email!, password);
  await reauthenticateWithCredential(current, cred);
  await verifyBeforeUpdateEmail(current, newEmail.trim());
  await post("/users/me/email-pending", {
    email: newEmail.trim(),
  });
}

export async function changePasswordService({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}) {
  const auth = getAuth(getApp());
  const current = requireCurrentUser(auth.currentUser);
  const cred = EmailAuthProvider.credential(current.email!, currentPassword);
  await reauthenticateWithCredential(current, cred);
  await updatePassword(current, newPassword);
}

export async function exportUserData() {
  return get<ExportedUserData>("/users/me/export");
}

export async function deleteAccountService({
  uid,
  password,
}: {
  uid: string;
  password: string;
}) {
  const auth = getAuth(getApp());
  const current = requireCurrentUser(auth.currentUser);

  const cred = EmailAuthProvider.credential(current.email!, password);
  await reauthenticateWithCredential(current, cred);
  await post("/users/me/delete");

  let deleteError: unknown = null;
  try {
    await current.delete();
  } catch (error) {
    deleteError = error;
    try {
      await signOut(auth);
    } catch (signOutError) {
      logError(
        "deleteAccount: failed signOut after Firebase Auth delete failure",
        { uid },
        signOutError,
      );
    }
  }

  await resetAccountDeleteRuntime(uid, deleteError);

  if (deleteError) {
    throw deleteError;
  }
}

export async function initializeUserOnboardingProfile(
  username: string,
  initialLanguage?: string | null,
) {
  const normalizedLanguage = normalizeInitialLanguage(initialLanguage);
  const response = await initializeUserOnboardingRemote({
    username: username.trim(),
    language: normalizedLanguage,
  });
  return response;
}
