import { initializeApp, getApp, getApps } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { connectAuthEmulator } from "@react-native-firebase/auth/lib/modular";
import { getRuntimeConfig } from "@/services/core/runtimeConfig";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyAMx2jGfr3mslwuu7PXwRry8M72794NMek",
  authDomain: "calories-calculator-ai.firebaseapp.com",
  projectId: "calories-calculator-ai",
  storageBucket: "calories-calculator-ai.appspot.com",
  messagingSenderId: "516060318021",
  appId: "1:516060318021:web:f2413698c906624376d62c",
  measurementId: "G-QNQBTJVFEW",
};

type FirebaseApp = ReturnType<typeof getApp>;

let appPromise: Promise<FirebaseApp>;
let authEmulatorConfigured = false;

function resolveFirebaseConfig(): typeof defaultFirebaseConfig {
  const firebaseProjectId = getRuntimeConfig().firebaseProjectId;
  if (!firebaseProjectId) {
    return defaultFirebaseConfig;
  }

  return {
    ...defaultFirebaseConfig,
    authDomain: `${firebaseProjectId}.firebaseapp.com`,
    projectId: firebaseProjectId,
    storageBucket: `${firebaseProjectId}.appspot.com`,
  };
}

if (!getApps().length) {
  appPromise = initializeApp(resolveFirebaseConfig());
} else {
  appPromise = Promise.resolve(getApp());
}

export const getFirebaseApp = () => appPromise;

function normalizeAuthEmulatorUrl(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

void appPromise.then((app) => {
  const emulatorUrl = normalizeAuthEmulatorUrl(
    getRuntimeConfig().firebaseAuthEmulatorHost,
  );
  if (!emulatorUrl || authEmulatorConfigured) return;
  authEmulatorConfigured = true;
  connectAuthEmulator(getAuth(app), emulatorUrl, { disableWarnings: true });
});

export const getFirebaseAuth = async () => {
  const app = await appPromise;
  return getAuth(app);
};
