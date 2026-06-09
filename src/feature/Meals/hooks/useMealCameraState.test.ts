import { act, renderHook } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Meal } from "@/types/meal";
import { useMealCameraState } from "@/feature/Meals/hooks/useMealCameraState";
import { getSampleMealUri } from "@/utils/devSamples";

const mockUseMealDraftContext = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseUserProfileContext = jest.fn();
const mockUseAiCreditsContext = jest.fn();
const mockCanAfford = jest.fn(() => true);
const mockCanUseFeature = jest.fn((feature: string) => feature === "photoAnalysis");
const mockDevice = { isDevice: true };
const mockNormalizeImageOrientation = jest.fn<(uri: string) => Promise<string>>();

jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

jest.mock("expo-device", () => mockDevice);

jest.mock("@contexts/MealDraftContext", () => ({
  useMealDraftContext: () => mockUseMealDraftContext(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserProfileContext(),
}));

jest.mock("@/context/AiCreditsContext", () => ({
  useAiCreditsContext: () => mockUseAiCreditsContext(),
}));

jest.mock("@/context/AccessContext", () => ({
  useAccessContext: () => ({
    accessState: {
      credits: {
        userId: "user-1",
        tier: "free",
        balance: 10,
        allocation: 100,
        periodStartAt: "2026-03-01T00:00:00.000Z",
        periodEndAt: "2026-04-01T00:00:00.000Z",
        costs: { chat: 1, textMeal: 1, photo: 5 },
      },
    },
    loading: false,
    refreshAccess: jest.fn(),
    applyAccessFromResponse: jest.fn(),
    canUseFeature: mockCanUseFeature,
    getFeature: jest.fn(),
  }),
}));

jest.mock("@/utils/devSamples", () => ({
  getSampleMealUri: jest.fn(),
}));

jest.mock("@/utils/normalizeImageOrientation", () => ({
  normalizeImageOrientation: (uri: string) => mockNormalizeImageOrientation(uri),
}));

const baseMeal = (): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  timestamp: "2026-03-01T10:00:00.000Z",
  type: "other",
  name: null,
  ingredients: [],
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  syncState: "pending",
  source: null,
  photoUrl: null,
});

const activeAiConsent = {
  status: "granted",
  grantedAt: "2026-06-01T10:00:00.000Z",
  revokedAt: null,
};

