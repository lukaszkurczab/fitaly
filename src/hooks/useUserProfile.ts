import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { UserData } from "@/types";
import { assertNoUndefined } from "@/utils/findUndefined";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "@/services/core/fileSystem";
import { emit, on } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  emitUserProfileChanged,
  fetchUserProfileRemote,
  subscribeToUserProfile,
} from "@/services/user/userProfileRepository";
import {
  getSyncCounts,
  enqueueUserProfileUpdate,
  retryDeadLetterOps,
} from "@/services/offline/queue.repo";
import { requestSync } from "@/services/offline/sync.engine";
import {
  sanitizeUserProfileLocalPatch,
  sanitizeUserProfilePatch,
} from "@/services/user/profilePatch";
import i18n from "@/i18n";
import type { QueueKind } from "@/services/offline/queue.repo";
import { captureException, logError, logWarning } from "@/services/core/errorLogger";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { parseUserProfile } from "@/services/user/profile.dto";

const PROFILE_SYNC_KINDS: QueueKind[] = [
  "update_user_profile",
  "upload_user_avatar",
];

export function normalizeLanguageCode(
  language: string | null | undefined
): "en" | "pl" {
  const normalized = (language || "").trim().toLowerCase();
  if (normalized === "pl" || normalized.startsWith("pl-")) return "pl";
  return "en";
}

const profileCacheLocks = new Map<string, Promise<void>>();

const isLocalUri = (value: string | null | undefined): value is string =>
  !!value &&
  (value.startsWith("file://") || value.startsWith("content://"));

type CurrentGuard = () => boolean;

function profileBootstrapErrorContext(uid: string, error: unknown) {
  const runtimeConfig = getRuntimeConfig();
  const candidate =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};

  return {
    uid,
    endpoint: "/users/me/profile",
    source: typeof candidate.source === "string" ? candidate.source : "unknown",
    code: typeof candidate.code === "string" ? candidate.code : "unknown",
    status:
      typeof candidate.status === "number" ? candidate.status : undefined,
    retryable:
      typeof candidate.retryable === "boolean"
        ? candidate.retryable
        : undefined,
    requestId:
      typeof candidate.requestId === "string" ? candidate.requestId : undefined,
    buildProfile: runtimeConfig.buildProfile || "unknown",
    environment: runtimeConfig.sentryEnvironment || "unknown",
  };
}

async function withProfileCacheLock<T>(
  uid: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = profileCacheLocks.get(uid) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  profileCacheLocks.set(uid, next);

  await previous.catch((error) => {
    logWarning("profile cache lock wait failed", null, error);
  });
  try {
    return await task();
  } finally {
    release();
    if (profileCacheLocks.get(uid) === next) {
      profileCacheLocks.delete(uid);
    }
  }
}

function profileCacheKey(uid: string): string {
  return `user:profile:${uid}`;
}

function isValidBootstrapProfile(uid: string, value: unknown): value is UserData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UserData>;
  return (
    candidate.uid === uid &&
    typeof candidate.username === "string" &&
    candidate.username.trim().length > 0
  );
}

function normalizeBootstrapProfile(
  uid: string,
  value: unknown,
): UserData | null {
  if (!isValidBootstrapProfile(uid, value)) return null;
  const candidate = value as UserData;
  return {
    ...candidate,
    profile: parseUserProfile(candidate.profile),
  };
}

function avatarCachePath(uid: string): string {
  return `${FileSystem.documentDirectory}users/${uid}/images/avatar.jpg`;
}

async function readProfileCache(uid: string): Promise<UserData | null> {
  try {
    const cached = await AsyncStorage.getItem(profileCacheKey(uid));
    if (!cached) return null;
    const parsed = normalizeBootstrapProfile(uid, JSON.parse(cached));
    if (!parsed) {
      logWarning("profile cache invalid for bootstrap", { uid });
      return null;
    }
    return parsed;
  } catch (error) {
    logWarning("profile cache read failed", null, error);
    return null;
  }
}

async function writeProfileCache(uid: string, profile: UserData): Promise<void> {
  try {
    await AsyncStorage.setItem(profileCacheKey(uid), JSON.stringify(profile));
  } catch (error) {
    logWarning("profile cache write failed", null, error);
  }
}

