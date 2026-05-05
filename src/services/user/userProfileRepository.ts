import type { UserData } from "@/types";
import { get, post, upload } from "@/services/core/apiClient";
import { emit, on } from "@/services/core/events";
import { sanitizeUserProfilePatch } from "./profilePatch";

type AvatarUploadResponse = {
  avatarUrl: string;
  avatarlastSyncedAt: string;
};

type UserOnboardingResponse = {
  username: string;
  profile: UserData;
  updated: boolean;
};

type AiHealthDataConsentResponse = {
  profile: UserData | null;
  updated: boolean;
  consent: UserData["readiness"];
};

const profileCache = new Map<string, UserData | null>();
const profileFetchInFlight = new Map<string, Promise<UserData | null>>();

export function getCachedUserProfile(uid: string): UserData | null | undefined {
  return profileCache.get(uid);
}

export function clearCachedUserProfile(uid: string): void {
  profileCache.delete(uid);
}

export function emitUserProfileChanged(uid: string, data: UserData | null) {
  profileCache.set(uid, data);
  emit("user:profile:changed", { uid, data });
}

export function subscribeToUserProfile(params: {
  uid: string;
  onData: (data: UserData | null) => void;
}): () => void {
  const cached = profileCache.get(params.uid);
  if (cached !== undefined) {
    params.onData(cached);
  }

  return on<{ uid?: string; data?: UserData | null }>(
    "user:profile:changed",
    (payload) => {
      if (payload?.uid !== params.uid) return;
      params.onData((payload.data as UserData | null | undefined) ?? null);
    },
  );
}

export async function fetchUserProfileRemote(
  sessionKey?: string,
): Promise<UserData | null> {
  if (sessionKey) {
    const inFlight = profileFetchInFlight.get(sessionKey);
    if (inFlight) return inFlight;
  }

  const request = (async () => {
    const response = await get<{ profile: UserData | null }>("/users/me/profile");
    return response.profile ?? null;
  })();

  if (sessionKey) {
    profileFetchInFlight.set(sessionKey, request);
  }
  try {
    return await request;
  } finally {
    if (sessionKey && profileFetchInFlight.get(sessionKey) === request) {
      profileFetchInFlight.delete(sessionKey);
    }
  }
}

export async function mergeUserProfileRemote(
  payload: Partial<UserData>,
): Promise<void> {
  const patch = sanitizeUserProfilePatch(payload);
  if (Object.keys(patch).length === 0) return;
  await post("/users/me/profile", patch);
}

export async function updateUserProfileRemote(
  payload: Partial<UserData> & { updatedAt?: string },
): Promise<void> {
  await mergeUserProfileRemote(payload);
}

export async function acceptAiHealthDataConsentRemote(
  uid: string,
): Promise<AiHealthDataConsentResponse> {
  const response = await post<AiHealthDataConsentResponse>(
    "/users/me/ai-health-data-consent",
    { accepted: true },
  );
  if (response.profile) {
    emitUserProfileChanged(uid, response.profile);
  }
  return response;
}

export async function uploadUserAvatarRemote(
  localPath: string,
): Promise<AvatarUploadResponse> {
  const data = new FormData();
  data.append("file", {
    uri: localPath,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  return upload<AvatarUploadResponse>("/users/me/avatar", data);
}

export async function initializeUserOnboardingRemote(
  payload: {
    username: string;
    language?: string | null;
  },
): Promise<UserOnboardingResponse> {
  return post<UserOnboardingResponse>("/users/me/onboarding", payload);
}
