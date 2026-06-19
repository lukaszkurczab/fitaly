import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  __resetE2EFixturesForTests,
  applyE2ESeedCommand,
  getE2EFixtureState,
  getE2EAccessState,
  parseE2ESeedCommand,
  resolveE2EBarcodeLookup,
  resolveE2EBillingPurchaseResult,
  resolveE2EChatRun,
  resolveE2EAiConsentSeed,
  resolveE2EAiConsentGrant,
  resolveE2EAiConsentRevoke,
  resolveE2ENotificationPermission,
  resolveE2EPhotoAnalysis,
  resolveE2EReminderDecision,
  resolveE2EShareExport,
  resolveE2ETextMealAnalysis,
  resolveE2EWeeklyReport,
} from "@/services/e2e/fixtures";

const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockMultiRemove = jest.fn<(keys: string[]) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();
const mockResetOfflineStorage = jest.fn();
const mockPullSmartMemoryChanges = jest.fn<(uid: string) => Promise<void>>();
const mockSaveMealTransaction = jest.fn<(input: unknown) => Promise<unknown>>();
const mockSaveMealRemote = jest.fn<(input: unknown) => Promise<void>>();
const mockFetchMealsPageRemote = jest.fn<
  (input: unknown) => Promise<{
    items: Array<{
      name: string;
      cloudId: string | null;
      updatedAt: string;
      deleted?: boolean;
    }>;
    nextCursor: string | null;
  }>
>();
const mockMarkMealDeletedRemote = jest.fn<
  (
    uid: string,
    cloudId: string,
    updatedAt: string,
    options: unknown,
  ) => Promise<void>
>();
type MockKnownPatternCandidateState = "candidate" | "shown";
type MockKnownPatternCountBucket = "3_4" | "5_plus";
const mockFetchKnownPatternCandidatesRemote = jest.fn<
  (request?: unknown, options?: unknown) => Promise<{
    items: Array<{
      firstSeenAt: string;
      lastSeenAt: string;
      state: MockKnownPatternCandidateState;
      suggestedAction: "open_review_draft";
      sourceCountBucket: MockKnownPatternCountBucket;
      distinctDayCountBucket: MockKnownPatternCountBucket;
    }>;
  }>
>();
const mockFetchPlannedMealsRemote = jest.fn<
  (request?: unknown, options?: unknown) => Promise<{
    items: Array<{
      plannedMealId: string;
      version: number;
      status: string;
    }>;
  }>
>();
const mockCreatePlannedMealRemote = jest.fn<
  (request: unknown, options?: unknown) => Promise<unknown>
>();
const mockDeletePlannedMealRemote = jest.fn<
  (plannedMealId: string, request: unknown, options?: unknown) => Promise<unknown>
>();
const mockGetAllMealsLocal = jest.fn<
  (uid: string) => Promise<Array<{ name: string | null; deleted?: boolean }>>
>();
const mockUpsertMealLocal = jest.fn<(meal: unknown) => Promise<void>>();
const mockUpsertMyMealLocal = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockUpsertLocalIngredientProductUserRecord =
  jest.fn<(params: unknown) => Promise<void>>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();
const mockGetSampleMealUri = jest.fn<() => Promise<string>>();
const mockUpsertSmartMemorySettingsProjection =
  jest.fn<(uid: string, settings: unknown) => Promise<void>>();
const mockUpsertSmartMemoryItemProjection =
  jest.fn<(uid: string, item: unknown) => Promise<void>>();
const mockUpsertSmartMemoryCandidateProjection =
  jest.fn<(uid: string, candidate: unknown) => Promise<void>>();
const mockMarkSmartMemoryCandidatePending =
  jest.fn<(params: unknown) => Promise<void>>();
const mockMarkSmartMemoryItemPending =
  jest.fn<(params: unknown) => Promise<void>>();
const mockMarkSmartMemoryProjectionSyncFailed =
  jest.fn<(params: unknown) => Promise<void>>();
const mockApiGet = jest.fn<(url: string, options?: unknown) => Promise<unknown>>();
const mockFlushTelemetry = jest.fn<() => Promise<void>>();
const mockSetTelemetryUserId = jest.fn<(uid: string | null) => void>();

let mockE2EEnabled = true;

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: (key: string, value: string) => mockSetItem(key, value),
  multiRemove: (keys: string[]) => mockMultiRemove(keys),
  removeItem: (key: string) => mockRemoveItem(key),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
}));

jest.mock("@/services/core/apiClient", () => ({
  get: (url: string, options?: unknown) => mockApiGet(url, options),
}));

jest.mock("@/services/telemetry/telemetryClient", () => ({
  flush: () => mockFlushTelemetry(),
  setTelemetryUserId: (uid: string | null) => mockSetTelemetryUserId(uid),
}));

jest.mock("@/services/offline/db", () => ({
  resetOfflineStorage: () => mockResetOfflineStorage(),
}));

jest.mock("@/services/offline/sync.engine", () => ({
  pullSmartMemoryChanges: (uid: string) => mockPullSmartMemoryChanges(uid),
}));

