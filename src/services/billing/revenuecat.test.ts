import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockConfigure = jest.fn();
const mockLogIn = jest.fn();
const mockLogOut = jest.fn();
const mockSetLogLevel = jest.fn();

function mockRevenueCatRuntime() {
  jest.doMock("react-native-purchases", () => ({
    __esModule: true,
    LOG_LEVEL: { DEBUG: "debug", ERROR: "error" },
    default: {
      configure: mockConfigure,
      logIn: mockLogIn,
      logOut: mockLogOut,
      setLogLevel: mockSetLogLevel,
    },
  }));
  jest.doMock("@/services/core/runtimeConfig", () => ({
    getRuntimeConfig: () => ({
      billingDisabled: false,
      buildProfile: "test",
      revenuecatIosKey: "ios_key",
      revenuecatAndroidKey: "android_key",
    }),
  }));
  jest.doMock("@/services/core/errorLogger", () => ({
    logWarning: jest.fn(),
  }));
}

describe("revenuecat billing identity", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockConfigure.mockReturnValue(undefined);
    mockLogIn.mockResolvedValue({} as never);
    mockLogOut.mockResolvedValue(undefined as never);
  });

  it("does not configure RevenueCat anonymously before uid is available", async () => {
    mockRevenueCatRuntime();
    const { initRevenueCat, isRevenueCatConfigured } = jest.requireActual<{
      initRevenueCat: (uid?: string | null) => void;
      isRevenueCatConfigured: () => boolean;
    }>("@/services/billing/revenuecat");

    initRevenueCat();

    expect(mockConfigure).not.toHaveBeenCalled();
    expect(isRevenueCatConfigured()).toBe(false);
  });

  it("configures RevenueCat directly with the authenticated uid", async () => {
    mockRevenueCatRuntime();
    const { rcLogIn, isRevenueCatConfigured } = jest.requireActual<{
      rcLogIn: (uid: string) => Promise<boolean>;
      isRevenueCatConfigured: () => boolean;
    }>("@/services/billing/revenuecat");

    const loggedIn = await rcLogIn(" user-1 ");

    expect(loggedIn).toBe(true);
    expect(isRevenueCatConfigured()).toBe(true);
    expect(mockConfigure).toHaveBeenCalledWith({
      apiKey: "ios_key",
      appUserID: "user-1",
    });
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("does not call RevenueCat logOut because it creates a new anonymous user", async () => {
    mockRevenueCatRuntime();
    const { rcLogOut } = jest.requireActual<{
      rcLogOut: () => Promise<void>;
    }>("@/services/billing/revenuecat");

    await rcLogOut();

    expect(mockLogOut).not.toHaveBeenCalled();
    expect(mockConfigure).not.toHaveBeenCalled();
  });
});
