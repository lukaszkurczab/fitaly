import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import { saveMealTransaction } from "@/services/meals/mealSaveTransaction";

const mockUuid = jest.fn<() => string>();
const mockInsertOrUpdateImage = jest.fn<
  (uid: string, cloudId: string, path: string, status: "pending") => Promise<void>
>();
const mockUpsertMealLocal = jest.fn<(meal: Meal) => Promise<void>>();
const mockEnqueueUpsert = jest.fn<(uid: string, meal: Meal) => Promise<void>>();
const mockEmit = jest.fn<(event: string, payload: Record<string, unknown>) => void>();
const mockUpsertMyMealWithPhoto = jest.fn<
  (uid: string, meal: Meal, localPhoto: string | null) => Promise<void>
>();
const mockTrackMealLogged = jest.fn<(meal: Meal) => Promise<void>>();

jest.mock("uuid", () => ({
  v4: () => mockUuid(),
}));

jest.mock("@/services/offline/images.repo", () => ({
  insertOrUpdateImage: (
    uid: string,
    cloudId: string,
    path: string,
    status: "pending",
  ) => mockInsertOrUpdateImage(uid, cloudId, path, status),
}));

jest.mock("@/services/offline/meals.repo", () => ({
  upsertMealLocal: (meal: Meal) => mockUpsertMealLocal(meal),
}));

jest.mock("@/services/offline/queue.repo", () => ({
  enqueueUpsert: (uid: string, meal: Meal) => mockEnqueueUpsert(uid, meal),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload: Record<string, unknown>) =>
    mockEmit(event, payload),
}));

jest.mock("@/services/meals/myMealService", () => ({
  upsertMyMealWithPhoto: (uid: string, meal: Meal, localPhoto: string | null) =>
    mockUpsertMyMealWithPhoto(uid, meal, localPhoto),
}));