jest.mock("@/services/meals/mealSaveTransaction", () => ({
  saveMealTransaction: (input: unknown) => mockSaveMealTransaction(input),
}));

jest.mock("@/services/meals/mealsRepository", () => ({
  fetchMealsPageRemote: (input: unknown) => mockFetchMealsPageRemote(input),
  markMealDeletedRemote: (
    uid: string,
    cloudId: string,
    updatedAt: string,
    options: unknown,
  ) => mockMarkMealDeletedRemote(uid, cloudId, updatedAt, options),
  saveMealRemote: (input: unknown) => mockSaveMealRemote(input),
}));

jest.mock("@/services/knownPatterns/knownPatternCandidatesApi", () => ({
  fetchKnownPatternCandidatesRemote: (request?: unknown, options?: unknown) =>
    mockFetchKnownPatternCandidatesRemote(request, options),
}));

jest.mock("@/services/plannedMeals/plannedMealsApi", () => ({
  createPlannedMealRemote: (request: unknown, options?: unknown) =>
    mockCreatePlannedMealRemote(request, options),
  fetchPlannedMealsRemote: (request?: unknown, options?: unknown) =>
    mockFetchPlannedMealsRemote(request, options),
  deletePlannedMealRemote: (
    plannedMealId: string,
    request: unknown,
    options?: unknown,
  ) => mockDeletePlannedMealRemote(plannedMealId, request, options),
}));

jest.mock("@/services/offline/meals.repo", () => ({
  getAllMealsLocal: (uid: string) => mockGetAllMealsLocal(uid),
  upsertMealLocal: (meal: unknown) => mockUpsertMealLocal(meal),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealLocal: (uid: string, meal: unknown) =>
    mockUpsertMyMealLocal(uid, meal),
}));

jest.mock(
  "@/services/foodLibrary/ingredientProductUserRecordProjectionRepository",
  () => ({
    upsertLocalIngredientProductUserRecord: (params: unknown) =>
      mockUpsertLocalIngredientProductUserRecord(params),
  }),
);

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload),
}));

jest.mock("@/utils/devSamples", () => ({
  getSampleMealUri: () => mockGetSampleMealUri(),
}));

jest.mock("@/services/smartMemory/smartMemoryProjectionRepository", () => ({
  upsertSmartMemorySettingsProjection: (uid: string, settings: unknown) =>
    mockUpsertSmartMemorySettingsProjection(uid, settings),
  upsertSmartMemoryItemProjection: (uid: string, item: unknown) =>
    mockUpsertSmartMemoryItemProjection(uid, item),
  upsertSmartMemoryCandidateProjection: (uid: string, candidate: unknown) =>
    mockUpsertSmartMemoryCandidateProjection(uid, candidate),
  markSmartMemoryCandidatePending: (params: unknown) =>
    mockMarkSmartMemoryCandidatePending(params),
  markSmartMemoryItemPending: (params: unknown) =>
    mockMarkSmartMemoryItemPending(params),
  markSmartMemoryProjectionSyncFailed: (params: unknown) =>
    mockMarkSmartMemoryProjectionSyncFailed(params),
}));

