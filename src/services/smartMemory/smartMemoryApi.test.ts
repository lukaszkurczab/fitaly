import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import fixture from "@/__contract_fixtures__/smart_memory_core_v1.json";
import type { SmartMemoryCoreContract } from "@/types/smartMemory";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPatch = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

const contract = fixture as SmartMemoryCoreContract;

describe("smartMemoryApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("parses Smart Memory contract fixture response examples", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");

    mockGet
      .mockResolvedValueOnce(contract.apiResponseExamples.itemsPage)
      .mockResolvedValueOnce({ items: [contract.apiResponseExamples.candidateResponse.candidate] })
      .mockResolvedValueOnce(contract.apiResponseExamples.settingsEnabledResponse);
    mockPost.mockResolvedValueOnce(contract.apiResponseExamples.itemDeleteResponse);
    mockPatch.mockResolvedValueOnce(contract.apiResponseExamples.settingsDisabledResponse);

    await expect(api.fetchSmartMemoryItemsRemote()).resolves.toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          memoryItemId: "memory-typical-portion-001",
          state: "active",
        }),
      ]),
      nextCursor: null,
    });
    await expect(api.fetchSmartMemoryCandidatesRemote()).resolves.toEqual({
      items: [
        expect.objectContaining({
          candidateId: "candidate-review-correction-001",
          state: "candidate",
        }),
      ],
      nextCursor: null,
    });
    await expect(api.fetchSmartMemorySettingsRemote()).resolves.toEqual(
      expect.objectContaining({
        settings: expect.objectContaining({ enabled: true }),
      }),
    );
    await expect(
      api.deleteSmartMemoryItemRemote({
        memoryItemId: "memory-deleted-001",
        clientMutationId: "delete-mutation",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({ state: "deleted_suppressed" }),
      }),
    );
    await expect(
      api.updateSmartMemorySettingsRemote({
        enabled: false,
        clientMutationId: "settings-disable",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        settings: expect.objectContaining({ enabled: false }),
      }),
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v2/users/me/smart-memory/items?limit=100",
    );
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v2/users/me/smart-memory/settings",
      { enabled: false, clientMutationId: "settings-disable" },
    );
  });
});
