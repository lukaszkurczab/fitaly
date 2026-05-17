import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserData } from "@/types";
import { logWarning } from "@/services/core/errorLogger";
import { parseUserProfile } from "@/services/user/profile.dto";

export function profileCacheKey(uid: string): string {
  return `user:profile:${uid}`;
}

function isValidBootstrapProfile(uid: string, value: unknown): value is UserData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UserData>;
  return (
    candidate.uid === uid &&
    typeof candidate.username === "string" &&
    candidate.username.trim().length > 0
  );
}

export function normalizeBootstrapProfile(
  uid: string,
  value: unknown,
): UserData | null {
  if (!isValidBootstrapProfile(uid, value)) return null;
  const candidate = value as UserData;
  return {
    ...candidate,
    profile: parseUserProfile(candidate.profile),
  };
}

export async function readProfileCache(uid: string): Promise<UserData | null> {
  try {
    const cached = await AsyncStorage.getItem(profileCacheKey(uid));
    if (!cached) return null;
    const parsed = normalizeBootstrapProfile(uid, JSON.parse(cached));
    if (!parsed) {
      logWarning("profile cache invalid for bootstrap", { uid });
      return null;
    }
    return parsed;
  } catch (error) {
    logWarning("profile cache read failed", null, error);
    return null;
  }
}

export async function writeProfileCache(
  uid: string,
  profile: UserData,
): Promise<void> {
  try {
    await AsyncStorage.setItem(profileCacheKey(uid), JSON.stringify(profile));
  } catch (error) {
    logWarning("profile cache write failed", null, error);
  }
}
