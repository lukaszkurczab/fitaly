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

type AuthContextType = {
  firebaseUser: FirebaseAuthTypes.User | null;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setAuthStateUser] =
    useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => {
    const app = getApp();
    const auth = getAuth(app);
    let active = true;
    let authStateVersion = 0;

    const unsub = onIdTokenChanged(auth, (user) => {
      const version = ++authStateVersion;
      const previousUid = lastUidRef.current;
      const nextUid = user?.uid ?? null;

      const applyAuthState = () => {
        lastUidRef.current = nextUid;
        setTelemetryUserId(nextUid);
        setAuthStateUser(user);
        if (user) {
          Sentry.setUser({ id: user.uid });
        } else {
          Sentry.setUser(null);
        }
        setLoading(false);
      };

      const handleAuthState = async () => {
        if (previousUid && nextUid && previousUid !== nextUid) {
          setLoading(true);
          await resetUserRuntime(previousUid, { reason: "account_switch" });
        }

        if (previousUid && !nextUid) {
          setLoading(true);
          await resetUserRuntime(previousUid, { reason: "session_lost" });
        }

        if (!active || version !== authStateVersion) return;
        applyAuthState();
      };

      void handleAuthState();
    });
    return () => {
      active = false;
      unsub();
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
