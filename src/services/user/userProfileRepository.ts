import type { UserAiConsent, UserData } from "@/types";
import type {
  ActivityLevel,
  AiPersona,
  Allergy,
  ChronicDisease,
  Goal,
  Preference,
  Sex,
  UnitsSystem,
} from "@/types";
import { get, post, upload } from "@/services/core/apiClient";
import { emit, on } from "@/services/core/events";
import { isE2EModeEnabled } from "@/services/e2e/config";
import {
  resolveE2EAiConsentGrant,
  resolveE2EAiConsentRevoke,
} from "@/services/e2e/fixtures";
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

export type UserOnboardingCompletePayload = {
  unitsSystem: UnitsSystem;
  age: string;
  sex: Sex;
  height: string;
  heightInch?: string;
  weight: string;
  preferences: Preference[];
  activityLevel: ActivityLevel | "";
  goal: Goal | "";
  chronicDiseases: ChronicDisease[];
  chronicDiseasesOther: string;
  allergies: Allergy[];
  allergiesOther: string;
  lifestyle: string;
  aiPersona: AiPersona;
  calorieAdjustment?: number | null;
};

type UserOnboardingCompleteResponse = {
  profile: UserData;
  updated: boolean;
};

type AiConsentResponse = {
  aiConsent: UserAiConsent;
};

type ProfileMutationOptions = {
  clientMutationId: string;
};

const profileCache = new Map<string, UserData | null>();
const profileFetchInFlight = new Map<string, Promise<UserData | null>>();
const localAiConsentRevokeGuards = new Map<string, UserAiConsent>();

type E2EAiConsentSeededPayload = {
  uid?: string | null;
  aiConsent?: UserAiConsent;
};

function isAiConsentActive(aiConsent: UserAiConsent | null | undefined): boolean {
  return (
    aiConsent?.status === "granted" &&
    Boolean(aiConsent.grantedAt) &&
    aiConsent.revokedAt === null
  );
}

function isAiConsentInactive(aiConsent: UserAiConsent | null | undefined): boolean {
  return !isAiConsentActive(aiConsent);
}

function getLocalRevokeGuard(uid: string): UserAiConsent | undefined {
  return localAiConsentRevokeGuards.get(uid);
}

function copyAiConsent(aiConsent: UserAiConsent): UserAiConsent {
  return { ...aiConsent };
}

function requireClientMutationId(options: ProfileMutationOptions | undefined): string {
  const clientMutationId = String(options?.clientMutationId || "").trim();
  if (!clientMutationId) {
    throw new Error("profile/client-mutation-id-required");
  }
  return clientMutationId;
}

export function getAiConsentLocalRevokeGuard(
  uid: string,
): UserAiConsent | null {
  const guard = getLocalRevokeGuard(uid);
  return guard ? copyAiConsent(guard) : null;
}

function overlayLocalRevokeGuard(
  profile: UserData,
  uid: string,
): UserData {
  const guard = getLocalRevokeGuard(uid);
  if (!guard) {
    return profile;
  }

  if (!isAiConsentActive(profile.profile.aiConsent)) {
    localAiConsentRevokeGuards.delete(uid);
    return {
      ...profile,
      profile: {
        ...profile.profile,
      },
    };
  }

  return {
    ...profile,
    profile: {
      ...profile.profile,
      aiConsent: copyAiConsent(guard),
    },
  };
}

export function getCachedUserProfile(uid: string): UserData | null | undefined {
  return profileCache.get(uid);
}

export function clearCachedUserProfile(uid: string): void {
  profileCache.delete(uid);
  localAiConsentRevokeGuards.delete(uid);
}

export function emitUserProfileChanged(uid: string, data: UserData | null) {
  profileCache.set(uid, data);
  emit("user:profile:changed", { uid, data });
}

function patchCachedAiConsent(uid: string, aiConsent: UserAiConsent): void {
  const cached = profileCache.get(uid);
  if (!cached) return;
  emitUserProfileChanged(uid, {
    ...cached,
    profile: {
      ...cached.profile,
      aiConsent,
    },
  });
}

