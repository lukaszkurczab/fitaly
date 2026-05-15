import { AppState } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { NetInfoState } from "@react-native-community/netinfo";
import {
  CONNECTIVITY_MONITOR_POLL_MS,
  useMonitoredNetInfo,
} from "@/services/core/connectivityMonitor";

const mockUseNetInfo = jest.fn<NetInfoState, []>();
const mockRefresh = jest.fn<Promise<NetInfoState>, []>();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    refresh: () => mockRefresh(),
  },
  useNetInfo: () => mockUseNetInfo(),
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
});
