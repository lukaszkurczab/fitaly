import { get } from "@/services/core/apiClient";
import { getErrorStatus } from "@/services/contracts/serviceError";
import { debugScope } from "@/utils/debug";
import { resolveE2EBarcodeLookup } from "@/services/e2e/fixtures";
import type { Ingredient } from "@/types";
import { asNumber, asString, isRecord } from "@/services/contracts/guards";

const log = debugScope("BarcodeService");
const BARCODE_LOOKUP_ENDPOINT = "/users/me/barcode/lookup";

export type BarcodeLookupResult =
  | { kind: "found"; name: string; ingredient: Ingredient }
  | { kind: "not_found" }
  | { kind: "error" };

type BarcodeLookupBackendFoundResponse = {
  kind: "found";
  name: string;
  ingredient: Ingredient;
};

function parseBarcodeLookupIngredient(
  payload: unknown,
): Ingredient | null {
  if (!isRecord(payload)) return null;

  const id = asString(payload.id);
  const name = asString(payload.name);
  const amount = asNumber(payload.amount);
  const kcal = asNumber(payload.kcal);
  const protein = asNumber(payload.protein);
  const fat = asNumber(payload.fat);
  const carbs = asNumber(payload.carbs);
  const unit = payload.unit;

  if (!id || !name || amount === undefined || kcal === undefined) {
    return null;
  }
  if (protein === undefined || fat === undefined || carbs === undefined) {
    return null;
  }
  if (unit !== undefined && unit !== null && unit !== "g" && unit !== "ml") {
    return null;
  }

  return {
    id,
    name,
    amount,
    unit: unit ?? undefined,
    kcal,
    protein,
    fat,
    carbs,
  };
}

function parseBarcodeLookupResponse(
  payload: unknown,
): BarcodeLookupBackendFoundResponse | null {
  if (!isRecord(payload) || payload.kind !== "found") return null;
  const name = asString(payload.name);
  const ingredient = parseBarcodeLookupIngredient(payload.ingredient);
  if (!name || !ingredient) return null;
  return { kind: "found", name, ingredient };
}

export async function lookupBarcodeProduct(
  barcode: string,
): Promise<BarcodeLookupResult> {
  const e2eFixture = resolveE2EBarcodeLookup();
  if (e2eFixture) {
    return e2eFixture;
  }

  try {
    const payload = await get<unknown>(
      `${BARCODE_LOOKUP_ENDPOINT}?barcode=${encodeURIComponent(barcode)}`,
    );
    const decoded = parseBarcodeLookupResponse(payload);
    if (!decoded) {
      log.warn("Barcode lookup response did not match expected schema", {
        barcode,
      });
      return { kind: "error" };
    }

    return decoded;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status === 404) {
      return { kind: "not_found" };
    }

    log.error("Barcode lookup failed", { barcode, error, status });
    return { kind: "error" };
  }
}

export async function fetchProductByBarcode(
  barcode: string,
): Promise<{ name: string; ingredient: Ingredient } | null> {
  const result = await lookupBarcodeProduct(barcode);
  return result.kind === "found"
    ? { name: result.name, ingredient: result.ingredient }
    : null;
}

export function extractBarcodeFromPayload(payload: string): string | null {
  try {
    const s = String(payload || "").trim();
    if (!s) return null;
    const onlyDigits = s.replace(/\D+/g, "");

    if (/^\d{8}$/.test(s) || /^\d{12}$/.test(s) || /^\d{13}$/.test(s)) return s;
    if (
      /^\d{8}$/.test(onlyDigits) ||
      /^\d{12}$/.test(onlyDigits) ||
      /^\d{13}$/.test(onlyDigits)
    ) {
      return onlyDigits;
    }

    const ai01 = s.match(/(?:\(01\)|01)(\d{14})/);
    if (ai01) {
      const gtin14 = ai01[1];
      if (gtin14.length === 14) {
        const ean13 = gtin14.startsWith("0")
          ? gtin14.slice(1)
          : gtin14.slice(1);
        if (/^\d{13}$/.test(ean13)) return ean13;
      }
    }

    const off = s.match(
      /openfoodfacts\.org\/(?:product|products)\/(\d{8,14})/i
    );
    if (off) {
      const raw = off[1];
      if (raw.length === 13 || raw.length === 12 || raw.length === 8)
        return raw;
      if (raw.length === 14 && raw.startsWith("0")) return raw.slice(1);
    }

    const url = s.match(/(?:ean|gtin)=([0-9]{8,14})/i);
    if (url) {
      const raw = url[1];
      if (raw.length === 13 || raw.length === 12 || raw.length === 8)
        return raw;
      if (raw.length === 14 && raw.startsWith("0")) return raw.slice(1);
    }

    const d13 = s.match(/\d{13}/);
    if (d13) return d13[0];
    const d12 = s.match(/\d{12}/);
    if (d12) return d12[0];
    const d8 = s.match(/\d{8}/);
    if (d8) return d8[0];
    return null;
  } catch (error: unknown) {
    log.warn("Failed to parse barcode payload", { error });
    return null;
  }
}
