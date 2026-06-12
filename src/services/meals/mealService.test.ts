import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { waitFor } from "@testing-library/react-native";
import type { Meal } from "@/types/meal";
import * as FileSystem from "@/services/core/fileSystem";
import {
  deleteMealInFirestore,
  getMealsPageFiltered,
  restoreMissingMealPhotos,
  subscribeMeals,
} from "@/services/meals/mealService";
import {
  ensureLocalMealPhoto,
  localPhotoPath,
} from "@/services/meals/mealService.images";

const mockGetMealsPageLocal =
  jest.fn<(...args: unknown[]) => Promise<Meal[]>>();
const mockGetMealsPageLocalFiltered =
  jest.fn<
    (
      ...args: unknown[]
    ) => Promise<{ items: Meal[]; nextCursor: string | null }>
  >();
const mockFetchMealsPageRemote =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMarkMealDeletedRemote =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockEmit =
  jest.fn<(event: string, payload: Record<string, unknown>) => void>();
const mockOn = jest.fn<(...args: unknown[]) => () => void>();

jest.mock("@/services/offline/meals.repo", () => ({
  getAllMealsLocal: (uid: string) =>
    mockGetMealsPageLocal(uid, 50, undefined),
  getMealsPageLocal: (...args: unknown[]) => mockGetMealsPageLocal(...args),
  getMealsPageLocalFiltered: (...args: unknown[]) =>
    mockGetMealsPageLocalFiltered(...args),
}));

jest.mock("@/services/meals/mealsRepository", () => ({
  fetchMealsPageRemote: (...args: unknown[]) =>
    mockFetchMealsPageRemote(...args),
  markMealDeletedRemote: (...args: unknown[]) =>
    mockMarkMealDeletedRemote(...args),
}));

jest.mock("@/services/meals/mealService.images", () => ({
  ensureLocalMealPhoto: jest.fn(),
  localPhotoPath: jest.fn(),
}));

jest.mock("@/services/core/events", () => ({
  on: (...args: unknown[]) => mockOn(...args),
  emit: (event: string, payload: Record<string, unknown>) =>
    mockEmit(event, payload),
}));

