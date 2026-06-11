import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { UserData } from "@/types";
import { savePhotoLocally } from "@utils/savePhotoLocally";
import * as FileSystem from "@/services/core/fileSystem";
import { enqueueUserAvatarUpload } from "@/services/offline/queue.repo";
import { on } from "@/services/core/events";
import { logError, logWarning } from "@/services/core/errorLogger";

const isLocalUri = (value: string | null | undefined): value is string =>
  !!value &&
  (value.startsWith("file://") || value.startsWith("content://"));

function avatarCachePath(uid: string): string {
  return `${FileSystem.documentDirectory}users/${uid}/images/avatar.jpg`;
}

async function cacheAvatarFromRemote(
  uid: string,
  avatarUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const createAbortError = () => {
    const error = new Error("Avatar hydration aborted");
    error.name = "AbortError";
    return error;
  };
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw createAbortError();
    }
  };
  const targetPath = avatarCachePath(uid);
  const tmpPath = `${targetPath}.tmp`;
  const dirPath = targetPath.slice(0, targetPath.lastIndexOf("/") + 1);

  throwIfAborted();

  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }

  try {
    const tmpInfo = await FileSystem.getInfoAsync(tmpPath);
    if (tmpInfo.exists) {
      await FileSystem.deleteAsync(tmpPath, { idempotent: true });
    }
  } catch (error) {
    logWarning("avatar tmp cleanup failed", null, error);
  }

  let downloadResumable: ReturnType<typeof FileSystem.createDownloadResumable> | null =
    null;
  const onAbort = () => {
    if (!downloadResumable) return;
    void downloadResumable.pauseAsync().catch((error: unknown) => {
      logWarning("avatar download pause failed", null, error);
    });
  };
  signal?.addEventListener("abort", onAbort);

  try {
    throwIfAborted();
    downloadResumable = FileSystem.createDownloadResumable(avatarUrl, tmpPath);
    const result = await downloadResumable.downloadAsync();
    throwIfAborted();
    const ok = !!result && result.status >= 200 && result.status < 300;
    if (!ok) {
      throw new Error("Avatar download failed");
    }

    try {
      const targetInfo = await FileSystem.getInfoAsync(targetPath);
      if (targetInfo.exists) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      }
    } catch (error) {
      logWarning("avatar cache target cleanup failed", null, error);
    }

    throwIfAborted();
    await FileSystem.moveAsync({ from: tmpPath, to: targetPath });
    return targetPath;
  } catch (error) {
    try {
      const tmpInfo = await FileSystem.getInfoAsync(tmpPath);
      if (tmpInfo.exists) {
        await FileSystem.deleteAsync(tmpPath, { idempotent: true });
      }
    } catch (innerError) {
      logWarning("avatar failed-download cleanup failed", null, innerError);
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

async function resolveExistingAvatarPath(
  ...paths: Array<string | null | undefined>
): Promise<string> {
  for (const path of paths) {
    if (!isLocalUri(path)) continue;
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    } catch (error) {
      logWarning("avatar path check failed", { path }, error);
      continue;
    }
  }
  return "";
}

type UseUserAvatarParams = {
  uid: string;
  userData: UserData | null;
  setUserData: Dispatch<SetStateAction<UserData | null>>;
  mirrorProfileLocally: (patch: Partial<UserData>) => Promise<void>;
  pushPendingChanges: () => Promise<void>;
  refreshProfileSyncState: () => Promise<void>;
};

type UseUserAvatarResult = {
  setAvatar: (photoUri: string) => Promise<void>;
};

export function useUserAvatar({
  uid,
  userData,
  setUserData,
  mirrorProfileLocally,
  pushPendingChanges,
  refreshProfileSyncState,
}: UseUserAvatarParams): UseUserAvatarResult {
  const avatarLocalPathRef = useRef<string>("");
  const avatarHydrationUrlRef = useRef<string>("");
  const latestAvatarRequestUrlRef = useRef<string>("");
  const avatarHydrationAbortControllerRef = useRef<AbortController | null>(null);
  const currentUidRef = useRef(uid);
  const lastSeenAvatarUrlRef = useRef<string>("");

  useEffect(() => {
    const uidChanged = currentUidRef.current !== uid;
    if (uidChanged) {
      avatarHydrationAbortControllerRef.current?.abort();
      avatarHydrationAbortControllerRef.current = null;
      avatarHydrationUrlRef.current = "";
      latestAvatarRequestUrlRef.current = "";
      lastSeenAvatarUrlRef.current = "";
      avatarLocalPathRef.current = "";
    }
    currentUidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    return () => {
      avatarHydrationAbortControllerRef.current?.abort();
      avatarHydrationAbortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    avatarLocalPathRef.current = userData?.avatarLocalPath || "";
  }, [userData]);

  const hydrateAvatarFromRemote = useCallback(
    async ({
      avatarUrl,
    }: {
      avatarUrl: string | null | undefined;
    }) => {
      const requestUid = uid;
      if (!requestUid || !avatarUrl || !/^https?:\/\//i.test(avatarUrl)) return;
      if (
        avatarHydrationUrlRef.current === avatarUrl &&
        avatarHydrationAbortControllerRef.current &&
        !avatarHydrationAbortControllerRef.current.signal.aborted
      ) {
        return;
      }

      avatarHydrationAbortControllerRef.current?.abort();
      const controller = new AbortController();
      avatarHydrationAbortControllerRef.current = controller;

      latestAvatarRequestUrlRef.current = avatarUrl;
      avatarHydrationUrlRef.current = avatarUrl;

      try {
        const localPath = await cacheAvatarFromRemote(
          requestUid,
          avatarUrl,
          controller.signal
        );
        if (controller.signal.aborted) return;
        const existingPath = await resolveExistingAvatarPath(localPath);
        if (!existingPath) return;
        if (currentUidRef.current !== requestUid) return;
        if (latestAvatarRequestUrlRef.current !== avatarUrl) return;

        avatarLocalPathRef.current = existingPath;
        await mirrorProfileLocally({ avatarLocalPath: existingPath });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      } finally {
        if (avatarHydrationAbortControllerRef.current === controller) {
          avatarHydrationAbortControllerRef.current = null;
          avatarHydrationUrlRef.current = "";
        }
      }
    },
    [uid, mirrorProfileLocally]
  );

  const maybeHydrateAvatar = useCallback(
    ({
      avatarUrl,
      avatarLocalPath,
    }: {
      avatarUrl?: string;
      avatarLocalPath: string;
    }) => {
      const nextUrl = avatarUrl || "";
      const prevUrl = lastSeenAvatarUrlRef.current;
      const urlChanged = !!nextUrl && !!prevUrl && prevUrl !== nextUrl;

      lastSeenAvatarUrlRef.current = nextUrl;

      if (nextUrl && (!avatarLocalPath || urlChanged)) {
        void hydrateAvatarFromRemote({
          avatarUrl: nextUrl,
        });
      }
    },
    [hydrateAvatarFromRemote]
  );

  useEffect(() => {
    let cancelled = false;
    if (!uid || !userData) return;

    void (async () => {
      const avatarLocalPath = await resolveExistingAvatarPath(
        avatarLocalPathRef.current,
        userData.avatarLocalPath
      );
      if (cancelled) return;

      avatarLocalPathRef.current = avatarLocalPath;
      if ((userData.avatarLocalPath || "") !== avatarLocalPath) {
        await mirrorProfileLocally({ avatarLocalPath });
      }

      maybeHydrateAvatar({
        avatarUrl: userData.avatarUrl,
        avatarLocalPath,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, userData, mirrorProfileLocally, maybeHydrateAvatar]);

  useEffect(() => {
    if (!uid) return;
    const unsub = on<{
      uid?: string;
      avatarUrl?: string;
      avatarLocalPath?: string;
      avatarlastSyncedAt?: string;
      avatarRef?: UserData["avatarRef"];
    }>("user:avatar:synced", (payload) => {
      if (!payload || payload.uid !== uid) return;
      if (payload.avatarUrl) {
        lastSeenAvatarUrlRef.current = payload.avatarUrl;
      }
      void mirrorProfileLocally({
        avatarUrl: payload.avatarUrl || "",
        avatarLocalPath: payload.avatarLocalPath || "",
        avatarlastSyncedAt: payload.avatarlastSyncedAt || "",
        avatarRef: payload.avatarRef,
      });
      void refreshProfileSyncState();
    });
    return () => {
      unsub();
    };
  }, [uid, mirrorProfileLocally, refreshProfileSyncState]);

  const setAvatar = useCallback(
    async (photoUri: string) => {
      if (!uid) return;
      const localPath = await savePhotoLocally({
        userUid: uid,
        fileId: "avatar",
        photoUri,
      });

      setUserData((prev) =>
        prev ? { ...prev, avatarLocalPath: localPath } : prev
      );
      avatarLocalPathRef.current = localPath;
      await mirrorProfileLocally({ avatarLocalPath: localPath });
      await enqueueUserAvatarUpload(uid, {
        localPath,
        updatedAt: new Date().toISOString(),
      });
      try {
        await pushPendingChanges();
      } catch (error) {
        logError("avatar upload sync failed", null, error);
      }
    },
    [uid, setUserData, mirrorProfileLocally, pushPendingChanges]
  );

  return useMemo(
    () => ({
      setAvatar,
    }),
    [setAvatar]
  );
}