jest.mock("@/services/telemetry/telemetryInstrumentation", () => ({
  trackMealLogged: (meal: Meal) => mockTrackMealLogged(meal),
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "stale-user",
  mealId: "meal-1",
  cloudId: "cloud-1",
  timestamp: "2026-02-25T10:00:00.000Z",
  dayKey: "2026-02-25",
  loggedAtLocalMin: 660,
  tzOffsetMin: 60,
  type: "lunch",
  name: "Chicken",
  ingredients: [
    { id: "i1", name: "Rice", amount: 100, kcal: 120, protein: 3, fat: 1, carbs: 25 },
    { id: "i2", name: "Chicken", amount: 80, kcal: 140, protein: 24, fat: 4, carbs: 0 },
  ],
  createdAt: "2026-02-25T09:00:00.000Z",
  updatedAt: "2026-02-25T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  inputMethod: "manual",
  totals: { kcal: 999, protein: 999, fat: 999, carbs: 999 },
  ...overrides,
});

describe("saveMealTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid.mockImplementation(() => "generated-cloud");
    mockInsertOrUpdateImage.mockResolvedValue();
    mockUpsertMealLocal.mockResolvedValue();
    mockEnqueueUpsert.mockResolvedValue();
    mockUpsertMyMealWithPhoto.mockResolvedValue();
    mockTrackMealLogged.mockResolvedValue();
  });

  it("keeps create semantics as the default operation", async () => {
    const { meal } = await saveMealTransaction({
      uid: "user-1",
      meal: baseMeal({ cloudId: undefined, mealId: undefined as unknown as string }),
      nowISO: "2026-02-25T12:00:00.000Z",
    });

    expect(meal).toEqual(
      expect.objectContaining({
        userUid: "user-1",
        cloudId: "generated-cloud",
        mealId: "generated-cloud",
        syncState: "pending",
        deleted: false,
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith("meal:added", { uid: "user-1", meal });
    expect(mockEnqueueUpsert).toHaveBeenCalledWith("user-1", meal);
    expect(mockTrackMealLogged).toHaveBeenCalledWith(meal);
  });

  it("canonicalizes update payloads and commits locally before enqueueing", async () => {
    const onLocalCommitted = jest.fn<(meal: Meal) => void>();

    const { meal } = await saveMealTransaction({
      uid: "user-1",
      operation: "update",
      nowISO: "2026-02-25T12:00:00.000Z",
      onLocalCommitted,
      meal: baseMeal({
        userUid: "stale-user",
        deleted: true,
        syncState: "synced",
        photoUrl: "file://meal.jpg",
        savedMealRefId: "template-1",
      }),
    });

    expect(meal).toEqual(
      expect.objectContaining({
        userUid: "user-1",
        cloudId: "cloud-1",
        mealId: "meal-1",
        dayKey: "2026-02-25",
        loggedAtLocalMin: 660,
        tzOffsetMin: 60,
        totals: { kcal: 260, protein: 27, carbs: 25, fat: 5 },
        photoLocalPath: "file://meal.jpg",
        syncState: "pending",
        deleted: false,
      }),
    );
    expect(meal).toEqual(
      expect.not.objectContaining({ savedMealRefId: expect.anything() }),
    );
    expect(mockInsertOrUpdateImage).toHaveBeenCalledWith(
      "user-1",
      "cloud-1",
      "file://meal.jpg",
      "pending",
    );
    expect(mockUpsertMealLocal).toHaveBeenCalledWith(meal);
    expect(onLocalCommitted).toHaveBeenCalledWith(meal);
    expect(mockEmit).toHaveBeenCalledWith("meal:updated", { uid: "user-1", meal });
    expect(mockEmit).not.toHaveBeenCalledWith("meal:added", expect.any(Object));
    expect(mockEnqueueUpsert).toHaveBeenCalledWith("user-1", meal);
    expect(mockTrackMealLogged).not.toHaveBeenCalled();

    expect(mockUpsertMealLocal.mock.invocationCallOrder[0]).toBeLessThan(
      onLocalCommitted.mock.invocationCallOrder[0],
    );
    expect(onLocalCommitted.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnqueueUpsert.mock.invocationCallOrder[0],
    );
  });

  it("derives dayKey and local timing metadata from the final timestamp", async () => {
    const finalTimestamp = "2026-03-20T08:30:00.000Z";
    const expectedDate = new Date(finalTimestamp);
    const { meal } = await saveMealTransaction({
      uid: "user-1",
      nowISO: finalTimestamp,
      meal: baseMeal({
        cloudId: undefined,
        mealId: "saved-draft-1",
        savedMealRefId: "template-1",
        source: "saved",
        inputMethod: "saved",
        timestamp: finalTimestamp,
        dayKey: "2026-01-10",
        loggedAtLocalMin: 780,
        tzOffsetMin: 60,
      }),
    });

    expect(meal).toEqual(
      expect.objectContaining({
        cloudId: "saved-draft-1",
        mealId: "saved-draft-1",
        source: "saved",
        inputMethod: "saved",
        timestamp: finalTimestamp,
        dayKey: "2026-03-20",
        loggedAtLocalMin:
          expectedDate.getHours() * 60 + expectedDate.getMinutes(),
        tzOffsetMin: -expectedDate.getTimezoneOffset(),
      }),
    );
    expect(meal).toEqual(
      expect.not.objectContaining({ savedMealRefId: expect.anything() }),
    );
  });

  it("leaves one queued upsert after several updates of the same meal", async () => {
    const queuedUpserts = new Map<string, Meal>();
    mockEnqueueUpsert.mockImplementation(async (uid, meal) => {
      queuedUpserts.set(`${uid}:${meal.cloudId}`, meal);
    });

    await saveMealTransaction({
      uid: "user-1",
      operation: "update",
      meal: baseMeal({ name: "First edit" }),
      nowISO: "2026-02-25T12:00:00.000Z",
    });
    await saveMealTransaction({
      uid: "user-1",
      operation: "update",
      meal: baseMeal({ name: "Second edit" }),
      nowISO: "2026-02-25T12:01:00.000Z",
    });
    await saveMealTransaction({
      uid: "user-1",
      operation: "update",
      meal: baseMeal({ name: "Final edit" }),
      nowISO: "2026-02-25T12:02:00.000Z",
    });

    expect(mockEnqueueUpsert).toHaveBeenCalledTimes(3);
    expect(queuedUpserts.size).toBe(1);
    expect([...queuedUpserts.values()][0]).toEqual(
      expect.objectContaining({
        cloudId: "cloud-1",
        name: "Final edit",
        updatedAt: "2026-02-25T12:02:00.000Z",
      }),
    );
  });
});
