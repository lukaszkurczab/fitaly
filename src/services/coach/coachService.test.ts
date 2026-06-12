import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachResponse } from "@/services/coach/coachTypes";

const mockGet = jest.fn<(path: string, options?: unknown) => Promise<unknown>>();
const mockReadPublicEnv = jest.fn<(name: string) => string | undefined>();
const mockWarn = jest.fn<(...args: unknown[]) => void>();

jest.mock("@/services/core/apiClient", () => ({
  get: (path: string, options?: unknown) => mockGet(path, options),
}));

jest.mock("@/services/core/publicEnv", () => ({
  readPublicEnv: (name: string) => mockReadPublicEnv(name),
}));

jest.mock("@/utils/debug", () => ({
  debugScope: () => ({
    log: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    child: () => ({
      log: jest.fn(),
      warn: (...args: unknown[]) => mockWarn(...args),
      error: jest.fn(),
      time: jest.fn(),
      timeEnd: jest.fn(),
      child: jest.fn(),
    }),
  }),
}));

describe("coachService", () => {
  function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    return { promise, resolve, reject };
  }

  function createHealthyPayload(overrides?: Partial<CoachResponse>): CoachResponse {
    return {
      dayKey: "2026-03-18",
      computedAt: "2026-03-18T12:00:00Z",
      source: "rules",
      insights: [
        {
          id: "2026-03-18:positive_momentum",
          type: "positive_momentum",
          priority: 40,
          title: "Recent momentum is worth protecting",
          body: "Keep the pattern going with one more complete log today.",
          actionLabel: "Open chat",
          actionType: "open_chat",
          reasonCodes: ["streak_positive", "consistency_improving"],
          source: "rules",
          validUntil: "2026-03-18T23:59:59Z",
          confidence: 0.74,
          isPositive: true,
        },
      ],
      topInsight: {
        id: "2026-03-18:positive_momentum",
        type: "positive_momentum",
        priority: 40,
        title: "Recent momentum is worth protecting",
        body: "Keep the pattern going with one more complete log today.",
        actionLabel: "Open chat",
        actionType: "open_chat",
        reasonCodes: ["streak_positive", "consistency_improving"],
        source: "rules",
        validUntil: "2026-03-18T23:59:59Z",
        confidence: 0.74,
        isPositive: true,
      },
      meta: { available: true, emptyReason: null, isDegraded: false },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_V2_STATE") {
        return "true";
      }
      return undefined;
    });
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");
    service.__resetCoachServiceForTests();
    await AsyncStorage.clear();
  });

  it("fetches coach insights and persists the last good response", async () => {
    mockGet.mockResolvedValue(createHealthyPayload());

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(mockGet).toHaveBeenCalledWith("/api/v2/users/me/coach?day=2026-03-18", {
      timeout: 15_000,
    });
    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.status).toBe("live_success");
    expect(result.isStale).toBe(false);
    expect(result.coach.topInsight?.type).toBe("positive_momentum");
    expect(await AsyncStorage.getItem("coach:last:v1:user-1:2026-03-18")).toEqual(
      expect.any(String),
    );
  });

  it("does not gate coach fetch behind mobile feature flags", async () => {
    mockReadPublicEnv.mockImplementation((name: string) => {
      if (name === "EXPO_PUBLIC_ENABLE_V2_STATE") {
        return "false";
      }
      return undefined;
    });
    mockGet.mockResolvedValue(createHealthyPayload());

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("remote");
    expect(result.status).toBe("live_success");
    expect(result.coach.dayKey).toBe("2026-03-18");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("uses in-memory cache for repeated reads of the same user and day", async () => {
    mockGet.mockResolvedValue(createHealthyPayload());

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const first = await service.getCoach("user-1", { dayKey: "2026-03-18" });
    const second = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(first.source).toBe("remote");
    expect(first.status).toBe("live_success");
    expect(second.source).toBe("memory");
    expect(second.status).toBe("live_success");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("falls back to persisted response when refresh fails", async () => {
    await AsyncStorage.setItem(
      "coach:last:v1:user-1:2026-03-18",
      JSON.stringify(
        createHealthyPayload({
          computedAt: "2026-03-18T10:00:00Z",
        }),
      ),
    );
    mockGet.mockRejectedValue(new Error("backend down"));

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("storage");
    expect(result.status).toBe("stale_cache");
    expect(result.isStale).toBe(true);
    expect(result.coach.topInsight?.type).toBe("positive_momentum");
    expect(mockWarn).toHaveBeenCalled();
  });

  it("returns service unavailable fallback when refresh fails without cache", async () => {
    mockGet.mockRejectedValue(new Error("backend down"));

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("service_unavailable");
    expect(result.isStale).toBe(true);
    expect(result.coach.topInsight).toBeNull();
    expect(result.coach.meta.available).toBe(false);
  });

  it("invalidates cached coach response so the next read refetches remote", async () => {
    mockGet
      .mockResolvedValueOnce(
        createHealthyPayload({
          computedAt: "2026-03-18T10:00:00Z",
        }),
      )
      .mockResolvedValueOnce({
        dayKey: "2026-03-18",
        computedAt: "2026-03-18T11:00:00Z",
        source: "rules",
        insights: [
          {
            id: "2026-03-18:under_logging",
            type: "under_logging",
            priority: 100,
            title: "Logging looks too light to coach well",
            body: "Log your next meal so today is easier to interpret and adjust.",
            actionLabel: "Log next meal",
            actionType: "log_next_meal",
            reasonCodes: ["valid_logging_days_7_low"],
            source: "rules",
            validUntil: "2026-03-18T23:59:59Z",
            confidence: 0.92,
            isPositive: false,
          },
        ],
        topInsight: {
          id: "2026-03-18:under_logging",
          type: "under_logging",
          priority: 100,
          title: "Logging looks too light to coach well",
          body: "Log your next meal so today is easier to interpret and adjust.",
          actionLabel: "Log next meal",
          actionType: "log_next_meal",
          reasonCodes: ["valid_logging_days_7_low"],
          source: "rules",
          validUntil: "2026-03-18T23:59:59Z",
          confidence: 0.92,
          isPositive: false,
        },
        meta: { available: true, emptyReason: null, isDegraded: false },
      });

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const first = await service.getCoach("user-1", { dayKey: "2026-03-18" });
    await service.invalidateCoachCache("user-1", { dayKey: "2026-03-18" });
    const second = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(first.status).toBe("live_success");
    expect(first.coach.topInsight?.type).toBe("positive_momentum");
    expect(second.coach.topInsight?.type).toBe("under_logging");
    expect(second.status).toBe("live_success");
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("fences stale in-flight writes after full user cache invalidation", async () => {
    const staleRequest = createDeferred<unknown>();
    const stalePayload = createHealthyPayload({
      computedAt: "2026-03-18T10:00:00Z",
    });
    const freshPayload = createHealthyPayload({
      computedAt: "2026-03-18T11:00:00Z",
    });
    mockGet
      .mockReturnValueOnce(staleRequest.promise)
      .mockResolvedValueOnce(freshPayload);

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const stalePromise = service.getCoach("user-1", { dayKey: "2026-03-18" });
    expect(mockGet).toHaveBeenCalledTimes(1);

    await service.invalidateCoachCache("user-1");
    const freshResult = await service.getCoach("user-1", {
      dayKey: "2026-03-18",
    });

    staleRequest.resolve(stalePayload);
    const staleResult = await stalePromise;
    const cachedResult = await service.getCoach("user-1", {
      dayKey: "2026-03-18",
    });
    const persisted = await AsyncStorage.getItem(
      "coach:last:v1:user-1:2026-03-18",
    );

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(staleResult.coach.computedAt).toBe("2026-03-18T10:00:00Z");
    expect(freshResult.coach.computedAt).toBe("2026-03-18T11:00:00Z");
    expect(cachedResult.source).toBe("memory");
    expect(cachedResult.coach.computedAt).toBe("2026-03-18T11:00:00Z");
    expect(JSON.parse(persisted ?? "{}")).toEqual(
      expect.objectContaining({ computedAt: "2026-03-18T11:00:00Z" }),
    );
  });

  it("rejects unknown insightType as invalid contract payload", async () => {
    mockGet.mockResolvedValue({
      ...createHealthyPayload(),
      insights: [
        {
          ...createHealthyPayload().insights[0],
          id: "2026-03-18:mystery_insight",
          type: "mystery_insight",
        },
      ],
      topInsight: {
        ...createHealthyPayload().topInsight!,
        id: "2026-03-18:mystery_insight",
        type: "mystery_insight",
      },
    });

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.coach.topInsight).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({ code: "coach/invalid-contract-payload" }),
    );
  });

  it("rejects unknown actionType as invalid contract payload", async () => {
    mockGet.mockResolvedValue({
      ...createHealthyPayload(),
      insights: [
        {
          ...createHealthyPayload().insights[0],
          actionType: "do_something_else",
        },
      ],
      topInsight: {
        ...createHealthyPayload().topInsight!,
        actionType: "do_something_else",
      },
    });

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.coach.topInsight).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({ code: "coach/invalid-contract-payload" }),
    );
  });

  it("rejects missing required fields as invalid contract payload", async () => {
    mockGet.mockResolvedValue({
      ...createHealthyPayload(),
      insights: [
        {
          ...createHealthyPayload().insights[0],
          title: "",
        },
      ],
      topInsight: {
        ...createHealthyPayload().topInsight!,
        title: "",
      },
    });

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("fallback");
    expect(result.status).toBe("invalid_payload");
    expect(result.coach.topInsight).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({ code: "coach/invalid-contract-payload" }),
    );
  });

  it("keeps stale cache semantics distinct from invalid payload", async () => {
    await AsyncStorage.setItem(
      "coach:last:v1:user-1:2026-03-18",
      JSON.stringify(
        createHealthyPayload({
          computedAt: "2026-03-18T10:00:00Z",
        }),
      ),
    );
    mockGet.mockRejectedValue(new Error("backend down"));

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("storage");
    expect(result.status).toBe("stale_cache");
    expect(result.isStale).toBe(true);
  });

  it("uses stale cache when the fresh payload is invalid", async () => {
    await AsyncStorage.setItem(
      "coach:last:v1:user-1:2026-03-18",
      JSON.stringify(
        createHealthyPayload({
          computedAt: "2026-03-18T10:00:00Z",
        }),
      ),
    );
    mockGet.mockResolvedValue({
      ...createHealthyPayload(),
      insights: [
        {
          ...createHealthyPayload().insights[0],
          id: "2026-03-18-positive-momentum",
          priority: 40,
        },
      ],
      topInsight: {
        ...createHealthyPayload().topInsight!,
        id: "2026-03-18-positive-momentum",
      },
    });

    const service =
      jest.requireActual("@/services/coach/coachService") as typeof import("@/services/coach/coachService");

    const result = await service.getCoach("user-1", { dayKey: "2026-03-18" });

    expect(result.source).toBe("storage");
    expect(result.status).toBe("invalid_payload");
    expect(result.isStale).toBe(true);
    expect(result.coach.topInsight?.type).toBe("positive_momentum");
  });
});
