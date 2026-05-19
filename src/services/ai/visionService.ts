import NetInfo from "@react-native-community/netinfo";
import { uriToBase64 } from "@/utils/uriToBase64";
import { convertToJpegAndResize } from "@/utils/convertToJpegAndResize";
import type { Ingredient } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { debugScope } from "@/utils/debug";
import {
  createServiceError,
  getErrorStatus,
  isServiceError,
} from "@/services/contracts/serviceError";
import { post } from "@/services/core/apiClient";
import { handleAiError } from "@/services/ai/handleAiError";
import type { AiPhotoAnalyzeResponse } from "@/services/ai/contracts";
import { isOfflineNetState } from "@/services/core/networkState";
import { resolveE2EPhotoAnalysis } from "@/services/e2e/fixtures";

const log = debugScope("Vision");
const AI_UNAVAILABLE_CODE = "ai/unavailable";
const _inFlight = new Set<string>();
const MAX_JPEG_BYTES = 2_500_000; // 2.5 MB -> base64 ~3.3 MB, safely under 4 MB limit

type VisionOpts = {
  lang?: string;
};

export type VisionAnalyzeResult = {
  ingredients: Ingredient[] | null;
  credits: AiPhotoAnalyzeResponse;
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBackendVisionPayload(
  payload: AiPhotoAnalyzeResponse,
): Ingredient[] | null {
  if (!Array.isArray(payload.ingredients) || payload.ingredients.length === 0) {
    return null;
  }

  return payload.ingredients.map((ingredient) => ({
    id: uuidv4(),
    name: ingredient.name ?? "",
    amount: safeNumber(ingredient.amount),
    unit: ingredient.unit ?? "g",
    protein: safeNumber(ingredient.protein),
    fat: safeNumber(ingredient.fat),
    carbs: safeNumber(ingredient.carbs),
    kcal: safeNumber(ingredient.kcal),
  }));
}

async function detectIngredientsWithBackend(
  userUid: string,
  imageBase64: string,
  userLang: string,
): Promise<VisionAnalyzeResult | null> {
  if (!userUid) return null;

  const response = await post<AiPhotoAnalyzeResponse>("/ai/photo/analyze", {
    imageBase64,
    lang: userLang,
  }, {
    retryMode: "idempotent",
  });

  return {
    ingredients: normalizeBackendVisionPayload(response),
    credits: response,
  };
}

export async function detectIngredientsWithVision(
  userUid: string,
  imageUri: string,
  opts?: VisionOpts,
): Promise<VisionAnalyzeResult | null> {
  const userLang = (opts?.lang || "pl").toLowerCase();
  const e2eFixture = await resolveE2EPhotoAnalysis(userUid);
  if (e2eFixture) {
    return e2eFixture;
  }

  // Prevent duplicate concurrent calls for the same user
  if (_inFlight.has(userUid)) {
    log.warn("blocked Vision call: already in flight for user");
    return null;
  }

  const net = await NetInfo.fetch();
  if (isOfflineNetState(net)) {
    log.warn("blocked Vision call: offline");
    throw createServiceError({
      code: "offline",
      source: "VisionService",
      retryable: true,
    });
  }

  _inFlight.add(userUid);
  try {
    const jpegUri = await convertToJpegAndResize(
      imageUri,
      512,
      512,
      {
        userUid,
        fileId: `vision-${Date.now()}`,
        dir: "tmp",
      },
      undefined,
      MAX_JPEG_BYTES,
    );
    const imageBase64 = await uriToBase64(jpegUri);

    return await detectIngredientsWithBackend(userUid, imageBase64, userLang);
  } catch (error) {
    if (getErrorStatus(error) === 402) {
      throw error;
    }

    if (
      isServiceError(error) &&
      (
        error.code === "offline" ||
        error.code === AI_UNAVAILABLE_CODE
      )
    ) {
      throw error;
    }

    return handleAiError(
      error,
      "VisionService",
      { userUid, lang: userLang },
      { action: "wrap-unavailable" },
    );
  } finally {
    _inFlight.delete(userUid);
  }
}
