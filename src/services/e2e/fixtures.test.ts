import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  __resetE2EFixturesForTests,
  applyE2ESeedCommand,
  getE2EAccessState,
  parseE2ESeedCommand,
  resolveE2EBarcodeLookup,
  resolveE2EBillingPurchaseResult,
  resolveE2EChatRun,
  resolveE2ETextMealAnalysis,
} from "@/services/e2e/fixtures";

const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockMultiRemove = jest.fn<(keys: string[]) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();
const mockResetOfflineStorage = jest.fn();
const mockSaveMealTransaction = jest.fn<(input: unknown) => Promise<unknown>>();
const mockUpsertMyMealLocal = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();

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

jest.mock("@/services/meals/mealSaveTransaction", () => ({
  saveMealTransaction: (input: unknown) => mockSaveMealTransaction(input),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealLocal: (uid: string, meal: unknown) =>
    mockUpsertMyMealLocal(uid, meal),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload),
}));

describe("E2E fixtures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockE2EEnabled = true;
    mockSetItem.mockResolvedValue(undefined);
    mockMultiRemove.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    mockSaveMealTransaction.mockResolvedValue({});
    mockUpsertMyMealLocal.mockResolvedValue(undefined);
    __resetE2EFixturesForTests();
  });

  it("parses only supported seed values", () => {
    expect(
      parseE2ESeedCommand({
        fixture: "user-with-today-meal",
        credits: "none",
        ai: "textSuccess",
        barcode: "known",
        billing: "premium",
        chat: "success",
      }),
    ).toEqual({
      fixture: "user-with-today-meal",
      credits: "none",
      ai: "textSuccess",
      barcode: "known",
      billing: "premium",
      chat: "success",
    });

    expect(
      parseE2ESeedCommand({
        fixture: "unknown",
        credits: "bad",
        ai: "bad",
        barcode: "bad",
        billing: "bad",
        chat: "bad",
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
    expect(getE2EAccessState("user-1")).toBeNull();
    expect(resolveE2EBarcodeLookup()).toBeNull();
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
          name: "E2E Today Meal",
          inputMethod: "manual",
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
        name: "E2E Saved Bowl",
        source: "saved",
        inputMethod: "saved",
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
      expect.stringContaining("E2E Draft Meal"),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "current_meal_draft_screen_user-1",
      "AddMeal",
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
      },
    });

    expect(markers).toEqual([
      "credits-none",
      "ai-textSuccess",
      "barcode-known",
      "billing-premium",
      "chat-success",
    ]);

    const access = getE2EAccessState("user-1");
    expect(access?.tier).toBe("premium");
    expect(access?.credits?.balance).toBe(0);
    expect(access?.features.aiChat.enabled).toBe(false);
    expect(resolveE2EBarcodeLookup()).toEqual(
      expect.objectContaining({ kind: "found", name: "E2E Barcode Yogurt" }),
    );
    await expect(resolveE2ETextMealAnalysis("user-1")).resolves.toEqual(
      expect.objectContaining({
        ingredients: [expect.objectContaining({ name: "E2E analyzed bowl" })],
      }),
    );
    expect(resolveE2EBillingPurchaseResult("restore")).toEqual({
      status: "success",
    });
    expect(resolveE2EChatRun()).toEqual({
      reply:
        "E2E chat response: keep hydration consistent and plan the next meal.",
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
});