async function mergeProfileCache(
  uid: string,
  patch: Record<string, unknown>
): Promise<void> {
  return withProfileCacheLock(uid, async () => {
    const cacheKey = profileCacheKey(uid);
    let parsedCurrent: Record<string, unknown> = {};

    try {
      const current = await AsyncStorage.getItem(cacheKey);
      if (current) {
        try {
          parsedCurrent = JSON.parse(current) as Record<string, unknown>;
        } catch (error) {
          logWarning("profile cache parse failed", null, error);
          parsedCurrent = {};
        }
      }

      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ ...parsedCurrent, ...patch })
      );
    } catch (error) {
      logWarning("profile cache merge write failed", null, error);
    }
  });
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

type SyncState = "synced" | "pending" | "conflict";
export type UserProfileBootstrapState =
  | "profileLoading"
  | "profileReady"
  | "profileMissing"
  | "offlineCached"
  | "bootstrapFailed";

type UseUserProfileResult = {
  userData: UserData | null;
  loading: boolean;
  profileBootstrapState: UserProfileBootstrapState;
  profileBootstrapError: unknown | null;
  syncState: SyncState;
  retryingProfileSync: boolean;
  language: string;
  getUserProfile: () => Promise<UserData | null>;
  fetchUserFromCloud: () => Promise<UserData | null>;
  updateUserProfile: (patch: Partial<UserData>) => Promise<void>;
  applyServerProfile: (profile: UserData) => Promise<UserData | null>;
  syncUserProfile: () => Promise<void>;
  retryProfileSync: () => Promise<void>;
  mirrorProfileLocally: (patch: Partial<UserData>) => Promise<void>;
  refreshProfileSyncState: () => Promise<void>;
  pushPendingChanges: () => Promise<void>;
  setUserData: Dispatch<SetStateAction<UserData | null>>;
};

