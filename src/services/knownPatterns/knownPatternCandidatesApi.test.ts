import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
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

function sampleControl(overrides: Record<string, unknown> = {}) {
  return {
    controlId: "d4e5f6a1b2c3d4e5",
    candidateId: "a1b2c3d4e5f6a1b2",
    subjectKeyHash: "b2c3d4e5f6a1b2c3",
    state: "declined",
    createdByRuleVersion: "known-pattern-v1",
    expiresAt: "2026-06-17T07:40:00.000Z",
    createdAt: "2026-06-10T07:40:00.000Z",
    updatedAt: "2026-06-10T07:40:00.000Z",
    ...overrides,
  };
}

function sampleControlResponse(overrides: Record<string, unknown> = {}) {
  return {
    control: sampleControl(),
    updated: true,
    ...overrides,
  };
}

function sampleReviewDraftResponse(overrides: Record<string, unknown> = {}) {
  return {
    draft: {
      name: "Owsianka z owocami",
      type: "breakfast",
      ingredients: [
        {
          id: "ingredient-1",
          name: "Płatki owsiane",
          amount: 50,
          unit: "g",
          kcal: 180,
          protein: 6,
          fat: 3,
          carbs: 32,
        },
      ],
      totals: {
        protein: 6,
        fat: 3,
        carbs: 32,
        kcal: 180,
      },
      notes: null,
      tags: [],
    },
    control: sampleControl({ state: "shown" }),
    updated: true,
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

  it("posts candidate control mutations with idempotent retry mode", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockPost.mockResolvedValueOnce(sampleControlResponse());

    await expect(
      api.markKnownPatternCandidateRemote("a1b2c3d4e5f6a1b2", {
        clientMutationId: "mutation-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
        action: "declined",
      }),
    ).resolves.toEqual({
      control: sampleControl(),
      updated: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/known-patterns/candidates/a1b2c3d4e5f6a1b2/control",
      {
        clientMutationId: "mutation-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
        action: "declined",
      },
      { retryMode: "idempotent" },
    );
  });

  it("opens a known-pattern review draft only through the explicit action endpoint", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockPost.mockResolvedValueOnce(sampleReviewDraftResponse());

    await expect(
      api.openKnownPatternReviewDraftRemote("a1b2c3d4e5f6a1b2", {
        clientMutationId: "mutation-review-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        draft: expect.objectContaining({
          name: "Owsianka z owocami",
          type: "breakfast",
          ingredients: [
            expect.objectContaining({
              name: "Płatki owsiane",
              unit: "g",
            }),
          ],
          notes: null,
        }),
        control: expect.objectContaining({ state: "shown" }),
      }),
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/users/me/known-patterns/candidates/a1b2c3d4e5f6a1b2/review-draft",
      {
        clientMutationId: "mutation-review-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
      },
      { retryMode: "idempotent" },
    );
  });

  it("rejects malformed control and review-draft payloads", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    mockPost.mockResolvedValueOnce(
      sampleControlResponse({
        control: sampleControl({
          meal: { name: "private meal" },
        }),
      }),
    );
    await expect(
      api.markKnownPatternCandidateRemote("a1b2c3d4e5f6a1b2", {
        clientMutationId: "mutation-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
        action: "declined",
      }),
    ).rejects.toThrow("Invalid Known Pattern response.");

    mockPost.mockResolvedValueOnce(
      sampleReviewDraftResponse({
        draft: {
          ...sampleReviewDraftResponse().draft,
          name: 123,
        },
      }),
    );
    await expect(
      api.openKnownPatternReviewDraftRemote("a1b2c3d4e5f6a1b2", {
        clientMutationId: "mutation-review-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
      }),
    ).rejects.toThrow("Invalid Known Pattern response.");
  });

  it("rejects malformed action candidate ids before making a request", async () => {
    const api =
      jest.requireActual<typeof import("./knownPatternCandidatesApi")>(
        "./knownPatternCandidatesApi",
      );

    await expect(
      api.markKnownPatternCandidateRemote("candidate-name", {
        clientMutationId: "mutation-1",
        subjectKeyHash: "b2c3d4e5f6a1b2c3",
        createdByRuleVersion: "known-pattern-v1",
        action: "declined",
      }),
    ).rejects.toThrow("Known Pattern candidate id is invalid.");
    expect(mockPost).not.toHaveBeenCalled();
  });
});
