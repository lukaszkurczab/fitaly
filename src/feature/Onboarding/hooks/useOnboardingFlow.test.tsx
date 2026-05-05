import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { UserData } from "@/types";
import { useOnboardingFlow } from "@/feature/Onboarding/hooks/useOnboardingFlow";

const mockUpdateUser = jest.fn();
const mockSyncUserProfile = jest.fn();
const mockTrackOnboardingCompleted = jest.fn();

let mockUserData: UserData | null = null;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "progress") {
        return `Step ${options?.current} of ${options?.total}`;
      }
      return key;
    },
  }),
}));

jest.mock("@/context/UserContext", () => ({
  useUserContext: () => ({
    userData: mockUserData,
    updateUser: mockUpdateUser,
    syncUserProfile: mockSyncUserProfile,
  }),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackOnboardingCompleted: (...args: unknown[]) =>
    mockTrackOnboardingCompleted(...args),
}));

function buildNavigation() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
  };
}

function buildUserData(overrides?: Partial<UserData>): UserData {
  return {
    uid: "user-1",
    email: "hello@example.com",
    username: "lukasz",
    plan: "free",
    createdAt: 1,
    lastLogin: "2026-03-28T10:00:00.000Z",
    unitsSystem: "metric",
    age: "30",
    sex: "female",
    height: "168",
    heightInch: "",
    weight: "62",
    preferences: [],
    activityLevel: "moderate",
    goal: "maintain",
    calorieDeficit: 0.2,
    calorieSurplus: 0.2,
    chronicDiseases: [],
    chronicDiseasesOther: "",
    allergies: [],
    allergiesOther: "",
    lifestyle: "",
    aiPersona: "cheerful_companion",
    surveyComplited: true,
    calorieTarget: 2100,
    syncState: "synced",
    language: "en",
    avatarUrl: "",
    avatarLocalPath: "",
    avatarlastSyncedAt: "",
    ...overrides,
  };
}

describe("useOnboardingFlow", () => {
  beforeEach(() => {
    mockUserData = null;
    mockUpdateUser.mockReset().mockImplementation(async () => undefined);
    mockSyncUserProfile.mockReset().mockImplementation(async () => undefined);
    mockTrackOnboardingCompleted
      .mockReset()
      .mockImplementation(async () => undefined);
  });

  it("blocks step 1 progression when required fields are missing", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "first", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.handlePrimaryAction();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.age).toBe("errors.ageRequired");
    expect(result.current.errors.height).toBe("errors.heightRequired");
    expect(result.current.errors.weight).toBe("errors.weightRequired");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("does not allow first-step skip in profile recovery mode", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({
        mode: "first",
        navigation: navigation as never,
        allowInitialSkip: false,
      }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.handleStep1SecondaryAction();
    });

    expect(result.current.modalState).toBeNull();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it("clears optional health details when the user confirms skip on step 3", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "first", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.setForm((current) => ({
        ...current,
        age: "30",
        height: "170",
        weight: "70",
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: ["other"],
        chronicDiseasesOther: "thyroid",
        allergies: ["other"],
        allergiesOther: "sesame",
        lifestyle: "night shifts",
      }));
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
      await result.current.handlePrimaryAction();
    });

    expect(result.current.step).toBe(3);

    act(() => {
      result.current.handleSkipStep();
    });

    await act(async () => {
      await result.current.handleSkipConfirm();
    });

    expect(result.current.step).toBe(4);
    expect(result.current.form.chronicDiseases).toEqual([]);
    expect(result.current.form.chronicDiseasesOther).toBe("");
    expect(result.current.form.allergies).toEqual([]);
    expect(result.current.form.allergiesOther).toBe("");
    expect(result.current.form.lifestyle).toBe("");
  });

  it("saves a cleaned final payload when the user skips the last optional step", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "first", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.setForm((current) => ({
        ...current,
        age: "30",
        height: "170",
        weight: "70",
        activityLevel: "moderate",
        goal: "maintain",
        aiPersona: "mediterranean_friend",
      }));
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
      await result.current.handlePrimaryAction();
      await result.current.handlePrimaryAction();
    });

    expect(result.current.step).toBe(4);

    act(() => {
      result.current.handleSkipStep();
    });

    await act(async () => {
      await result.current.handleSkipConfirm();
    });

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser.mock.calls[0][0]).toMatchObject({
      aiPersona: "calm_guide",
      surveyComplited: true,
    });
    expect(navigation.replace).toHaveBeenCalledWith("Home");
  });

  it("shows optional skip confirmation only once in the same flow", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "first", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.setForm((current) => ({
        ...current,
        age: "30",
        height: "170",
        weight: "70",
        activityLevel: "moderate",
        goal: "maintain",
      }));
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
      await result.current.handlePrimaryAction();
    });

    expect(result.current.step).toBe(3);

    await act(async () => {
      await result.current.handleSkipStep();
    });

    expect(result.current.modalState).toEqual({ type: "skip_step", step: 3 });

    await act(async () => {
      await result.current.handleSkipConfirm();
    });

    expect(result.current.step).toBe(4);
    expect(result.current.modalState).toBeNull();

    await act(async () => {
      await result.current.handleSkipStep();
    });

    expect(result.current.modalState).toBeNull();
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
  });

  it("stops save-and-exit in refill mode when required data is invalid", async () => {
    mockUserData = buildUserData();
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "refill", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.setForm((current) => ({
        ...current,
        age: "",
      }));
    });

    await act(async () => {
      await result.current.handleSaveAndExit();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.age).toBe("errors.ageRequired");
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
