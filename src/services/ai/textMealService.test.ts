import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPost = jest.fn<
  (url: string, data?: unknown, options?: unknown) => Promise<unknown>
>();

jest.mock("uuid", () => {
  let counter = 0;
  return {
    v4: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
    }),
  };
});

jest.mock("@/services/core/apiClient", () => ({
  post: (url: string, data?: unknown, options?: unknown) =>
    mockPost(url, data, options),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe("textMealService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("uses backend text meal endpoint and maps returned ingredients", async () => {
    mockPost.mockResolvedValueOnce({
      ingredients: [
        {
          name: "Płatki owsiane",
          amount: 40,
          protein: 5,
          fat: 3,
          carbs: 27,
          kcal: 150,
        },
      ],
      userId: "user-1",
      tier: "free",
      balance: 99,
      allocation: 100,
      periodStartAt: "2026-03-03T00:00:00.000Z",
      periodEndAt: "2026-04-03T00:00:00.000Z",
      costs: { chat: 1, textMeal: 1, photo: 5 },
      version: "test",
      persistence: "backend_owned",
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    const result = await extractIngredientsFromText(
      "user-1",
      {
        name: "owsianka",
        ingredients: "płatki owsiane",
        amount_g: 40,
        notes: null,
      },
      { lang: "pl" },
    );

    expect(mockPost).toHaveBeenCalledWith("/ai/text-meal/analyze", {
      payload: {
        name: "owsianka",
        ingredients: "płatki owsiane",
        amount_g: 40,
        notes: null,
      },
      lang: "pl",
    }, {
      retryMode: "idempotent",
    });
    expect(result?.ingredients).toHaveLength(1);
    expect(result?.ingredients[0]).toMatchObject({
      id: expect.any(String),
      name: "Płatki owsiane",
      amount: 40,
      unit: "g",
      protein: 5,
      fat: 3,
      carbs: 27,
      kcal: 150,
    });
    expect(result?.credits).toMatchObject({
      balance: 99,
      allocation: 100,
      costs: { chat: 1, textMeal: 1, photo: 5 },
    });
  });

  it("returns null when backend responds with zero nutrition values", async () => {
    mockPost.mockResolvedValueOnce({
      ingredients: [
        {
          name: "Kebab",
          amount: 350,
          protein: 0,
          fat: 0,
          carbs: 0,
          kcal: 0,
        },
      ],
      userId: "user-1",
      tier: "free",
      balance: 99,
      allocation: 100,
      periodStartAt: "2026-03-03T00:00:00.000Z",
      periodEndAt: "2026-04-03T00:00:00.000Z",
      costs: { chat: 1, textMeal: 1, photo: 5 },
      version: "test",
      persistence: "backend_owned",
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logWarning } = require("@/services/core/errorLogger");

    const result = await extractIngredientsFromText(
      "user-1",
      {
        name: "kebab",
        ingredients: "kebab",
        amount_g: 350,
        notes: null,
      },
      { lang: "pl" },
    );

    expect(result).toBeNull();
    expect(logWarning).toHaveBeenCalledWith(
      "[textMealService] backend returned ingredients without nutrition values",
      { userUid: "user-1", lang: "pl" },
    );
  });

  it("maps 401 into auth/required service error", async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { status: 401 }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      code: "auth/required",
      source: "TextMealService",
      retryable: false,
    });
  });

  it("maps structured backend consent rejection into explicit consent service error", async () => {
    mockPost.mockRejectedValueOnce({
      status: 403,
      details: {
        detail: {
          code: "AI_CONSENT_REQUIRED",
          message: "AI health data consent required.",
          aiConsent: {
            required: true,
            scope: "global_ai_health_data",
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      code: "ai/consent-required",
      source: "TextMealService",
      retryable: false,
      message: "AI health data consent required.",
    });
  });

  it("maps 503 into ai/unavailable service error", async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      code: "ai/unavailable",
      source: "TextMealService",
      retryable: true,
    });
  });

  it("maps structured provider unavailable rejection to provider-unavailable UX", async () => {
    mockPost.mockRejectedValueOnce({
      status: 503,
      details: {
        detail: {
          code: "AI_CHAT_PROVIDER_UNAVAILABLE",
          message: "AI provider is temporarily unavailable.",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAiUxErrorType } = require("@/services/ai/uxError");

    try {
      await extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" });
      throw new Error("Expected extractIngredientsFromText to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ai/unavailable",
        source: "TextMealService",
        retryable: true,
        message: "AI provider is temporarily unavailable.",
      });
      expect(getAiUxErrorType(error)).toBe("AI_CHAT_PROVIDER_UNAVAILABLE");
    }
  });

  it("maps structured provider timeout rejection to timeout UX", async () => {
    mockPost.mockRejectedValueOnce({
      status: 504,
      details: {
        detail: {
          code: "AI_CHAT_TIMEOUT",
          message: "AI provider timed out before a response was generated.",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAiUxErrorType } = require("@/services/ai/uxError");

    try {
      await extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" });
      throw new Error("Expected extractIngredientsFromText to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "api/timeout",
        source: "TextMealService",
        retryable: true,
        message: "AI provider timed out before a response was generated.",
      });
      expect(getAiUxErrorType(error)).toBe("AI_CHAT_TIMEOUT");
    }
  });

  it("maps structured meal-analysis disabled rejection into explicit disabled service error", async () => {
    mockPost.mockRejectedValueOnce({
      status: 503,
      details: {
        detail: {
          code: "AI_MEAL_ANALYSIS_DISABLED",
          message: "Meal analysis AI is temporarily disabled.",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      code: "ai/meal-analysis-disabled",
      source: "TextMealService",
      retryable: false,
      message: "Meal analysis AI is temporarily disabled.",
    });
  });

  it("maps structured meal-analysis idempotency conflict into explicit service error", async () => {
    mockPost.mockRejectedValueOnce({
      status: 409,
      details: {
        detail: {
          code: "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT",
          message: "Meal analysis request is already in progress or completed.",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      code: "ai/meal-analysis-idempotency-conflict",
      source: "TextMealService",
      retryable: false,
      message: "Meal analysis request is already in progress or completed.",
    });
  });

  it("passes 402 through for credits refresh flow", async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error("payment required"), { status: 402 }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractIngredientsFromText } = require("@/services/ai/textMealService");

    await expect(
      extractIngredientsFromText("user-1", { name: "burger" }, { lang: "en" }),
    ).rejects.toMatchObject({
      status: 402,
    });
  });
});
