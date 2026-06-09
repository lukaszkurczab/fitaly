import { getDB } from "./db";
import type { Meal } from "@/types/meal";
import type { UserData } from "@/types";
import type { DeadLetterRow, QueueKind, QueueRow } from "./types";
import { v4 as uuidv4 } from "uuid";
import { emit } from "@/services/core/events";

export type { QueueKind } from "./types";

export type QueuedOp = Omit<QueueRow, "payload"> & { payload: unknown };
export type DeadLetterOp = Omit<DeadLetterRow, "payload"> & {
  payload: unknown;
};
export const MAX_QUEUE_ATTEMPTS = 10;

function newClientMutationId(kind: QueueKind, uid: string, cloudId: string): string {
  return `meal-sync:${kind}:${uid}:${cloudId}:${uuidv4()}`;
}

function safeParse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

export async function enqueueUpsert(uid: string, meal: Meal): Promise<void> {
  const db = getDB();
  const cloudId = meal.cloudId ?? meal.mealId;
  const payload = meal.cloudId ? meal : { ...meal, cloudId };
  const clientMutationId = newClientMutationId("upsert", uid, cloudId);
  db.execSync("BEGIN");
  try {
    db.runSync(
      `DELETE FROM op_queue
       WHERE cloud_id=? AND user_uid=? AND kind='upsert'`,
      [cloudId, uid],
    );
    db.runSync(
      `INSERT INTO op_queue (
         client_mutation_id, cloud_id, user_uid, kind, payload, updated_at
       ) VALUES (?, ?, ?, 'upsert', ?, ?)`,
      [clientMutationId, cloudId, uid, JSON.stringify(payload), meal.updatedAt],
    );
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function enqueueMyMealUpsert(
  uid: string,
  meal: Meal
): Promise<void> {
  const db = getDB();
  const docId = meal.mealId ?? meal.cloudId ?? uuidv4();
  const payload = {
    ...meal,
    mealId: docId,
    cloudId: docId,
    source: meal.source ?? "saved",
  };
  const clientMutationId = newClientMutationId("upsert_mymeal", uid, docId);
  db.execSync("BEGIN");
  try {
    db.runSync(
      `DELETE FROM op_queue
       WHERE cloud_id=? AND user_uid=? AND kind='upsert_mymeal'`,
      [docId, uid],
    );
    db.runSync(
      `INSERT INTO op_queue (
         client_mutation_id, cloud_id, user_uid, kind, payload, updated_at
       ) VALUES (?, ?, ?, 'upsert_mymeal', ?, ?)`,
      [clientMutationId, docId, uid, JSON.stringify(payload), meal.updatedAt],
    );
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function enqueueDelete(
  uid: string,
  cloudId: string,
  updatedAt: string
): Promise<void> {
  await enqueueDeleteOp(uid, cloudId, updatedAt, "delete", [
    "upsert",
    "delete",
  ]);
}

export async function enqueueMyMealDelete(
  uid: string,
  cloudId: string,
  updatedAt: string
): Promise<void> {
  await enqueueDeleteOp(uid, cloudId, updatedAt, "delete_mymeal", [
    "upsert_mymeal",
    "delete_mymeal",
  ]);
}

async function enqueueDeleteOp(
  uid: string,
  cloudId: string,
  updatedAt: string,
  kind: Extract<QueueKind, "delete" | "delete_mymeal">,
  supersededKinds: QueueKind[],
): Promise<void> {
  const db = getDB();
  const clientMutationId = newClientMutationId(kind, uid, cloudId);
  db.execSync("BEGIN");
  try {
    db.runSync(
      `DELETE FROM op_queue
       WHERE cloud_id=? AND user_uid=? AND kind IN (${supersededKinds
         .map(() => "?")
         .join(",")})`,
      [cloudId, uid, ...supersededKinds],
    );
    db.runSync(
      `INSERT INTO op_queue (
         client_mutation_id, cloud_id, user_uid, kind, payload, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        clientMutationId,
        cloudId,
        uid,
        kind,
        JSON.stringify({ cloudId, deleted: true }),
        updatedAt,
      ],
    );
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function enqueueUserProfileUpdate(
  uid: string,
  payload: Partial<UserData>,
  options?: { updatedAt?: string },
): Promise<void> {
  if (!uid) return;
  const db = getDB();
  const updatedAt = options?.updatedAt ?? new Date().toISOString();
  const clientMutationId = newClientMutationId("update_user_profile", uid, "user_profile");
  db.execSync("BEGIN");
  try {
    const existing = db.getFirstSync<{ payload: string }>(
      `SELECT payload
       FROM op_queue
       WHERE user_uid=? AND kind='update_user_profile'
       ORDER BY id DESC
       LIMIT 1`,
      [uid],
    );

    const existingPayload = safeParse(existing?.payload ?? "{}");
    const mergedPayload =
      existingPayload && typeof existingPayload === "object"
        ? {
            ...(existingPayload as Record<string, unknown>),
            ...payload,
          }
        : payload;

    db.runSync(
      `DELETE FROM op_queue
       WHERE user_uid=? AND kind='update_user_profile'`,
      [uid],
    );
    db.runSync(
      `INSERT INTO op_queue (
         client_mutation_id, cloud_id, user_uid, kind, payload, updated_at
       ) VALUES (?, ?, ?, 'update_user_profile', ?, ?)`,
      [
        clientMutationId,
        "user_profile",
        uid,
        JSON.stringify(mergedPayload),
        updatedAt,
      ],
    );
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function enqueueUserAvatarUpload(
  uid: string,
  payload: {
    localPath: string;
    updatedAt?: string;
  },
): Promise<void> {
  const db = getDB();
  const updatedAt = payload.updatedAt ?? new Date().toISOString();
  const clientMutationId = newClientMutationId("upload_user_avatar", uid, "profile_avatar");
  db.execSync("BEGIN");
  try {
    db.runSync(
      `DELETE FROM op_queue
       WHERE user_uid=? AND kind='upload_user_avatar'`,
      [uid],
    );
    db.runSync(
      `INSERT INTO op_queue (
         client_mutation_id, cloud_id, user_uid, kind, payload, updated_at
       ) VALUES (?, ?, ?, 'upload_user_avatar', ?, ?)`,
      [
        clientMutationId,
        "profile_avatar",
        uid,
        JSON.stringify({
          localPath: payload.localPath,
          updatedAt,
        }),
        updatedAt,
      ],
    );
    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}

export async function nextBatch(limit: number, uid: string): Promise<QueuedOp[]> {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT * FROM op_queue
     WHERE user_uid=? AND attempts < ?
     ORDER BY id ASC
     LIMIT ?`,
    [uid, MAX_QUEUE_ATTEMPTS, limit]
  );
  return (rows as QueueRow[]).map((r) => ({
    ...r,
    payload: safeParse(r.payload),
  }));
}

export async function markDone(id: number): Promise<void> {
  const db = getDB();
  db.runSync(`DELETE FROM op_queue WHERE id=?`, [id]);
}

export async function bumpAttempts(id: number): Promise<void> {
  const db = getDB();
  db.runSync(`UPDATE op_queue SET attempts=attempts+1 WHERE id=?`, [id]);
}

export async function moveToDeadLetter(
  op: QueuedOp,
  nextAttempts: number,
  error?: { code?: string; message?: string }
): Promise<void> {
  const db = getDB();
  db.execSync("BEGIN");
  try {
    db.runSync(
      `INSERT INTO op_queue_dead (
         op_id, client_mutation_id, cloud_id, user_uid, kind, payload,
         updated_at, attempts, failed_at, last_error_code, last_error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        op.id,
        op.client_mutation_id,
        op.cloud_id,
        op.user_uid,
        op.kind,
        JSON.stringify(op.payload),
        op.updated_at,
        nextAttempts,
        new Date().toISOString(),
        error?.code ?? null,
        error?.message ?? null,
      ]
    );
    db.runSync(`DELETE FROM op_queue WHERE id=?`, [op.id]);
    db.execSync("COMMIT");
  } catch (e) {
    db.execSync("ROLLBACK");
    throw e;
  }
}

function buildKindsClause(kinds?: QueueKind[]) {
  const normalized = Array.from(
    new Set((kinds || []).filter((kind): kind is QueueKind => !!kind)),
  );
  if (!normalized.length) {
    return { sql: "", args: [] as string[] };
  }
  return {
    sql: ` AND kind IN (${normalized.map(() => "?").join(",")})`,
    args: normalized,
  };
}

function retryConflictFamily(kind: QueueKind): QueueKind[] {
  if (kind === "upsert" || kind === "delete") {
    return ["upsert", "delete"];
  }
  if (kind === "upsert_mymeal" || kind === "delete_mymeal") {
    return ["upsert_mymeal", "delete_mymeal"];
  }
  return [kind];
}

function isRetryUpsertKind(kind: QueueKind): boolean {
  return kind === "upsert" || kind === "upsert_mymeal";
}

function isNewerOrSameIntent(
  pending: Pick<QueueRow, "updated_at">,
  dead: Pick<DeadLetterRow, "updated_at">,
): boolean {
  return String(pending.updated_at) >= String(dead.updated_at);
}

export async function getDeadLetterCount(
  uid: string,
  options?: { kinds?: QueueKind[] },
): Promise<number> {
  if (!uid) return 0;
  const db = getDB();
  const kindsClause = buildKindsClause(options?.kinds);
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(1) AS count
     FROM op_queue_dead
     WHERE user_uid=?${kindsClause.sql}`,
    [uid, ...kindsClause.args],
  );
  return Number(row?.count ?? 0);
}

export async function getQueuedOpsCount(
  uid: string,
  options?: { kinds?: QueueKind[] },
): Promise<number> {
  if (!uid) return 0;
  const db = getDB();
  const kindsClause = buildKindsClause(options?.kinds);
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(1) AS count
     FROM op_queue
     WHERE user_uid=?${kindsClause.sql}`,
    [uid, ...kindsClause.args],
  );
  return Number(row?.count ?? 0);
}

export async function getSyncCounts(
  uid: string,
  options?: { kinds?: QueueKind[] },
): Promise<{ dead: number; pending: number }> {
  if (!uid) return { dead: 0, pending: 0 };
  const db = getDB();
  const kindsClause = buildKindsClause(options?.kinds);
  const row = db.getFirstSync<{ dead: number; pending: number }>(
    `SELECT
       (SELECT COUNT(1) FROM op_queue_dead WHERE user_uid=?${kindsClause.sql}) AS dead,
       (SELECT COUNT(1) FROM op_queue WHERE user_uid=?${kindsClause.sql}) AS pending`,
    [uid, ...kindsClause.args, uid, ...kindsClause.args],
  );
  return {
    dead: Number(row?.dead ?? 0),
    pending: Number(row?.pending ?? 0),
  };
}

export async function getDeadLetterOps(params: {
  uid: string;
  kinds?: QueueKind[];
  limit?: number;
}): Promise<DeadLetterOp[]> {
  if (!params.uid) return [];
  const db = getDB();
  const kindsClause = buildKindsClause(params.kinds);
  const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
  const rows = db.getAllSync(
    `SELECT * FROM op_queue_dead
     WHERE user_uid=?${kindsClause.sql}
     ORDER BY failed_at DESC, id DESC
     LIMIT ?`,
    [params.uid, ...kindsClause.args, limit],
  ) as DeadLetterRow[];
  return rows.map((row) => ({
    ...row,
    payload: safeParse(row.payload),
  }));
}

export async function retryDeadLetterOps(params: {
  uid: string;
  kinds?: QueueKind[];
  limit?: number;
}): Promise<number> {
  if (!params.uid) return 0;
  const db = getDB();
  const kindsClause = buildKindsClause(params.kinds);
  const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
  const rows = db.getAllSync(
    `SELECT * FROM op_queue_dead
     WHERE user_uid=?${kindsClause.sql}
     ORDER BY failed_at ASC, id ASC
     LIMIT ?`,
    [params.uid, ...kindsClause.args, limit],
  ) as DeadLetterRow[];

  if (!rows.length) return 0;

  const mealCloudIds = new Set<string>();
  const myMealCloudIds = new Set<string>();
  const deadIds: number[] = [];
  const skippedRows: Array<{
    id: number;
    cloudId: string;
    kind: QueueKind;
    reason: "newer_pending_family_op";
  }> = [];
  let retriedCount = 0;

  db.execSync("BEGIN");
  try {
    for (const row of rows) {
      deadIds.push(row.id);
      const family = retryConflictFamily(row.kind);
      const familyPendingRows = db.getAllSync(
        `SELECT *
         FROM op_queue
         WHERE cloud_id=? AND user_uid=? AND kind IN (${family
           .map(() => "?")
           .join(",")})
         ORDER BY updated_at DESC, id DESC`,
        [row.cloud_id, row.user_uid, ...family],
      ) as QueueRow[];
      const hasNewerOrSamePendingFamilyOp =
        isRetryUpsertKind(row.kind) &&
        familyPendingRows.some((pending) => isNewerOrSameIntent(pending, row));

      if (hasNewerOrSamePendingFamilyOp) {
        skippedRows.push({
          id: row.id,
          cloudId: row.cloud_id,
          kind: row.kind,
          reason: "newer_pending_family_op",
        });
        continue;
      }

      db.runSync(
        `DELETE FROM op_queue
         WHERE cloud_id=? AND user_uid=? AND kind IN (${family
           .map(() => "?")
           .join(",")})`,
        [row.cloud_id, row.user_uid, ...family],
      );
      db.runSync(
        `INSERT INTO op_queue (
           client_mutation_id, cloud_id, user_uid, kind, payload, updated_at, attempts
         ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          row.client_mutation_id,
          row.cloud_id,
          row.user_uid,
          row.kind,
          row.payload,
          row.updated_at,
        ],
      );
      retriedCount++;

      if (row.cloud_id) {
        if (row.kind === "upsert" || row.kind === "delete") {
          mealCloudIds.add(row.cloud_id);
        }
        if (row.kind === "upsert_mymeal" || row.kind === "delete_mymeal") {
          myMealCloudIds.add(row.cloud_id);
        }
      }
    }

    if (deadIds.length) {
      db.runSync(
        `DELETE FROM op_queue_dead WHERE id IN (${deadIds.map(() => "?").join(",")})`,
        deadIds,
      );
    }

    const mealIds = Array.from(mealCloudIds);
    if (mealIds.length) {
      db.runSync(
        `UPDATE meals
         SET sync_state='pending'
         WHERE user_uid=? AND cloud_id IN (${mealIds.map(() => "?").join(",")})`,
        [params.uid, ...mealIds],
      );
    }

    const myMealIds = Array.from(myMealCloudIds);
    if (myMealIds.length) {
      db.runSync(
        `UPDATE my_meals
         SET sync_state='pending'
         WHERE user_uid=? AND cloud_id IN (${myMealIds.map(() => "?").join(",")})`,
        [params.uid, ...myMealIds],
      );
    }

    db.execSync("COMMIT");
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }

  const now = new Date().toISOString();
  for (const cloudId of mealCloudIds) {
    emit("meal:local:upserted", { uid: params.uid, cloudId, ts: now });
  }
  for (const cloudId of myMealCloudIds) {
    emit("mymeal:local:upserted", { cloudId, ts: now });
  }
  emit("sync:op:retried", {
    uid: params.uid,
    count: retriedCount,
  });
  if (skippedRows.length) {
    emit("sync:op:retry_skipped", {
      uid: params.uid,
      count: skippedRows.length,
      reason: "newer_pending_family_op",
      ops: skippedRows.map((row) => ({
        id: row.id,
        cloudId: row.cloudId,
        kind: row.kind,
      })),
    });
  }

  return retriedCount;
}
