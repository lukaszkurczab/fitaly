import type { Meal, MealImageRef } from "@/types/meal";
import type { MealDocument } from "@/types/mealDocument";
import { get, post, upload } from "@/services/core/apiClient";
import { on } from "@/services/core/events";
import {
  getAllMyMealsLocal,
  getMyMealsPageLocal,
} from "@/services/offline/myMeals.repo";

export type MyMealDoc = Meal & {
  uploadState?: "pending" | "done";
  localPhotoUri?: string | null;
};

export type MyMealsCursor = string | null;

export type MyMealsPage = {
  items: Meal[];
  lastDoc: MyMealsCursor;
  hasMore: boolean;
};

type MyMealsRemoteResponse = {
  items?: unknown[];
  nextCursor?: string | null;
};

type UploadPhotoResponse = {
  templateId?: string;
  imageId?: string;
  storagePath?: string;
  photoUrl?: string;
};

type MealTemplatePayload = {
  templateId: string;
  ownerUserId?: string;
  templateVersion: number;
  displayName: string | null;
  description: string | null;
  mealTypeHint: Meal["type"];
  draftItems: Meal["ingredients"];
  draftTotals: Meal["totals"];
  nutritionSnapshot: Meal["totals"];
  imageRef: MealImageRef | null;
  createdAt?: string;
  updatedAt?: string;
  deleted: boolean;
};

const LOGGED_MEAL_ONLY_TEMPLATE_RESPONSE_FIELDS = [
  "id",
  "mealId",
  "cloudId",
  "loggedAt",
  "timestamp",
  "dayKey",
  "loggedAtLocalMin",
  "tzOffsetMin",
  "type",
  "name",
  "ingredients",
  "syncState",
  "source",
  "inputMethod",
  "aiMeta",
  "notes",
  "tags",
  "totals",
  "userUid",
  "imageId",
  "photoUrl",
  "savedMealRefId",
] as const;

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isMealType(value: unknown): value is Meal["type"] {
  return (
    value === "breakfast" ||
    value === "lunch" ||
    value === "dinner" ||
    value === "snack" ||
    value === "other"
  );
}

