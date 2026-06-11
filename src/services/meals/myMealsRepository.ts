import type { Meal } from "@/types/meal";
import type { MealDocument, MealImageRef } from "@/types/mealDocument";
import { get, post, upload } from "@/services/core/apiClient";
import { on } from "@/services/core/events";
import {
  getAllMyMealsLocal,
  getMyMealsPageLocal,
} from "@/services/offline/myMeals.repo";
import {
  normalizeMealAiMeta,
  normalizeMealInputMethod,
} from "@/services/meals/mealMetadata";

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
  mealId?: string;
  imageId?: string;
  storagePath?: string;
  photoUrl?: string;
};

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
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
  return Boolean(storagePath && uid && storagePath.startsWith(`myMeals/${uid}/`));
}

function normalizeMeal(raw: unknown, uid: string): Meal | null {
  const doc = raw as Partial<MealDocument> & Partial<Meal>;
  const id = String(doc.id || doc.cloudId || doc.mealId || "").trim();
  const loggedAt = String(doc.loggedAt || doc.timestamp || "").trim();
  const updatedAt = String(doc.updatedAt || "").trim();
  if (!id || !loggedAt || !updatedAt) {
    return null;
  }

  const imageRef =
    parseImageRef(doc.imageRef) ||
    (typeof doc.imageId === "string" && doc.imageId.trim().length > 0
      ? {
          imageId: doc.imageId.trim(),
          downloadUrl:
            typeof doc.photoUrl === "string" && doc.photoUrl.trim().length > 0
              ? doc.photoUrl.trim()
              : null,
        }
      : null);

  return {
    userUid: uid,
    mealId: id,
    cloudId: id,
    timestamp: loggedAt,
    type:
      doc.type === "breakfast" ||
      doc.type === "lunch" ||
      doc.type === "dinner" ||
      doc.type === "snack" ||
      doc.type === "other"
        ? doc.type
        : "other",
    name: typeof doc.name === "string" ? doc.name : null,
    ingredients: Array.isArray(doc.ingredients) ? doc.ingredients : [],
    createdAt: String(doc.createdAt || loggedAt),
    updatedAt,
    syncState: "synced",
    source: "saved",
    inputMethod: normalizeMealInputMethod(doc.inputMethod),
    aiMeta: normalizeMealAiMeta(doc.aiMeta),
    imageId: imageRef?.imageId ?? null,
    photoUrl: imageRef?.downloadUrl ?? null,
    notes: typeof doc.notes === "string" ? doc.notes : null,
    tags: Array.isArray(doc.tags)
      ? doc.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    deleted: Boolean(doc.deleted),
    totals: {
      kcal: toFiniteNumber(doc.totals?.kcal),
      protein: toFiniteNumber(doc.totals?.protein),
      carbs: toFiniteNumber(doc.totals?.carbs),
      fat: toFiniteNumber(doc.totals?.fat),
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
    `/users/me/my-meals/changes?${query.toString()}`,
  );
  return toRemotePage(response, params.uid);
}

function toMealDocumentPayload(
  mealId: string,
  payload: MyMealDoc | Partial<MyMealDoc> | Partial<MealDocument>,
  ownerUid: string,
): Partial<MealDocument> {
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

  return {
    id,
    loggedAt:
      typeof payload.timestamp === "string" && payload.timestamp.trim().length > 0
        ? payload.timestamp
        : undefined,
    dayKey: payload.dayKey,
    loggedAtLocalMin: payload.loggedAtLocalMin,
    tzOffsetMin: payload.tzOffsetMin,
    type: payload.type,
    name: payload.name,
    ingredients: payload.ingredients,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    source: "saved",
    inputMethod: normalizeMealInputMethod(payload.inputMethod),
    aiMeta: normalizeMealAiMeta(payload.aiMeta),
    imageRef: imageId
      ? {
          imageId,
          ...(storagePath ? { storagePath } : {}),
          downloadUrl,
        }
      : null,
    notes: payload.notes,
    tags: payload.tags,
    deleted: payload.deleted,
    totals: payload.totals,
  };
}

export async function updateMyMealRemote(
  uid: string,
  mealId: string,
  payload: MyMealDoc | Partial<MyMealDoc> | Partial<MealDocument>,
  clientMutationId: string,
): Promise<void> {
  await post("/users/me/my-meals", {
    ...toMealDocumentPayload(mealId, payload, uid),
    clientMutationId,
  });
}

export async function uploadMyMealPhotoRemote(
  uid: string,
  mealId: string,
  photoUri: string,
): Promise<{ imageId: string; photoUrl: string; storagePath?: string }> {
  void uid;
  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    name: `${mealId}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await upload<UploadPhotoResponse>(
    `/users/me/my-meals/${encodeURIComponent(mealId)}/photo`,
    formData,
  );
  return {
    imageId: String(response.imageId || ""),
    photoUrl: String(response.photoUrl || ""),
    ...(typeof response.storagePath === "string" && response.storagePath.trim()
      ? { storagePath: response.storagePath.trim() }
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
  await post(`/users/me/my-meals/${encodeURIComponent(mealId)}/delete`, {
    updatedAt,
    clientMutationId: options.clientMutationId,
  });
}
