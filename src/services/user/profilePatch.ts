import type { UserData, UserProfile } from "@/types";
import {
  PROFILE_EDITABLE_LOCAL_FIELDS,
  PROFILE_EDITABLE_REMOTE_FIELDS,
} from "./profileContract";

const EDITABLE_REMOTE_PROFILE_FIELDS = new Set<keyof UserData>(
  PROFILE_EDITABLE_REMOTE_FIELDS,
);

const EDITABLE_LOCAL_PROFILE_FIELDS = new Set<keyof UserData>(
  PROFILE_EDITABLE_LOCAL_FIELDS,
);

const EDITABLE_REMOTE_NESTED_PROFILE_FIELDS = new Set<keyof UserProfile>([
  "language",
  "nutritionProfile",
  "aiPreferences",
]);

function sanitizeWithAllowedFields(
  payload: Partial<UserData>,
  allowedFields: ReadonlySet<keyof UserData>,
): Partial<UserData> {
  const patch: Partial<UserData> = {};
  const mutablePatch = patch as Record<
    keyof UserData,
    UserData[keyof UserData] | undefined
  >;

  for (const [key, value] of Object.entries(payload) as Array<
    [keyof UserData, UserData[keyof UserData]]
  >) {
    if (!allowedFields.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    mutablePatch[key] = value;
  }

  return patch;
}

function sanitizeRemoteProfilePatch(
  profile: UserProfile | undefined,
): Partial<UserProfile> | undefined {
  if (!profile) return undefined;

  const patch: Partial<UserProfile> = {};
  const mutablePatch = patch as Record<
    keyof UserProfile,
    UserProfile[keyof UserProfile] | undefined
  >;

  for (const [key, value] of Object.entries(profile) as Array<
    [keyof UserProfile, UserProfile[keyof UserProfile]]
  >) {
    if (!EDITABLE_REMOTE_NESTED_PROFILE_FIELDS.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    mutablePatch[key] = value;
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function sanitizeUserProfilePatch(
  payload: Partial<UserData>,
): Partial<UserData> {
  const patch = sanitizeWithAllowedFields(payload, EDITABLE_REMOTE_PROFILE_FIELDS);
  const profilePatch = sanitizeRemoteProfilePatch(patch.profile);
  if (!profilePatch) {
    delete patch.profile;
    return patch;
  }
  return {
    ...patch,
    profile: profilePatch as UserProfile,
  };
}

export function sanitizeUserProfileLocalPatch(
  payload: Partial<UserData>,
): Partial<UserData> {
  return sanitizeWithAllowedFields(payload, EDITABLE_LOCAL_PROFILE_FIELDS);
}