function hasOwnField(record: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function hasLoggedMealOnlyTemplateResponseField(
  record: Record<string, unknown>,
): boolean {
  return LOGGED_MEAL_ONLY_TEMPLATE_RESPONSE_FIELDS.some((field) =>
    hasOwnField(record, field),
  );
}

function parseImageRef(raw: unknown): MealImageRef | null {
  const imageRef = asMap(raw);
  if (!imageRef) return null;
  const imageId = String(imageRef.imageId || "").trim();
  const storagePath = String(imageRef.storagePath || "").trim();
  if (!imageId) return null;
  const downloadUrl =
    typeof imageRef.downloadUrl === "string" && imageRef.downloadUrl.trim().length > 0
      ? imageRef.downloadUrl.trim()
      : null;
  return {
    imageId,
    ...(storagePath ? { storagePath } : {}),
    downloadUrl,
  };
}

function isUserScopedSavedMealStoragePath(
  storagePath: string | null | undefined,
  uid: string,
): storagePath is string {
  return Boolean(storagePath && uid && storagePath.startsWith(`mealTemplates/${uid}/`));
}

function normalizeMeal(raw: unknown, uid: string): Meal | null {
  const doc = asMap(raw);
  if (!doc) {
    return null;
  }
  if (hasLoggedMealOnlyTemplateResponseField(doc)) {
    return null;
  }

  const id = asNonEmptyString(doc.templateId);
  const ownerUserId = asNonEmptyString(doc.ownerUserId);
  const templateVersion =
    typeof doc.templateVersion === "number" && doc.templateVersion >= 1
      ? doc.templateVersion
      : null;
  const createdAt = asNonEmptyString(doc.createdAt);
  const updatedAt = asNonEmptyString(doc.updatedAt);
  const mealType = isMealType(doc.mealTypeHint) ? doc.mealTypeHint : null;
  const draftItems = Array.isArray(doc.draftItems)
    ? (doc.draftItems as Meal["ingredients"])
    : null;
  const draftTotals = asMap(doc.draftTotals) || asMap(doc.nutritionSnapshot);
  const nutritionSnapshot = asMap(doc.nutritionSnapshot);
  const displayName =
    doc.displayName === null || typeof doc.displayName === "string"
      ? doc.displayName
      : undefined;
  const description =
    doc.description === null || typeof doc.description === "string"
      ? doc.description
      : undefined;
  const hasImageRefField = hasOwnField(doc, "imageRef");
  const deleted = typeof doc.deleted === "boolean" ? doc.deleted : null;
  if (
    !id ||
    !ownerUserId ||
    !templateVersion ||
    !createdAt ||
    !updatedAt ||
    !mealType ||
    !draftItems ||
    !draftTotals ||
    !nutritionSnapshot ||
    displayName === undefined ||
    description === undefined ||
    !hasImageRefField ||
    deleted === null
  ) {
    return null;
  }

  const imageRef = parseImageRef(doc.imageRef);
  if (doc.imageRef !== null && imageRef === null) {
    return null;
  }
  const sanitizedImageRef =
    imageRef && isUserScopedSavedMealStoragePath(imageRef.storagePath, uid)
      ? imageRef
      : imageRef
        ? {
            imageId: imageRef.imageId,
            downloadUrl: imageRef.downloadUrl,
          }
        : null;

  return {
    userUid: uid,
    mealId: id,
    cloudId: id,
    timestamp: createdAt,
    type: mealType,
    name: displayName,
    ingredients: draftItems,
    createdAt,
    updatedAt,
    syncState: "synced",
    source: "saved",
    inputMethod: null,
    aiMeta: null,
    imageRef: sanitizedImageRef,
    imageId: sanitizedImageRef?.imageId ?? null,
    photoUrl: sanitizedImageRef?.downloadUrl ?? null,
    notes: description,
    tags: [],
    deleted,
    totals: {
      kcal: toFiniteNumber(draftTotals?.kcal),
      protein: toFiniteNumber(draftTotals?.protein),
      carbs: toFiniteNumber(draftTotals?.carbs),
      fat: toFiniteNumber(draftTotals?.fat),
    },
  };
}

function toRemotePage(
  payload: unknown,
  uid: string,
): { items: Meal[]; nextCursor: string | null } {
  const page = (payload || {}) as MyMealsRemoteResponse;
  const items = Array.isArray(page.items)
    ? page.items
        .map((item) => normalizeMeal(item, uid))
        .filter((item): item is Meal => item !== null)
    : [];
  return {
    items,
    nextCursor:
      typeof page.nextCursor === "string" && page.nextCursor.trim().length > 0
        ? page.nextCursor
        : null,
  };
}

export function buildMyMealUpdatedCursor(
  meal: Pick<Meal, "updatedAt" | "cloudId">,
): string {
  return `${meal.updatedAt}|${meal.cloudId || meal.updatedAt}`;
}

export function subscribeToMyMealsOrderedByName(params: {
  uid: string;
  onData: (items: Meal[]) => void;
  onError?: (error: unknown) => void;
}): () => void {
  let active = true;

  const publish = async () => {
    if (!active) return;
    try {
      const items = await getAllMyMealsLocal(params.uid);
      if (active) {
        params.onData(items);
      }
    } catch (error) {
      params.onError?.(error);
    }
  };

  void publish();

  const unsubs = [
    on("mymeal:local:upserted", () => void publish()),
    on("mymeal:local:deleted", () => void publish()),
    on("mymeal:synced", () => void publish()),
  ];

  return () => {
    active = false;
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}

export function subscribeToMyMealsFirstPage(params: {
  uid: string;
  pageSize: number;
  onData: (page: MyMealsPage) => void;
  onError?: (error: unknown) => void;
}): () => void {
  let active = true;

  const publish = async () => {
    if (!active) return;
    try {
      const page = await getMyMealsPageLocal({
        uid: params.uid,
        limit: params.pageSize,
        cursor: null,
      });
      if (active) {
        params.onData({
          items: page.items,
          lastDoc: page.nextCursor,
          hasMore: page.hasMore,
        });
      }
    } catch (error) {
      params.onError?.(error);
    }
  };

  void publish();

  const unsubs = [
    on("mymeal:local:upserted", () => void publish()),
    on("mymeal:local:deleted", () => void publish()),
    on("mymeal:synced", () => void publish()),
  ];

  return () => {
    active = false;
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}

export async function fetchMyMealsPage(params: {
  uid: string;
  pageSize: number;
  lastDoc: string;
}): Promise<MyMealsPage> {
  const page = await getMyMealsPageLocal({
    uid: params.uid,
    limit: params.pageSize,
    cursor: params.lastDoc,
  });
  return {
    items: page.items,
    lastDoc: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function fetchMyMealChangesRemote(params: {
  uid: string;
  pageSize: number;
  cursor: string | null;
}): Promise<{ items: Meal[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  query.set("limit", String(params.pageSize));
  if (params.cursor) {
    query.set("afterCursor", params.cursor);
  }

  const response = await get<MyMealsRemoteResponse>(
    `/users/me/meal-templates/changes?${query.toString()}`,
  );
  return toRemotePage(response, params.uid);
}

function toMealTemplatePayload(
  mealId: string,
  payload: MyMealDoc | Partial<MyMealDoc> | Partial<MealDocument>,
  ownerUid: string,
): MealTemplatePayload {
  const incomingImageRef = parseImageRef((payload as Partial<MealDocument>).imageRef);
  const id = String(payload.cloudId || payload.mealId || mealId || "").trim();
  const imageId =
    typeof payload.imageId === "string" && payload.imageId.trim().length > 0
      ? payload.imageId.trim()
      : incomingImageRef?.imageId ?? null;
  const uid = String(ownerUid || payload.userUid || "").trim();
  const downloadUrl =
    typeof payload.photoUrl === "string" && /^https?:\/\//i.test(payload.photoUrl)
      ? payload.photoUrl
      : incomingImageRef?.downloadUrl || null;
  const storagePath =
    incomingImageRef && isUserScopedSavedMealStoragePath(incomingImageRef.storagePath, uid)
      ? incomingImageRef.storagePath
      : null;

  const mealType =
    payload.type === "breakfast" ||
    payload.type === "lunch" ||
    payload.type === "dinner" ||
    payload.type === "snack" ||
    payload.type === "other"
      ? payload.type
      : "other";
  const totals = {
    kcal: toFiniteNumber(payload.totals?.kcal),
    protein: toFiniteNumber(payload.totals?.protein),
    carbs: toFiniteNumber(payload.totals?.carbs),
    fat: toFiniteNumber(payload.totals?.fat),
  };

  return {
    templateId: id,
    ...(uid ? { ownerUserId: uid } : {}),
    templateVersion: 1,
    displayName: typeof payload.name === "string" ? payload.name : null,
    description: typeof payload.notes === "string" ? payload.notes : null,
    mealTypeHint: mealType,
    draftItems: Array.isArray(payload.ingredients) ? payload.ingredients : [],
    draftTotals: totals,
    nutritionSnapshot: totals,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    imageRef: imageId
      ? {
          imageId,
          ...(storagePath ? { storagePath } : {}),
          downloadUrl,
        }
      : null,
    deleted: Boolean(payload.deleted),
  };
}

export async function updateMyMealRemote(
  uid: string,
  mealId: string,
  payload: MyMealDoc | Partial<MyMealDoc> | Partial<MealDocument>,
  clientMutationId: string,
): Promise<void> {
  await post("/users/me/meal-templates", {
    ...toMealTemplatePayload(mealId, payload, uid),
    clientMutationId,
  });
}

export async function uploadMyMealPhotoRemote(
  uid: string,
  mealId: string,
  photoUri: string,
): Promise<{ imageId: string; photoUrl: string; storagePath?: string }> {
  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    name: `${mealId}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await upload<UploadPhotoResponse>(
    `/users/me/meal-templates/${encodeURIComponent(mealId)}/photo`,
    formData,
  );
  const responseStoragePath =
    typeof response.storagePath === "string" ? response.storagePath.trim() : null;
  return {
    imageId: String(response.imageId || ""),
    photoUrl: String(response.photoUrl || ""),
    ...(isUserScopedSavedMealStoragePath(responseStoragePath, uid)
      ? { storagePath: responseStoragePath }
      : {}),
  };
}

export async function markMyMealDeletedRemote(
  uid: string,
  mealId: string,
  updatedAt: string,
  options: { clientMutationId: string; syncState?: "synced" },
): Promise<void> {
  void uid;
  void options.syncState;
  await post(`/users/me/meal-templates/${encodeURIComponent(mealId)}/delete`, {
    updatedAt,
    clientMutationId: options.clientMutationId,
  });
}
