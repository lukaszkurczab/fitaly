import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { UserData } from "@/types";
import { useOnboardingFlow } from "@/feature/Onboarding/hooks/useOnboardingFlow";

const mockUpdateUser = jest.fn();
const mockSyncUserProfile = jest.fn();
const mockApplyServerProfile = jest.fn();
const mockCompleteUserOnboardingRemote = jest.fn();
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

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    userData: mockUserData,
    updateUser: mockUpdateUser,
    syncUserProfile: mockSyncUserProfile,
    applyServerProfile: mockApplyServerProfile,
  }),
}));

jest.mock("@/services/user/userProfileRepository", () => ({
  completeUserOnboardingRemote: (...args: unknown[]) =>
    mockCompleteUserOnboardingRemote(...args),
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
  const base: UserData = {
    uid: "user-1",
    email: "hello@example.com",
    username: "lukasz",
    plan: "free",
    createdAt: 1,
    lastLogin: "2026-03-28T10:00:00.000Z",
    profile: {
      language: "en",
      nutritionProfile: {
        unitsSystem: "metric",
        age: "30",
        sex: "female",
        height: "168",
        heightInch: "",
        weight: "62",
        preferences: [],
        activityLevel: "moderate",
        goal: "maintain",
        chronicDiseases: [],
        chronicDiseasesOther: "",
        allergies: [],
        allergiesOther: "",
        lifestyle: "",
        calorieTarget: 2100,
      },
      aiPreferences: {
        stylePersona: "cheerful_companion",
      },
      consents: {
        aiHealthDataConsentAt: "2026-03-28T10:00:00.000Z",
      },
      readiness: {
        status: "ready",
        onboardingCompletedAt: "2026-03-28T10:00:00.000Z",
        readyAt: "2026-03-28T10:00:00.000Z",
      },
    },
    syncState: "synced",
    avatarUrl: "",
    avatarLocalPath: "",
    avatarlastSyncedAt: "",
  };
  return { ...base, ...overrides };
}

describe("useOnboardingFlow", () => {
  beforeEach(() => {
    mockUserData = null;
    mockUpdateUser.mockReset().mockImplementation(async () => undefined);
    mockSyncUserProfile.mockReset().mockImplementation(async () => undefined);
    mockApplyServerProfile.mockReset().mockImplementation(async (profile) => profile);
    mockCompleteUserOnboardingRemote.mockReset().mockImplementation(async () => ({
      updated: true,
      profile: buildUserData(),
    }));
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

  it("does not allow first-run onboarding to skip into Home", async () => {
    const navigation = buildNavigation();
    const { result } = renderHook(() =>
      useOnboardingFlow({ mode: "first", navigation: navigation as never }),
    );

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.handleStep1SecondaryAction();
    });

    expect(result.current.modalState).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
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

  it("does not allow the final optional assistant step to skip into Home", async () => {
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

    await act(async () => {
      await result.current.handleSkipStep();
    });

    expect(result.current.step).toBe(4);
    expect(result.current.modalState).toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalledWith("Home");
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it("completes first-run onboarding through the canonical final action", async () => {
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
    });
    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    await act(async () => {
      await result.current.handlePrimaryAction();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSyncUserProfile).not.toHaveBeenCalled();
    expect(mockCompleteUserOnboardingRemote).toHaveBeenCalledTimes(1);
    const completionPayload = mockCompleteUserOnboardingRemote.mock.calls[0][0];
    expect(completionPayload).toMatchObject({
      aiPersona: "mediterranean_friend",
      goal: "maintain",
      calorieAdjustment: null,
    });
    expect(completionPayload).not.toHaveProperty("readiness");
    expect(mockApplyServerProfile).toHaveBeenCalledTimes(1);
    expect(mockTrackOnboardingCompleted).toHaveBeenCalledWith({ mode: "first" });
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
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("does not unlock Home when server completion fails", async () => {
    mockCompleteUserOnboardingRemote.mockImplementationOnce(async () => {
      throw new Error("completion failed");
    });
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
    });
    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    await expect(
      act(async () => {
        await result.current.handlePrimaryAction();
      }),
    ).rejects.toThrow("completion failed");

    expect(mockCompleteUserOnboardingRemote).toHaveBeenCalledTimes(1);
    expect(mockApplyServerProfile).not.toHaveBeenCalled();
    expect(mockTrackOnboardingCompleted).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalledWith("Home");
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
