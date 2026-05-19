import { useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchNotificationPrefs,
  updateNotificationPrefs,
} from "@/services/notifications/notificationsRepository";
import { logWarning } from "@/services/core/errorLogger";
import { getE2EFixtureState } from "@/services/e2e/fixtures";

type BoolPrefs = { enabled: boolean };

type PrefConfig = {
  key: string;
  field: "motivationEnabled" | "smartRemindersEnabled" | "statsEnabled";
  defaultValue: boolean;
};

const PREF_CONFIGS: Record<string, PrefConfig> = {
  motivation: {
    key: "motivation",
    field: "motivationEnabled",
    defaultValue: false,
  },
  smartReminders: {
    key: "smart-reminders",
    field: "smartRemindersEnabled",
    defaultValue: true,
  },
  stats: { key: "stats", field: "statsEnabled", defaultValue: false },
};

function parseCachedBoolPrefs(cached: string | null): BoolPrefs | null {
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as Partial<BoolPrefs>;
    return { enabled: !!parsed.enabled };
  } catch (error) {
    logWarning("notification pref cache parse failed", null, error);
    return null;
  }
}

function cacheKey(uid: string, config: PrefConfig): string {
  return `notif:prefs:${uid}:${config.key}`;
}

async function loadPref(
  uid: string,
  config: PrefConfig,
  prefsData: Awaited<ReturnType<typeof fetchNotificationPrefs>> | null,
): Promise<BoolPrefs> {
  if (prefsData) {
    const raw = prefsData.notifications?.[config.field];
    const enabled = typeof raw === "boolean" ? raw : config.defaultValue;
    await AsyncStorage.setItem(
      cacheKey(uid, config),
      JSON.stringify({ enabled }),
    );
    return { enabled };
  }

  try {
    const cached = await AsyncStorage.getItem(cacheKey(uid, config));
    const parsed = parseCachedBoolPrefs(cached);
    if (parsed) return parsed;
  } catch (error) {
    logWarning("notification pref cache read failed", null, error);
    // Ignore malformed local cache fallback.
  }
  return { enabled: config.defaultValue };
}

async function savePref(
  uid: string,
  config: PrefConfig,
  enabled: boolean,
): Promise<void> {
  try {
    if (!getE2EFixtureState()?.notificationPermission) {
      await updateNotificationPrefs(uid, { [config.field]: enabled });
    }
    await AsyncStorage.setItem(
      cacheKey(uid, config),
      JSON.stringify({ enabled }),
    );
  } catch (error) {
    logWarning("notification prefs update failed", null, error);
    throw error;
  }
}

export function useNotifications(uid: string | null) {
  void uid;
  const loadAllPrefs = useCallback(async (uidLocal: string) => {
    let prefsData: Awaited<ReturnType<typeof fetchNotificationPrefs>> | null =
      null;
    if (!getE2EFixtureState()?.notificationPermission) {
      try {
        prefsData = await fetchNotificationPrefs(uidLocal);
      } catch (error) {
        logWarning("notification prefs fetch failed", null, error);
        // Fall through - loadPref will use cached values.
      }
    }

    const [motivation, smartReminders, stats] = await Promise.all([
      loadPref(uidLocal, PREF_CONFIGS.motivation, prefsData),
      loadPref(uidLocal, PREF_CONFIGS.smartReminders, prefsData),
      loadPref(uidLocal, PREF_CONFIGS.stats, prefsData),
    ]);

    return { motivation, smartReminders, stats };
  }, []);

  const setMotivationPrefs = useCallback(
    (uidLocal: string, enabled: boolean) =>
      savePref(uidLocal, PREF_CONFIGS.motivation, enabled),
    [],
  );

  const setSmartRemindersPrefs = useCallback(
    (uidLocal: string, enabled: boolean) =>
      savePref(uidLocal, PREF_CONFIGS.smartReminders, enabled),
    [],
  );

  const setStatsPrefs = useCallback(
    (uidLocal: string, enabled: boolean) =>
      savePref(uidLocal, PREF_CONFIGS.stats, enabled),
    [],
  );

  return useMemo(
    () => ({
      loading: false,
      loadAllPrefs,
      setMotivationPrefs,
      setSmartRemindersPrefs,
      setStatsPrefs,
    }),
    [
      loadAllPrefs,
      setMotivationPrefs,
      setSmartRemindersPrefs,
      setStatsPrefs,
    ],
  );
}
