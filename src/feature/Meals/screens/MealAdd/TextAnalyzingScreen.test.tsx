import type { ReactNode } from "react";
import { waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import TextAnalyzingScreen from "@/feature/Meals/screens/MealAdd/TextAnalyzingScreen";
import type { MealAddScreenProps } from "@/feature/Meals/feature/MapMealAddScreens";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { Meal } from "@/types";

type ExtractIngredientsFromText = (
  userUid: string,
  payload: unknown,
  opts?: { lang?: string },
) => Promise<{
  ingredients: Array<{
    id: string;
    name: string;
    amount: number;
    unit?: string;
    protein: number;
    fat: number;
    carbs: number;
    kcal: number;
  }>;
  credits: {
    userId: string;
    tier: "free" | "premium";
    balance: number;
    allocation: number;
    periodStartAt: string;
    periodEndAt: string;
    costs: { chat: number; textMeal: number; photo: number };
    version: string;
    persistence: "backend_owned";
  };
} | null>;

const mockExtractIngredientsFromText = jest.fn<ExtractIngredientsFromText>();
const mockGetErrorStatus = jest.fn();
const mockGetAiUxErrorType = jest.fn();
const mockGetMealAiMetaFromAiResponse = jest.fn();
const mockPost = jest.fn<(url: string, data?: unknown) => Promise<unknown>>();
const mockUseAuthContext = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseAiCreditsContext = jest.fn();
const mockUseAccessContext = jest.fn();
const mockUseMealDraftContext = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/services/ai/textMealService", () => ({
  extractIngredientsFromText: (...args: Parameters<ExtractIngredientsFromText>) =>
    mockExtractIngredientsFromText(...args),
}));

jest.mock("@/services/contracts/serviceError", () => ({
  getErrorStatus: (error: unknown) => mockGetErrorStatus(error),
}));

jest.mock("@/services/ai/uxError", () => ({
  getAiUxErrorType: (error: unknown) => mockGetAiUxErrorType(error),
}));

jest.mock("@/services/meals/mealMetadata", () => ({
  getMealAiMetaFromAiResponse: (value: unknown) =>
    mockGetMealAiMetaFromAiResponse(value),
}));

jest.mock("@/services/core/apiClient", () => ({
  post: (url: string, data?: unknown) => mockPost(url, data),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserContext(),
}));

jest.mock("@/context/AiCreditsContext", () => ({
  useAiCreditsContext: () => mockUseAiCreditsContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => mockUseAccessContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; ns?: string }) =>
      options?.defaultValue ?? `${options?.ns ?? "meals"}:${key}`,
  }),
}));

jest.mock("@/components", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    Layout: ({ children }: { children?: ReactNode }) =>
      createElement(View, null, children),
    TextInput: ({ label, value }: { label?: string; value: string }) =>
      createElement(
        View,
        null,
        createElement(Text, null, label ?? ""),
        createElement(Text, null, value),
      ),
    Toast: {
      show: jest.fn(),
    },
  };
});

jest.mock("@/components/AiCreditsBadge", () => ({
  AiCreditsBadge: () => null,
}));

jest.mock("@/feature/Meals/components/MealAddPhotoScaffold", () => ({
  MealAddPhotoScaffold: ({
    preview,
    content,
  }: {
    preview?: ReactNode;
    content?: ReactNode;
  }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(View, null, preview, content);
  },
  MealAddStatusBanner: ({ label }: { label: string }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return createElement(Text, null, label);
  },
}));

const creditsSnapshot = {
  userId: "user-1",
  tier: "free" as const,
  balance: 5,
  allocation: 100,
  periodStartAt: "2026-03-01T00:00:00.000Z",
  periodEndAt: "2026-04-01T00:00:00.000Z",
  costs: { chat: 1, textMeal: 1, photo: 5 },
  version: "v1",
  persistence: "backend_owned" as const,
};