describe("E2E fixtures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockE2EEnabled = true;
    mockSetItem.mockResolvedValue(undefined);
    mockMultiRemove.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    mockPullSmartMemoryChanges.mockResolvedValue(undefined);
    mockSaveMealTransaction.mockResolvedValue({});
    mockSaveMealRemote.mockResolvedValue(undefined);
    mockFetchMealsPageRemote.mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    mockMarkMealDeletedRemote.mockResolvedValue(undefined);
    mockFetchKnownPatternCandidatesRemote.mockImplementation(async () => {
      const timestamps = mockSaveMealRemote.mock.calls.map(
        (call) => (call[0] as { meal: { timestamp: string } }).meal.timestamp,
      );
      return {
        items:
          timestamps.length > 0
            ? [
                {
                  firstSeenAt: timestamps[0],
                  lastSeenAt: timestamps[timestamps.length - 1],
                  state: "candidate",
                  suggestedAction: "open_review_draft",
                  sourceCountBucket: "5_plus",
                  distinctDayCountBucket: "5_plus",
                },
              ]
            : [],
      };
    });
    mockFetchPlannedMealsRemote.mockResolvedValue({ items: [] });
    mockCreatePlannedMealRemote.mockResolvedValue({ updated: true });
    mockDeletePlannedMealRemote.mockResolvedValue({ updated: true });
    mockGetAllMealsLocal.mockResolvedValue([]);
    mockUpsertMealLocal.mockResolvedValue(undefined);
    mockUpsertMyMealLocal.mockResolvedValue(undefined);
    mockUpsertLocalIngredientProductUserRecord.mockResolvedValue(undefined);
    mockGetSampleMealUri.mockResolvedValue("file:///sampleMeal-local.jpg");
    mockUpsertSmartMemorySettingsProjection.mockResolvedValue(undefined);
    mockUpsertSmartMemoryItemProjection.mockResolvedValue(undefined);
    mockUpsertSmartMemoryCandidateProjection.mockResolvedValue(undefined);
    mockMarkSmartMemoryCandidatePending.mockResolvedValue(undefined);
    mockMarkSmartMemoryItemPending.mockResolvedValue(undefined);
    mockMarkSmartMemoryProjectionSyncFailed.mockResolvedValue(undefined);
    mockApiGet.mockResolvedValue({ buckets: [] });
    mockFlushTelemetry.mockResolvedValue(undefined);
    __resetE2EFixturesForTests();
  });

  it("parses only supported seed values", () => {
    expect(
      parseE2ESeedCommand({
        fixture: "user-with-failed-meal",
        credits: "none",
        ai: "photoSlow",
        barcode: "known",
        billing: "restoreSlowFailure",
        chat: "success",
        shareExport: "success",
        notificationPermission: "allowed",
        reminder: "send",
        weeklyReport: "available",
        aiConsent: "revoked",
        aiConsentGrant: "success",
        aiConsentRevoke: "failureOnce",
        smartMemory: "reviewCandidate",
        knownPattern: "candidate",
        planning: "reviewReady",
        historyAssert: "noRecipeReviewDraft",
        telemetryBaseline: "homeNextActionStarted",
        telemetryAssert: "homeNextActionStarted",
      }),
    ).toEqual({
      fixture: "user-with-failed-meal",
      credits: "none",
      ai: "photoSlow",
      barcode: "known",
      billing: "restoreSlowFailure",
      chat: "success",
      shareExport: "success",
      notificationPermission: "allowed",
      reminder: "send",
      weeklyReport: "available",
      aiConsent: "revoked",
      aiConsentGrant: "success",
      aiConsentRevoke: "failureOnce",
      smartMemory: "reviewCandidate",
      knownPattern: "candidate",
      planning: "reviewReady",
      historyAssert: "noRecipeReviewDraft",
      telemetryBaseline: "homeNextActionStarted",
      telemetryAssert: "homeNextActionStarted",
    });

    expect(
      parseE2ESeedCommand({
        fixture: "user-with-private-product-conflict",
      }),
    ).toEqual({
      fixture: "user-with-private-product-conflict",
    });

    expect(
      parseE2ESeedCommand({
        fixture: "unknown",
        credits: "bad",
        ai: "bad",
        barcode: "bad",
        billing: "bad",
        chat: "bad",
        shareExport: "bad",
        notificationPermission: "bad",
        reminder: "bad",
        weeklyReport: "bad",
        aiConsent: "bad",
        aiConsentGrant: "bad",
        aiConsentRevoke: "bad",
        smartMemory: "bad",
        knownPattern: "bad",
        planning: "bad",
        historyAssert: "bad",
        telemetryBaseline: "bad",
        telemetryAssert: "bad",
      }),
    ).toEqual({});
  });

  it("does nothing when E2E mode is disabled", async () => {
    mockE2EEnabled = false;

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-today-meal", credits: "none" },
    });

    expect(markers).toEqual([]);
    expect(mockResetOfflineStorage).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
    expect(mockUpsertLocalIngredientProductUserRecord).not.toHaveBeenCalled();
    expect(getE2EAccessState("user-1")).toBeNull();
    expect(resolveE2EBarcodeLookup()).toBeNull();
    expect(resolveE2ENotificationPermission()).toBeNull();
  });

  it("applies explicit AI consent seed state with uid-scoped readiness markers", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: {
        aiConsent: "revoked",
        aiConsentGrant: "success",
        aiConsentRevoke: "failureOnce",
      },
    });

    expect(markers).toEqual([
      "aiConsent-revoked",
      "aiConsentGrant-success",
      "aiConsentRevoke-failureOnce",
    ]);
    expect(getE2EFixtureState()).toEqual(
      expect.objectContaining({
        aiConsent: "revoked",
        aiConsentGrant: "success",
        aiConsentRevoke: "failureOnce",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("e2e:aiConsentSeeded", {
      uid: "user-1",
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-05-02T10:00:00.000Z",
      },
    });
    expect(resolveE2EAiConsentSeed("user-1")).toEqual({
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: "2026-05-02T10:00:00.000Z",
    });
    expect(resolveE2EAiConsentSeed("user-2")).toBeNull();
  });

  it("does not mark profile AI consent seed ready without a uid", async () => {
    const markers = await applyE2ESeedCommand({
      uid: null,
      command: { aiConsent: "granted" },
    });

    expect(markers).toEqual([]);
    expect(getE2EFixtureState()).toEqual({});
    expect(mockEmit).not.toHaveBeenCalledWith(
      "e2e:aiConsentSeeded",
      expect.anything(),
    );
  });

  it("resolves deterministic AI consent grant and revoke mutation modes", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { aiConsentGrant: "success", aiConsentRevoke: "failureOnce" },
    });

    expect(
      resolveE2EAiConsentGrant("user-1", {
        status: "not_granted",
        grantedAt: null,
        revokedAt: null,
      }),
    ).toEqual({
      aiConsent: {
        status: "granted",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: null,
      },
    });

    expect(
      resolveE2EAiConsentRevoke("user-1", {
        status: "granted",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: null,
      }),
    ).toEqual({ error: expect.any(Error) });
    expect(
      resolveE2EAiConsentRevoke("user-1", {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-06-01T10:00:00.000Z",
      }),
    ).toEqual({
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-06-01T10:00:00.000Z",
      },
    });
  });

  it("re-arms failureOnce on explicit aiConsentRevoke reseed per uid", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { aiConsentRevoke: "failureOnce" },
    });

    const grantedConsent = {
      status: "granted" as const,
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: null,
    };

    expect(resolveE2EAiConsentRevoke("user-1", grantedConsent)).toEqual({
      error: expect.any(Error),
    });
    expect(resolveE2EAiConsentRevoke("user-2", grantedConsent)).toEqual({
      error: expect.any(Error),
    });
    expect(resolveE2EAiConsentRevoke("user-1", grantedConsent)).toEqual({
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-05-02T10:00:00.000Z",
      },
    });
    expect(resolveE2EAiConsentRevoke("user-2", grantedConsent)).toEqual({
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-05-02T10:00:00.000Z",
      },
    });

    await applyE2ESeedCommand({
      uid: "user-1",
      command: { aiConsentRevoke: "failureOnce" },
    });

    expect(resolveE2EAiConsentRevoke("user-1", grantedConsent)).toEqual({
      error: expect.any(Error),
    });
  });

  it("updates the uid-scoped AI consent seed after E2E grant and revoke mutations", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: {
        aiConsent: "notGranted",
        aiConsentGrant: "success",
        aiConsentRevoke: "success",
      },
    });

    expect(resolveE2EAiConsentSeed("user-1")).toEqual({
      status: "not_granted",
      grantedAt: null,
      revokedAt: null,
    });

    const grantResult = resolveE2EAiConsentGrant("user-1", {
      status: "not_granted",
      grantedAt: null,
      revokedAt: null,
    });

    expect(grantResult).toEqual({
      aiConsent: {
        status: "granted",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: null,
      },
    });
    expect(resolveE2EAiConsentSeed("user-1")).toEqual({
      status: "granted",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: null,
    });

    expect(
      resolveE2EAiConsentRevoke(
        "user-1",
        "aiConsent" in grantResult! ? grantResult.aiConsent : null,
      ),
    ).toEqual({
      aiConsent: {
        status: "revoked",
        grantedAt: "2026-05-01T10:00:00.000Z",
        revokedAt: "2026-05-02T10:00:00.000Z",
      },
    });
    expect(resolveE2EAiConsentSeed("user-1")).toEqual({
      status: "revoked",
      grantedAt: "2026-05-01T10:00:00.000Z",
      revokedAt: "2026-05-02T10:00:00.000Z",
    });
  });

  it("seeds a logged meal through the canonical save transaction", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-today-meal" },
    });

    expect(markers).toEqual(["fixture-user-with-today-meal"]);
    expect(mockResetOfflineStorage).toHaveBeenCalledTimes(1);
    expect(mockSaveMealTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        savedTemplate: { mode: "none" },
      }),
    );
    const firstSaveInput = mockSaveMealTransaction.mock.calls[0]?.[0];
    expect(firstSaveInput).toEqual(
      expect.objectContaining({
        meal: expect.objectContaining({
          userUid: "user-1",
          name: "Jogurt z owocami i granolą",
          inputMethod: "manual",
        }),
      }),
    );
  });

  it("seeds a synced visible meal for normal details visual coverage", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-synced-meal" },
    });

    expect(markers).toEqual(["fixture-user-with-synced-meal"]);
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jogurt z owocami i granolą",
        syncState: "synced",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "meal:local:upserted",
      expect.objectContaining({
        uid: "user-1",
        meal: expect.objectContaining({ syncState: "synced" }),
      }),
    );
  });

  it("seeds the photo meal with a local sample photo for share visual coverage", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-photo-meal" },
    });

    expect(markers).toEqual(["fixture-user-with-photo-meal"]);
    expect(mockGetSampleMealUri).toHaveBeenCalledTimes(1);
    expect(mockSaveMealTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        meal: expect.objectContaining({
          name: "Talerz z kurczakiem",
          inputMethod: "photo",
          photoUrl: "file:///sampleMeal-local.jpg",
          photoLocalPath: "file:///sampleMeal-local.jpg",
        }),
      }),
    );
  });

  it("seeds saved meals through the canonical saved-meal service", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-saved-meals" },
    });

    expect(markers).toEqual(["fixture-user-with-saved-meals"]);
    expect(mockUpsertMyMealLocal).toHaveBeenCalledTimes(2);
    expect(mockUpsertMyMealLocal).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "Miska z kaszą i warzywami",
        source: "saved",
        inputMethod: "manual",
      }),
    );
  });

  it("seeds a known-pattern candidate through the backend meal API", async () => {
    mockFetchMealsPageRemote.mockResolvedValueOnce({
      items: [
        {
          name: "Znany wzorzec QA stale",
          cloudId: "old-known-pattern",
          updatedAt: "2026-06-18T08:00:00.000Z",
        },
        {
          name: "Regular meal",
          cloudId: "regular-meal",
          updatedAt: "2026-06-18T09:00:00.000Z",
        },
      ],
      nextCursor: "known-pattern-page-2",
    });
    mockFetchMealsPageRemote.mockResolvedValueOnce({
      items: [
        {
          name: "Znany wzorzec QA stale page 2",
          cloudId: "old-known-pattern-page-2",
          updatedAt: "2026-06-18T10:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { knownPattern: "candidate" },
    });

    expect(markers).toEqual(["knownPattern-candidate"]);
    expect(mockFetchMealsPageRemote).toHaveBeenNthCalledWith(1, {
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
    expect(mockFetchMealsPageRemote).toHaveBeenNthCalledWith(2, {
      uid: "user-1",
      pageSize: 100,
      cursor: "known-pattern-page-2",
    });
    expect(mockMarkMealDeletedRemote).toHaveBeenCalledTimes(2);
    expect(mockMarkMealDeletedRemote).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "old-known-pattern",
      "2026-06-18T08:00:00.000Z",
      {
        clientMutationId:
          "e2e-known-pattern-cleanup:user-1:old-known-pattern",
      },
    );
    expect(mockMarkMealDeletedRemote).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "old-known-pattern-page-2",
      "2026-06-18T10:00:00.000Z",
      {
        clientMutationId:
          "e2e-known-pattern-cleanup:user-1:old-known-pattern-page-2",
      },
    );
    expect(mockSaveMealRemote).toHaveBeenCalledTimes(5);
    expect(mockFetchKnownPatternCandidatesRemote).toHaveBeenCalledWith(
      { limit: 10 },
      { timeout: 10000 },
    );
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();

    const calls = mockSaveMealRemote.mock.calls.map((call) => call[0]);
    const mealNames = calls.map(
      (input) => (input as { meal: { name: string } }).meal.name,
    );
    const dayKeys = calls.map(
      (input) => (input as { meal: { dayKey: string } }).meal.dayKey,
    );
    expect(new Set(mealNames).size).toBe(1);
    expect(mealNames[0]).toMatch(/^Znany wzorzec QA /);
    expect(dayKeys).toHaveLength(5);
    expect(new Set(dayKeys).size).toBe(5);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: "user-1",
          clientMutationId: expect.stringMatching(
            /^e2e-known-pattern:user-1:/,
          ),
          meal: expect.objectContaining({
            userUid: "user-1",
            inputMethod: "manual",
            type: "lunch",
            ingredients: expect.arrayContaining([
              expect.objectContaining({ name: "Owsianka QA" }),
              expect.objectContaining({ name: "Jogurt QA" }),
            ]),
          }),
        }),
      ]),
    );
  });

  it("does not accept unrelated known-pattern candidates as seed readiness", async () => {
    mockFetchKnownPatternCandidatesRemote.mockImplementationOnce(async () => ({
      items: [
        {
          firstSeenAt: "2026-06-01T10:00:00.000Z",
          lastSeenAt: "2026-06-05T10:00:00.000Z",
          state: "candidate",
          suggestedAction: "open_review_draft",
          sourceCountBucket: "5_plus",
          distinctDayCountBucket: "5_plus",
        },
      ],
    }));
    mockFetchKnownPatternCandidatesRemote.mockImplementationOnce(async () => {
      const timestamps = mockSaveMealRemote.mock.calls.map(
        (call) => (call[0] as { meal: { timestamp: string } }).meal.timestamp,
      );
      return {
        items: [
          {
            firstSeenAt: timestamps[0],
            lastSeenAt: timestamps[timestamps.length - 1],
            state: "shown",
            suggestedAction: "open_review_draft",
            sourceCountBucket: "3_4",
            distinctDayCountBucket: "3_4",
          },
        ],
      };
    });

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { knownPattern: "candidate" },
    });

    expect(markers).toEqual(["knownPattern-candidate"]);
    expect(mockFetchKnownPatternCandidatesRemote).toHaveBeenCalledTimes(2);
  });

  it("clears active planned meals through the planned meal API only", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({
      items: [
        {
          plannedMealId: "planned-1",
          version: 2,
          status: "planned",
        },
        {
          plannedMealId: "planned-deleted",
          version: 4,
          status: "deleted",
        },
      ],
    });

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { planning: "empty" },
    });

    expect(markers).toEqual(["planning-empty"]);
    expect(mockFetchPlannedMealsRemote).toHaveBeenCalledWith(
      {
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        days: 3,
        includeDeleted: false,
      },
      { timeout: 10000 },
    );
    expect(mockDeletePlannedMealRemote).toHaveBeenCalledTimes(1);
    expect(mockDeletePlannedMealRemote).toHaveBeenCalledWith(
      "planned-1",
      {
        clientMutationId: "e2e-planning-delete:user-1:planned-1:2",
        expectedVersion: 2,
      },
      { timeout: 10000 },
    );
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("creates a review-ready planned item through the planned meal API only", async () => {
    mockFetchPlannedMealsRemote.mockResolvedValueOnce({ items: [] });

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { planning: "reviewReady" },
    });

    expect(markers).toEqual(["planning-reviewReady"]);
    expect(mockFetchPlannedMealsRemote).toHaveBeenCalledWith(
      {
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        days: 3,
        includeDeleted: false,
      },
      { timeout: 10000 },
    );
    expect(mockCreatePlannedMealRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMutationId: expect.stringMatching(/^e2e-planning-create:user-1:/),
        plannedMealId: expect.stringMatching(/^e2e-planning-/),
        dateBucket: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        timeBucket: "lunch",
        sourceType: "manual",
        sourceRef: null,
        draftSnapshot: expect.objectContaining({
          name: "E2E Planning Bowl",
          type: "lunch",
          totals: {
            kcal: 400,
            protein: 25,
            fat: 14,
            carbs: 45,
          },
        }),
        nutritionEstimate: {
          state: "known",
          totals: {
            kcal: 400,
            protein: 25,
            fat: 14,
            carbs: 45,
          },
          missingFields: [],
          confidence: "medium",
        },
      }),
      { timeout: 10000 },
    );
    expect(mockDeletePlannedMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("asserts review drafts were not silently saved in remote history", async () => {
    mockFetchMealsPageRemote.mockResolvedValueOnce({
      items: [
        {
          name: "Unrelated meal",
          cloudId: "meal-1",
          updatedAt: "2026-06-18T08:00:00.000Z",
        },
      ],
      nextCursor: "history-page-2",
    });
    mockFetchMealsPageRemote.mockResolvedValueOnce({
      items: [
        {
          name: "Salmon rice plate",
          cloudId: "deleted-recipe-draft",
          updatedAt: "2026-06-18T09:00:00.000Z",
          deleted: true,
        },
      ],
      nextCursor: null,
    });

    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { historyAssert: "noRecipeReviewDraft" },
    });

    expect(markers).toEqual(["historyAssert-noRecipeReviewDraft"]);
    expect(mockGetAllMealsLocal).toHaveBeenCalledWith("user-1");
    expect(mockFetchMealsPageRemote).toHaveBeenNthCalledWith(1, {
      uid: "user-1",
      pageSize: 100,
      cursor: null,
    });
    expect(mockFetchMealsPageRemote).toHaveBeenNthCalledWith(2, {
      uid: "user-1",
      pageSize: 100,
      cursor: "history-page-2",
    });
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("fails history assertion when a review draft was saved locally only", async () => {
    mockGetAllMealsLocal.mockResolvedValueOnce([
      {
        name: "E2E Planning Bowl",
        deleted: false,
      },
    ]);

    await expect(
      applyE2ESeedCommand({
        uid: "user-1",
        command: { historyAssert: "noPlanningReviewDraft" },
      }),
    ).rejects.toMatchObject({
      code: "e2e/local-history-assertion-failed",
    });
    expect(mockFetchMealsPageRemote).not.toHaveBeenCalled();
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("fails history assertion when a review draft was saved remotely", async () => {
    mockFetchMealsPageRemote.mockResolvedValueOnce({
      items: [
        {
          name: "E2E Planning Bowl",
          cloudId: "saved-planning-draft",
          updatedAt: "2026-06-18T09:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    await expect(
      applyE2ESeedCommand({
        uid: "user-1",
        command: { historyAssert: "noPlanningReviewDraft" },
      }),
    ).rejects.toMatchObject({
      code: "e2e/history-assertion-failed",
    });
    expect(mockSaveMealRemote).not.toHaveBeenCalled();
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("records and asserts telemetry count increases through backend summary", async () => {
    mockApiGet.mockResolvedValueOnce({
      buckets: [
        {
          eventCounts: [
            { name: "home_next_action_started", count: 2 },
            { name: "home_next_action_shown", count: 4 },
          ],
        },
      ],
    });
    mockApiGet.mockResolvedValueOnce({
      buckets: [
        {
          eventCounts: [
            { name: "home_next_action_started", count: 3 },
          ],
        },
      ],
    });

    await expect(
      applyE2ESeedCommand({
        uid: "user-1",
        command: { telemetryBaseline: "homeNextActionStarted" },
      }),
    ).resolves.toEqual(["telemetryBaseline-homeNextActionStarted"]);
    await expect(
      applyE2ESeedCommand({
        uid: "user-1",
        command: { telemetryAssert: "homeNextActionStarted" },
      }),
    ).resolves.toEqual(["telemetryAssert-homeNextActionStarted"]);

    expect(mockFlushTelemetry).toHaveBeenCalledTimes(2);
    expect(mockSetTelemetryUserId).toHaveBeenCalledTimes(2);
    expect(mockSetTelemetryUserId).toHaveBeenCalledWith("user-1");
    expect(mockApiGet).toHaveBeenCalledWith(
      "/api/v2/telemetry/events/summary/daily?days=1",
      { timeout: 10000 },
    );
  });

  it("fails telemetry assertion when baseline is missing", async () => {
    await expect(
      applyE2ESeedCommand({
        uid: "user-1",
        command: { telemetryAssert: "homeNextActionStarted" },
      }),
    ).rejects.toMatchObject({
      code: "e2e/telemetry-baseline-missing",
    });
    expect(mockFlushTelemetry).not.toHaveBeenCalled();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("seeds draft data through the canonical draft storage keys", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-draft" },
    });

    expect(markers).toEqual(["fixture-user-with-draft"]);
    expect(mockSetItem).toHaveBeenCalledWith(
      "current_meal_draft_user-1",
      expect.stringContaining("Kurczak z ryżem"),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "current_meal_draft_screen_user-1",
      "AddMeal",
    );
  });

  it("seeds failed and conflict meals as visible local-only sync states", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-failed-meal" },
    });
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-conflict-meal" },
    });

    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Kanapka z jajkiem",
        syncState: "failed",
      }),
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Makaron z pomidorami",
        syncState: "conflict",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "meal:local:upserted",
      expect.objectContaining({
        uid: "user-1",
        meal: expect.objectContaining({ syncState: "failed" }),
      }),
    );
  });

  it("seeds a current-user private Product/Ingredient conflict projection for Maestro", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { fixture: "user-with-private-product-conflict" },
    });

    expect(markers).toEqual(["fixture-user-with-private-product-conflict"]);
    expect(mockResetOfflineStorage).toHaveBeenCalledTimes(1);
    expect(mockUpsertLocalIngredientProductUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        syncState: "conflict",
        updatedAt: expect.stringMatching(/T10:30:00\.000Z$/),
        lastSyncedAt: 0,
        lastErrorCode: "food-library/conflict",
        lastErrorMessage:
          "Remote Product/Ingredient record conflicts with pending local create.",
        item: expect.objectContaining({
          ingredientProductId: "e2e-private-product-conflict",
          recordScope: "user_scoped",
          ownerUserId: "user-1",
          displayName: "Prywatny konflikt QA",
          ingredientName: "Prywatny konflikt QA",
          sourceAttribution: expect.objectContaining({
            sourceType: "user_created",
            sourceId: "e2e-private-product-conflict-mutation",
          }),
        }),
      }),
    );
    expect(mockSaveMealTransaction).not.toHaveBeenCalled();
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
  });

  it("applies deterministic credits, barcode, AI, billing, and chat state", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: {
        credits: "none",
        ai: "textSuccess",
        barcode: "known",
        billing: "premium",
        chat: "success",
        shareExport: "success",
        notificationPermission: "allowed",
        reminder: "send",
        weeklyReport: "available",
      },
    });

    expect(markers).toEqual([
      "credits-none",
      "ai-textSuccess",
      "barcode-known",
      "billing-premium",
      "chat-success",
      "shareExport-success",
      "notificationPermission-allowed",
      "reminder-send",
      "weeklyReport-available",
    ]);

    const access = getE2EAccessState("user-1");
    expect(access?.tier).toBe("premium");
    expect(access?.credits?.balance).toBe(0);
    expect(access?.credits?.allocation).toBe(800);
    expect(access?.features.aiChat.enabled).toBe(false);
    expect(resolveE2EBarcodeLookup()).toEqual(
      expect.objectContaining({ kind: "found", name: "Jogurt naturalny" }),
    );
    await expect(resolveE2ETextMealAnalysis("user-1")).resolves.toEqual(
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({ name: "Kurczak z ryżem" }),
        ],
      }),
    );
    expect(resolveE2EBillingPurchaseResult("restore")).toEqual({
      status: "success",
    });
    expect(resolveE2EChatRun()).toEqual({
      reply:
        "Wygląda na to, że najważniejszy kolejny krok to spokojnie dopilnować białka i nawodnienia.",
    });
    expect(resolveE2ENotificationPermission()).toEqual(
      expect.objectContaining({ granted: true, status: "granted" }),
    );
    expect(resolveE2EShareExport("gallery")).toEqual({
      status: "success",
      assetUri: "file:///tmp/fitaly-e2e-share-gallery.png",
    });
    expect(resolveE2EReminderDecision("user-1", "2026-05-19")).toEqual(
      expect.objectContaining({
        status: "live_success",
        decision: expect.objectContaining({ decision: "send" }),
      }),
    );
    expect(resolveE2EWeeklyReport("user-1", "2026-05-18")).toEqual(
      expect.objectContaining({
        status: "live_success",
        report: expect.objectContaining({ status: "ready" }),
      }),
    );
  });

  it("seeds Smart Memory local projection for Maestro without backend calls", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "active" },
    });

    expect(markers).toEqual(["smartMemory-active"]);
    expect(mockUpsertSmartMemorySettingsProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ enabled: true }),
    );
    expect(mockUpsertSmartMemoryItemProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        memoryItemId: "e2e-memory-portion-yogurt",
        memoryType: "typical_portion",
        state: "active",
      }),
    );
    expect(mockMarkSmartMemoryCandidatePending).not.toHaveBeenCalled();
  });

  it("seeds Review-specific active Smart Memory projection for Maestro", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "reviewActive" },
    });

    expect(markers).toEqual(["smartMemory-reviewActive"]);
    expect(mockUpsertSmartMemoryItemProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        memoryItemId: "e2e-memory-review-portion-chicken",
        subject: expect.objectContaining({
          displayLabel: "Kurczak grillowany",
        }),
        userValue: { amount: 140, unit: "g" },
      }),
    );
  });

  it("seeds disabled Review Smart Memory precedence fixture for Maestro", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "reviewDisabledActive" },
    });

    expect(markers).toEqual(["smartMemory-reviewDisabledActive"]);
    expect(mockUpsertSmartMemorySettingsProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUpsertSmartMemoryItemProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        memoryItemId: "e2e-memory-review-portion-chicken",
        state: "active",
        userValue: { amount: 140, unit: "g" },
      }),
    );
  });

  it("seeds Smart Memory pending and sync-failed states through projection helpers", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "pending" },
    });
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "syncFailed" },
    });

    expect(mockMarkSmartMemoryCandidatePending).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        input: expect.objectContaining({
          candidateId: "e2e-memory-candidate-portion",
        }),
      }),
    );
    expect(mockMarkSmartMemoryItemPending).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        memoryItemId: "e2e-memory-portion-yogurt",
        operation: "mute",
      }),
    );
    expect(mockMarkSmartMemoryProjectionSyncFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        code: "api/e2e-smart-memory-failure",
      }),
    );
  });

  it("seeds Review Smart Memory candidate as a backend candidate row", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "reviewCandidate" },
    });

    expect(mockUpsertSmartMemorySettingsProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ enabled: true }),
    );
    expect(mockUpsertSmartMemoryCandidateProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        candidateId: "e2e-memory-candidate-portion",
        state: "candidate",
        subject: expect.objectContaining({
          displayLabel: "Kurczak grillowany",
        }),
      }),
    );
    expect(mockMarkSmartMemoryCandidatePending).not.toHaveBeenCalled();
    expect(mockUpsertSmartMemoryItemProjection).not.toHaveBeenCalled();
  });

  it("pulls Smart Memory from backend without local projection seeding", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "backendPull" },
    });

    expect(markers).toEqual(["smartMemory-backendPull"]);
    expect(mockPullSmartMemoryChanges).toHaveBeenCalledWith("user-1");
    expect(mockUpsertSmartMemorySettingsProjection).not.toHaveBeenCalled();
    expect(mockUpsertSmartMemoryItemProjection).not.toHaveBeenCalled();
    expect(mockMarkSmartMemoryCandidatePending).not.toHaveBeenCalled();
    expect(mockMarkSmartMemoryItemPending).not.toHaveBeenCalled();
    expect(mockMarkSmartMemoryProjectionSyncFailed).not.toHaveBeenCalled();
  });

  it("seeds a Smart Memory source-deleted row for Memory Center coverage", async () => {
    const markers = await applyE2ESeedCommand({
      uid: "user-1",
      command: { smartMemory: "sourceDeleted" },
    });

    expect(markers).toEqual(["smartMemory-sourceDeleted"]);
    expect(mockUpsertSmartMemoryItemProjection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        memoryItemId: "e2e-memory-portion-yogurt",
        state: "source_deleted",
        stateReason: "source_deleted",
      }),
    );
  });

  it("supports restore error billing fixture for restore-state visual evidence", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { billing: "restoreError" },
    });

    expect(resolveE2EBillingPurchaseResult("restore")).toEqual({
      status: "error",
      errorCode: "network",
      message: "E2E restore could not contact the store.",
    });
    expect(resolveE2EBillingPurchaseResult("purchase")).toEqual({
      status: "error",
      errorCode: "entitlement_inactive",
      message: "E2E free billing state has no active entitlement.",
    });
  });

  it("supports pending restore fixture without granting backend premium access", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { credits: "ok", billing: "restorePending" },
    });

    expect(resolveE2EBillingPurchaseResult("restore")).toEqual({
      status: "success",
    });
    expect(getE2EAccessState("user-1")).toEqual(
      expect.objectContaining({
        tier: "free",
        entitlementStatus: "inactive",
        credits: expect.objectContaining({ tier: "free" }),
      }),
    );
  });

  it("supports delayed restore failure fixture for loading-state visual evidence", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { billing: "restoreSlowFailure" },
    });

    expect(resolveE2EBillingPurchaseResult("restore")).toEqual({
      status: "error",
      errorCode: "entitlement_inactive",
      message: "E2E delayed restore did not find an active entitlement.",
      delayMs: 5000,
    });
    expect(resolveE2EBillingPurchaseResult("purchase")).toEqual({
      status: "error",
      errorCode: "entitlement_inactive",
      message: "E2E free billing state has no active entitlement.",
    });
  });

  it("returns deterministic chat failure without a backend call", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { chat: "failure" },
    });

    const result = resolveE2EChatRun();
    expect(result).toEqual({ error: expect.any(Error) });
  });

  it("returns deterministic photo analysis for photo E2E flows", async () => {
    await applyE2ESeedCommand({
      uid: "user-1",
      command: { ai: "photoSuccess" },
    });

    await expect(resolveE2EPhotoAnalysis("user-1")).resolves.toEqual(
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({ name: "Kurczak z ryżem" }),
        ],
      }),
    );
  });
});