jest.mock("@/services/core/fileSystem", () => ({
  documentDirectory: "file:///docs/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "ignored",
  mealId: "meal-1",
  timestamp: "2026-03-03T12:00:00.000Z",
  type: "lunch",
  name: "Chicken",
  ingredients: [
    {
      id: "i1",
      name: "Chicken",
      amount: 100,
      kcal: 200,
      protein: 30,
      fat: 5,
      carbs: 0,
    },
  ],
  createdAt: "2026-03-03T12:00:00.000Z",
  updatedAt: "2026-03-03T12:00:00.000Z",
  syncState: "synced",
  source: "manual",
  cloudId: "cloud-1",
  totals: { kcal: 200, protein: 30, fat: 5, carbs: 0 },
  ...overrides,
});

const buildClampedWindow = (days: number) => {
  const now = new Date("2026-03-03T12:00:00.000Z");
  const start = new Date(now);
  start.setDate(now.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

describe("services/mealService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-03T12:00:00.000Z"));
    mockGetMealsPageLocal.mockResolvedValue([]);
    mockFetchMealsPageRemote.mockResolvedValue({ items: [], nextCursor: null });
    mockMarkMealDeletedRemote.mockResolvedValue(undefined);
    mockOn.mockReturnValue(jest.fn());
    jest
      .mocked(FileSystem.getInfoAsync)
      .mockResolvedValue({ exists: false } as ReturnType<
        typeof FileSystem.getInfoAsync
      > extends Promise<infer T>
        ? T
        : never);
    jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
    jest
      .mocked(localPhotoPath)
      .mockReturnValue("file:///docs/meals/u1/cloud-1.jpg");
    jest.mocked(ensureLocalMealPhoto).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses local history repo and clamps access window", async () => {
    mockGetMealsPageLocalFiltered.mockResolvedValueOnce({
      items: [baseMeal()],
      nextCursor: "2026-03-02|2026-03-02T12:00:00.000Z|cloud-1",
    });

    const result = await getMealsPageFiltered("u1", {
      limit: 20,
      cursor: "2026-03-02|2026-03-02T12:00:00.000Z|cloud-1",
      filters: {
        dateRange: {
          start: new Date("2026-01-01T12:00:00.000Z"),
          end: new Date("2026-03-10T12:00:00.000Z"),
        },
      },
      accessWindowDays: 3,
    });

    const expectedWindow = buildClampedWindow(3);

    expect(mockGetMealsPageLocalFiltered).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        limit: 20,
        cursor: "2026-03-02|2026-03-02T12:00:00.000Z|cloud-1",
        filters: expect.objectContaining({
          dateRange: {
            start: expectedWindow.start,
            end: expectedWindow.end,
          },
        }),
      }),
    );
    expect(mockFetchMealsPageRemote).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [baseMeal()],
      nextCursor: "2026-03-02|2026-03-02T12:00:00.000Z|cloud-1",
    });
  });

  it("uses local history repo for filtered pagination even when online", async () => {
    mockGetMealsPageLocalFiltered.mockResolvedValueOnce({
      items: [baseMeal({ cloudId: "cloud-2" })],
      nextCursor: "2026-03-01|2026-03-01T12:00:00.000Z|cloud-2",
    });

    const result = await getMealsPageFiltered("u1", {
      limit: 10,
      cursor: null,
      filters: {
        calories: [100, 500],
      },
      accessWindowDays: 30,
    });

    const expectedWindow = buildClampedWindow(30);

    expect(mockGetMealsPageLocalFiltered).toHaveBeenCalledWith("u1", {
      limit: 10,
      cursor: null,
      filters: {
        calories: [100, 500],
        protein: undefined,
        carbs: undefined,
        fat: undefined,
        dateRange: { start: expectedWindow.start, end: expectedWindow.end },
      },
    });
    expect(mockFetchMealsPageRemote).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [baseMeal({ cloudId: "cloud-2" })],
      nextCursor: "2026-03-01|2026-03-01T12:00:00.000Z|cloud-2",
    });
  });

  it("subscribes through local meals cache and event bus", async () => {
    const unsubscribe1 = jest.fn();
    const unsubscribe2 = jest.fn();
    const unsubscribe3 = jest.fn();
    mockOn
      .mockReturnValueOnce(unsubscribe1)
      .mockReturnValueOnce(unsubscribe2)
      .mockReturnValueOnce(unsubscribe3);
    const localMeal = baseMeal({ userUid: "u1" });
    mockGetMealsPageLocal.mockResolvedValueOnce([localMeal]);
    const onData = jest.fn();

    const result = subscribeMeals("u1", onData);

    await waitFor(() => {
      expect(mockGetMealsPageLocal).toHaveBeenCalledWith("u1", 50, undefined);
      expect(onData).toHaveBeenCalledWith([localMeal]);
    });

    result();

    expect(unsubscribe1).toHaveBeenCalled();
    expect(unsubscribe2).toHaveBeenCalled();
    expect(unsubscribe3).toHaveBeenCalled();
  });

  it("clampDateRange: accessWindowDays=0 does not clamp — returns filters unchanged", async () => {
    const dateRange = {
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-03-03T23:59:59.000Z"),
    };
    mockGetMealsPageLocalFiltered.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    await getMealsPageFiltered("u1", {
      limit: 10,
      cursor: null,
      filters: { dateRange },
      accessWindowDays: 0,
    });

    expect(mockGetMealsPageLocalFiltered).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        filters: expect.objectContaining({ dateRange }),
      }),
    );
  });

  it("clampDateRange: no accessWindowDays passes filters through unchanged", async () => {
    const dateRange = {
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-03-03T23:59:59.000Z"),
    };
    mockGetMealsPageLocalFiltered.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    await getMealsPageFiltered("u1", {
      limit: 10,
      cursor: null,
      filters: { dateRange },
    });

    expect(mockGetMealsPageLocalFiltered).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        filters: expect.objectContaining({ dateRange }),
      }),
    );
  });

  it("clampDateRange: returns epoch range when clamped start exceeds clamped end", async () => {
    // input.end (2026-01-01) is before the 3-day window start (2026-03-01)
    // → after clamping: start = 2026-03-01, end = 2026-01-01 → start > end → epoch
    mockGetMealsPageLocalFiltered.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    await getMealsPageFiltered("u1", {
      limit: 10,
      cursor: null,
      filters: {
        dateRange: {
          start: new Date("2025-12-01T00:00:00.000Z"),
          end: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
      accessWindowDays: 3,
    });

    expect(mockGetMealsPageLocalFiltered).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        filters: expect.objectContaining({
          dateRange: { start: new Date(0), end: new Date(0) },
        }),
      }),
    );
  });

  it("restoreMissingMealPhotos: returns empty record for empty meals array", async () => {
    const result = await restoreMissingMealPhotos("u1", []);
    expect(result).toEqual({});
    expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
  });

  it("restoreMissingMealPhotos: returns empty record for falsy uid", async () => {
    const result = await restoreMissingMealPhotos("", [baseMeal()]);
    expect(result).toEqual({});
  });

  it("restoreMissingMealPhotos: adds local path when photo already exists on disk", async () => {
    jest
      .mocked(FileSystem.getInfoAsync)
      .mockResolvedValueOnce({ exists: false } as ReturnType<
        typeof FileSystem.getInfoAsync
      > extends Promise<infer T>
        ? T
        : never) // ensureDir check
      .mockResolvedValueOnce({ exists: true } as ReturnType<
        typeof FileSystem.getInfoAsync
      > extends Promise<infer T>
        ? T
        : never); // photo exists

    jest
      .mocked(localPhotoPath)
      .mockReturnValue("file:///docs/meals/u1/cloud-1.jpg");

    const result = await restoreMissingMealPhotos("u1", [baseMeal()]);

    expect(result).toEqual({ "cloud-1": "file:///docs/meals/u1/cloud-1.jpg" });
    expect(ensureLocalMealPhoto).not.toHaveBeenCalled();
  });

  it("restoreMissingMealPhotos: adds path from ensureLocalMealPhoto when photo missing", async () => {
    jest
      .mocked(FileSystem.getInfoAsync)
      .mockResolvedValue({ exists: false } as ReturnType<
        typeof FileSystem.getInfoAsync
      > extends Promise<infer T>
        ? T
        : never);
    jest
      .mocked(ensureLocalMealPhoto)
      .mockResolvedValueOnce("file:///docs/meals/u1/cloud-1.jpg");

    const result = await restoreMissingMealPhotos("u1", [baseMeal()]);

    expect(result).toEqual({ "cloud-1": "file:///docs/meals/u1/cloud-1.jpg" });
  });

  it("restoreMissingMealPhotos: omits meal when ensureLocalMealPhoto returns null", async () => {
    jest
      .mocked(FileSystem.getInfoAsync)
      .mockResolvedValue({ exists: false } as ReturnType<
        typeof FileSystem.getInfoAsync
      > extends Promise<infer T>
        ? T
        : never);
    jest.mocked(ensureLocalMealPhoto).mockResolvedValueOnce(null);

    const result = await restoreMissingMealPhotos("u1", [baseMeal()]);

    expect(result).toEqual({});
  });

  it("marks meals as deleted through repository helper", async () => {
    await deleteMealInFirestore("u1", "cloud-1");

    expect(mockMarkMealDeletedRemote).toHaveBeenCalledWith(
      "u1",
      "cloud-1",
      "2026-03-03T12:00:00.000Z",
      {
        clientMutationId:
          "direct-delete:u1:cloud-1:2026-03-03T12:00:00.000Z",
      },
    );
  });
});
