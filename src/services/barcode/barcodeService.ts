import type { Ingredient } from "@/types";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";
import { parseOffProductResponse } from "@/services/barcode/off.dto";
import { debugScope } from "@/utils/debug";
import { resolveE2EBarcodeLookup } from "@/services/e2e/fixtures";

const log = debugScope("BarcodeService");

export type BarcodeLookupResult =
  | { kind: "found"; name: string; ingredient: Ingredient }
  | { kind: "not_found" }
  | { kind: "error" };

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(String(v).replace(/[^0-9.+-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  return 0;
};

export async function lookupBarcodeProduct(
  barcode: string,
): Promise<BarcodeLookupResult> {
  const e2eFixture = resolveE2EBarcodeLookup();
  if (e2eFixture) {
    return e2eFixture;
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      log.warn("OpenFoodFacts lookup failed", { barcode, status: res.status });
      return res.status === 404 ? { kind: "not_found" } : { kind: "error" };
    }

    const json = await res.json();
    const status =
      typeof json === "object" &&
      json !== null &&
      "status" in json &&
      typeof json.status === "number"
        ? json.status
        : null;

    if (status === 0) {
      return { kind: "not_found" };
    }

    const decoded = parseOffProductResponse(json);
    if (!decoded) {
      log.warn("OpenFoodFacts response did not match expected schema", {
        barcode,
      });
      return status === 0 ? { kind: "not_found" } : { kind: "error" };
    }

    const p = decoded.product;
    const name = decodeHtmlEntities(p.product_name || "").trim();
    const n = p.nutriments || {};

    const kcal = toNumber(
      n["energy-kcal_100g"] ??
        n["energy-kcal"] ??
        n["energy_100g"] ??
        n["energy"]
    );
    const protein = toNumber(n["proteins_100g"] ?? n["proteins"]);
    const carbs = toNumber(n["carbohydrates_100g"] ?? n["carbohydrates"]);
    const fat = toNumber(n["fat_100g"] ?? n["fat"]);

    const q = String(p.quantity || "").toLowerCase();
    const srv = String(p.serving_size || "").toLowerCase();
    const tags: string[] = Array.isArray(p.categories_tags)
      ? p.categories_tags
      : [];
    const dataPer = String(p.nutrition_data_per || "").toLowerCase();

    const isBeverage =
      tags.some((t) => /beverage|drink|napoje|napój/i.test(String(t))) ||
      q.includes("ml") ||
      srv.includes("ml");
    const unit: "g" | "ml" =
      isBeverage || dataPer.includes("100ml") ? "ml" : "g";

    const ingredient: Ingredient = {
      id: `${Date.now()}`,
      name: name || `Product ${barcode}`,
      amount: 100,
      unit,
      protein,
      fat,
      carbs,
      kcal,
    };

    return { kind: "found", name: ingredient.name, ingredient };
  } catch (error: unknown) {
    log.error("Barcode lookup failed", { barcode, error });
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
