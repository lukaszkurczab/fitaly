import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getApp } from "@react-native-firebase/app";
import {
  getAuth,
  onIdTokenChanged,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import * as Sentry from "@sentry/react-native";
import { resetUserRuntime } from "@/services/session/resetUserRuntime";
import { setTelemetryUserId } from "@/services/telemetry/telemetryClient";
import { isE2EModeEnabled } from "@/services/e2e/config";
import {
  hydrateE2EAuthSession,
  subscribeE2EAuthSession,
  type E2EAuthSession,
} from "@/services/e2e/authSession";

export type AuthContextUser = Pick<FirebaseAuthTypes.User, "uid" | "email">;

type AuthContextType = {
  firebaseUser: AuthContextUser | null;
  uid: string | null;
  email: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  uid: null,
  email: null,
  isAuthenticated: false,
  authLoading: true,
  loading: true,
});

function userFromE2ESession(session: E2EAuthSession): AuthContextUser {
  return {
    uid: session.uid,
    email: session.email,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setAuthStateUser] =
    useState<AuthContextUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUidRef = useRef<string | null>(null);
  const e2eSessionRef = useRef<AuthContextUser | null>(null);
  const e2eSessionVersionRef = useRef(0);

  useEffect(() => {
    const app = getApp();
    const auth = getAuth(app);
    let active = true;
    let authStateVersion = 0;

    const unsub = onIdTokenChanged(auth, (user) => {
      const version = ++authStateVersion;
      const e2eSessionVersion = e2eSessionVersionRef.current;
      const previousUid = lastUidRef.current;
      const nextUser = e2eSessionRef.current ?? user;
      const nextUid = nextUser?.uid ?? null;

      const applyAuthState = () => {
        lastUidRef.current = nextUid;
        setTelemetryUserId(nextUid);
        setAuthStateUser(nextUser);
        if (nextUser) {
          Sentry.setUser({ id: nextUser.uid });
        } else {
          Sentry.setUser(null);
        }
        setLoading(false);
      };

      const handleAuthState = async () => {
        if (e2eSessionVersion !== e2eSessionVersionRef.current) return;

        if (previousUid && nextUid && previousUid !== nextUid) {
          setLoading(true);
          await resetUserRuntime(previousUid, { reason: "account_switch" });
        }

        if (previousUid && !nextUid) {
          setLoading(true);
          await resetUserRuntime(previousUid, { reason: "session_lost" });
        }

        if (
          !active ||
          version !== authStateVersion ||
          e2eSessionVersion !== e2eSessionVersionRef.current
        ) {
          return;
        }
        applyAuthState();
      };

      void handleAuthState();
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!isE2EModeEnabled()) return;
    let active = true;

    const applyE2ESession = (session: E2EAuthSession | null) => {
      if (!active) return;
      e2eSessionVersionRef.current += 1;
      const nextUser = session ? userFromE2ESession(session) : null;
      e2eSessionRef.current = nextUser;
      const nextUid = nextUser?.uid ?? null;
      lastUidRef.current = nextUid;
      setTelemetryUserId(nextUid);
      setAuthStateUser(nextUser);
      if (nextUser) {
        Sentry.setUser({ id: nextUser.uid });
      } else {
        Sentry.setUser(null);
      }
      setLoading(false);
    };

    void hydrateE2EAuthSession().then((session) => {
      if (session) {
        applyE2ESession(session);
      }
    });
    const unsubscribe = subscribeE2EAuthSession(applyE2ESession);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const uid = firebaseUser?.uid ?? null;
    const email = firebaseUser?.email ?? null;
    return {
      firebaseUser,
      uid,
      email,
      isAuthenticated: !!uid,
      authLoading: loading,
      loading,
    };
  }, [firebaseUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