export function useUserProfile(uid: string): UseUserProfileResult {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileBootstrapState, setProfileBootstrapState] =
    useState<UserProfileBootstrapState>("profileLoading");
  const [profileBootstrapError, setProfileBootstrapError] =
    useState<unknown | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [retryingProfileSync, setRetryingProfileSync] = useState(false);
  const language = normalizeLanguageCode(
    userData?.profile?.language ?? i18n.resolvedLanguage ?? i18n.language,
  );
  const userDataRef = useRef<UserData | null>(null);
  const mountedRef = useRef(true);
  const latestUidRef = useRef(uid);
  const bootstrapRunIdRef = useRef(0);

  useEffect(() => {
    latestUidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      bootstrapRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setSyncState("synced");
    }
  }, [uid]);

  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  const applyProfileData = useCallback(
    async (
      profile: UserData | null,
      options?: {
        emitChange?: boolean;
        writeCache?: boolean;
        completeBootstrap?: boolean;
        bootstrapState?: UserProfileBootstrapState;
        isCurrent?: CurrentGuard;
      },
    ): Promise<UserData | null> => {
      if (!uid) return null;
      const isCurrent =
        options?.isCurrent ??
        (() => mountedRef.current && latestUidRef.current === uid);
      if (!isCurrent()) return null;
      const completeBootstrap = options?.completeBootstrap !== false;

      if (!profile) {
        setUserData(null);
        userDataRef.current = null;
        if (completeBootstrap) {
          setLoading(false);
          setProfileBootstrapState(
            options?.bootstrapState ?? "profileMissing",
          );
          setProfileBootstrapError(null);
        }
        if (options?.emitChange) {
          emitUserProfileChanged(uid, null);
        }
        return null;
      }

      const currentAvatarLocalPath =
        userDataRef.current?.uid === uid
          ? userDataRef.current.avatarLocalPath
          : undefined;
      const avatarLocalPath = await resolveExistingAvatarPath(
        profile.avatarLocalPath,
        currentAvatarLocalPath,
        avatarCachePath(uid)
      );
      if (!isCurrent()) return null;
      const normalizedProfile = parseUserProfile(profile.profile);
      const normalizedLanguage = normalizeLanguageCode(normalizedProfile.language);
      const normalized = {
        ...profile,
        profile: {
          ...normalizedProfile,
          language: normalizedLanguage,
        },
        avatarLocalPath,
      };
      setUserData(normalized);
      userDataRef.current = normalized;
      if (
        normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language) !==
        normalizedLanguage
      ) {
        i18n.changeLanguage(normalizedLanguage).catch((error) => {
          logWarning("language sync failed", null, error);
        });
      }
      if (completeBootstrap) {
        setLoading(false);
        setProfileBootstrapState(options?.bootstrapState ?? "profileReady");
        setProfileBootstrapError(null);
      }
      if (
        options?.writeCache ||
        (profile.avatarLocalPath || "") !== avatarLocalPath
      ) {
        void writeProfileCache(uid, normalized);
      }
      if (options?.emitChange) {
        emitUserProfileChanged(uid, normalized);
      }
      return normalized;
    },
    [uid],
  );

  const refreshProfileSyncState = useCallback(async () => {
    if (!uid) {
      setSyncState("synced");
      return;
    }
    try {
      const { dead, pending } = await getSyncCounts(uid, {
        kinds: PROFILE_SYNC_KINDS,
      });
      setSyncState(dead > 0 ? "conflict" : pending > 0 ? "pending" : "synced");
    } catch (error) {
      logWarning("profile sync state refresh failed", null, error);
    }
  }, [uid]);

  const fetchUserFromCloud = useCallback(async (options?: { isCurrent?: CurrentGuard }) => {
    if (!uid) return null;
    const requestUid = uid;
    const isCurrent =
      options?.isCurrent ??
      (() => mountedRef.current && latestUidRef.current === requestUid);
    if (!isCurrent()) return null;

    const readCached = async () => {
      try {
        const parsed = await readProfileCache(requestUid);
        if (!isCurrent()) return null;
        if (!parsed) return null;
        const currentAvatarLocalPath =
          userDataRef.current?.uid === requestUid
            ? userDataRef.current.avatarLocalPath
            : undefined;
        const avatarLocalPath = await resolveExistingAvatarPath(
          parsed.avatarLocalPath,
          currentAvatarLocalPath,
          avatarCachePath(requestUid)
        );
        if (!isCurrent()) return null;
        const normalized = { ...parsed, avatarLocalPath };
        setUserData(normalized);
        userDataRef.current = normalized;
        if ((parsed.avatarLocalPath || "") !== avatarLocalPath) {
          void writeProfileCache(requestUid, normalized);
        }
        return normalized;
      } catch (error) {
        if (!isCurrent()) return null;
        logWarning("profile cache fallback read failed", null, error);
        return null;
      }
    };

    const net = await NetInfo.fetch();
    if (!isCurrent()) return null;
    if (isOfflineNetState(net)) {
      const cached = (await readCached()) || userDataRef.current;
      if (!isCurrent()) return null;
      if (cached) {
        setLoading(false);
        setProfileBootstrapState("offlineCached");
        setProfileBootstrapError(null);
      } else {
        setLoading(false);
        setProfileBootstrapState("bootstrapFailed");
        setProfileBootstrapError(null);
      }
      return cached;
    }
    try {
      const data = await fetchUserProfileRemote(requestUid);
      if (!isCurrent()) return null;
      const profile = normalizeBootstrapProfile(requestUid, data);
      if (data && !profile) {
        logWarning("remote profile invalid for bootstrap", { uid: requestUid });
      }
      return applyProfileData(profile, {
        emitChange: true,
        writeCache: !!profile,
        bootstrapState: profile ? "profileReady" : "profileMissing",
        isCurrent,
      });
    } catch (error) {
      if (!isCurrent()) return null;
      const errorContext = profileBootstrapErrorContext(requestUid, error);
      logWarning("user profile remote fetch failed", errorContext, error);
      const cached = (await readCached()) || userDataRef.current;
      if (!isCurrent()) return null;
      if (cached) {
        setLoading(false);
        setProfileBootstrapState("offlineCached");
        setProfileBootstrapError(error);
      } else {
        captureException("user_profile_bootstrap_failed", errorContext, error);
        setLoading(false);
        setProfileBootstrapState("bootstrapFailed");
        setProfileBootstrapError(error);
      }
      return cached;
    }
  }, [applyProfileData, uid]);

  const getUserProfile = useCallback(async () => {
    return userData;
  }, [userData]);

  const pushPendingChanges = useCallback(async () => {
    setSyncState("pending");
    const net = await NetInfo.fetch();
    if (isOfflineNetState(net)) return;
    await requestSync({
      uid,
      domain: "userProfile",
      reason: "local-change",
      pullAfterPush: false,
    });
    await refreshProfileSyncState();
  }, [uid, refreshProfileSyncState]);

  const updateUserProfile = useCallback(
    async (patch: Partial<UserData>) => {
      if (!uid) return;
      const localPatch = sanitizeUserProfileLocalPatch(patch);
      const payload = sanitizeUserProfilePatch(patch);
      assertNoUndefined(payload, "updateUserProfile payload");

      setUserData((prev) =>
        prev ? { ...prev, ...localPatch } : ({ uid, ...localPatch } as UserData)
      );
      if (localPatch.profile?.language) {
        const nextLanguage = normalizeLanguageCode(localPatch.profile.language);
        i18n.changeLanguage(nextLanguage).catch((error) => {
          logWarning("language change failed", null, error);
        });
      }

      await mergeProfileCache(uid, localPatch as Record<string, unknown>);

      if (Object.keys(payload).length === 0) return;
      await enqueueUserProfileUpdate(uid, payload, {
        updatedAt: new Date().toISOString(),
      });
      await pushPendingChanges();
    },
    [uid, pushPendingChanges]
  );

  const applyServerProfile = useCallback(
    async (profile: UserData) => {
      return applyProfileData(profile, {
        emitChange: true,
        writeCache: true,
        bootstrapState: "profileReady",
      });
    },
    [applyProfileData],
  );

  const mirrorProfileLocally = useCallback(
    async (patch: Partial<UserData>) => {
      if (!uid) return;
      setUserData((prev) =>
        prev ? { ...prev, ...patch } : ({ uid, ...patch } as UserData)
      );
      await mergeProfileCache(uid, patch as Record<string, unknown>);
    },
    [uid]
  );

  const retryProfileSync = useCallback(async () => {
    if (!uid || retryingProfileSync) return;
    setRetryingProfileSync(true);
    try {
      const retried = await retryDeadLetterOps({
        uid,
        kinds: PROFILE_SYNC_KINDS,
      });
      if (retried > 0) {
        setSyncState("pending");
      }
      const net = await NetInfo.fetch();
      if (retried > 0 && !isOfflineNetState(net)) {
        await requestSync({
          uid,
          domain: "userProfile",
          reason: "retry",
          pullAfterPush: false,
        });
      }
      await refreshProfileSyncState();
    } catch (error) {
      logError("profile sync retry failed", null, error);
      emit("ui:toast", {
        text: i18n.t("common:unknownError"),
      });
    } finally {
      setRetryingProfileSync(false);
    }
  }, [retryingProfileSync, uid, refreshProfileSyncState]);

  const syncUserProfile = useCallback(async () => {
    await fetchUserFromCloud();
  }, [fetchUserFromCloud]);

  useEffect(() => {
    let cancelled = false;
    const runId = ++bootstrapRunIdRef.current;
    const isCurrent = () =>
      !cancelled &&
      mountedRef.current &&
      latestUidRef.current === uid &&
      bootstrapRunIdRef.current === runId;

    if (!uid) {
      setUserData(null);
      setLoading(false);
      setProfileBootstrapState("profileMissing");
      setProfileBootstrapError(null);
      return;
    }
    setLoading(true);
    setProfileBootstrapState("profileLoading");
    setProfileBootstrapError(null);

    const unsub = subscribeToUserProfile({
      uid,
      onData: (data) => {
        if (!isCurrent()) return;
        void applyProfileData(data, { writeCache: !!data, isCurrent });
      },
    });

    void (async () => {
      try {
        const parsed = await readProfileCache(uid);
        if (parsed) {
          if (!isCurrent()) return;
          await applyProfileData(parsed, {
            completeBootstrap: false,
            isCurrent,
          });
        }
      } catch (error) {
        if (!isCurrent()) return;
        logWarning("profile cache hydration failed", null, error);
      }

      if (!isCurrent()) return;
      await fetchUserFromCloud({ isCurrent });
    })();

    return () => {
      cancelled = true;
      bootstrapRunIdRef.current += 1;
      unsub();
    };
  }, [applyProfileData, fetchUserFromCloud, uid]);

  useEffect(() => {
    void refreshProfileSyncState();
  }, [refreshProfileSyncState]);

  useEffect(() => {
    if (!uid) return;
    const handler = (payload: { uid?: string } | undefined) => {
      if (!payload || payload.uid !== uid) return;
      void refreshProfileSyncState();
    };
    const unsubs = ([
      "user:profile:synced",
      "user:profile:failed",
      "user:avatar:failed",
      "sync:op:retried",
    ] as const).map((event) => on<{ uid?: string }>(event, handler));
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [uid, refreshProfileSyncState]);

  return useMemo(
    () => ({
      userData,
      loading,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      retryingProfileSync,
      language,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
      mirrorProfileLocally,
      refreshProfileSyncState,
      pushPendingChanges,
      setUserData,
    }),
    [
      userData,
      loading,
      profileBootstrapState,
      profileBootstrapError,
      syncState,
      retryingProfileSync,
      language,
      getUserProfile,
      fetchUserFromCloud,
      updateUserProfile,
      applyServerProfile,
      syncUserProfile,
      retryProfileSync,
      mirrorProfileLocally,
      refreshProfileSyncState,
      pushPendingChanges,
      setUserData,
    ]
  );
}
