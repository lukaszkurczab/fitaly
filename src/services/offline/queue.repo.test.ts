import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Meal } from "@/types/meal";
import type { IngredientProductSearchRow } from "@/types/foodLibrary";

const mockRunSync = jest.fn<
  (sql: string, params?: unknown[]) => { changes?: number } | void
>();
const mockExecSync = jest.fn<(sql: string) => void>();
const mockGetAllSync = jest.fn<(sql: string, params?: unknown[]) => unknown[]>();
const mockGetFirstSync = jest.fn<
  (sql: string, params?: unknown[]) => { count?: number; dead?: number; pending?: number } | undefined
>();
const mockEmit = jest.fn<(event: string, payload?: unknown) => void>();

type QueuedOp = {
  id: number;
  clientMutationId: string;
  cloudId: string;
  uid: string;
  kind: string;
  payload: unknown;
  updatedAt: string;
  attempts: number;
};

type DeadOp = QueuedOp & {
  failedAt: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  opId: number;
};

let nextQueueId = 1;
let nextDeadId = 100;
let queuedOps: QueuedOp[] = [];
let deadOps: DeadOp[] = [];

function applyQueueMutation(sql: string, params: unknown[] = []) {
  if (sql.includes("DELETE FROM op_queue_dead")) {
    if (sql.includes("cloud_id IN")) {
      const uid = String(params[0] ?? "");
      const cloudIdMatch = sql.match(/cloud_id IN \(([^)]+)\)/);
      const cloudIdCount =
        cloudIdMatch?.[1].split(",").filter((part) => part.trim() === "?")
          .length ?? 0;
      const cloudIds = new Set(params.slice(1, 1 + cloudIdCount).map(String));
      const kinds = new Set(
        params
          .slice(1 + cloudIdCount)
          .filter((value): value is string => typeof value === "string"),
      );
      const before = deadOps.length;
      deadOps = deadOps.filter(
        (op) =>
          !(
            op.uid === uid &&
            cloudIds.has(op.cloudId) &&
            (!kinds.size || kinds.has(op.kind))
          ),
      );
      return { changes: before - deadOps.length };
    }

    if (sql.includes("user_uid=?")) {
      const uid = String(params[0] ?? "");
      const ids = new Set(
        params
          .slice(1)
          .filter((value): value is number => typeof value === "number")
          .map(Number),
      );
      const kinds = new Set(
        params
          .slice(1)
          .filter((value): value is string => typeof value === "string"),
      );
      const before = deadOps.length;
      deadOps = deadOps.filter(
        (op) =>
          !(
            op.uid === uid &&
            ids.has(op.id) &&
            (!kinds.size || kinds.has(op.kind))
          ),
      );
      return { changes: before - deadOps.length };
    }

    const ids = new Set((params as number[]).map(Number));
    const before = deadOps.length;
    deadOps = deadOps.filter((op) => !ids.has(op.id));
    return { changes: before - deadOps.length };
  }

  if (sql.includes("DELETE FROM op_queue")) {
    if (sql.includes("cloud_id IN")) {
      const uid = String(params[0] ?? "");
      const cloudIdMatch = sql.match(/cloud_id IN \(([^)]+)\)/);
      const cloudIdCount =
        cloudIdMatch?.[1].split(",").filter((part) => part.trim() === "?")
          .length ?? 0;
      const cloudIds = new Set(params.slice(1, 1 + cloudIdCount).map(String));
      const kinds = new Set(
        params
          .slice(1 + cloudIdCount)
          .filter((value): value is string => typeof value === "string"),
      );
      const before = queuedOps.length;
      queuedOps = queuedOps.filter(
        (op) =>
          !(
            op.uid === uid &&
            cloudIds.has(op.cloudId) &&
            (!kinds.size || kinds.has(op.kind))
          ),
      );
      return { changes: before - queuedOps.length };
    }

    if (sql.includes("client_mutation_id IN")) {
      const uid = String(params[0] ?? "");
      const mutationIds = new Set(
        params
          .slice(1)
          .filter((value): value is string => typeof value === "string")
          .filter((value) => value.startsWith("mutation-")),
      );
      const kinds = new Set(
        params
          .slice(1)
          .filter((value): value is string => typeof value === "string")
          .filter((value) => !value.startsWith("mutation-")),
      );
      const before = queuedOps.length;
      queuedOps = queuedOps.filter(
        (op) =>
          !(
            op.uid === uid &&
            mutationIds.has(op.clientMutationId) &&
            (!kinds.size || kinds.has(op.kind))
          ),
      );
      return { changes: before - queuedOps.length };
    }

    if (sql.includes("WHERE id=?")) {
      const id = Number(params[0]);
      queuedOps = queuedOps.filter((op) => op.id !== id);
      return;
    }

    const [cloudId, uid, ...rest] = params as string[];
    const targetKinds = sql.includes("kind IN")
      ? rest
      : sql.includes("kind=?")
        ? [String(params[2])]
      : [
          sql.includes("kind='upsert_mymeal'")
            ? "upsert_mymeal"
            : "upsert",
        ];
    queuedOps = queuedOps.filter(
      (op) =>
        !(
          op.cloudId === cloudId &&
          op.uid === uid &&
          targetKinds.includes(op.kind)
        ),
    );
    return;
  }

  if (sql.includes("INSERT INTO op_queue")) {
    const hasClientMutationId = sql.includes("client_mutation_id");
    const offset = hasClientMutationId ? 1 : 0;
    const clientMutationId = hasClientMutationId
      ? String(params[0])
      : `legacy:${params[1]}:${params[2]}:${params[0]}`;
    const cloudId = String(params[offset]);
    const uid = String(params[offset + 1]);
    const maybeKind = params[offset + 2];
    const kind =
      typeof maybeKind === "string" && !String(maybeKind).startsWith("{")
        ? maybeKind
        : sql.includes("'upsert_mymeal'")
          ? "upsert_mymeal"
          : sql.includes("'update_user_profile'")
            ? "update_user_profile"
            : sql.includes("'upload_user_avatar'")
              ? "upload_user_avatar"
              : "upsert";
    const kindIsParam = kind === maybeKind;
    const payloadIndex = offset + (kindIsParam ? 3 : 2);
    const updatedAtIndex = payloadIndex + 1;
    queuedOps.push({
      id: nextQueueId++,
      clientMutationId,
      cloudId,
      uid,
      kind,
      payload:
        typeof params[payloadIndex] === "string"
          ? JSON.parse(String(params[payloadIndex]))
          : params[payloadIndex],
      updatedAt: String(params[updatedAtIndex]),
      attempts: 0,
    });
  }
}

