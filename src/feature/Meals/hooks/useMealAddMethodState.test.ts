import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useMealAddMethodState } from "@/feature/Meals/hooks/useMealAddMethodState";

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockSetMeal = jest.fn();
const mockSaveDraft = jest.fn<(uid: string, meal: unknown) => Promise<void>>();
const mockSetLastScreen = jest.fn<(uid: string, screen: string) => Promise<void>>();
const mockLoadDraft = jest.fn<(uid: string) => Promise<void>>();
const mockRemoveDraft = jest.fn<(uid: string) => Promise<void>>();
const mockUseAuthContext = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@contexts/MealDraftContext", () => ({
  getDraftKey: (uid: string) => `draft:${uid}`,
  getScreenKey: (uid: string) => `screen:${uid}`,
  useMealDraftContext: () => ({
    setMeal: mockSetMeal,
    saveDraft: (uid: string, meal: unknown) => mockSaveDraft(uid, meal),
    setLastScreen: (uid: string, screen: string) => mockSetLastScreen(uid, screen),
    loadDraft: (uid: string) => mockLoadDraft(uid),
    removeDraft: (uid: string) => mockRemoveDraft(uid),
  }),
}));

jest.mock("@/services/e2e/config", () => ({
  E2E_DETERMINISTIC_INGREDIENT: {
    id: "ingredient-1",
    name: "ingredient",
    kcal: 100,
    protein: 1,
    fat: 1,
    carbs: 1,
    amount: 1,
    unit: "g",
  },
  isE2EModeEnabled: () => false,
}));

describe("useMealAddMethodState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ uid: null });
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockSaveDraft.mockResolvedValue(undefined);
    mockSetLastScreen.mockResolvedValue(undefined);
    mockLoadDraft.mockResolvedValue(undefined);
    mockRemoveDraft.mockResolvedValue(undefined);
  });

  it("broadcasts persisted default method changes to other hook instances", async () => {
    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const homeHook = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );
    const chooserHook = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        persistSelection: true,
      }),
    );

    await waitFor(() => {
      expect(homeHook.result.current.preferredMethodKey).toBe("photo");
    });

    const textOption = chooserHook.result.current.options.find(
      (option) => option.key === "text",
    );

    expect(textOption).toBeTruthy();

    await act(async () => {
      await chooserHook.result.current.handleOptionPress(textOption!);
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      "meal-add-preferred-method",
      "text",
    );
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "DescribeMeal",
    });

    await waitFor(() => {
      expect(homeHook.result.current.preferredMethodKey).toBe("text");
    });
    expect(homeHook.result.current.preferredOption.key).toBe("text");
  });

  it("resumes unfinished AddMeal drafts in the new review flow", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "draft:user-1") {
        return JSON.stringify({
          mealId: "draft-1",
          createdAt: "2026-03-30T08:00:00.000Z",
          ingredients: [{ name: "Chicken", amount: 120, kcal: 220 }],
        });
      }
      if (key === "screen:user-1") return "AddMeal";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
      }),
    );

    await act(async () => {
      await result.current.handleOptionPress(result.current.options[0]);
    });

    expect(result.current.showResumeModal).toBe(true);
    expect(result.current.resumeDraftMeal).toEqual(
      expect.objectContaining({ mealId: "draft-1" }),
    );

    await act(async () => {
      await result.current.handleContinueDraft();
    });

    expect(mockLoadDraft).toHaveBeenCalledWith("user-1");
    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "ReviewMeal",
    });
    expect(result.current.resumeDraftMeal).toBeNull();
  });

  it("starts the preferred photo method at the instructional entry by default", async () => {
    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("starts the preferred photo method in fullscreen camera mode when stored", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") return "true";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
      fullscreenPreferred: true,
    });
  });

  it("falls back to the instructional photo entry for invalid fullscreen preference values", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") return "fullscreen";
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("falls back to the instructional photo entry when fullscreen preference storage fails", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === "meal-add-preferred-method") return null;
      if (key === "meal-add:photo-fullscreen:user-1") {
        throw new Error("storage unavailable");
      }
      return null;
    });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: false,
      }),
    );

    await act(async () => {
      await result.current.handleDirectStart();
    });

    expect(mockNavigate).toHaveBeenCalledWith("AddMeal", {
      start: "CameraDefault",
      attempt: 1,
    });
  });

  it("resets the stack when starting a new method from inside the meal add flow", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
        resetStackOnStart: true,
      }),
    );

    const textOption = result.current.options.find((option) => option.key === "text");

    await act(async () => {
      await result.current.handleOptionPress(textOption!);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: {
          index: 1,
          routes: [
            { name: "Home" },
            { name: "AddMeal", params: { start: "DescribeMeal" } },
          ],
        },
      }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("starts manual meals at the details editor with a manual draft", async () => {
    mockUseAuthContext.mockReturnValue({ uid: "user-1" });

    const navigation = {
      navigate: mockNavigate,
      replace: mockReplace,
      dispatch: mockDispatch,
    } as const;

    const { result } = renderHook(() =>
      useMealAddMethodState({
        navigation,
        replaceOnStart: true,
      }),
    );

    const manualOption = result.current.options.find(
      (option) => option.key === "manual",
    );

    expect(manualOption).toBeTruthy();

    await act(async () => {
      await result.current.handleOptionPress(manualOption!);
    });

    expect(mockReplace).toHaveBeenCalledWith("AddMeal", {
      start: "EditMealDetails",
    });
    expect(mockSaveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        inputMethod: "manual",
      }),
    );
  });
});
