import type { UserData } from "@/types";

const EDITABLE_REMOTE_PROFILE_FIELDS = new Set<keyof UserData>([
  "unitsSystem",
  "age",
  "sex",
  "height",
  "heightInch",
  "weight",
  "preferences",
  "activityLevel",
  "goal",
  "calorieDeficit",
  "calorieSurplus",
  "chronicDiseases",
  "chronicDiseasesOther",
  "allergies",
  "allergiesOther",
  "lifestyle",
  "aiStyle",
  "aiFocus",
  "aiFocusOther",
  "aiNote",
  "surveyComplited",
  "surveyCompletedAt",
  "calorieTarget",
  "language",
]);

const EDITABLE_LOCAL_PROFILE_FIELDS = new Set<keyof UserData>([
  ...EDITABLE_REMOTE_PROFILE_FIELDS,
  "username",
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
