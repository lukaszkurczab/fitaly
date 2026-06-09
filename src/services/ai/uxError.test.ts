import { describe, expect, it } from "@jest/globals";

import { getAiUxErrorType } from "@/services/ai/uxError";

describe("getAiUxErrorType", () => {
  it("prefers canonical backend detail.code for AI Chat v2", () => {
    expect(
      getAiUxErrorType({
        status: 503,
        details: {
          detail: {
            code: "AI_CHAT_CONTEXT_UNAVAILABLE",
            message: "Chat context is temporarily unavailable.",
          },
        },
      }),
    ).toBe("AI_CHAT_CONTEXT_UNAVAILABLE");
  });

  it("maps global backend consent detail to the consent-required UX state", () => {
    expect(
      getAiUxErrorType({
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
      }),
    ).toBe("AI_CONSENT_REQUIRED");
  });

  it("maps Add Meal consent service errors to the consent-required UX state", () => {
    expect(
      getAiUxErrorType(
        Object.assign(new Error("AI health data consent required."), {
          code: "ai/consent-required",
          source: "TextMealService",
          retryable: false,
        }),
      ),
    ).toBe("AI_CONSENT_REQUIRED");
  });

  it("maps structured meal-analysis disabled detail to the disabled UX state", () => {
    expect(
      getAiUxErrorType({
        status: 503,
        details: {
          detail: {
            code: "AI_MEAL_ANALYSIS_DISABLED",
            message: "Meal analysis AI is temporarily disabled.",
          },
        },
      }),
    ).toBe("AI_MEAL_ANALYSIS_DISABLED");
  });

  it("maps Add Meal disabled service errors to the disabled UX state", () => {
    expect(
      getAiUxErrorType(
        Object.assign(new Error("Meal analysis AI is temporarily disabled."), {
          code: "ai/meal-analysis-disabled",
          source: "TextMealService",
          retryable: false,
        }),
      ),
    ).toBe("AI_MEAL_ANALYSIS_DISABLED");
  });

  it("maps structured Add Meal idempotency conflict detail to the conflict UX state", () => {
    expect(
      getAiUxErrorType({
        status: 409,
        details: {
          detail: {
            code: "AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT",
            message: "Meal analysis request is already in progress or completed.",
          },
        },
      }),
    ).toBe("AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT");
  });

  it("maps Add Meal idempotency service errors to the conflict UX state", () => {
    expect(
      getAiUxErrorType(
        Object.assign(
          new Error("Meal analysis request is already in progress or completed."),
          {
            code: "ai/meal-analysis-idempotency-conflict",
            source: "TextMealService",
            retryable: false,
          },
        ),
      ),
    ).toBe("AI_MEAL_ANALYSIS_IDEMPOTENCY_CONFLICT");
  });

  it("maps structured provider unavailable detail to provider-unavailable UX", () => {
    expect(
      getAiUxErrorType({
        status: 503,
        details: {
          detail: {
            code: "AI_CHAT_PROVIDER_UNAVAILABLE",
            message: "AI provider is temporarily unavailable.",
          },
        },
      }),
    ).toBe("AI_CHAT_PROVIDER_UNAVAILABLE");
  });

  it("maps structured provider timeout detail to timeout UX", () => {
    expect(
      getAiUxErrorType({
        status: 504,
        details: {
          detail: {
            code: "AI_CHAT_TIMEOUT",
            message: "AI provider timed out before a response was generated.",
          },
        },
      }),
    ).toBe("AI_CHAT_TIMEOUT");
  });

  it("maps structured credits exhausted detail to no-credit UX", () => {
    expect(
      getAiUxErrorType({
        status: 402,
        details: {
          detail: {
            code: "AI_CREDITS_EXHAUSTED",
            message: "AI credits exhausted.",
            credits: {
              userId: "user-1",
              tier: "free",
              balance: 0,
              allocation: 100,
              periodStartAt: "2026-04-19T00:00:00Z",
              periodEndAt: "2026-05-19T00:00:00Z",
              costs: { chat: 1, textMeal: 1, photo: 5 },
            },
          },
        },
      }),
    ).toBe("AI_CREDITS_EXHAUSTED");
  });

  it("does not turn unrecognized structured 403 codes into consent aliases", () => {
    expect(
      getAiUxErrorType({
        status: 403,
        details: {
          detail: {
            code: "AI_FORBIDDEN_UNKNOWN",
            message: "Forbidden.",
          },
        },
      }),
    ).toBe("unknown");
  });

  it("maps status-only 403 responses to unknown instead of consent-required", () => {
    expect(getAiUxErrorType({ status: 403 })).toBe("unknown");
  });

  it("maps timeout-like service failures to AI_CHAT_TIMEOUT", () => {
    expect(
      getAiUxErrorType(
        Object.assign(new Error("AI service unavailable"), {
          code: "ai/unavailable",
          source: "ApiClient",
          retryable: true,
          cause: Object.assign(new Error("Timed out"), {
            code: "api/timeout",
            source: "ApiClient",
            retryable: true,
          }),
        }),
      ),
    ).toBe("AI_CHAT_TIMEOUT");
  });

  it("maps 500 fallback to AI_CHAT_INTERNAL_ERROR", () => {
    expect(getAiUxErrorType({ status: 500 })).toBe("AI_CHAT_INTERNAL_ERROR");
  });

  it("keeps generic status-only 503 responses mapped to provider unavailable", () => {
    expect(getAiUxErrorType({ status: 503 })).toBe(
      "AI_CHAT_PROVIDER_UNAVAILABLE",
    );
  });
});
