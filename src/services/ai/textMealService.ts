import type { Ingredient } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  type AiTextMealAnalyzeResponse,
  type AiTextMealPayload,
} from "@/services/ai/contracts";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { post } from "@/services/core/apiClient";
import { handleAiError } from "@/services/ai/handleAiError";
import { logWarning } from "@/services/core/errorLogger";
import { resolveE2ETextMealAnalysis } from "@/services/e2e/fixtures";

const _inFlight = new Set<string>();

export type TextMealAnalyzeResult = {
  ingredients: Ingredient[];
  credits: AiTextMealAnalyzeResponse;
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasNonZeroNutrition(ingredient: Ingredient): boolean {
  return (
    Number(ingredient.kcal) > 0 ||
    Number(ingredient.protein) > 0 ||
    Number(ingredient.fat) > 0 ||
    Number(ingredient.carbs) > 0
  );
}

export async function extractIngredientsFromText(
  uid: string,
  payload: AiTextMealPayload,
  opts?: { lang?: string },
): Promise<TextMealAnalyzeResult | null> {
  if (!uid) return null;

  const e2eFixture = await resolveE2ETextMealAnalysis(uid);
  if (e2eFixture) {
    return e2eFixture;
  }

  // Prevent duplicate concurrent calls for the same user
  if (_inFlight.has(uid)) {
    return null;
  }

  const lang = opts?.lang || "en";
  _inFlight.add(uid);

  try {
    const response = await post<AiTextMealAnalyzeResponse>("/ai/text-meal/analyze", {
      payload,
      lang,
    }, {
      retryMode: "idempotent",
    });

    const mappedIngredients = response.ingredients.map(
      (ingredient): Ingredient => ({
        id: uuidv4(),
        name: ingredient.name ?? "",
        amount: safeNumber(ingredient.amount),
        unit: ingredient.unit ?? "g",
        protein: safeNumber(ingredient.protein),
        fat: safeNumber(ingredient.fat),
        carbs: safeNumber(ingredient.carbs),
        kcal: safeNumber(ingredient.kcal),
      }),
    );

    if (!mappedIngredients.some(hasNonZeroNutrition)) {
      logWarning(
        "[textMealService] backend returned ingredients without nutrition values",
        { userUid: uid, lang },
      );
      return null;
    }

    return {
      ingredients: mappedIngredients,
      credits: response,
    };
  } catch (error) {
    if (getErrorStatus(error) === 402) {
      throw error;
    }

    return handleAiError(
      error,
      "textMealService",
      { userUid: uid, lang },
      { action: "return-null" },
    );
  } finally {
    _inFlight.delete(uid);
  }
}
