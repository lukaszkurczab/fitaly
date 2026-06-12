import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "@/services/core/fileSystem";
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from "uuid";
import { get, upload } from "@/services/core/apiClient";
import { isOfflineNetState } from "@/services/core/networkState";
import { createServiceError } from "@/services/contracts/serviceError";

const CLOUD_MAX = 1280;
const CLOUD_Q = 0.8;
const AI_MAX = 480;
const AI_Q = 0.75;
const CLOUD_URL_CACHE_MAX_ENTRIES = 200;
const CLOUD_URL_CACHE = new Map<string, string>();

export type UploadedImage = {
  imageId: string;
  cloudUrl: string;
  aiLocalUri: string;
};

type MealPhotoResponse = {
  imageId?: string;
  storagePath?: string;
  photoUrl?: string;
};

async function ensureDirFor(filePath: string) {
  const dir = filePath.replace(/[^/]+$/, "");
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function toJpegMaxSide(uri: string, maxSide: number, q: number) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxSide } }],
    { compress: q, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

async function cleanupTemporaryFile(path: string, preserve: Set<string>) {
  if (!path || preserve.has(path)) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // Ignore cleanup failures for temporary files.
  }
}

export function localPhotoPath(uid: string, id: string) {
  return `${FileSystem.documentDirectory}meals/${uid}/${id}.jpg`;
}

function setCachedCloudUrl(key: string, url: string) {
  if (CLOUD_URL_CACHE.has(key)) {
    CLOUD_URL_CACHE.delete(key);
  }
  CLOUD_URL_CACHE.set(key, url);
  if (CLOUD_URL_CACHE.size <= CLOUD_URL_CACHE_MAX_ENTRIES) return;
  const oldestKey = CLOUD_URL_CACHE.keys().next().value;
  if (typeof oldestKey === "string") {
    CLOUD_URL_CACHE.delete(oldestKey);
  }
}

export async function processAndUpload(
  userUid: string,
  localUri: string
): Promise<UploadedImage> {
  const net = await NetInfo.fetch();
  if (isOfflineNetState(net)) {
    throw createServiceError({
      code: "net/offline",
      source: "MealImageService",
      retryable: true,
    });
  }

  const aiTmp = `${FileSystem.cacheDirectory}ai/${uuidv4()}.jpg`;
  let cloudJpeg = "";
  let aiJpeg = "";
  const preserve = new Set([localUri, aiTmp]);
  try {
    cloudJpeg = await toJpegMaxSide(localUri, CLOUD_MAX, CLOUD_Q);

    await ensureDirFor(aiTmp);
    aiJpeg = await toJpegMaxSide(localUri, AI_MAX, AI_Q);
    await FileSystem.copyAsync({ from: aiJpeg, to: aiTmp });

    void userUid;
    const data = new FormData();
    data.append("file", {
      uri: cloudJpeg,
      name: "meal.jpg",
      type: "image/jpeg",
    } as unknown as Blob);

    const response = await upload<MealPhotoResponse>("/users/me/meals/photo", data);
    const imageId = String(response.imageId || "").trim();
    const cloudUrl = String(response.photoUrl || "").trim();

    return { imageId, cloudUrl, aiLocalUri: aiTmp };
  } finally {
    await cleanupTemporaryFile(cloudJpeg, preserve);
    await cleanupTemporaryFile(aiJpeg, preserve);
  }
}

async function getMealPhotoUrl(args: {
  mealId?: string | null;
  imageId?: string | null;
}): Promise<string> {
  const params = new URLSearchParams();
  if (args.mealId) {
    params.set("mealId", args.mealId);
  }
  if (args.imageId) {
    params.set("imageId", args.imageId);
  }
  const key = `meals:${args.mealId || ""}:${args.imageId || ""}`;
  const cached = CLOUD_URL_CACHE.get(key);
  if (cached) return cached;
  const response = await get<MealPhotoResponse>(
    `/users/me/meals/photo-url?${params.toString()}`,
  );
  const url = String(response.photoUrl || "").trim();
  setCachedCloudUrl(key, url);
  return url;
}

async function tryDownloadTo(url: string, target: string): Promise<boolean> {
  try {
    const result = await FileSystem.downloadAsync(url, target);
    if (result.status >= 200 && result.status < 300) {
      const ok = await FileSystem.getInfoAsync(target);
      return ok.exists;
    }
    await FileSystem.deleteAsync(target, { idempotent: true });
    return false;
  } catch {
    return false;
  }
}

export async function ensureLocalMealPhoto(args: {
  uid: string;
  cloudId?: string | null;
  imageId?: string | null;
  photoUrl?: string | null;
}): Promise<string | null> {
  const { uid, cloudId, imageId, photoUrl } = args;
  const id = String(cloudId || imageId || "").trim();
  if (!uid || !id) return null;

  const target = localPhotoPath(uid, id);
  await ensureDirFor(target);

  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) return target;

  if (photoUrl && /^https?:\/\//i.test(photoUrl)) {
    if (await tryDownloadTo(photoUrl, target)) return target;
  }

  if (cloudId || imageId) {
    try {
      const freshUrl = await getMealPhotoUrl({ mealId: cloudId, imageId });
      if (freshUrl && (await tryDownloadTo(freshUrl, target))) return target;
    } catch {
      // ignore
    }
  }

  return null;
}
