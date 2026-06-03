import AsyncStorage from "@react-native-async-storage/async-storage";

const photoFullscreenPreferenceKey = (uid: string) =>
  `meal-add:photo-fullscreen:${uid}`;

export async function getPhotoFullscreenPreference(
  uid: string | null | undefined,
): Promise<boolean> {
  if (!uid) return false;

  try {
    return (await AsyncStorage.getItem(photoFullscreenPreferenceKey(uid))) === "true";
  } catch {
    return false;
  }
}

export async function setPhotoFullscreenPreference(
  uid: string | null | undefined,
  enabled: boolean,
): Promise<void> {
  if (!uid) return;

  try {
    await AsyncStorage.setItem(
      photoFullscreenPreferenceKey(uid),
      enabled ? "true" : "false",
    );
  } catch {
    // Best-effort UI preference; failing to persist should not block capture.
  }
}
