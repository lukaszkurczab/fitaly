import { act, render } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

type AuthUser = { uid: string; email: string | null };
type AuthStateCallback = (user: AuthUser | null) => void;

let authStateCallback: AuthStateCallback | null = null;

const mockResetUserRuntime = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockSetTelemetryUserId = jest.fn<(uid: string | null) => void>();
const mockSentrySetUser = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({ name: "app" })),
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: jest.fn(() => ({ app: "auth" })),
  onAuthStateChanged: (_auth: unknown, callback: AuthStateCallback) => {
    authStateCallback = callback;
    return mockUnsubscribe;
  },
}));

jest.mock("@sentry/react-native", () => ({
  setUser: (...args: unknown[]) => mockSentrySetUser(...args),
}));

jest.mock("@/services/session/resetUserRuntime", () => ({
  resetUserRuntime: (...args: unknown[]) => mockResetUserRuntime(...args),
}));

jest.mock("@/services/telemetry/telemetryClient", () => ({
  setTelemetryUserId: (uid: string | null) => mockSetTelemetryUserId(uid),
}));

function Probe({ onRender }: { onRender: (uid: string | null) => void }) {
  const { uid } = useAuthContext();
  onRender(uid);
  return <Text testID="uid">{uid ?? "none"}</Text>;
}

function lastRenderedUid(renderedUids: Array<string | null>): string | null {
  return renderedUids[renderedUids.length - 1] ?? null;
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
    mockResetUserRuntime.mockResolvedValue(undefined);
  });

  it("resets previous user runtime before publishing switched account", async () => {
    const renderedUids: Array<string | null> = [];
    render(
      <AuthProvider>
        <Probe onRender={(uid) => renderedUids.push(uid)} />
      </AuthProvider>,
    );

    await act(async () => {
      authStateCallback?.({ uid: "user-a", email: "a@example.com" });
      await Promise.resolve();
    });

    expect(lastRenderedUid(renderedUids)).toBe("user-a");

    let resolveReset: (() => void) | null = null;
    const resetPromise = new Promise<void>((resolve) => {
      resolveReset = resolve;
    });
    mockResetUserRuntime.mockReturnValueOnce(resetPromise);

    await act(async () => {
      authStateCallback?.({ uid: "user-b", email: "b@example.com" });
      await Promise.resolve();
    });

    expect(mockResetUserRuntime).toHaveBeenCalledWith("user-a", {
      reason: "account_switch",
    });
    expect(lastRenderedUid(renderedUids)).toBe("user-a");

    await act(async () => {
      resolveReset?.();
      await resetPromise;
      await Promise.resolve();
    });

    expect(lastRenderedUid(renderedUids)).toBe("user-b");
    expect(mockSentrySetUser).toHaveBeenLastCalledWith({ id: "user-b" });
    expect(mockSetTelemetryUserId).toHaveBeenLastCalledWith("user-b");
  });

  it("resets previous user runtime when native auth session is lost", async () => {
    const renderedUids: Array<string | null> = [];
    render(
      <AuthProvider>
        <Probe onRender={(uid) => renderedUids.push(uid)} />
      </AuthProvider>,
    );

    await act(async () => {
      authStateCallback?.({ uid: "user-a", email: "a@example.com" });
      await Promise.resolve();
    });

    expect(lastRenderedUid(renderedUids)).toBe("user-a");

    await act(async () => {
      authStateCallback?.(null);
      await Promise.resolve();
    });

    expect(mockResetUserRuntime).toHaveBeenCalledWith("user-a", {
      reason: "session_lost",
    });
    expect(lastRenderedUid(renderedUids)).toBeNull();
    expect(mockSentrySetUser).toHaveBeenLastCalledWith(null);
    expect(mockSetTelemetryUserId).toHaveBeenLastCalledWith(null);
  });
});
