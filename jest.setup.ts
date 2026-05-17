const ONLINE_STATE = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: null,
};

jest.mock("expo-sqlite", () => {
  const db = {
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => undefined),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(() => ({
        getAllSync: () => [],
        getFirstSync: () => undefined,
      })),
      finalizeSync: jest.fn(),
    })),
    closeSync: jest.fn(),
  };

  return {
    __esModule: true,
    openDatabaseSync: jest.fn(() => db),
  };
});

jest.mock("expo-image-manipulator", () => ({
  __esModule: true,
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
}));

jest.mock("expo-file-system", () => ({
  __esModule: true,
  documentDirectory: "file:///mock-documents/",
  cacheDirectory: "file:///mock-cache/",
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async () => ({ uri: "file:///mock-download.jpg" })),
}));

jest.mock("expo-print", () => ({
  __esModule: true,
  printToFileAsync: jest.fn(async () => ({ uri: "file:///mock-export.pdf" })),
}));

jest.mock("expo-sharing", () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("@/services/core/fileSystem", () => ({
  __esModule: true,
  documentDirectory: "file:///mock-documents/",
  cacheDirectory: "file:///mock-cache/",
  EncodingType: {
    UTF8: "utf8",
    Base64: "base64",
  },
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  moveAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async () => ({ uri: "file:///mock-download.jpg" })),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(async () => ({ uri: "file:///mock-download.jpg", status: 200 })),
    pauseAsync: jest.fn(async () => undefined),
  })),
  StorageAccessFramework: null,
  readAsStringAsync: jest.fn(async () => ""),
}));

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  getApp: jest.fn(() => ({ name: "mock-app" })),
}));

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    appOwnership: "standalone",
    executionEnvironment: "standalone",
    expoConfig: { extra: {} },
    manifest: { extra: {} },
  },
}));

jest.mock("expo-device", () => ({
  __esModule: true,
  isDevice: true,
}));

jest.mock("expo-splash-screen", () => ({
  __esModule: true,
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-localization", () => ({
  __esModule: true,
  getLocales: jest.fn(() => [{ languageTag: "en-US" }]),
}));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  AndroidImportance: { HIGH: "high" },
  AndroidNotificationVisibility: { PUBLIC: "public" },
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    DAILY: "daily",
    DATE: "date",
  },
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getNotificationChannelAsync: jest.fn(async () => ({ id: "default" })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted" })),
  scheduleNotificationAsync: jest.fn(async () => "mock-notification-id"),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

jest.mock("@sentry/react-native", () => ({
  __esModule: true,
  init: jest.fn(),
  wrap: jest.fn((Component: unknown) => Component),
  setUser: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

jest.mock("@react-native-community/netinfo", () => {
  const fetch = jest.fn(async () => ONLINE_STATE);
  const addEventListener = jest.fn(() => jest.fn());
  const useNetInfo = jest.fn(() => ONLINE_STATE);

  return {
    __esModule: true,
    default: {
      fetch,
      addEventListener,
      configure: jest.fn(),
      useNetInfo,
    },
    fetch,
    addEventListener,
    configure: jest.fn(),
    useNetInfo,
    NetInfoStateType: {
      none: "none",
      unknown: "unknown",
      cellular: "cellular",
      wifi: "wifi",
      bluetooth: "bluetooth",
      ethernet: "ethernet",
      wimax: "wimax",
      vpn: "vpn",
      other: "other",
    },
  };
});
