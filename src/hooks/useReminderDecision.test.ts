import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReminderDecisionResult } from "@/services/reminders/reminderTypes";
import { useReminderDecision } from "@/hooks/useReminderDecision";

const mockGetReminderDecision = jest.fn<
  (
    uid: string | null | undefined,
    options?: { dayKey?: string | null; productReady?: boolean },
  ) => Promise<ReminderDecisionResult>
>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

jest.mock("@/services/reminders/reminderService", () => {
  return {
    getCurrentReminderDecisionDayKey: () => "2026-03-18",
    getReminderDecision: (
      uid: string | null | undefined,
      options?: { dayKey?: string | null; productReady?: boolean },
    ) => mockGetReminderDecision(uid, options),
  };
});

jest.mock("@/hooks/useProductReadiness", () => ({
  useIsProductReady: () => true,
}));

describe("useReminderDecision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads reminder decision for the requested uid and day", async () => {
    mockGetReminderDecision.mockResolvedValue({
      decision: {
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T12:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: [
          "preferred_window_today",
          "day_partially_logged",
        ],
        scheduledAtUtc: "2026-03-18T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-18T19:30:00Z",
      },
      source: "remote",
      status: "live_success",
      enabled: true,
      error: null,
    });

    const { result } = renderHook(() =>
      useReminderDecision({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetReminderDecision).toHaveBeenCalledWith("user-1", {
      dayKey: "2026-03-18",
      productReady: true,
    });
    expect(result.current.decision?.kind).toBe("log_next_meal");
    expect(result.current.source).toBe("remote");
    expect(result.current.status).toBe("live_success");
    expect(result.current.enabled).toBe(true);
  });

  it("returns a stable fallback when uid is missing and skips the service", async () => {
    const { result } = renderHook(() => useReminderDecision({ uid: null }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetReminderDecision).not.toHaveBeenCalled();
    expect(result.current.decision).toBeNull();
    expect(result.current.source).toBe("fallback");
    expect(result.current.status).toBe("no_user");
  });

  it("exposes fallback state when reminder endpoint is unavailable", async () => {
    mockGetReminderDecision.mockResolvedValue({
      decision: null,
      source: "fallback",
      status: "service_unavailable",
      enabled: true,
      error: new Error("backend down"),
    });

    const { result } = renderHook(() =>
      useReminderDecision({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.decision).toBeNull();
    expect(result.current.enabled).toBe(true);
    expect(result.current.source).toBe("fallback");
    expect(result.current.status).toBe("service_unavailable");
  });

  it("supports explicit refresh and replaces the current decision", async () => {
    mockGetReminderDecision
      .mockResolvedValueOnce({
        decision: null,
        source: "fallback",
        status: "service_unavailable",
        enabled: true,
        error: new Error("backend down"),
      })
      .mockResolvedValueOnce({
        decision: {
          dayKey: "2026-03-18",
          computedAt: "2026-03-18T12:05:00Z",
          decision: "suppress",
          kind: null,
          reasonCodes: ["quiet_hours"],
          scheduledAtUtc: null,
          confidence: 1,
          validUntil: "2026-03-18T22:00:00Z",
        },
        source: "remote",
        status: "live_success",
        enabled: true,
        error: null,
      });

    const { result } = renderHook(() =>
      useReminderDecision({ uid: "user-1", dayKey: "2026-03-18" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.decision).toBeNull();
    expect(result.current.status).toBe("service_unavailable");

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetReminderDecision).toHaveBeenCalledTimes(2);
    expect(mockGetReminderDecision).toHaveBeenLastCalledWith("user-1", {
      dayKey: "2026-03-18",
      productReady: true,
    });
    await waitFor(() => {
      expect(result.current.decision?.decision).toBe("suppress");
    });
    expect(result.current.source).toBe("remote");
    expect(result.current.status).toBe("live_success");
  });

  it("ignores stale reminder decisions after day changes", async () => {
    const firstRequest = deferred<ReminderDecisionResult>();
    const secondRequest = deferred<ReminderDecisionResult>();
    mockGetReminderDecision
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ dayKey }: { dayKey: string }) =>
        useReminderDecision({ uid: "user-1", dayKey }),
      {
        initialProps: { dayKey: "2026-03-18" },
      },
    );

    rerender({ dayKey: "2026-03-19" });

    await act(async () => {
      secondRequest.resolve({
        decision: {
          dayKey: "2026-03-19",
          computedAt: "2026-03-19T12:05:00Z",
          decision: "suppress",
          kind: null,
          reasonCodes: ["recent_activity_detected"],
          scheduledAtUtc: null,
          confidence: 1,
          validUntil: "2026-03-19T22:00:00Z",
        },
        source: "remote",
        status: "live_success",
        enabled: true,
        error: null,
      });
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.decision?.dayKey).toBe("2026-03-19");
      expect(result.current.decision?.reasonCodes).toEqual([
        "recent_activity_detected",
      ]);
    });

    await act(async () => {
      firstRequest.resolve({
        decision: {
          dayKey: "2026-03-18",
          computedAt: "2026-03-18T12:05:00Z",
          decision: "send",
          kind: "log_next_meal",
          reasonCodes: ["preferred_window_open"],
          scheduledAtUtc: "2026-03-18T18:30:00Z",
          confidence: 0.7,
          validUntil: "2026-03-18T19:30:00Z",
        },
        source: "remote",
        status: "live_success",
        enabled: true,
        error: null,
      });
      await firstRequest.promise;
    });

    expect(result.current.decision?.dayKey).toBe("2026-03-19");
    expect(result.current.decision?.reasonCodes).toEqual([
      "recent_activity_detected",
    ]);
  });
});