describe("useMealCameraState", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  const mockedGetSampleMealUri = getSampleMealUri as jest.MockedFunction<
    typeof getSampleMealUri
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockDevice.isDevice = true;
    mockCanAfford.mockReturnValue(true);
    mockCanUseFeature.mockImplementation((feature: string) => feature === "photoAnalysis");
    mockNormalizeImageOrientation.mockImplementation(async (uri: string) => uri);

    mockUseAuthContext.mockReturnValue({ uid: "user-1" });
    mockUseUserProfileContext.mockReturnValue({
      userData: {
        profile: {
          aiConsent: activeAiConsent,
        },
      },
    });
    mockUseAiCreditsContext.mockReturnValue({
      credits: {
        userId: "user-1",
        tier: "free",
        balance: 10,
        allocation: 100,
        periodStartAt: "2026-03-01T00:00:00.000Z",
        periodEndAt: "2026-04-01T00:00:00.000Z",
        costs: { chat: 1, textMeal: 1, photo: 5 },
      },
      canAfford: mockCanAfford,
    });
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("persists photo drafts before moving to preparing review", async () => {
    const setMeal = jest.fn();
    const updateMeal = jest.fn();
    const setLastScreen = jest.fn(async () => undefined);
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(async () => undefined);
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal,
      updateMeal,
      setLastScreen,
      saveDraft,
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    await act(async () => {
      await result.current.handleAccept("file:///meal.jpg");
    });

    expect(updateMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        photoUrl: "file:///meal.jpg",
        inputMethod: "photo",
      }),
    );
    expect(saveDraft).toHaveBeenLastCalledWith(
      "user-1",
      expect.objectContaining({
        photoUrl: "file:///meal.jpg",
        inputMethod: "photo",
      }),
    );
    expect(flow.goTo).toHaveBeenCalledWith("PreparingReviewPhoto", {
      image: "file:///meal.jpg",
      id: "meal-1",
      attempt: 1,
    });
  });

  it("replaces the camera step with review when detection is skipped", async () => {
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: { skipDetection: true },
      }),
    );

    await act(async () => {
      await result.current.handleAccept("file:///meal.jpg");
    });

    expect(flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
  });

  it("allows skipped detection photo attachment without active consent", async () => {
    mockUseUserProfileContext.mockReturnValue({
      userData: {
        profile: {
          aiConsent: { status: "revoked", grantedAt: null, revokedAt: null },
        },
      },
    });
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: { skipDetection: true },
      }),
    );

    await act(async () => {
      await result.current.handleAccept("file:///meal.jpg");
    });

    expect(flow.replace).toHaveBeenCalledWith("ReviewMeal", {});
    expect(navigation.navigate).not.toHaveBeenCalledWith("PrivacyAiSettings");
  });

  it.each([
    [
      "not_granted",
      { status: "not_granted", grantedAt: null, revokedAt: null },
    ],
    [
      "revoked",
      {
        status: "revoked",
        grantedAt: "2026-06-01T10:00:00.000Z",
        revokedAt: "2026-06-02T10:00:00.000Z",
      },
    ],
    [
      "granted missing grantedAt",
      { status: "granted", grantedAt: null, revokedAt: null },
    ],
    [
      "granted with revokedAt",
      {
        status: "granted",
        grantedAt: "2026-06-01T10:00:00.000Z",
        revokedAt: "2026-06-02T10:00:00.000Z",
      },
    ],
  ])(
    "routes to Privacy & AI settings without capturing when consent is %s",
    async (_label, aiConsent) => {
      mockUseUserProfileContext.mockReturnValue({
        userData: {
          profile: {
            aiConsent,
          },
        },
      });
      const flow = {
        goTo: jest.fn(),
        replace: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => false),
      };
      const navigation = {
        addListener: jest.fn(() => () => undefined),
        navigate: jest.fn(),
      };
      const takePictureAsync = jest.fn(async () => ({ uri: "file:///raw.jpg" }));

      mockUseMealDraftContext.mockReturnValue({
        meal: baseMeal(),
        setMeal: jest.fn(),
        updateMeal: jest.fn(),
        setLastScreen: jest.fn(async () => undefined),
        saveDraft: jest.fn(async () => undefined),
      });

      const { result } = renderHook(() =>
        useMealCameraState({
          navigation: navigation as never,
          flow: flow as never,
          params: {},
        }),
      );

      act(() => {
        result.current.setIsCameraReady(true);
        result.current.cameraRef.current = {
          takePictureAsync,
        } as unknown as (typeof result.current.cameraRef)["current"];
      });

      await act(async () => {
        await result.current.handleTakePicture();
      });

      expect(result.current.hasActiveAiConsent).toBe(false);
      expect(takePictureAsync).not.toHaveBeenCalled();
      expect(mockedGetSampleMealUri).not.toHaveBeenCalled();
      expect(result.current.premiumModal).toBe(false);
      expect(flow.goTo).not.toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith("PrivacyAiSettings");
    },
  );

  it("does not start simulator sample photo AI without active consent", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockDevice.isDevice = false;
    mockUseUserProfileContext.mockReturnValue({
      userData: {
        profile: {
          aiConsent: { status: "not_granted", grantedAt: null, revokedAt: null },
        },
      },
    });
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    await act(async () => {
      await result.current.handleTakePicture();
    });

    expect(mockedGetSampleMealUri).not.toHaveBeenCalled();
    expect(flow.goTo).not.toHaveBeenCalled();
    expect(result.current.premiumModal).toBe(false);
    expect(navigation.navigate).toHaveBeenCalledWith("PrivacyAiSettings");
  });

  it("does not route accepted photos to preparing review without active consent", async () => {
    mockUseUserProfileContext.mockReturnValue({
      userData: {
        profile: {
          aiConsent: {
            status: "granted",
            grantedAt: "2026-06-01T10:00:00.000Z",
            revokedAt: "2026-06-02T10:00:00.000Z",
          },
        },
      },
    });
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };
    const updateMeal = jest.fn();
    const saveDraft = jest.fn(async () => undefined);

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal,
      setLastScreen: jest.fn(async () => undefined),
      saveDraft,
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    await act(async () => {
      await result.current.handleAccept("file:///meal.jpg");
    });

    expect(updateMeal).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(flow.goTo).not.toHaveBeenCalled();
    expect(flow.replace).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("PrivacyAiSettings");
  });

  it("opens insufficient-credits modal when photo AI is not affordable", async () => {
    mockCanAfford.mockReturnValue(false);
    mockCanUseFeature.mockReturnValue(false);

    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    await act(async () => {
      await result.current.handleTakePicture();
    });

    expect(result.current.premiumModal).toBe(true);
  });

  it("normalizes captured photo URI before preview and accept flow", async () => {
    const updateMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(async () => undefined);
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };
    const takePictureAsync = jest.fn(async () => ({ uri: "file:///raw.jpg" }));

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal,
      setLastScreen: jest.fn(async () => undefined),
      saveDraft,
    });
    mockNormalizeImageOrientation.mockResolvedValue("file:///normalized.jpg");

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    act(() => {
      result.current.setIsCameraReady(true);
      result.current.cameraRef.current = {
        takePictureAsync,
      } as unknown as (typeof result.current.cameraRef)["current"];
    });

    await act(async () => {
      await result.current.handleTakePicture();
    });

    expect(takePictureAsync).toHaveBeenCalledWith({ quality: 0.7 });
    expect(mockNormalizeImageOrientation).toHaveBeenCalledWith(
      "file:///raw.jpg",
    );
    expect(result.current.photoUri).toBe("file:///normalized.jpg");

    await act(async () => {
      await result.current.handleAccept();
    });

    expect(updateMeal).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: "file:///normalized.jpg" }),
    );
    expect(flow.goTo).toHaveBeenCalledWith("PreparingReviewPhoto", {
      image: "file:///normalized.jpg",
      id: "meal-1",
      attempt: 1,
    });
  });

  it("clears preview photo on retake after capture", async () => {
    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };
    const takePictureAsync = jest.fn(
      async () => ({ uri: "file:///captured-photo.jpg" }),
    );

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    act(() => {
      result.current.setIsCameraReady(true);
      result.current.cameraRef.current = {
        takePictureAsync,
      } as unknown as (typeof result.current.cameraRef)["current"];
    });

    await act(async () => {
      await result.current.handleTakePicture();
    });
    expect(result.current.photoUri).toBe("file:///captured-photo.jpg");

    act(() => {
      result.current.handleRetake();
    });
    expect(result.current.photoUri).toBeNull();
  });

  it("uses the mocked sample photo on simulator and skips confirmation", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockDevice.isDevice = false;
    mockedGetSampleMealUri.mockResolvedValue("file:///sample-meal.jpg");

    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };
    const updateMeal = jest.fn();
    const saveDraft = jest.fn<
      (uid: string, draftOverride?: Meal | null) => Promise<void>
    >(async () => undefined);

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal,
      setLastScreen: jest.fn(async () => undefined),
      saveDraft,
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {
          simulatorCreditsState: "low",
          simulatorReviewState: "failed",
        },
      }),
    );

    await act(async () => {
      await result.current.handleTakePicture();
    });

    expect(mockedGetSampleMealUri).toHaveBeenCalledTimes(1);
    expect(updateMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        photoUrl: "file:///sample-meal.jpg",
        inputMethod: "photo",
      }),
    );
    expect(saveDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        photoUrl: "file:///sample-meal.jpg",
      }),
    );
    expect(flow.goTo).toHaveBeenCalledWith("PreparingReviewPhoto", {
      image: "file:///sample-meal.jpg",
      id: "meal-1",
      attempt: 1,
      simulatorCreditsState: "low",
      simulatorReviewState: "failed",
    });
  });

  it("keeps default simulator photo flow on the E2E analysis path", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockDevice.isDevice = false;
    mockedGetSampleMealUri.mockResolvedValue("file:///sample-meal.jpg");

    const flow = {
      goTo: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
    };
    const navigation = {
      addListener: jest.fn(() => () => undefined),
      navigate: jest.fn(),
    };

    mockUseMealDraftContext.mockReturnValue({
      meal: baseMeal(),
      setMeal: jest.fn(),
      updateMeal: jest.fn(),
      setLastScreen: jest.fn(async () => undefined),
      saveDraft: jest.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useMealCameraState({
        navigation: navigation as never,
        flow: flow as never,
        params: {},
      }),
    );

    await act(async () => {
      await result.current.handleTakePicture();
    });

    expect(flow.goTo).toHaveBeenCalledWith("PreparingReviewPhoto", {
      image: "file:///sample-meal.jpg",
      id: "meal-1",
      attempt: 1,
    });
  });
});