function selectDeadOps(_sql: string, params: unknown[] = []) {
  const uid = String(params[0] ?? "");
  const limit = Number(params[params.length - 1] ?? deadOps.length);
  const kinds = new Set(
    params
      .slice(1, -1)
      .filter((value): value is string => typeof value === "string"),
  );
  return deadOps
    .filter((op) => op.uid === uid && (!kinds.size || kinds.has(op.kind)))
    .slice(0, limit)
    .map((op) => ({
      id: op.id,
      op_id: op.opId,
      client_mutation_id: op.clientMutationId,
      cloud_id: op.cloudId,
      user_uid: op.uid,
      kind: op.kind,
      payload: JSON.stringify(op.payload),
      updated_at: op.updatedAt,
      attempts: op.attempts,
      failed_at: op.failedAt,
      last_error_code: op.lastErrorCode,
      last_error_message: op.lastErrorMessage,
    }));
}

function toQueueRow(op: QueuedOp) {
  return {
    id: op.id,
    client_mutation_id: op.clientMutationId,
    cloud_id: op.cloudId,
    user_uid: op.uid,
    kind: op.kind,
    payload: JSON.stringify(op.payload),
    updated_at: op.updatedAt,
    attempts: op.attempts,
  };
}

function selectQueuedOps(_sql: string, params: unknown[] = []) {
  const cloudId = String(params[0] ?? "");
  const uid = String(params[1] ?? "");
  const kinds = new Set(
    params
      .slice(2)
      .filter((value): value is string => typeof value === "string"),
  );
  return queuedOps
    .filter(
      (op) =>
        op.cloudId === cloudId &&
        op.uid === uid &&
        (!kinds.size || kinds.has(op.kind)),
    )
    .sort((left, right) => {
      const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
      return byUpdatedAt || right.id - left.id;
    })
    .map(toQueueRow);
}

function selectRows(sql: string, params: unknown[] = []) {
  if (sql.includes("FROM op_queue_dead")) {
    return selectDeadOps(sql, params);
  }
  if (sql.includes("FROM op_queue")) {
    return selectQueuedOps(sql, params);
  }
  return [];
}

function countFor(
  ops: Array<{ uid: string; kind: string }>,
  uid: string,
  kinds: string[],
) {
  return ops.filter(
    (op) => op.uid === uid && (!kinds.length || kinds.includes(op.kind)),
  ).length;
}

function getCounts(sql: string, params: unknown[] = []) {
  const firstUid = String(params[0] ?? "");
  if (sql.includes("COUNT(1) AS count")) {
    const kinds = params
      .slice(1)
      .filter((value): value is string => typeof value === "string");
    return {
      count: countFor(deadOps, firstUid, kinds),
    };
  }

  const midpoint = Math.floor(params.length / 2);
  const firstKinds = params
    .slice(1, midpoint)
    .filter((value): value is string => typeof value === "string");
  const secondUid = String(params[midpoint] ?? "");
  const secondKinds = params
    .slice(midpoint + 1)
    .filter((value): value is string => typeof value === "string");
  return {
    dead: countFor(deadOps, firstUid, firstKinds),
    pending: countFor(queuedOps, secondUid, secondKinds),
  };
}

jest.mock("@/services/offline/db", () => ({
  getDB: () => ({
    runSync: mockRunSync,
    execSync: mockExecSync,
    getAllSync: mockGetAllSync,
    getFirstSync: mockGetFirstSync,
  }),
}));

jest.mock("@/services/core/events", () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload),
}));

jest.mock("uuid", () => ({
  v4: () => "uuid-generated",
}));

const baseMeal = (overrides: Partial<Meal> = {}): Meal => ({
  userUid: "user-1",
  mealId: "meal-1",
  cloudId: "cloud-1",
  timestamp: "2026-02-25T10:00:00.000Z",
  type: "lunch",
  name: "Chicken",
  ingredients: [],
  createdAt: "2026-02-25T10:00:00.000Z",
  updatedAt: "2026-02-25T10:00:00.000Z",
  syncState: "pending",
  source: "manual",
  ...overrides,
});