on<E2EAiConsentSeededPayload>("e2e:aiConsentSeeded", (payload) => {
  if (!isE2EModeEnabled()) return;
  const uid = payload?.uid;
  const aiConsent = payload?.aiConsent;
  if (!uid || !aiConsent) return;
  patchCachedAiConsent(uid, aiConsent);
});

export function publishAiConsentRevokeLocalInactive(
  uid: string,
  currentProfile?: UserData | null,
): UserAiConsent | null {
  const source = profileCache.get(uid) ?? currentProfile ?? null;
  if (!source) return null;
  const currentAiConsent = source.profile.aiConsent;
  const aiConsent: UserAiConsent = {
    status: "revoked",
    grantedAt: currentAiConsent.grantedAt,
    revokedAt: currentAiConsent.revokedAt ?? new Date().toISOString(),
  };
  localAiConsentRevokeGuards.set(uid, aiConsent);

  emitUserProfileChanged(uid, {
    ...source,
    profile: {
      ...source.profile,
      aiConsent,
    },
  });

  return aiConsent;
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
    const profile = response.profile ?? null;
    if (!profile) return null;

    const uid = profile.uid || sessionKey;
    if (!uid) return profile;

    const guardedProfile = overlayLocalRevokeGuard(profile, uid);
    if (guardedProfile !== profile) {
      emitUserProfileChanged(uid, guardedProfile);
    }

    return guardedProfile;
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
  options: ProfileMutationOptions,
): Promise<void> {
  const patch = sanitizeUserProfilePatch(payload);
  if (Object.keys(patch).length === 0) return;
  const clientMutationId = requireClientMutationId(options);
  await post("/users/me/profile", {
    ...patch,
    clientMutationId,
  });
}

export async function updateUserProfileRemote(
  payload: Partial<UserData> & { updatedAt?: string },
  options: ProfileMutationOptions,
): Promise<void> {
  await mergeUserProfileRemote(payload, options);
}

export async function grantAiConsentRemote(
  uid: string,
): Promise<AiConsentResponse> {
  const guard = getLocalRevokeGuard(uid);
  if (guard) {
    throw new Error("ai-consent/revoke-pending");
  }

  if (isE2EModeEnabled()) {
    const e2eResponse = resolveE2EAiConsentGrant(
      uid,
      profileCache.get(uid)?.profile.aiConsent,
    );
    if (e2eResponse) {
      if ("error" in e2eResponse) throw e2eResponse.error;
      patchCachedAiConsent(uid, e2eResponse.aiConsent);
      return e2eResponse;
    }
  }

  const response = await post<AiConsentResponse>("/users/me/ai-consent/grant");
  patchCachedAiConsent(uid, response.aiConsent);
  return response;
}

export async function revokeAiConsentRemote(
  uid: string,
): Promise<AiConsentResponse> {
  if (isE2EModeEnabled()) {
    const e2eResponse = resolveE2EAiConsentRevoke(
      uid,
      profileCache.get(uid)?.profile.aiConsent,
    );
    if (e2eResponse) {
      if ("error" in e2eResponse) throw e2eResponse.error;
      if (isAiConsentInactive(e2eResponse.aiConsent)) {
        localAiConsentRevokeGuards.delete(uid);
      }
      patchCachedAiConsent(uid, e2eResponse.aiConsent);
      return e2eResponse;
    }
  }

  const response = await post<AiConsentResponse>("/users/me/ai-consent/revoke");
  if (isAiConsentInactive(response.aiConsent)) {
    localAiConsentRevokeGuards.delete(uid);
  }
  patchCachedAiConsent(uid, response.aiConsent);
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
  const response = await post<UserOnboardingResponse>(
    "/users/me/onboarding",
    payload,
  );
  if (response.profile?.uid) {
    emitUserProfileChanged(response.profile.uid, response.profile);
  }
  return response;
}

export async function completeUserOnboardingRemote(
  payload: UserOnboardingCompletePayload,
): Promise<UserOnboardingCompleteResponse> {
  const response = await post<UserOnboardingCompleteResponse>(
    "/users/me/onboarding/complete",
    payload,
  );
  if (response.profile?.uid) {
    emitUserProfileChanged(response.profile.uid, response.profile);
  }
  return response;
}
