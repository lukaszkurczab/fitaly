import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import fixture from "@/__contract_fixtures__/smart_memory_core_v1.json";
import type { SmartMemoryCoreContract } from "@/types/smartMemory";

const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPatch = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRuntimeConfig = {
  apiVersion: "v1",
  foodLibraryEnabled: true,
  smartMemoryEnabled: true,
  knownPatternsEnabled: true,
  recipeCatalogEnabled: true,
  planningEnabled: true,
  homeNextActionEnabled: true,
};

jest.mock("@/services/core/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

jest.mock("@/services/core/runtimeConfig", () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

const contract = fixture as SmartMemoryCoreContract;

function getContractItem() {
  const item = contract.apiResponseExamples.itemsPage.items[0];
  if (!item) {
    throw new Error("Missing Smart Memory item contract fixture");
  }
  return item;
}

function getContractCandidate() {
  return contract.apiResponseExamples.candidateResponse.candidate;
}

function getRequiredSourceRef(sourceRefs: Array<Record<string, unknown>>) {
  const sourceRef = sourceRefs[0];
  if (!sourceRef) {
    throw new Error("Missing Smart Memory sourceRef contract fixture");
  }
  return sourceRef;
}

describe("smartMemoryApi", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRuntimeConfig.smartMemoryEnabled = true;
  });

  it("does not call backend requests when Smart Memory is disabled", async () => {
    mockRuntimeConfig.smartMemoryEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");

    await expect(api.fetchSmartMemoryItemsRemote()).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(api.fetchSmartMemoryCandidatesRemote()).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(api.fetchSmartMemorySettingsRemote()).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.upsertSmartMemoryCandidateRemote({
        clientMutationId: "candidate-mutation",
        input: { candidateId: "candidate-1" } as never,
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.editSmartMemoryItemRemote({
        memoryItemId: "memory-1",
        clientMutationId: "edit-mutation",
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.muteSmartMemoryItemRemote({
        memoryItemId: "memory-1",
        clientMutationId: "mute-mutation",
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.restoreSmartMemoryItemRemote({
        memoryItemId: "memory-1",
        clientMutationId: "restore-mutation",
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.deleteSmartMemoryItemRemote({
        memoryItemId: "memory-1",
        clientMutationId: "delete-mutation",
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.markSmartMemoryItemSourceDeletedRemote({
        memoryItemId: "memory-1",
        clientMutationId: "source-deleted-mutation",
        input: { sourceRef: { kind: "meal", sourceHash: "source-1" } } as never,
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });
    await expect(
      api.updateSmartMemorySettingsRemote({
        enabled: false,
        clientMutationId: "settings-mutation",
      }),
    ).rejects.toMatchObject({
      code: "feature/smart-memory-disabled",
      retryable: false,
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("parses Smart Memory contract fixture response examples", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");

    mockGet
      .mockResolvedValueOnce(contract.apiResponseExamples.emptyItemsPage)
      .mockResolvedValueOnce(contract.apiResponseExamples.itemsPage)
      .mockResolvedValueOnce({ items: [contract.apiResponseExamples.candidateResponse.candidate] })
      .mockResolvedValueOnce(contract.apiResponseExamples.settingsEnabledResponse);
    mockPost.mockResolvedValueOnce(contract.apiResponseExamples.itemDeleteResponse);
    mockPatch.mockResolvedValueOnce(contract.apiResponseExamples.settingsDisabledResponse);

    await expect(api.fetchSmartMemoryItemsRemote()).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
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

  it("rejects malformed item page payloads instead of dropping invalid rows", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");
    const validItem = getContractItem();
    const invalidPayloads = [
      {},
      { items: [validItem, "not-an-item"] },
      {
        items: [
          validItem,
          {
            ...validItem,
            memoryItemId: "memory-unsupported-type",
            memoryType: "unsupported_memory_type",
          },
        ],
      },
      {
        items: [
          validItem,
          {
            ...validItem,
            memoryItemId: "memory-unknown-state",
            state: "unknown_state",
          },
        ],
      },
    ];

    for (const payload of invalidPayloads) {
      mockGet.mockResolvedValueOnce(payload);
      await expect(api.fetchSmartMemoryItemsRemote()).rejects.toThrow(
        "Invalid Smart Memory items page response",
      );
    }
  });

  it("rejects nested drift in Smart Memory item responses", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");
    const validItem = getContractItem();
    const validSourceRef = getRequiredSourceRef(validItem.sourceRefs);
    const missingSchemaVersion = { ...validItem } as Record<string, unknown>;
    delete missingSchemaVersion.schemaVersion;

    const invalidItems = [
      { ...validItem, stateReason: "unsupported_state_reason" },
      {
        ...validItem,
        sourceRefs: [validSourceRef, "not-a-source-ref"],
      },
      {
        ...validItem,
        sourceRefs: [{ kind: "meal_review", sourceId: "source-id-001" }],
      },
      {
        ...validItem,
        sourceRefs: [{ ...validSourceRef, sourceId: "source-id-001" }],
      },
      {
        ...validItem,
        confidenceReasonCodes: ["distinct_days_met", "unknown_confidence_reason"],
      },
      { ...validItem, schemaVersion: 2 },
      missingSchemaVersion,
      { ...validItem, serverRevision: 0 },
      { ...validItem, serverRevision: "3" },
    ];

    for (const item of invalidItems) {
      mockPost.mockResolvedValueOnce({ item, updated: true });
      await expect(
        api.deleteSmartMemoryItemRemote({
          memoryItemId: "memory-1",
          clientMutationId: "delete-mutation",
        }),
      ).rejects.toThrow("Invalid Smart Memory item response");
    }
  });

  it("rejects malformed candidate page payloads instead of dropping invalid rows", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");
    const validCandidate = getContractCandidate();
    const invalidPayloads = [
      {},
      { items: [validCandidate, "not-a-candidate"] },
      {
        items: [
          validCandidate,
          {
            ...validCandidate,
            candidateId: "candidate-unsupported-type",
            memoryType: "unsupported_memory_type",
          },
        ],
      },
      {
        items: [
          validCandidate,
          {
            ...validCandidate,
            candidateId: "candidate-unknown-state",
            state: "unknown_state",
          },
        ],
      },
    ];

    for (const payload of invalidPayloads) {
      mockGet.mockResolvedValueOnce(payload);
      await expect(api.fetchSmartMemoryCandidatesRemote()).rejects.toThrow(
        "Invalid Smart Memory candidates page response",
      );
    }
  });

  it("rejects nested drift in Smart Memory candidate responses", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");
    const validCandidate = getContractCandidate();
    const validSourceRef = getRequiredSourceRef(validCandidate.sourceRefs);
    const missingSchemaVersion = { ...validCandidate } as Record<string, unknown>;
    delete missingSchemaVersion.schemaVersion;

    const invalidCandidates = [
      {
        ...validCandidate,
        sourceRefs: [validSourceRef, "not-a-source-ref"],
      },
      {
        ...validCandidate,
        sourceRefs: [{ kind: "review_confirmation", sourceId: "source-id-001" }],
      },
      {
        ...validCandidate,
        sourceRefs: [{ ...validSourceRef, sourceId: "source-id-001" }],
      },
      {
        ...validCandidate,
        confidenceReasonCodes: ["single_observation", "unknown_confidence_reason"],
      },
      { ...validCandidate, schemaVersion: 2 },
      missingSchemaVersion,
      { ...validCandidate, serverRevision: 0 },
      { ...validCandidate, serverRevision: "1" },
    ];

    for (const candidate of invalidCandidates) {
      mockPost.mockResolvedValueOnce({ candidate, updated: true });
      await expect(
        api.upsertSmartMemoryCandidateRemote({
          clientMutationId: "candidate-mutation",
          input: { candidateId: "candidate-1" } as never,
        }),
      ).rejects.toThrow("Invalid Smart Memory candidate response");
    }
  });

  it("rejects invalid Smart Memory settings server revisions", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require("./smartMemoryApi") as typeof import("./smartMemoryApi");
    const validSettings = contract.apiResponseExamples.settingsEnabledResponse.settings;
    const missingServerRevision = { ...validSettings } as Record<string, unknown>;
    delete missingServerRevision.serverRevision;

    const invalidSettings = [
      missingServerRevision,
      { ...validSettings, serverRevision: 0 },
      { ...validSettings, serverRevision: "1" },
      { ...validSettings, serverRevision: 1.5 },
    ];

    for (const settings of invalidSettings) {
      mockGet.mockResolvedValueOnce({ settings, updated: true });
      await expect(api.fetchSmartMemorySettingsRemote()).rejects.toThrow(
        "Invalid Smart Memory settings response",
      );
    }
  });
});
