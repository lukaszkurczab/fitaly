import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import type { Ingredient } from "@/types";
import type { BarcodeLookupResult } from "@/services/barcode/barcodeService";
import { lookupBarcodeProduct } from "@/services/barcode/barcodeService";

const mockGet = jest.fn() as jest.MockedFunction<
  (url: string) => Promise<unknown>
>;
const mockResolveE2EBarcodeLookup = jest.fn() as jest.MockedFunction<
  () => BarcodeLookupResult | null
>;
const originalFetch = global.fetch;
const barcodeLookupFixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../__contract_fixtures__/barcode_lookup_v1.json"),
    "utf-8",
  ),
) as {
  route: { path: string; query: { barcode: string } };
  found: { kind: "found"; name: string; ingredient: Ingredient };
  errors: {
    not_found: { status: number };
    timeout: { status: number };
    provider_error: { status: number };
  };
};

jest.mock("@/services/core/apiClient", () => ({
  get: (url: string) => mockGet(url),
}));

jest.mock("@/services/e2e/fixtures", () => ({
  resolveE2EBarcodeLookup: () => mockResolveE2EBarcodeLookup(),
}));

describe("barcodeService", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockResolveE2EBarcodeLookup.mockReset();
    mockResolveE2EBarcodeLookup.mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch as unknown as typeof fetch;
  });

  it("uses the backend barcode lookup route and accepts the contract fixture", async () => {
    mockGet.mockResolvedValueOnce(barcodeLookupFixture.found);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const barcode = barcodeLookupFixture.route.query.barcode;

    await expect(lookupBarcodeProduct(barcode)).resolves.toEqual(
      barcodeLookupFixture.found,
    );
    expect(mockGet).toHaveBeenCalledWith(
      `${barcodeLookupFixture.route.path}?barcode=${barcode}`,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps backend 404 responses to not_found", async () => {
    mockGet.mockRejectedValueOnce(
      Object.assign(new Error("missing"), {
        status: barcodeLookupFixture.errors.not_found.status,
      }),
    );

    await expect(lookupBarcodeProduct("5901234123457")).resolves.toEqual({
      kind: "not_found",
    });
  });

  it("maps backend timeout and provider failures to error", async () => {
    mockGet
      .mockRejectedValueOnce(
        Object.assign(new Error("timeout"), {
          status: barcodeLookupFixture.errors.timeout.status,
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("provider"), {
          status: barcodeLookupFixture.errors.provider_error.status,
        }),
      );

    await expect(lookupBarcodeProduct("5901234123457")).resolves.toEqual({
      kind: "error",
    });
    await expect(lookupBarcodeProduct("5901234123457")).resolves.toEqual({
      kind: "error",
    });
  });

  it("bypasses the backend when the E2E barcode fixture is active", async () => {
    const fixtureResult: BarcodeLookupResult = {
      kind: "found",
      name: "Fixture yogurt",
      ingredient: {
        id: "fixture",
        name: "Fixture yogurt",
        amount: 100,
        unit: "g",
        kcal: 100,
        protein: 10,
        fat: 2,
        carbs: 8,
      },
    };
    mockResolveE2EBarcodeLookup.mockReturnValue(fixtureResult);

    await expect(lookupBarcodeProduct("5901234123457")).resolves.toEqual(
      fixtureResult,
    );
    expect(mockGet).not.toHaveBeenCalled();
  });
});
