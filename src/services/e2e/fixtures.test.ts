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
const mockUpsertMealLocal = jest.fn<(meal: unknown) => Promise<void>>();
const mockUpsertMyMealLocal = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();
const mockGetSampleMealUri = jest.fn<() => Promise<string>>();
const mockUpsertSmartMemorySettingsProjection =
  jest.fn<(uid: string, settings: unknown) => Promise<void>>();
const mockUpsertSmartMemoryItemProjection =
  jest.fn<(uid: string, item: unknown) => Promise<void>>();
const mockMarkSmartMemoryCandidatePending =
  jest.fn<(params: unknown) => Promise<void>>();
const mockMarkSmartMemoryItemPending =
  jest.fn<(params: unknown) => Promise<void>>();
const mockMarkSmartMemoryProjectionSyncFailed =
  jest.fn<(params: unknown) => Promise<void>>();

let mockE2EEnabled = true;

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: (key: string, value: string) => mockSetItem(key, value),
  multiRemove: (keys: string[]) => mockMultiRemove(keys),
  removeItem: (key: string) => mockRemoveItem(key),
}));

jest.mock("@/services/e2e/config", () => ({
  isE2EModeEnabled: () => mockE2EEnabled,
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

jest.mock("@/services/offline/meals.repo", () => ({
  upsertMealLocal: (meal: unknown) => mockUpsertMealLocal(meal),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealLocal: (uid: string, meal: unknown) =>
    mockUpsertMyMealLocal(uid, meal),
}));

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
    mockUpsertMealLocal.mockResolvedValue(undefined);
    mockUpsertMyMealLocal.mockResolvedValue(undefined);
    mockGetSampleMealUri.mockResolvedValue("file:///sampleMeal-local.jpg");
    mockUpsertSmartMemorySettingsProjection.mockResolvedValue(undefined);
    mockUpsertSmartMemoryItemProjection.mockResolvedValue(undefined);
    mockMarkSmartMemoryCandidatePending.mockResolvedValue(undefined);
    mockMarkSmartMemoryItemPending.mockResolvedValue(undefined);
    mockMarkSmartMemoryProjectionSyncFailed.mockResolvedValue(undefined);
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
        smartMemory: "backendPull",
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
      smartMemory: "backendPull",
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
    expect(mockUpsertMealLocal).not.toHaveBeenCalled();
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
