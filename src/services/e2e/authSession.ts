import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createUserWithEmailAndPassword,
  getIdToken,
  signInWithEmailAndPassword,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { getFirebaseAuth } from "@/FirebaseConfig";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";
import { isE2EModeEnabled, buildE2EProfileSeed } from "@/services/e2e/config";
import {
  getE2EAuthToken as readE2EAuthToken,
  setE2EAuthToken,
} from "@/services/e2e/authToken";
import { emit, on } from "@/services/core/events";
import { writeProfileCache } from "@/services/user/profileCache";

export type E2EAuthSession = {
  uid: string;
  email: string;
  idToken?: string;
};

type FirebaseEmulatorAuthSession = {
  user: FirebaseAuthTypes.User;
  idToken: string;
};

const E2E_AUTH_SESSION_EVENT = "e2e:auth:session";
const E2E_AUTH_SESSION_STORAGE_KEY = "e2e:auth:session";
const DEFAULT_E2E_AUTH_PASSWORD = "Test@1234";
const E2E_PROFILE_CHANGED_EVENT = "user:profile:changed";

let currentSession: E2EAuthSession | null = null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uidForEmail(email: string): string {
  const slug = normalizeEmail(email)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `e2e-${slug || "user"}`;
}

function parseStoredSession(value: string | null): E2EAuthSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<E2EAuthSession>;
    const uid = parsed.uid?.trim() ?? "";
    const email = normalizeEmail(parsed.email ?? "");
    const idToken =
      typeof parsed.idToken === "string" && parsed.idToken.trim()
        ? parsed.idToken.trim()
        : undefined;
    if (!uid || !email) return null;
    return { uid, email, ...(idToken ? { idToken } : {}) };
  } catch {
    return null;
  }
}

function shouldUseFirebaseAuthEmulator(): boolean {
  return Boolean(getRuntimeConfig().firebaseAuthEmulatorHost.trim());
}

function isMissingFirebaseUserError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  const code = String((error as { code?: unknown }).code || "")
    .trim()
    .toLowerCase();
  return code === "auth/user-not-found";
}

async function signInOrCreateFirebaseEmulatorUser(
  email: string,
  password: string,
): Promise<FirebaseEmulatorAuthSession> {
  const auth = await getFirebaseAuth();

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await getIdToken(credential.user, true);
    return { user: credential.user, idToken };
  } catch (error) {
    if (!isMissingFirebaseUserError(error)) {
      throw error;
    }
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await getIdToken(credential.user, true);
  return { user: credential.user, idToken };
}

async function persistE2EAuthSession(session: E2EAuthSession): Promise<void> {
  const profile = buildE2EProfileSeed(session.uid, session.email);
  await AsyncStorage.setItem(
    E2E_AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
  await writeProfileCache(session.uid, profile);
  setE2EAuthToken(session.idToken ?? null);
  emit(E2E_PROFILE_CHANGED_EVENT, { uid: session.uid, data: profile });
  currentSession = session;
}

function publishE2EAuthSession(session: E2EAuthSession | null): void {
  currentSession = session;
  emit<E2EAuthSession | null>(E2E_AUTH_SESSION_EVENT, session);
}

export function getE2EAuthSession(): E2EAuthSession | null {
  if (!isE2EModeEnabled()) return null;
  return currentSession;
}

export function getE2EAuthToken(): string | null {
  return readE2EAuthToken();
}

export function subscribeE2EAuthSession(
  handler: (session: E2EAuthSession | null) => void,
): () => void {
  if (!isE2EModeEnabled()) return () => {};
  return on<E2EAuthSession | null>(E2E_AUTH_SESSION_EVENT, (session) => {
    handler(session ?? null);
  });
}

export async function hydrateE2EAuthSession(): Promise<E2EAuthSession | null> {
  if (!isE2EModeEnabled()) return null;
  const session = parseStoredSession(
    await AsyncStorage.getItem(E2E_AUTH_SESSION_STORAGE_KEY),
  );
  if (!session) return null;
  await persistE2EAuthSession(session);
  publishE2EAuthSession(session);
  return session;
}

export async function establishE2EAuthSession(
  email: string,
  password = DEFAULT_E2E_AUTH_PASSWORD,
): Promise<E2EAuthSession> {
  if (!isE2EModeEnabled()) {
    throw Object.assign(new Error("E2E auth session is disabled"), {
      code: "e2e/auth-session-disabled",
    });
  }
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw Object.assign(new Error("E2E auth email is required"), {
      code: "e2e/auth-email-required",
    });
  }
  const firebaseSession = shouldUseFirebaseAuthEmulator()
    ? await signInOrCreateFirebaseEmulatorUser(
        normalizedEmail,
        password || DEFAULT_E2E_AUTH_PASSWORD,
      )
    : null;
  const session = {
    uid: firebaseSession?.user.uid ?? uidForEmail(normalizedEmail),
    email: normalizedEmail,
    ...(firebaseSession?.idToken ? { idToken: firebaseSession.idToken } : {}),
  };
  await persistE2EAuthSession(session);
  publishE2EAuthSession(session);
  return session;
}

export async function restoreE2EAuthSession(
  session: E2EAuthSession,
): Promise<void> {
  if (!isE2EModeEnabled()) return;
  await persistE2EAuthSession(session);
  publishE2EAuthSession(session);
}

export async function clearE2EAuthSession(): Promise<void> {
  if (!isE2EModeEnabled()) return;
  currentSession = null;
  setE2EAuthToken(null);
  await AsyncStorage.removeItem(E2E_AUTH_SESSION_STORAGE_KEY);
  publishE2EAuthSession(null);
}
