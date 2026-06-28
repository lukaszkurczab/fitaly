import { AppState } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { NetInfoState } from "@react-native-community/netinfo";
import {
  CONNECTIVITY_MONITOR_POLL_MS,
  useMonitoredNetInfo,
} from "@/services/core/connectivityMonitor";

const mockUseNetInfo = jest.fn<NetInfoState, []>();
const mockRefresh = jest.fn<Promise<NetInfoState>, []>();
const mockConnectivityListeners = new Set<(forcedOffline: boolean) => void>();
let mockForcedOffline = false;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  NetInfoStateType: {
    none: "none",
  },
  default: {
    refresh: () => mockRefresh(),
  },
  useNetInfo: () => mockUseNetInfo(),
}));

jest.mock("@/services/e2e/connectivityOverride", () => ({
  isE2EForcedOffline: () => mockForcedOffline,
  subscribeE2EConnectivityOverride: (
    listener: (forcedOffline: boolean) => void,
  ) => {
    mockConnectivityListeners.add(listener);
    return () => {
      mockConnectivityListeners.delete(listener);
    };
  },
}));

const offlineState = {
  type: "none",
  isConnected: false,
  isInternetReachable: false,
  details: null,
} as unknown as NetInfoState;

const onlineState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: null,
} as unknown as NetInfoState;

describe("useMonitoredNetInfo", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockUseNetInfo.mockReset();
    mockRefresh.mockReset();
    mockForcedOffline = false;
    mockConnectivityListeners.clear();
  });

  it("updates connectivity from periodic refresh when NetInfo listener stays stale", async () => {
    jest.useFakeTimers();
    const appStateRemove = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: appStateRemove } as never);
    mockUseNetInfo.mockReturnValue(offlineState);
    mockRefresh.mockResolvedValueOnce(offlineState);

    const { result, unmount } = renderHook(() => useMonitoredNetInfo());

    expect(result.current.isConnected).toBe(false);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    mockRefresh.mockResolvedValueOnce(onlineState);
    await act(async () => {
      jest.advanceTimersByTime(CONNECTIVITY_MONITOR_POLL_MS);
      await Promise.resolve();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);

    unmount();
    expect(appStateRemove).toHaveBeenCalledTimes(1);
  });

  it("applies the E2E forced-offline override to monitored state", async () => {
    jest.useFakeTimers();
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as never);
    mockUseNetInfo.mockReturnValue(onlineState);
    mockRefresh.mockResolvedValue(onlineState);

    const { result, unmount } = renderHook(() => useMonitoredNetInfo());

    expect(result.current.isConnected).toBe(true);

    act(() => {
      mockForcedOffline = true;
      for (const listener of mockConnectivityListeners) {
        listener(true);
      }
    });

    expect(result.current.type).toBe("none");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);

    act(() => {
      mockForcedOffline = false;
      for (const listener of mockConnectivityListeners) {
        listener(false);
      }
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);

    unmount();
  });
});
