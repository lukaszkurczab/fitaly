import type { UserData } from "@/types";
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

export function sanitizeUserProfilePatch(
  payload: Partial<UserData>,
): Partial<UserData> {
  return sanitizeWithAllowedFields(payload, EDITABLE_REMOTE_PROFILE_FIELDS);
}

export function sanitizeUserProfileLocalPatch(
  payload: Partial<UserData>,
): Partial<UserData> {
  return sanitizeWithAllowedFields(payload, EDITABLE_LOCAL_PROFILE_FIELDS);
}
