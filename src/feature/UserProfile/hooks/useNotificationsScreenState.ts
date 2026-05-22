import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useNotifications } from "@/hooks/useNotifications";
import { reconcileAll } from "@/services/notifications/engine";
import { ensureAndroidChannel } from "@/services/notifications/localScheduler";
import { markNotificationPermissionRequested } from "@/services/notifications/notificationDiagnostics";
import { cancelSystemNotifications } from "@/services/notifications/system";
import { cancelAllReminderScheduling } from "@/services/reminders/reminderScheduling";
import { resolveE2ENotificationPermission } from "@/services/e2e/fixtures";

function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus | {
    granted?: boolean;
    status?: string;
  },
): boolean {
  const maybeGranted = permission as { granted?: boolean; status?: string };
  return maybeGranted.granted === true || maybeGranted.status === "granted";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "notification_preferences_sync_failed";
}

export function useNotificationsScreenState(uid: string | null) {
  const {
    loading,
    loadAllPrefs,
    setMotivationPrefs,
    setSmartRemindersPrefs,
    setStatsPrefs,
  } = useNotifications(uid);

  const [motivationEnabled, setMotivationEnabled] = useState(false);
  const [smartRemindersEnabled, setSmartRemindersEnabled] = useState(false);
  const [statsEnabled, setStatsEnabled] = useState(false);
  const [systemAllowed, setSystemAllowed] = useState<boolean | null>(null);
  const [settingsCtaVisible, setSettingsCtaVisible] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastPrefsSyncStatus, setLastPrefsSyncStatus] = useState<
    "idle" | "success" | "failed"
  >("idle");
  const [lastPrefsSyncAt, setLastPrefsSyncAt] = useState<string | null>(null);
  const autoDisabledRef = useRef(false);

  const refreshPermissionStatus = useCallback(async (): Promise<boolean> => {
    try {
      const perm =
        resolveE2ENotificationPermission() ??
        (await Notifications.getPermissionsAsync());
      const isGranted = isNotificationPermissionGranted(perm);
      setSystemAllowed(isGranted);
      if (isGranted && Platform.OS === "android") {
        await ensureAndroidChannel();
      }
      return isGranted;
    } catch {
      setSystemAllowed(false);
      return false;
    }
  }, []);

  useEffect(() => {
    autoDisabledRef.current = false;
    setLastSyncError(null);
    setLastPrefsSyncStatus("idle");
    setLastPrefsSyncAt(null);
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setSystemAllowed(null);
      return;
    }

    (async () => {
      const { motivation, smartReminders, stats } = await loadAllPrefs(uid);
      setMotivationEnabled(!!motivation.enabled);
      setSmartRemindersEnabled(!!smartReminders.enabled);
      setStatsEnabled(!!stats.enabled);

      const isGranted = await refreshPermissionStatus();
      if (isGranted) {
        await reconcileAll(uid);
      }
    })();
  }, [uid, loadAllPrefs, refreshPermissionStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshPermissionStatus();
      }
    });
    return () => {
      sub.remove();
    };
  }, [refreshPermissionStatus]);

  useEffect(() => {
    (async () => {
      if (!uid) return;
      if (systemAllowed !== false || autoDisabledRef.current) {
        return;
      }

      autoDisabledRef.current = true;

      try {
        if (motivationEnabled) {
          await setMotivationPrefs(uid, false);
          setMotivationEnabled(false);
        }
        if (smartRemindersEnabled) {
          await setSmartRemindersPrefs(uid, false);
          setSmartRemindersEnabled(false);
        }
        if (statsEnabled) {
          await setStatsPrefs(uid, false);
          setStatsEnabled(false);
        }
        setLastSyncError(null);
        setLastPrefsSyncStatus("success");
        setLastPrefsSyncAt(new Date().toISOString());
      } catch (error) {
        setLastSyncError(errorMessage(error));
        setLastPrefsSyncStatus("failed");
        setLastPrefsSyncAt(new Date().toISOString());
      } finally {
        await cancelSystemNotifications(uid, "motivation_dont_give_up");
        await cancelSystemNotifications(uid, "stats_weekly_summary");
        await cancelAllReminderScheduling(uid);
      }
    })();
  }, [
    systemAllowed,
    uid,
    motivationEnabled,
    smartRemindersEnabled,
    statsEnabled,
    setMotivationPrefs,
    setSmartRemindersPrefs,
    setStatsPrefs,
  ]);

  const requestSystemPermission = useCallback(async (): Promise<boolean> => {
    await markNotificationPermissionRequested();
    try {
      const res =
        resolveE2ENotificationPermission() ??
        (await Notifications.requestPermissionsAsync());
      const granted = isNotificationPermissionGranted(res);
      setSystemAllowed(granted);
      if (granted && Platform.OS === "android") {
        await ensureAndroidChannel();
      }
      if (!granted) {
        setSettingsCtaVisible(true);
      }
      return granted;
    } catch {
      setSystemAllowed(false);
      return false;
    }
  }, []);

  const openSettings = useCallback(async () => {
    setSettingsCtaVisible(false);
    try {
      await Linking.openSettings();
    } catch {
      // Ignore settings deep-link failures.
    }
  }, []);

  const onToggleSmartReminders = useCallback(
    async (enabled: boolean) => {
      if (!uid) return;
      if (enabled && systemAllowed !== true) {
        const allowed = await requestSystemPermission();
        if (!allowed) return;
      }

      const previous = smartRemindersEnabled;
      setSmartRemindersEnabled(enabled);
      setLastSyncError(null);
      setLastPrefsSyncStatus("idle");

      try {
        await setSmartRemindersPrefs(uid, enabled);
        setLastSyncError(null);
        setLastPrefsSyncStatus("success");
        setLastPrefsSyncAt(new Date().toISOString());
      } catch (error) {
        setSmartRemindersEnabled(previous);
        setLastSyncError(errorMessage(error));
        setLastPrefsSyncStatus("failed");
        setLastPrefsSyncAt(new Date().toISOString());
        return;
      }

      if (enabled) {
        await reconcileAll(uid);
      } else {
        await cancelAllReminderScheduling(uid);
      }
    },
    [
      requestSystemPermission,
      setSmartRemindersPrefs,
      smartRemindersEnabled,
      systemAllowed,
      uid,
    ],
  );

  const onToggleMotivation = useCallback(
    async (enabled: boolean) => {
      if (!uid) return;
      if (enabled && systemAllowed !== true) {
        const allowed = await requestSystemPermission();
        if (!allowed) return;
      }

      const previous = motivationEnabled;
      setMotivationEnabled(enabled);
      setLastSyncError(null);
      setLastPrefsSyncStatus("idle");

      try {
        await setMotivationPrefs(uid, enabled);
        setLastSyncError(null);
        setLastPrefsSyncStatus("success");
        setLastPrefsSyncAt(new Date().toISOString());
      } catch (error) {
        setMotivationEnabled(previous);
        setLastSyncError(errorMessage(error));
        setLastPrefsSyncStatus("failed");
        setLastPrefsSyncAt(new Date().toISOString());
        return;
      }

      if (enabled) {
        await reconcileAll(uid);
      } else {
        await cancelSystemNotifications(uid, "motivation_dont_give_up");
      }
    },
    [
      motivationEnabled,
      requestSystemPermission,
      setMotivationPrefs,
      systemAllowed,
      uid,
    ],
  );

  const onToggleStats = useCallback(
    async (enabled: boolean) => {
      if (!uid) return;
      if (enabled && systemAllowed !== true) {
        const allowed = await requestSystemPermission();
        if (!allowed) return;
      }

      const previous = statsEnabled;
      setStatsEnabled(enabled);
      setLastSyncError(null);
      setLastPrefsSyncStatus("idle");

      try {
        await setStatsPrefs(uid, enabled);
        setLastSyncError(null);
        setLastPrefsSyncStatus("success");
        setLastPrefsSyncAt(new Date().toISOString());
      } catch (error) {
        setStatsEnabled(previous);
        setLastSyncError(errorMessage(error));
        setLastPrefsSyncStatus("failed");
        setLastPrefsSyncAt(new Date().toISOString());
        return;
      }

      if (enabled) {
        await reconcileAll(uid);
      } else {
        await cancelSystemNotifications(uid, "stats_weekly_summary");
      }
    },
    [statsEnabled, requestSystemPermission, setStatsPrefs, systemAllowed, uid],
  );

  return {
    loading,
    motivationEnabled,
    smartRemindersEnabled,
    statsEnabled,
    systemAllowed,
    settingsCtaVisible,
    lastSyncError,
    lastPrefsSyncStatus,
    lastPrefsSyncAt,
    setSettingsCtaVisible,
    openSettings,
    onToggleSmartReminders,
    onToggleMotivation,
    onToggleStats,
  };
}
