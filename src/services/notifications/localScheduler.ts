import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { isRecord } from "@/services/contracts/guards";
import { emitNotificationScheduledTelemetry } from "@/services/notifications/notificationTelemetry";
import { parseStoredIds } from "@/services/notifications/storageUtils";

const KEY_PREFIX = "notif:ids:";
const USER_NOTIFICATION_ORIGIN = "user_notifications";
const ANDROID_CHANNEL_ID = "default";

export type AndroidChannelEnsureResult = {
  platform: "android" | "non-android";
  channelId: string;
  ensured: boolean;
  exists: boolean | null;
  errorMessage: string | null;
};

export type StoredNotificationIdsEntry = {
  localKey: string;
  ids: string[];
};

function key(localKey: string) {
  return KEY_PREFIX + localKey;
}

export function notificationScheduleKey(uid: string, notificationId: string): string {
  return `${uid}:${notificationId}`;
}

function buildTelemetryContent(
  content: Notifications.NotificationContentInput,
): Notifications.NotificationContentInput {
  const data = isRecord(content.data) ? content.data : {};
  const explicitOrigin =
    typeof data.origin === "string" && data.origin.trim().length > 0
      ? data.origin
      : null;
  return {
    ...content,
    data: {
      ...data,
      origin: explicitOrigin ?? USER_NOTIFICATION_ORIGIN,
    },
  };
}

function resolveNotificationTypeFromContent(
  content: Notifications.NotificationContentInput,
): string | null {
  if (!isRecord(content.data)) {
    return null;
  }

  return typeof content.data.type === "string" ? content.data.type : null;
}

function resolveNotificationOriginFromContent(
  content: Notifications.NotificationContentInput,
): string {
  if (!isRecord(content.data)) {
    return USER_NOTIFICATION_ORIGIN;
  }

  return typeof content.data.origin === "string" &&
    content.data.origin.trim().length > 0
    ? content.data.origin
    : USER_NOTIFICATION_ORIGIN;
}

async function storeId(localKey: string, id: string) {
  const raw = await AsyncStorage.getItem(key(localKey));
  const arr = parseStoredIds(raw);
  arr.push(id);
  await AsyncStorage.setItem(key(localKey), JSON.stringify(arr));
}

export async function cancelAllForNotif(localKey: string) {
  const raw = await AsyncStorage.getItem(key(localKey));
  const ids = parseStoredIds(raw);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Ignore missing/already-cancelled local IDs.
    }
  }
  await AsyncStorage.setItem(key(localKey), JSON.stringify([]));
}

export async function listStoredNotificationIdsByPrefix(
  localKeyPrefix: string,
): Promise<StoredNotificationIdsEntry[]> {
  const keys = await AsyncStorage.getAllKeys();
  const storagePrefix = key(localKeyPrefix);
  const matching = keys.filter((storageKey) => storageKey.startsWith(storagePrefix));
  const entries: StoredNotificationIdsEntry[] = [];

  for (const storageKey of matching) {
    const raw = await AsyncStorage.getItem(storageKey);
    entries.push({
      localKey: storageKey.slice(KEY_PREFIX.length),
      ids: parseStoredIds(raw),
    });
  }

  return entries;
}

export async function ensureAndroidChannel(): Promise<AndroidChannelEnsureResult> {
  if (Platform.OS !== "android") {
    return {
      platform: "non-android",
      channelId: ANDROID_CHANNEL_ID,
      ensured: false,
      exists: null,
      errorMessage: null,
    };
  }

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "General",
      description: "General notifications",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: undefined,
      enableVibrate: true,
      enableLights: false,
      showBadge: true,
    });
    let exists: boolean | null = true;
    const getChannel = (
      Notifications as unknown as {
        getNotificationChannelAsync?: (
          channelId: string,
        ) => Promise<unknown>;
      }
    ).getNotificationChannelAsync;
    if (typeof getChannel === "function") {
      try {
        const channel = await getChannel(ANDROID_CHANNEL_ID);
        exists = !!channel;
      } catch {
        exists = null;
      }
    }
    return {
      platform: "android",
      channelId: ANDROID_CHANNEL_ID,
      ensured: true,
      exists,
      errorMessage: null,
    };
  } catch (error) {
    return {
      platform: "android",
      channelId: ANDROID_CHANNEL_ID,
      ensured: false,
      exists: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function scheduleOneShotAt(
  when: Date,
  content: Notifications.NotificationContentInput,
  localKey: string
) {
  await ensureAndroidChannel();
  const contentWithTelemetry = buildTelemetryContent(content);
  const id = await Notifications.scheduleNotificationAsync({
    content: contentWithTelemetry,
    trigger: Platform.select({
      android: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: ANDROID_CHANNEL_ID,
      },
      ios: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    }) as Notifications.NotificationTriggerInput,
  });
  await storeId(localKey, id);
  void emitNotificationScheduledTelemetry({
    notificationType: resolveNotificationTypeFromContent(contentWithTelemetry),
    origin: resolveNotificationOriginFromContent(contentWithTelemetry),
  });
}

export function nextOccurrenceForDays(
  time: { hour: number; minute: number },
  days: number[]
): Date | null {
  if (!days?.length) return null;
  const now = new Date();
  for (let off = 0; off < 14; off++) {
    const d = new Date(now);
    d.setDate(now.getDate() + off);
    const weekday0Sun = d.getDay();
    if (days.includes(weekday0Sun)) {
      d.setHours(time.hour, time.minute, 0, 0);
      if (d > now) return d;
    }
  }
  return null;
}
