import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

function sampleCandidate(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "a1b2c3d4e5f6a1b2",
    candidateType: "repeated_meal_snapshot",
    subjectKeyHash: "b2c3d4e5f6a1b2c3",
    state: "candidate",
    confidenceBucket: "medium",
    sourceCountBucket: "3_4",
    distinctDayCountBucket: "3_4",
    firstSeenAt: "2026-06-01T07:30:00.000Z",
    lastSeenAt: "2026-06-03T07:40:00.000Z",
    expiresAt: "2026-06-17T07:40:00.000Z",
    sourceRefs: [
      {
        sourceType: "meal_snapshot",
        sourceHash: "c3d4e5f6a1b2c3d4",
      },
    ],
    explanation: {
      key: "knownPattern.explanation.repeatedMealSnapshot",
      reasonCode: "repeated_meal_recent_distinct_days",
    },
    suggestedAction: "open_review_draft",
    createdByRuleVersion: "known-pattern-v1",
    ...overrides,
  };
}

function sampleResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [sampleCandidate()],
    queryEcho: {
      ruleVersion: "known-pattern-v1",
      minSourceCount: 3,
      minDistinctDays: 3,
      maxHistoryItems: 100,
      returnedCandidates: 1,
    },
    ...overrides,
  };
}

describe("knownPatternCandidatesApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("calls the read-only v2 known-pattern candidates endpoint", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse({ items: [] }));

    await api.fetchKnownPatternCandidatesRemote();

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/known-patterns/candidates",
      undefined,
    );
  });

  it("serializes limit and preserves bounded candidate metadata", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(sampleResponse());

    await expect(
      api.fetchKnownPatternCandidatesRemote({ limit: 3 }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            candidateId: "a1b2c3d4e5f6a1b2",
            candidateType: "repeated_meal_snapshot",
            subjectKeyHash: "b2c3d4e5f6a1b2c3",
            confidenceBucket: "medium",
            sourceCountBucket: "3_4",
            distinctDayCountBucket: "3_4",
            suggestedAction: "open_review_draft",
            explanation: {
              key: "knownPattern.explanation.repeatedMealSnapshot",
              reasonCode: "repeated_meal_recent_distinct_days",
            },
          }),
        ],
        queryEcho: expect.objectContaining({
          returnedCandidates: 1,
        }),
      }),
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/known-patterns/candidates?limit=3",
      undefined,
    );
  });

  it("accepts an empty candidate response", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [],
        queryEcho: {
          ruleVersion: "known-pattern-v1",
          minSourceCount: 3,
          minDistinctDays: 3,
          maxHistoryItems: 100,
          returnedCandidates: 0,
        },
      }),
    );

    await expect(api.fetchKnownPatternCandidatesRemote()).resolves.toEqual(
      expect.objectContaining({ items: [] }),
    );
  });

  it("rejects malformed candidate rows instead of hiding warning evidence", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleCandidate({ confidenceBucket: "low" }),
          sampleCandidate({ candidateId: "candidate-valid" }),
        ],
      }),
    );

    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );
  });

  it("rejects raw meal/private fields on candidates", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleCandidate({
            meal: { name: "Owsianka", totals: { kcal: 420 } },
          }),
        ],
      }),
    );

    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );
  });

  it("rejects raw values smuggled into hash fields", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleCandidate({
            candidateId: "Owsianka z owocami",
          }),
        ],
      }),
    );
    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleCandidate({
            sourceRefs: [
              {
                sourceType: "meal_snapshot",
                sourceHash: "private note",
              },
            ],
          }),
        ],
      }),
    );
    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );
  });

  it("rejects malformed source refs and query echo", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [sampleCandidate({ sourceRefs: [] })],
      }),
    );
    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        items: [
          sampleCandidate({
            sourceRefs: Array.from({ length: 6 }, (_, index) => ({
              sourceType: "meal_snapshot",
              sourceHash: `c3d4e5f6a1b2c3d${index}`,
            })),
          }),
        ],
      }),
    );
    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );

    mockGet.mockResolvedValueOnce(
      sampleResponse({
        queryEcho: {
          ruleVersion: "known-pattern-v1",
          minSourceCount: 0,
          minDistinctDays: 3,
          maxHistoryItems: 100,
          returnedCandidates: 1,
        },
      }),
    );
    await expect(api.fetchKnownPatternCandidatesRemote()).rejects.toThrow(
      "Invalid Known Pattern response.",
    );
  });

  it("rejects candidate limit values outside the backend contract", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    await expect(
      api.fetchKnownPatternCandidatesRemote({ limit: 0 }),
    ).rejects.toThrow("Known Pattern candidate limit must be between 1 and 10.");
    await expect(
      api.fetchKnownPatternCandidatesRemote({ limit: 11 }),
    ).rejects.toThrow("Known Pattern candidate limit must be between 1 and 10.");
    await expect(
      api.fetchKnownPatternCandidatesRemote({ limit: 1.5 }),
    ).rejects.toThrow("Known Pattern candidate limit must be between 1 and 10.");
    expect(mockGet).not.toHaveBeenCalled();
  });
});
