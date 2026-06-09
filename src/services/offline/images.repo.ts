import { getDB } from "./db";
import type { ImageRow, ImageStatus, MealRow } from "./types";
import * as FileSystem from "@/services/core/fileSystem";

export type ConfirmedLoggedMealPhotoCleanupResult =
  | {
      cleaned: true;
      cloudId: string;
      localPath: string;
    }
  | {
      cleaned: false;
      cloudId: string;
      localPath?: string;
      reason:
        | "confirmed-image-id-missing"
        | "meal-missing"
        | "local-path-missing"
        | "confirmed-image-mismatch"
        | "confirmed-photo-url-mismatch"
        | "image-row-not-uploaded"
        | "content-uri-retained"
        | "unsupported-local-uri"
        | "db-clear-failed"
        | "delete-failed";
      message?: string;
      restoreMessage?: string;
    };

function normalizedString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rollbackQuietly(db: ReturnType<typeof getDB>): void {
  try {
    db.execSync("ROLLBACK");
  } catch {
    // Keep the original cleanup failure reason observable.
  }
}

function restoreConfirmedLoggedMealPhotoReferences(params: {
  uid: string;
  cloudId: string;
  confirmedImageId: string;
  localPath: string;
  image: ImageRow;
}): void {
  const db = getDB();
  db.execSync("BEGIN");
  try {
    db.runSync(
      `UPDATE meals
       SET image_local=?
       WHERE user_uid=? AND cloud_id=? AND image_id=? AND image_local IS NULL`,
      [params.localPath, params.uid, params.cloudId, params.confirmedImageId]
    );
    db.runSync(
      `INSERT INTO images (image_id, user_uid, local_path, status, cloud_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(image_id) DO UPDATE SET
         user_uid=excluded.user_uid,
         local_path=excluded.local_path,
         status=excluded.status,
         cloud_url=excluded.cloud_url,
         updated_at=excluded.updated_at`,
      [
        params.image.image_id,
        params.image.user_uid,
        params.image.local_path,
        params.image.status,
        params.image.cloud_url,
        params.image.updated_at,
      ]
    );
    db.execSync("COMMIT");
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

export async function insertOrUpdateImage(
  userUid: string,
  imageId: string,
  localPath: string,
  status: ImageStatus,
  cloudUrl?: string,
  updatedAt?: string
): Promise<void> {
  const db = getDB();
  db.runSync(
    `INSERT INTO images (image_id, user_uid, local_path, status, cloud_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(image_id) DO UPDATE SET
       user_uid=excluded.user_uid,
       local_path=excluded.local_path,
       status=excluded.status,
       cloud_url=excluded.cloud_url,
       updated_at=excluded.updated_at`,
    [
      imageId,
      userUid,
      localPath,
      status,
      cloudUrl ?? null,
      updatedAt ?? new Date().toISOString(),
    ]
  );
}

export async function getPendingUploads(uid: string): Promise<ImageRow[]> {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT * FROM images WHERE user_uid=? AND status='pending'`,
    [uid]
  );
  return rows as ImageRow[];
}

export async function markUploaded(
  imageId: string,
  cloudUrl: string
): Promise<void> {
  const db = getDB();
  db.runSync(
    `UPDATE images SET status='uploaded', cloud_url=?, updated_at=? WHERE image_id=?`,
    [cloudUrl, new Date().toISOString(), imageId]
  );
}

export async function cleanupConfirmedLoggedMealPhoto(params: {
  uid: string;
  cloudId: string;
  confirmedImageId: string;
  confirmedPhotoUrl?: string | null;
}): Promise<ConfirmedLoggedMealPhotoCleanupResult> {
  const confirmedImageId = normalizedString(params.confirmedImageId);
  const confirmedPhotoUrl = normalizedString(params.confirmedPhotoUrl);

  if (!confirmedImageId) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      reason: "confirmed-image-id-missing",
    };
  }

  const db = getDB();
  const meal = db.getFirstSync(
    `SELECT cloud_id, image_local, image_id, photo_url
     FROM meals
     WHERE user_uid=? AND cloud_id=? AND deleted=0
     LIMIT 1`,
    [params.uid, params.cloudId]
  ) as Pick<
    MealRow,
    "cloud_id" | "image_local" | "image_id" | "photo_url"
  > | null;

  if (!meal) {
    return { cleaned: false, cloudId: params.cloudId, reason: "meal-missing" };
  }

  const localPath = meal.image_local?.trim();
  if (!localPath) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      reason: "local-path-missing",
    };
  }

  if (normalizedString(meal.image_id) !== confirmedImageId) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "confirmed-image-mismatch",
    };
  }

  if (
    confirmedPhotoUrl &&
    normalizedString(meal.photo_url) !== confirmedPhotoUrl
  ) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "confirmed-photo-url-mismatch",
    };
  }

  const image = db.getFirstSync(
    `SELECT *
     FROM images
     WHERE user_uid=? AND local_path=?
     LIMIT 1`,
    [params.uid, localPath]
  ) as ImageRow | null;

  if (image?.status !== "uploaded") {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "image-row-not-uploaded",
    };
  }

  if (
    confirmedPhotoUrl &&
    normalizedString(image.cloud_url) !== confirmedPhotoUrl
  ) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "confirmed-photo-url-mismatch",
    };
  }

  if (localPath.startsWith("content://")) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "content-uri-retained",
    };
  }

  if (!localPath.startsWith("file://")) {
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "unsupported-local-uri",
    };
  }

  db.execSync("BEGIN");
  try {
    db.runSync(
      `UPDATE meals
       SET image_local=NULL
       WHERE user_uid=? AND cloud_id=? AND image_local=? AND image_id=?`,
      [params.uid, params.cloudId, localPath, confirmedImageId]
    );
    db.runSync(
      `DELETE FROM images
       WHERE user_uid=? AND local_path=? AND image_id=? AND status='uploaded'`,
      [params.uid, localPath, image.image_id]
    );
    db.execSync("COMMIT");
  } catch (error) {
    rollbackQuietly(db);
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "db-clear-failed",
      message: errorMessage(error),
    };
  }

  try {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch (error) {
    let restoreMessage: string | undefined;
    try {
      restoreConfirmedLoggedMealPhotoReferences({
        uid: params.uid,
        cloudId: params.cloudId,
        confirmedImageId,
        localPath,
        image,
      });
    } catch (restoreError) {
      restoreMessage = errorMessage(restoreError);
    }
    return {
      cleaned: false,
      cloudId: params.cloudId,
      localPath,
      reason: "delete-failed",
      message: errorMessage(error),
      ...(restoreMessage ? { restoreMessage } : {}),
    };
  }

  return { cleaned: true, cloudId: params.cloudId, localPath };
}
