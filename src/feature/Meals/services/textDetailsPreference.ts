import AsyncStorage from "@react-native-async-storage/async-storage";

const textDetailsPreferenceKey = (uid: string) =>
  `meal-add:text-details-expanded:${uid}`;

export async function getTextDetailsExpandedPreference(
  uid: string | null | undefined,
): Promise<boolean> {
  if (!uid) return false;

  try {
    return (await AsyncStorage.getItem(textDetailsPreferenceKey(uid))) === "true";
  } catch {
    return false;
  }
}

export async function setTextDetailsExpandedPreference(
  uid: string | null | undefined,
  expanded: boolean,
): Promise<void> {
  if (!uid) return;

  try {
    await AsyncStorage.setItem(
      textDetailsPreferenceKey(uid),
      expanded ? "true" : "false",
    );
  } catch {
    // Best-effort UI preference; failing to persist should not block text capture.
  }
}