function ingredientProductRow(
  overrides: Partial<IngredientProductSearchRow> = {},
): IngredientProductSearchRow {
  return {
    ingredientProductId: "user-product-1",
    recordScope: "user_scoped",
    lifecycleState: "candidate",
    displayName: "Owsianka domowa",
    kind: "generic_ingredient",
    defaultServing: { quantity: 50, unit: "g" },
    nutritionPer100: null,
    confidence: { identity: "medium", nutrition: "unknown", profile: "unknown" },
    sourceAttribution: {
      sourceType: "user_created",
      sourceId: "ingredient-product:create:user-1:mutation-1",
      sourceName: "manual_entry",
      provider: null,
      license: null,
      observedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    profileCompatibility: {
      status: "unknown",
      dietaryFlags: [],
      allergenFlags: [],
    },
    warningReasonCodes: [],
    rankingSignals: ["user_scoped"],
    brandName: null,
    ingredientName: null,
    packageName: null,
    category: null,
    servingSizes: [],
    dietaryFlags: [],
    allergenFlags: [],
    cacheState: "fresh",
    ownerUserId: "user-1",
    ...overrides,
  };
}

function queuedOp(overrides: Partial<QueuedOp> = {}): QueuedOp {
  return {
    id: nextQueueId++,
    clientMutationId: "mutation-queued",
    cloudId: "cloud-1",
    uid: "user-1",
    kind: "upsert",
    payload: baseMeal(),
    updatedAt: "2026-02-25T10:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

function deadOp(overrides: Partial<DeadOp> = {}): DeadOp {
  return {
    id: nextDeadId++,
    opId: 10 + deadOps.length,
    clientMutationId: "mutation-dead",
    cloudId: "cloud-1",
    uid: "user-1",
    kind: "upsert",
    payload: baseMeal({ syncState: "failed" }),
    updatedAt: "2026-02-25T10:00:00.000Z",
    attempts: 10,
    failedAt: "2026-02-25T10:05:00.000Z",
    lastErrorCode: "sync/test",
    lastErrorMessage: "Test failure",
    ...overrides,
  };
}

function familyOps(uid: string, cloudId: string, kinds: string[]) {
  return queuedOps.filter(
    (op) =>
      op.uid === uid && op.cloudId === cloudId && kinds.includes(op.kind),
  );
}

describe("queue.repo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    nextQueueId = 1;
    nextDeadId = 100;
    queuedOps = [];
    deadOps = [];
    mockRunSync.mockImplementation(applyQueueMutation);
    mockGetAllSync.mockImplementation(selectRows);
    mockGetFirstSync.mockImplementation(getCounts);
  });

  it("coalesces meal upserts by user, cloud id and kind before enqueueing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enqueueUpsert } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await enqueueUpsert("user-1", baseMeal());

    expect(mockExecSync).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockRunSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("DELETE FROM op_queue"),
      ["cloud-1", "user-1"],
    );
    expect(mockRunSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO op_queue"),
      [
        "meal-sync:upsert:user-1:cloud-1:uuid-generated",
        "cloud-1",
        "user-1",
        expect.stringContaining('"cloudId":"cloud-1"'),
        "2026-02-25T10:00:00.000Z",
      ],
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(2, "COMMIT");
  });

  it("keeps one queued meal upsert after repeated offline edits and stores the latest payload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enqueueUpsert, getSyncCounts } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await enqueueUpsert(
      "user-1",
      baseMeal({
        name: "First offline edit",
        updatedAt: "2026-02-25T10:10:00.000Z",
      }),
    );
    await enqueueUpsert(
      "user-1",
      baseMeal({
        name: "Second offline edit",
        updatedAt: "2026-02-25T10:20:00.000Z",
      }),
    );
    await enqueueUpsert(
      "user-1",
      baseMeal({
        name: "Final offline edit",
        updatedAt: "2026-02-25T10:30:00.000Z",
      }),
    );

    expect(queuedOps).toHaveLength(1);
    expect(queuedOps[0]).toEqual(
      expect.objectContaining({
        clientMutationId: "meal-sync:upsert:user-1:cloud-1:uuid-generated",
        cloudId: "cloud-1",
        kind: "upsert",
        updatedAt: "2026-02-25T10:30:00.000Z",
        payload: expect.objectContaining({
          name: "Final offline edit",
          updatedAt: "2026-02-25T10:30:00.000Z",
        }),
      }),
    );
    await expect(
      getSyncCounts("user-1", { kinds: ["upsert", "delete"] }),
    ).resolves.toEqual({ dead: 0, pending: 1 });
  });

  it("coalesces saved-meal upserts by generated document id", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enqueueMyMealUpsert } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await enqueueMyMealUpsert(
      "user-1",
      baseMeal({ mealId: undefined as unknown as string, cloudId: undefined }),
    );

    expect(mockRunSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("DELETE FROM op_queue"),
      ["uuid-generated", "user-1"],
    );
    expect(mockRunSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO op_queue"),
      [
        "meal-sync:upsert_mymeal:user-1:uuid-generated:uuid-generated",
        "uuid-generated",
        "user-1",
        expect.stringContaining('"source":"manual"'),
        "2026-02-25T10:00:00.000Z",
      ],
    );
  });

  it("coalesces repeated meal deletes into a single pending op", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enqueueDelete } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await enqueueDelete("user-1", "cloud-1", "2026-02-25T10:00:00.000Z");
    await enqueueDelete("user-1", "cloud-1", "2026-02-25T11:00:00.000Z");

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "cloud-1",
        uid: "user-1",
        kind: "delete",
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ]);
    expect(mockExecSync.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "COMMIT",
      "BEGIN",
      "COMMIT",
    ]);
  });

  it("replaces a pending meal edit with a single delete tombstone", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");
    const { enqueueDelete, enqueueUpsert } = queueRepo;

    await enqueueUpsert(
      "user-1",
      baseMeal({
        name: "Edited before delete",
        updatedAt: "2026-02-25T10:30:00.000Z",
      }),
    );
    await enqueueDelete("user-1", "cloud-1", "2026-02-25T11:00:00.000Z");

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "cloud-1",
        uid: "user-1",
        kind: "delete",
        updatedAt: "2026-02-25T11:00:00.000Z",
        payload: { cloudId: "cloud-1", deleted: true },
      }),
    ]);
  });

  it("replaces pending saved-meal upserts and deletes with one saved-meal delete", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");
    const { enqueueMyMealDelete, enqueueMyMealUpsert } = queueRepo;

    await enqueueMyMealUpsert("user-1", baseMeal());
    await enqueueMyMealDelete("user-1", "meal-1", "2026-02-25T11:00:00.000Z");
    await enqueueMyMealDelete("user-1", "meal-1", "2026-02-25T12:00:00.000Z");

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "meal-1",
        uid: "user-1",
        kind: "delete_mymeal",
        updatedAt: "2026-02-25T12:00:00.000Z",
      }),
    ]);
  });

  it("uses Smart Memory-specific queue kinds for candidate and item controls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await queueRepo.enqueueSmartMemoryCandidateUpsert("user-1", {
      candidateId: "candidate-1",
      memoryType: "typical_portion",
      subject: { kind: "ingredient_alias", aliasHash: "hash-1" },
      evidenceSummary: { observationCount: 1 },
      sourceRefs: [{ kind: "meal_review", sourceHash: "source-1" }],
      confidenceReasonCodes: ["single_observation"],
      suppressionChecks: { settingsEnabled: true },
    });
    await queueRepo.enqueueSmartMemoryItemEdit("user-1", "memory-1", {
      userValue: { amount: 60, unit: "g" },
      editedFields: ["userValue"],
    });
    await queueRepo.enqueueSmartMemoryItemMute("user-1", "memory-1");
    await queueRepo.enqueueSmartMemoryItemDelete("user-1", "memory-1");

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "candidate-1",
        uid: "user-1",
        kind: "smart_memory_candidate_upsert",
        clientMutationId:
          "smart-memory:candidate_upsert:user-1:candidate-1:uuid-generated",
      }),
      expect.objectContaining({
        cloudId: "memory-1",
        uid: "user-1",
        kind: "smart_memory_item_delete",
        clientMutationId: "smart-memory:delete:user-1:memory-1:uuid-generated",
      }),
    ]);
    expect(familyOps("user-1", "memory-1", ["smart_memory_item_edit", "smart_memory_item_mute"])).toEqual(
      [],
    );
  });

  it("coalesces Smart Memory settings enable and disable controls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await queueRepo.enqueueSmartMemorySettingsDisable("user-1");
    await queueRepo.enqueueSmartMemorySettingsEnable("user-1");

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "settings",
        uid: "user-1",
        kind: "smart_memory_settings_enable",
        payload: { enabled: true },
        clientMutationId:
          "smart-memory:settings_enable:user-1:settings:uuid-generated",
      }),
    ]);
  });

  it("uses Product/Ingredient-specific create queue kind and durable client mutation id", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await queueRepo.enqueueIngredientProductCreate(
      "user-1",
      {
        searchQuery: "Owsianka domowa",
        locale: "pl-PL",
        request: {
          clientMutationId: "ingredient-product:create:user-1:mutation-1",
          ingredientProductId: "user-product-1",
          displayName: "Owsianka domowa",
          kind: "generic_ingredient",
          defaultServing: { quantity: 50, unit: "g" },
          nutritionPer100: null,
        },
      },
      { updatedAt: "2026-06-16T10:00:00.000Z" },
    );
    await queueRepo.enqueueIngredientProductCreate(
      "user-1",
      {
        searchQuery: "Owsianka domowa",
        locale: "pl-PL",
        request: {
          clientMutationId: "ingredient-product:create:user-1:mutation-2",
          ingredientProductId: "user-product-1",
          displayName: "Owsianka domowa",
          kind: "generic_ingredient",
          defaultServing: { quantity: 60, unit: "g" },
          nutritionPer100: null,
        },
      },
      { updatedAt: "2026-06-16T10:05:00.000Z" },
    );

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "user-product-1",
        uid: "user-1",
        kind: "ingredient_product_create",
        clientMutationId: "ingredient-product:create:user-1:mutation-2",
        updatedAt: "2026-06-16T10:05:00.000Z",
        payload: expect.objectContaining({
          searchQuery: "Owsianka domowa",
          request: expect.objectContaining({
            ingredientProductId: "user-product-1",
            defaultServing: { quantity: 60, unit: "g" },
          }),
        }),
      }),
    ]);
  });

  it("uses Product/Ingredient-specific delete queue kind without removing queued creates", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await queueRepo.enqueueIngredientProductCreate(
      "user-1",
      {
        searchQuery: "Owsianka domowa",
        locale: "pl-PL",
        request: {
          clientMutationId: "ingredient-product:create:user-1:mutation-1",
          ingredientProductId: "user-product-1",
          displayName: "Owsianka domowa",
          kind: "generic_ingredient",
          defaultServing: { quantity: 50, unit: "g" },
          nutritionPer100: null,
        },
      },
      { updatedAt: "2026-06-16T10:00:00.000Z" },
    );
    await queueRepo.enqueueIngredientProductDelete("user-1", "user-product-1", {
      updatedAt: "2026-06-16T10:05:00.000Z",
    });
    await queueRepo.enqueueIngredientProductDelete("user-1", "user-product-1", {
      updatedAt: "2026-06-16T10:06:00.000Z",
    });

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "user-product-1",
        uid: "user-1",
        kind: "ingredient_product_create",
        clientMutationId: "ingredient-product:create:user-1:mutation-1",
      }),
      expect.objectContaining({
        cloudId: "user-product-1",
        uid: "user-1",
        kind: "ingredient_product_delete",
        clientMutationId:
          "ingredient-product:delete:user-1:user-product-1:uuid-generated",
        updatedAt: "2026-06-16T10:06:00.000Z",
        payload: { ingredientProductId: "user-product-1" },
      }),
    ]);
  });

  it("uses Product/Ingredient-specific update queue kind and rejects invalid local context", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    await queueRepo.enqueueIngredientProductUpdate(
      "user-1",
      {
        searchQuery: "Updated oats",
        locale: "pl-PL",
        baseItem: ingredientProductRow(),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-1",
          ingredientProductId: "user-product-1",
          displayName: "Updated oats",
          brandName: null,
        },
      },
      { updatedAt: "2026-06-16T10:00:00.000Z" },
    );
    await queueRepo.enqueueIngredientProductUpdate(
      "user-1",
      {
        searchQuery: "Updated oats",
        locale: "pl-PL",
        baseItem: ingredientProductRow(),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-2",
          ingredientProductId: "user-product-1",
          displayName: "Updated oats v2",
          servingSizes: null,
        },
      },
      { updatedAt: "2026-06-16T10:05:00.000Z" },
    );

    expect(queuedOps).toEqual([
      expect.objectContaining({
        cloudId: "user-product-1",
        uid: "user-1",
        kind: "ingredient_product_update",
        clientMutationId: "ingredient-product:update:user-1:mutation-2",
        updatedAt: "2026-06-16T10:05:00.000Z",
        payload: expect.objectContaining({
          searchQuery: "Updated oats",
          locale: "pl-PL",
          baseItem: expect.objectContaining({
            ingredientProductId: "user-product-1",
            recordScope: "user_scoped",
            ownerUserId: "user-1",
          }),
          request: expect.objectContaining({
            ingredientProductId: "user-product-1",
            displayName: "Updated oats v2",
            servingSizes: null,
          }),
        }),
      }),
    ]);

    await expect(
      queueRepo.enqueueIngredientProductUpdate("user-1", {
        searchQuery: "Blocked",
        baseItem: ingredientProductRow({
          recordScope: "global_seed",
          ownerUserId: null,
        }),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-3",
          ingredientProductId: "user-product-1",
          displayName: "Blocked",
        },
      }),
    ).rejects.toThrow(
      "Ingredient/Product update payload must target a current-user record.",
    );
    await expect(
      queueRepo.enqueueIngredientProductUpdate("user-1", {
        searchQuery: "Blocked",
        baseItem: ingredientProductRow(),
        request: {
          clientMutationId: "ingredient-product:update:user-1:mutation-4",
          ingredientProductId: " ",
          displayName: "Blocked",
        },
      }),
    ).rejects.toThrow(
      "Ingredient/Product update payload must target a current-user record.",
    );
  });

  it("surfaces dead meal ops, retries them without duplicate pending ops, and clears after success", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");
    const {
      getDeadLetterCount,
      getDeadLetterOps,
      getSyncCounts,
      markDone,
      retryDeadLetterOps,
    } = queueRepo;

    queuedOps = [
      {
        id: 1,
        cloudId: "cloud-1",
        clientMutationId: "mutation-dead-retry",
        uid: "user-1",
        kind: "upsert",
        payload: baseMeal({
          name: "Older pending payload",
          updatedAt: "2026-02-25T09:00:00.000Z",
        }),
        updatedAt: "2026-02-25T09:00:00.000Z",
        attempts: 0,
      },
    ];
    nextQueueId = 2;
    deadOps = [
      {
        id: 10,
        opId: 1,
        clientMutationId: "mutation-dead-retry",
        cloudId: "cloud-1",
        uid: "user-1",
        kind: "upsert",
        payload: baseMeal({ syncState: "failed" }),
        updatedAt: "2026-02-25T10:00:00.000Z",
        attempts: 10,
        failedAt: "2026-02-25T10:05:00.000Z",
        lastErrorCode: "sync/test",
        lastErrorMessage: "Test failure",
      },
    ];

    await expect(
      getDeadLetterCount("user-1", { kinds: ["upsert", "delete"] }),
    ).resolves.toBe(1);
    await expect(
      getDeadLetterOps({
        uid: "user-1",
        kinds: ["upsert", "delete"],
        limit: 1,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        cloud_id: "cloud-1",
        kind: "upsert",
        payload: expect.objectContaining({ syncState: "failed" }),
      }),
    ]);

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(1);

    expect(queuedOps).toHaveLength(1);
    expect(queuedOps[0]).toEqual(
      expect.objectContaining({
        cloudId: "cloud-1",
        kind: "upsert",
        clientMutationId: "mutation-dead-retry",
        attempts: 0,
        payload: expect.objectContaining({ syncState: "failed" }),
      }),
    );
    await expect(
      getSyncCounts("user-1", { kinds: ["upsert", "delete"] }),
    ).resolves.toEqual({ dead: 0, pending: 1 });

    await markDone(queuedOps[0].id);

    await expect(
      getSyncCounts("user-1", { kinds: ["upsert", "delete"] }),
    ).resolves.toEqual({ dead: 0, pending: 0 });
  });

  it("retries a dead avatar upload with the same durable identity and clears the dead row", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    deadOps = [
      deadOp({
        id: 44,
        opId: 12,
        clientMutationId: "avatar-mutation-1",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
        payload: {
          localPath: "file://avatar-new.jpg",
          updatedAt: "2026-03-03T12:10:00.000Z",
        },
        updatedAt: "2026-03-03T12:10:00.000Z",
        attempts: 10,
        failedAt: "2026-03-03T12:12:00.000Z",
        lastErrorCode: "storage/upload-failed",
        lastErrorMessage: "Upload failed",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upload_user_avatar"] }),
    ).resolves.toBe(1);

    expect(queuedOps).toEqual([
      expect.objectContaining({
        clientMutationId: "avatar-mutation-1",
        cloudId: "profile_avatar",
        uid: "user-1",
        kind: "upload_user_avatar",
        payload: {
          localPath: "file://avatar-new.jpg",
          updatedAt: "2026-03-03T12:10:00.000Z",
        },
        updatedAt: "2026-03-03T12:10:00.000Z",
        attempts: 0,
      }),
    ]);
    expect(deadOps).toEqual([]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:retried", {
      uid: "user-1",
      count: 1,
    });
  });

  it("discards only selected dead-letter rows for the requested uid and kind", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { discardDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        id: 44,
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
      }),
    ];
    deadOps = [
      deadOp({
        id: 10,
        uid: "user-1",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
      }),
      deadOp({
        id: 11,
        uid: "user-1",
        cloudId: "user_profile",
        kind: "update_user_profile",
      }),
      deadOp({
        id: 12,
        uid: "other-user",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
      }),
    ];

    await expect(
      discardDeadLetterOps({
        uid: "user-1",
        ids: [10, 11, 12],
        kinds: ["upload_user_avatar"],
      }),
    ).resolves.toBe(1);

    expect(deadOps).toEqual([
      expect.objectContaining({ id: 11, uid: "user-1" }),
      expect.objectContaining({ id: 12, uid: "other-user" }),
    ]);
    expect(queuedOps).toEqual([
      expect.objectContaining({
        id: 44,
        uid: "user-1",
        kind: "upload_user_avatar",
      }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:discarded", {
      uid: "user-1",
      count: 1,
      ids: [10, 11, 12],
      kinds: ["upload_user_avatar"],
    });
  });

  it("does not emit a discard event when no dead-letter rows are removed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { discardDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    deadOps = [
      deadOp({
        id: 10,
        uid: "other-user",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
      }),
    ];

    await expect(
      discardDeadLetterOps({
        uid: "user-1",
        ids: [10],
        kinds: ["upload_user_avatar"],
      }),
    ).resolves.toBe(0);

    expect(deadOps).toEqual([
      expect.objectContaining({ id: 10, uid: "other-user" }),
    ]);
    expect(mockEmit).not.toHaveBeenCalledWith(
      "sync:op:discarded",
      expect.anything(),
    );
  });

  it("discards selected queued ops by client mutation id for failed local recovery", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queueRepo = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");
    const { discardQueuedOpsByClientMutationIds } = queueRepo;

    queuedOps = [
      queuedOp({
        id: 20,
        uid: "user-1",
        cloudId: "memory-1",
        kind: "smart_memory_item_mute",
        clientMutationId: "mutation-smart-memory-1",
      }),
      queuedOp({
        id: 21,
        uid: "user-1",
        cloudId: "meal-1",
        kind: "upsert",
        clientMutationId: "mutation-meal-1",
      }),
      queuedOp({
        id: 22,
        uid: "other-user",
        cloudId: "memory-1",
        kind: "smart_memory_item_mute",
        clientMutationId: "mutation-smart-memory-1",
      }),
    ];

    await expect(
      discardQueuedOpsByClientMutationIds({
        uid: "user-1",
        clientMutationIds: ["mutation-smart-memory-1", ""],
        kinds: ["smart_memory_item_mute"],
      }),
    ).resolves.toBe(1);

    expect(queuedOps).toEqual([
      expect.objectContaining({ id: 21, uid: "user-1", kind: "upsert" }),
      expect.objectContaining({ id: 22, uid: "other-user" }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:discarded", {
      uid: "user-1",
      count: 1,
      clientMutationIds: ["mutation-smart-memory-1"],
      kinds: ["smart_memory_item_mute"],
    });
  });

  it("discards queued and dead-letter ops by cloud id only for the requested uid and kinds", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { discardQueuedAndDeadLetterOpsByCloudIds } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        id: 30,
        uid: "user-1",
        cloudId: "user-product-1",
        kind: "ingredient_product_create",
      }),
      queuedOp({
        id: 31,
        uid: "user-1",
        cloudId: "user-product-1",
        kind: "ingredient_product_update",
      }),
      queuedOp({
        id: 32,
        uid: "user-1",
        cloudId: "user-product-1",
        kind: "upsert",
      }),
      queuedOp({
        id: 33,
        uid: "user-1",
        cloudId: "memory-1",
        kind: "smart_memory_item_delete",
      }),
      queuedOp({
        id: 34,
        uid: "other-user",
        cloudId: "user-product-1",
        kind: "ingredient_product_create",
      }),
      queuedOp({
        id: 35,
        uid: "user-1",
        cloudId: "other-product",
        kind: "ingredient_product_delete",
      }),
    ];
    deadOps = [
      deadOp({
        id: 40,
        uid: "user-1",
        cloudId: "user-product-1",
        kind: "ingredient_product_delete",
      }),
      deadOp({
        id: 41,
        uid: "user-1",
        cloudId: "user-product-1",
        kind: "delete",
      }),
      deadOp({
        id: 42,
        uid: "other-user",
        cloudId: "user-product-1",
        kind: "ingredient_product_update",
      }),
    ];

    await expect(
      discardQueuedAndDeadLetterOpsByCloudIds({
        uid: "user-1",
        cloudIds: ["user-product-1", "user-product-1", " "],
        kinds: [
          "ingredient_product_create",
          "ingredient_product_update",
          "ingredient_product_delete",
        ],
      }),
    ).resolves.toEqual({ queued: 2, dead: 1 });

    expect(queuedOps).toEqual([
      expect.objectContaining({ id: 32, kind: "upsert" }),
      expect.objectContaining({ id: 33, kind: "smart_memory_item_delete" }),
      expect.objectContaining({ id: 34, uid: "other-user" }),
      expect.objectContaining({ id: 35, cloudId: "other-product" }),
    ]);
    expect(deadOps).toEqual([
      expect.objectContaining({ id: 41, kind: "delete" }),
      expect.objectContaining({ id: 42, uid: "other-user" }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:discarded", {
      uid: "user-1",
      count: 3,
      cloudIds: ["user-product-1"],
      kinds: [
        "ingredient_product_create",
        "ingredient_product_update",
        "ingredient_product_delete",
      ],
    });
  });

  it("replaces an existing pending avatar upload when retrying the same dead avatar reference", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        clientMutationId: "avatar-pending-old",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
        payload: {
          localPath: "file://avatar-stale.jpg",
          updatedAt: "2026-03-03T12:00:00.000Z",
        },
        updatedAt: "2026-03-03T12:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        clientMutationId: "avatar-mutation-retry",
        cloudId: "profile_avatar",
        kind: "upload_user_avatar",
        payload: {
          localPath: "file://avatar-retry.jpg",
          updatedAt: "2026-03-03T12:10:00.000Z",
        },
        updatedAt: "2026-03-03T12:10:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upload_user_avatar"] }),
    ).resolves.toBe(1);

    expect(familyOps("user-1", "profile_avatar", ["upload_user_avatar"])).toEqual([
      expect.objectContaining({
        clientMutationId: "avatar-mutation-retry",
        kind: "upload_user_avatar",
        payload: {
          localPath: "file://avatar-retry.jpg",
          updatedAt: "2026-03-03T12:10:00.000Z",
        },
        updatedAt: "2026-03-03T12:10:00.000Z",
        attempts: 0,
      }),
    ]);
    expect(deadOps).toEqual([]);
  });

  it("skips a dead meal upsert when a newer pending delete exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        kind: "delete",
        payload: { cloudId: "cloud-1", deleted: true },
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        kind: "upsert",
        payload: baseMeal({
          name: "Stale dead upsert",
          updatedAt: "2026-02-25T10:00:00.000Z",
        }),
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(0);

    expect(familyOps("user-1", "cloud-1", ["upsert", "delete"])).toEqual([
      expect.objectContaining({
        kind: "delete",
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ]);
    expect(deadOps).toEqual([]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:retried", {
      uid: "user-1",
      count: 0,
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "sync:op:retry_skipped",
      expect.objectContaining({
        uid: "user-1",
        count: 1,
        reason: "newer_pending_family_op",
      }),
    );
  });

  it("retries a dead meal delete by superseding a pending upsert", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        kind: "upsert",
        payload: baseMeal({ name: "Pending upsert" }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        kind: "delete",
        payload: { cloudId: "cloud-1", deleted: true },
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(1);

    expect(familyOps("user-1", "cloud-1", ["upsert", "delete"])).toEqual([
      expect.objectContaining({
        kind: "delete",
        payload: { cloudId: "cloud-1", deleted: true },
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:retried", {
      uid: "user-1",
      count: 1,
    });
  });

  it("skips an older dead meal upsert when a newer pending upsert exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        kind: "upsert",
        payload: baseMeal({
          name: "Newer pending payload",
          updatedAt: "2026-02-25T11:00:00.000Z",
        }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        kind: "upsert",
        payload: baseMeal({
          name: "Older dead payload",
          updatedAt: "2026-02-25T10:00:00.000Z",
        }),
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(0);

    expect(familyOps("user-1", "cloud-1", ["upsert", "delete"])).toEqual([
      expect.objectContaining({
        kind: "upsert",
        payload: expect.objectContaining({ name: "Newer pending payload" }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ]);
    expect(deadOps).toEqual([]);
  });

  it("retries a newer dead meal upsert by replacing an older pending upsert", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        kind: "upsert",
        payload: baseMeal({
          name: "Older pending payload",
          updatedAt: "2026-02-25T10:00:00.000Z",
        }),
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        kind: "upsert",
        payload: baseMeal({
          name: "Newer dead payload",
          updatedAt: "2026-02-25T11:00:00.000Z",
        }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(1);

    expect(familyOps("user-1", "cloud-1", ["upsert", "delete"])).toEqual([
      expect.objectContaining({
        kind: "upsert",
        payload: expect.objectContaining({ name: "Newer dead payload" }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ]);
  });

  it("applies family-aware retry semantics to saved meal dead-letter ops", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        cloudId: "saved-skip",
        kind: "delete_mymeal",
        payload: { cloudId: "saved-skip", deleted: true },
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
      queuedOp({
        cloudId: "saved-delete",
        kind: "upsert_mymeal",
        payload: baseMeal({
          cloudId: "saved-delete",
          mealId: "saved-delete",
          name: "Pending saved upsert",
        }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        cloudId: "saved-skip",
        kind: "upsert_mymeal",
        payload: baseMeal({
          cloudId: "saved-skip",
          mealId: "saved-skip",
          name: "Stale saved upsert",
          updatedAt: "2026-02-25T10:00:00.000Z",
        }),
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
      deadOp({
        cloudId: "saved-delete",
        kind: "delete_mymeal",
        payload: { cloudId: "saved-delete", deleted: true },
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({
        uid: "user-1",
        kinds: ["upsert_mymeal", "delete_mymeal"],
      }),
    ).resolves.toBe(1);

    expect(
      familyOps("user-1", "saved-skip", ["upsert_mymeal", "delete_mymeal"]),
    ).toEqual([
      expect.objectContaining({
        kind: "delete_mymeal",
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ]);
    expect(
      familyOps("user-1", "saved-delete", ["upsert_mymeal", "delete_mymeal"]),
    ).toEqual([
      expect.objectContaining({
        kind: "delete_mymeal",
        payload: { cloudId: "saved-delete", deleted: true },
      }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith("sync:op:retried", {
      uid: "user-1",
      count: 1,
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "sync:op:retry_skipped",
      expect.objectContaining({ uid: "user-1", count: 1 }),
    );
  });

  it("reports only actually requeued ops and leaves no duplicate operation family rows", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retryDeadLetterOps } = require("@/services/offline/queue.repo") as
      typeof import("@/services/offline/queue.repo");

    queuedOps = [
      queuedOp({
        cloudId: "skip-cloud",
        kind: "delete",
        payload: { cloudId: "skip-cloud", deleted: true },
        updatedAt: "2026-02-25T12:00:00.000Z",
      }),
      queuedOp({
        cloudId: "replace-cloud",
        kind: "upsert",
        payload: baseMeal({
          cloudId: "replace-cloud",
          mealId: "replace-cloud",
          name: "Old pending",
          updatedAt: "2026-02-25T09:00:00.000Z",
        }),
        updatedAt: "2026-02-25T09:00:00.000Z",
      }),
    ];
    deadOps = [
      deadOp({
        cloudId: "skip-cloud",
        kind: "upsert",
        payload: baseMeal({
          cloudId: "skip-cloud",
          mealId: "skip-cloud",
          name: "Skipped dead",
          updatedAt: "2026-02-25T10:00:00.000Z",
        }),
        updatedAt: "2026-02-25T10:00:00.000Z",
      }),
      deadOp({
        cloudId: "replace-cloud",
        kind: "upsert",
        payload: baseMeal({
          cloudId: "replace-cloud",
          mealId: "replace-cloud",
          name: "Requeued dead",
          updatedAt: "2026-02-25T11:00:00.000Z",
        }),
        updatedAt: "2026-02-25T11:00:00.000Z",
      }),
    ];

    await expect(
      retryDeadLetterOps({ uid: "user-1", kinds: ["upsert", "delete"] }),
    ).resolves.toBe(1);

    expect(mockEmit).toHaveBeenCalledWith("sync:op:retried", {
      uid: "user-1",
      count: 1,
    });
    for (const cloudId of ["skip-cloud", "replace-cloud"]) {
      expect(
        familyOps("user-1", cloudId, ["upsert", "delete"]),
      ).toHaveLength(1);
    }
    expect(familyOps("user-1", "replace-cloud", ["upsert", "delete"])).toEqual([
      expect.objectContaining({
        kind: "upsert",
        payload: expect.objectContaining({ name: "Requeued dead" }),
      }),
    ]);
  });
});