describe("TextAnalyzingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseUserContext.mockReturnValue({ language: "pl" });
    mockGetErrorStatus.mockImplementation((error: unknown) => {
      if (!error || typeof error !== "object") return undefined;
      return (error as { status?: number }).status;
    });
    mockGetAiUxErrorType.mockReturnValue("unknown");
    mockGetMealAiMetaFromAiResponse.mockReturnValue(null);
    mockUseAccessContext.mockReturnValue({
      applyAccessFromResponse: jest.fn((value: unknown) => value),
      refreshAccess: jest.fn(async () => ({ credits: creditsSnapshot })),
    });
  });

  it("retries after syncing credits when the first analysis returns 402", async () => {
    const applyCreditsFromResponse = jest.fn((value: unknown) => value);
    const refreshCredits = jest.fn(async () => creditsSnapshot);
    const applyAccessFromResponse = jest.fn((value: unknown) => value);
    const refreshAccess = jest.fn(async () => ({ credits: creditsSnapshot }));
    const setMeal = jest.fn();
    const saveDraft = jest.fn(async (_uid: string, _meal?: Meal | null) => undefined);
    const setLastScreen = jest.fn(async (_uid: string, _screen: string) => undefined);
    const props = {
      navigation: { navigate: jest.fn() } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"TextAnalyzing">["flow"],
      params: {
        analysisRequestId: "req-1",
        name: "Kawa z mlekiem",
        quickDescription: "duza kawa z mlekiem 2%",
        retries: 0,
      },
    } as MealAddScreenProps<"TextAnalyzing">;

    mockUseAiCreditsContext.mockReturnValue({
      applyCreditsFromResponse,
      refreshCredits,
    });
    mockUseAccessContext.mockReturnValue({
      applyAccessFromResponse,
      refreshAccess,
    });
    mockUseMealDraftContext.mockReturnValue({
      meal: null,
      saveDraft,
      setLastScreen,
      setMeal,
    });
    mockExtractIngredientsFromText
      .mockRejectedValueOnce(Object.assign(new Error("payment required"), { status: 402 }))
      .mockResolvedValueOnce({
        ingredients: [
          {
            id: "ing-1",
            name: "Kawa z mlekiem",
            amount: 300,
            unit: "ml",
            protein: 4,
            fat: 3,
            carbs: 8,
            kcal: 80,
          },
        ],
        credits: creditsSnapshot,
      });
    renderWithTheme(<TextAnalyzingScreen {...props} />);

    await waitFor(() => {
      expect(props.flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(refreshCredits).not.toHaveBeenCalled();
    expect(refreshAccess).toHaveBeenCalledTimes(1);
    expect(mockExtractIngredientsFromText).toHaveBeenCalledTimes(2);
    expect(applyCreditsFromResponse).toHaveBeenCalledWith(creditsSnapshot);
    expect(applyAccessFromResponse).toHaveBeenCalledWith(creditsSnapshot);
    expect(setLastScreen).toHaveBeenCalledWith("user-1", "AddMeal");
  });

  it("runs text analysis once for the same payload across rerenders", async () => {
    const applyCreditsFromResponse = jest.fn((value: unknown) => value);
    const refreshCredits = jest.fn(async () => creditsSnapshot);
    const saveDraft = jest.fn(async (_uid: string, _meal?: Meal | null) => undefined);
    const setLastScreen = jest.fn(async (_uid: string, _screen: string) => undefined);
    let currentMeal: Meal | null = null;
    const setMeal = jest.fn((nextMeal: Meal) => {
      currentMeal = nextMeal;
    });
    const props = {
      navigation: { navigate: jest.fn() } as never,
      flow: {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
      } as unknown as MealAddScreenProps<"TextAnalyzing">["flow"],
      params: {
        analysisRequestId: "req-2",
        name: "Kawa",
        quickDescription: "Kawa z mlekiem i miodem - 300ml",
        retries: 0,
      },
    } as MealAddScreenProps<"TextAnalyzing">;

    mockUseAiCreditsContext.mockReturnValue({
      applyCreditsFromResponse,
      refreshCredits,
    });
    mockUseMealDraftContext.mockImplementation(() => ({
      meal: currentMeal,
      saveDraft,
      setLastScreen,
      setMeal,
    }));
    mockExtractIngredientsFromText.mockResolvedValue({
      ingredients: [
        {
          id: "ing-1",
          name: "Kawa z mlekiem i miodem",
          amount: 300,
          unit: "ml",
          protein: 4,
          fat: 4,
          carbs: 20,
          kcal: 140,
        },
      ],
      credits: creditsSnapshot,
    });

    const view = renderWithTheme(<TextAnalyzingScreen {...props} />);

    await waitFor(() => {
      expect(props.flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    });
    expect(mockExtractIngredientsFromText).toHaveBeenCalledTimes(1);

    view.rerender(<TextAnalyzingScreen {...props} />);

    await waitFor(() => {
      expect(mockExtractIngredientsFromText).toHaveBeenCalledTimes(1);
    });
  });
});
