import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { detectIngredientsWithVision } from "@/services/ai/visionService";
import { isServiceError } from "@/services/contracts/serviceError";

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockUriToBase64 = jest.fn<(uri: string) => Promise<string>>();
const mockConvertToJpegAndResize = jest.fn<
  (
    uri: string,
    width: number,
    height: number,
    options?: Record<string, unknown>,
  ) => Promise<string>
>();
const mockPost = jest.fn<
  (url: string, data?: unknown, options?: unknown) => Promise<unknown>
>();
const mockLogError = jest.fn();
const mockUuid = jest.fn<() => string>();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: (...args: []) => mockNetInfoFetch(...args),
  },
}));

jest.mock("@/utils/uriToBase64", () => ({
  uriToBase64: (uri: string) => mockUriToBase64(uri),
}));

jest.mock("@/utils/convertToJpegAndResize", () => ({
  convertToJpegAndResize: (
    uri: string,
    width: number,
    height: number,
    options?: Record<string, unknown>,
  ) => mockConvertToJpegAndResize(uri, width, height, options),
}));

jest.mock("@/services/core/apiClient", () => ({
  post: (url: string, data?: unknown, options?: unknown) =>
    mockPost(url, data, options),
}));

jest.mock("@/services/core/errorLogger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

describe("visionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockConvertToJpegAndResize.mockResolvedValue("file:///tmp/resized.jpg");
    mockUriToBase64.mockResolvedValue("base64-image");
    mockUuid.mockImplementation(() => `uuid-${mockUuid.mock.calls.length + 1}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps backend photo analyze ingredients directly into app ingredients", async () => {
    mockPost.mockResolvedValueOnce({
      ingredients: [
        {
          name: "Owsianka",
          amount: 250,
          protein: 10,
          fat: 6,
          carbs: 30,
          kcal: 210,
          unit: "ml",
        },
      ],
      userId: "user-1",
      tier: "free",
      balance: 95,
      allocation: 100,
      periodStartAt: "2026-03-03T00:00:00.000Z",
      periodEndAt: "2026-04-03T00:00:00.000Z",
      costs: { chat: 1, textMeal: 1, photo: 5 },
      version: "test",
      persistence: "backend_owned",
    });

    const result = await detectIngredientsWithVision("user-1", "file:///meal.jpg", {
      lang: "EN",
    });

    expect(mockConvertToJpegAndResize).toHaveBeenCalledWith(
      "file:///meal.jpg",
      512,
      512,
      expect.objectContaining({
        userUid: "user-1",
        dir: "tmp",
      }),
    );
    expect(mockUriToBase64).toHaveBeenCalledWith("file:///tmp/resized.jpg");
    expect(mockPost).toHaveBeenCalledWith("/ai/photo/analyze", {
      imageBase64: "base64-image",
      lang: "en",
    }, {
      retryMode: "idempotent",
    });
    expect(result).toMatchObject({
      ingredients: [
        {
          id: expect.any(String),
          name: "Owsianka",
          amount: 250,
          unit: "ml",
          protein: 10,
          fat: 6,
          carbs: 30,
          kcal: 210,
        },
      ],
    });
    expect(result?.credits).toMatchObject({
      balance: 95,
      allocation: 100,
      tier: "free",
    });
  });

  it("returns offline service error when network is unavailable", async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
      }),
    ).rejects.toMatchObject({
      code: "offline",
      source: "VisionService",
      retryable: true,
    });

    expect(mockConvertToJpegAndResize).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("wraps backend failures as ai/unavailable and logs them", async () => {
    mockPost.mockRejectedValueOnce(new Error("backend down"));

    try {
      await detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      });
      throw new Error("Expected detectIngredientsWithVision to reject");
    } catch (error) {
      expect(isServiceError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "ai/unavailable",
        source: "VisionService",
        retryable: true,
      });
    }

    expect(mockLogError).toHaveBeenCalledWith(
      "[visionService] backend photo analysis failed",
      { userUid: "user-1", lang: "pl" },
      expect.any(Error),
    );
  });

  it("maps 401 into auth/required service error", async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { status: 401 }));

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      code: "auth/required",
      source: "VisionService",
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

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      code: "ai/consent-required",
      source: "VisionService",
      retryable: false,
      message: "AI health data consent required.",
    });
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

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      code: "ai/meal-analysis-disabled",
      source: "VisionService",
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

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      code: "ai/meal-analysis-idempotency-conflict",
      source: "VisionService",
      retryable: false,
      message: "Meal analysis request is already in progress or completed.",
    });
  });

  it("keeps generic 503 backend failures mapped to ai/unavailable", async () => {
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error("unavailable"), { status: 503 }),
    );

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      code: "ai/unavailable",
      source: "VisionService",
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
    const { getAiUxErrorType } = require("@/services/ai/uxError");

    try {
      await detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      });
      throw new Error("Expected detectIngredientsWithVision to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ai/unavailable",
        source: "VisionService",
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
    const { getAiUxErrorType } = require("@/services/ai/uxError");

    try {
      await detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      });
      throw new Error("Expected detectIngredientsWithVision to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "api/timeout",
        source: "VisionService",
        retryable: true,
        message: "AI provider timed out before a response was generated.",
      });
      expect(getAiUxErrorType(error)).toBe("AI_CHAT_TIMEOUT");
    }
  });

  it("passes 402 through for credits refresh flow", async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error("payment required"), { status: 402 }));

    await expect(
      detectIngredientsWithVision("user-1", "file:///meal.jpg", {
        lang: "pl",
      }),
    ).rejects.toMatchObject({
      status: 402,
    });
  });
});
