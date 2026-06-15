import { fireEvent, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import MemoryCenterScreen from "@/feature/UserProfile/screens/MemoryCenterScreen";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type {
  SmartMemoryProjection,
  SmartMemoryProjectionCandidate,
  SmartMemoryProjectionItem,
  SmartMemoryProjectionSettings,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import type { SmartMemoryItem } from "@/types/smartMemory";

const mockReadSmartMemoryProjection =
  jest.fn<(uid: string) => Promise<SmartMemoryProjection>>();
const mockQueueSettingsDisable = jest.fn<(uid: string) => Promise<unknown>>();
const mockQueueSettingsEnable = jest.fn<(uid: string) => Promise<unknown>>();
const mockQueueItemMute =
  jest.fn<(uid: string, memoryItemId: string) => Promise<unknown>>();
const mockQueueItemRestore =
  jest.fn<(uid: string, memoryItemId: string) => Promise<unknown>>();
const mockQueueItemDelete =
  jest.fn<(uid: string, memoryItemId: string) => Promise<unknown>>();
const mockRetryFailedControls = jest.fn<(uid: string) => Promise<unknown>>();
const mockDiscardFailedControls = jest.fn<(uid: string) => Promise<unknown>>();

let mockProjection: SmartMemoryProjection;
let mockIsOffline = false;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.defaultValue ? String(options.defaultValue) : key,
  }),
}));

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    userData: { uid: "user-1" },
  }),
}));

jest.mock("@/services/core/connectivityMonitor", () => ({
  useMonitoredNetInfo: () => ({ isConnected: !mockIsOffline }),
}));

jest.mock("@/services/core/networkState", () => ({
  isOfflineNetState: (state: { isConnected?: boolean | null }) =>
    state.isConnected === false,
}));

jest.mock("@/services/smartMemory/smartMemoryService", () => {
  const actual =
    jest.requireActual<typeof import("@/services/smartMemory/smartMemoryService")>(
      "@/services/smartMemory/smartMemoryService",
    );
  return {
    ...actual,
    readSmartMemoryProjection: (uid: string) => mockReadSmartMemoryProjection(uid),
    queueSmartMemorySettingsDisable: (uid: string) => mockQueueSettingsDisable(uid),
    queueSmartMemorySettingsEnable: (uid: string) => mockQueueSettingsEnable(uid),
    queueSmartMemoryItemMute: (uid: string, memoryItemId: string) =>
      mockQueueItemMute(uid, memoryItemId),
    queueSmartMemoryItemRestore: (uid: string, memoryItemId: string) =>
      mockQueueItemRestore(uid, memoryItemId),
    queueSmartMemoryItemDelete: (uid: string, memoryItemId: string) =>
      mockQueueItemDelete(uid, memoryItemId),
    retryFailedSmartMemoryControls: (uid: string) => mockRetryFailedControls(uid),
    discardFailedSmartMemoryControls: (uid: string) =>
      mockDiscardFailedControls(uid),
  };
});

jest.mock("@/components", () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Button: ({
      label,
      onPress,
      testID,
      disabled,
    }: {
      label?: string;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
    }) => (
      <Pressable testID={testID} disabled={disabled} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    ButtonToggle: ({
      value,
      onToggle,
      testID,
      disabled,
    }: {
      value: boolean;
      onToggle: (value: boolean) => void;
      testID?: string;
      disabled?: boolean;
    }) => (
      <Pressable
        testID={testID}
        disabled={disabled}
        accessibilityState={{ checked: value, disabled }}
        onPress={() => onToggle(!value)}
      >
        <Text>{value ? "on" : "off"}</Text>
      </Pressable>
    ),
    FormScreenShell: ({
      title,
      intro,
      children,
      trailingAction,
      testID,
    }: {
      title: string;
      intro?: string;
      children: ReactNode;
      trailingAction?: { onPress: () => void; testID?: string };
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {intro ? <Text>{intro}</Text> : null}
        {trailingAction ? (
          <Pressable
            onPress={trailingAction.onPress}
            testID={trailingAction.testID}
          >
            <Text>refresh</Text>
          </Pressable>
        ) : null}
        {children}
      </View>
    ),
    InfoBlock: ({
      title,
      body,
      testID,
    }: {
      title: string;
      body: string;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        <Text>{body}</Text>
      </View>
    ),
    Modal: ({
      visible,
      title,
      message,
      children,
      primaryAction,
      secondaryAction,
      testID,
    }: {
      visible: boolean;
      title?: string;
      message?: string;
      children?: ReactNode;
      primaryAction?: { label: string; onPress?: () => void; testID?: string };
      secondaryAction?: { label: string; onPress?: () => void; testID?: string };
      testID?: string;
    }) =>
      visible ? (
        <View testID={testID}>
          {title ? <Text>{title}</Text> : null}
          {message ? <Text>{message}</Text> : null}
          {children}
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              testID={secondaryAction.testID}
            >
              <Text>{secondaryAction.label}</Text>
            </Pressable>
          ) : null}
          {primaryAction ? (
            <Pressable
              onPress={primaryAction.onPress}
              testID={primaryAction.testID}
            >
              <Text>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null,
    SettingsRow: ({
      title,
      subtitle,
      value,
      onPress,
      testID,
      leading,
      trailing,
    }: {
      title: string;
      subtitle?: string;
      value?: string;
      onPress?: () => void;
      testID?: string;
      leading?: ReactNode;
      trailing?: ReactNode;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        {leading}
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {value ? <Text>{value}</Text> : null}
        {trailing}
      </Pressable>
    ),
    SettingsSection: ({
      title,
      children,
    }: {
      title?: string;
      children: ReactNode;
    }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
  };
});

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function projection(
  overrides: Partial<SmartMemoryProjection> = {},
): SmartMemoryProjection {
  return {
    settings: settingsProjection(),
    items: [],
    candidates: [],
    ...overrides,
  };
}

function settingsProjection(
  overrides: Partial<SmartMemoryProjectionSettings> = {},
): SmartMemoryProjectionSettings {
  return {
    kind: "settings",
    settings: {
      ownerUserId: "user-1",
      enabled: true,
      updatedAt: "2026-06-10T10:00:00.000Z",
      serverRevision: 1,
    },
    projectionState: "no_signal",
    suggestionUse: "blocked",
    syncState: "synced",
    queuedOperation: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function memoryItem(
  overrides: Partial<SmartMemoryItem> = {},
): SmartMemoryItem {
  return {
    memoryItemId: "memory-1",
    ownerUserId: "user-1",
    schemaVersion: 1,
    memoryType: "typical_portion",
    state: "active",
    stateReason: "threshold_met",
    subject: { displayLabel: "Owsianka" },
    userValue: { amount: 60, unit: "g" },
    evidenceSummary: {},
    sourceRefs: [],
    threshold: {},
    confidence: {},
    confidenceReasonCodes: ["distinct_days_met"],
    control: {},
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    serverRevision: 1,
    ...overrides,
  };
}

function itemProjection(
  overrides: Partial<SmartMemoryProjectionItem> = {},
): SmartMemoryProjectionItem {
  return {
    kind: "item",
    item: memoryItem(),
    projectionState: "active",
    suggestionUse: "allowed",
    syncState: "synced",
    queuedOperation: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function candidateProjection(
  overrides: Partial<SmartMemoryProjectionCandidate> = {},
): SmartMemoryProjectionCandidate {
  return {
    kind: "candidate",
    candidate: {
      candidateId: "candidate-1",
      memoryType: "review_correction",
      subject: { kind: "nutrient_adjustment", subjectHash: "subject-hash-1" },
      evidenceSummary: {},
      sourceRefs: [],
      confidenceReasonCodes: ["consistent_user_review"],
      suppressionChecks: {},
    },
    projectionState: "pending_offline_candidate",
    suggestionUse: "pending_only",
    syncState: "pending",
    queuedOperation: {
      operation: "candidate_upsert",
      status: "queued",
      clientMutationId: "mutation-1",
      updatedAt: "2026-06-10T10:00:00.000Z",
    },
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function renderScreen() {
  return renderWithTheme(
    <MemoryCenterScreen
      navigation={
        {
          canGoBack: jest.fn(() => true),
          goBack: jest.fn(),
          navigate: jest.fn(),
        } as never
      }
    />,
  );
}

describe("MemoryCenterScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOffline = false;
    mockProjection = projection();
    mockReadSmartMemoryProjection.mockImplementation(async () => mockProjection);
    mockQueueSettingsDisable.mockResolvedValue({});
    mockQueueSettingsEnable.mockResolvedValue({});
    mockQueueItemMute.mockResolvedValue({});
    mockQueueItemRestore.mockResolvedValue({});
    mockQueueItemDelete.mockResolvedValue({});
    mockRetryFailedControls.mockResolvedValue({});
    mockDiscardFailedControls.mockResolvedValue({});
  });

  it("renders the empty enabled shell and queues account disable", async () => {
    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-empty-enabled-state")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("memory-center-account-toggle"));

    await waitFor(() => {
      expect(mockQueueSettingsDisable).toHaveBeenCalledWith("user-1");
    });
  });

  it("renders the empty disabled shell and queues account enable", async () => {
    mockProjection = projection({
      settings: settingsProjection({
        settings: {
          ownerUserId: "user-1",
          enabled: false,
          disabledAt: "2026-06-10T10:00:00.000Z",
          updatedAt: "2026-06-10T10:00:00.000Z",
          serverRevision: 2,
        },
        projectionState: "disabled",
      }),
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-empty-disabled-state")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("memory-center-account-toggle"));

    await waitFor(() => {
      expect(mockQueueSettingsEnable).toHaveBeenCalledWith("user-1");
    });
  });

  it("shows pending candidates as pending-only state", async () => {
    mockProjection = projection({
      candidates: [candidateProjection()],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-pending-state")).toBeTruthy();
      expect(screen.getByTestId("memory-center-candidate-candidate-1")).toBeTruthy();
    });
    expect(screen.getByText("memoryCenter.candidateSubtitle")).toBeTruthy();
  });

  it("shows sync failed recovery controls and wires retry", async () => {
    mockProjection = projection({
      items: [
        itemProjection({
          syncState: "dead_letter",
          projectionState: "sync_failed",
          queuedOperation: {
            operation: "mute",
            status: "dead_letter",
            clientMutationId: "mutation-dead",
            updatedAt: "2026-06-10T10:00:00.000Z",
          },
          lastErrorMessage: "Backend rejected operation",
        }),
      ],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-sync-failed-state")).toBeTruthy();
      expect(screen.getByTestId("memory-center-sync-recovery-actions")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("memory-center-retry-button"));
    await waitFor(() => {
      expect(mockRetryFailedControls).toHaveBeenCalledWith("user-1");
    });
  });

  it("wires discard for sync failed recovery", async () => {
    mockProjection = projection({
      items: [
        itemProjection({
          syncState: "dead_letter",
          projectionState: "sync_failed",
          queuedOperation: {
            operation: "mute",
            status: "dead_letter",
            clientMutationId: "mutation-dead",
            updatedAt: "2026-06-10T10:00:00.000Z",
          },
          lastErrorMessage: "Backend rejected operation",
        }),
      ],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-discard-button")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("memory-center-discard-button"));
    await waitFor(() => {
      expect(mockDiscardFailedControls).toHaveBeenCalledWith("user-1");
    });
  });

  it("hides confirmed deleted memories from normal groups", async () => {
    mockProjection = projection({
      items: [
        itemProjection({
          item: memoryItem({
            state: "deleted_suppressed",
            stateReason: "user_deleted",
            deletedAt: "2026-06-10T10:00:00.000Z",
          }),
          projectionState: "deleted_suppressed",
          suggestionUse: "blocked",
        }),
      ],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-empty-enabled-state")).toBeTruthy();
    });
    expect(screen.queryByTestId("memory-center-item-memory-1")).toBeNull();
  });

  it("keeps source-deleted memories inspectable in the shell", async () => {
    mockProjection = projection({
      items: [
        itemProjection({
          item: memoryItem({
            state: "source_deleted",
            stateReason: "source_deleted",
            sourceDeletedAt: "2026-06-10T10:00:00.000Z",
          }),
          projectionState: "source_deleted",
          suggestionUse: "blocked",
        }),
      ],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-item-memory-1")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("memory-center-item-memory-1"));
    expect(screen.getByTestId("memory-center-detail-modal")).toBeTruthy();
  });

  it("opens detail and queues mute for active memory", async () => {
    mockProjection = projection({
      items: [itemProjection()],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-item-memory-1")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("memory-center-item-memory-1"));
    fireEvent.press(screen.getByTestId("memory-center-mute-button"));

    await waitFor(() => {
      expect(mockQueueItemMute).toHaveBeenCalledWith("user-1", "memory-1");
    });
  });

  it("opens detail and queues restore for muted memory", async () => {
    mockProjection = projection({
      items: [
        itemProjection({
          item: memoryItem({ state: "muted", stateReason: "user_muted" }),
          projectionState: "muted",
          suggestionUse: "blocked",
        }),
      ],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-item-memory-1")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("memory-center-item-memory-1"));
    fireEvent.press(screen.getByTestId("memory-center-restore-button"));

    await waitFor(() => {
      expect(mockQueueItemRestore).toHaveBeenCalledWith("user-1", "memory-1");
    });
  });

  it("requires delete confirmation and queues delete without source deletion flow", async () => {
    mockProjection = projection({
      items: [itemProjection()],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-item-memory-1")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("memory-center-item-memory-1"));
    fireEvent.press(screen.getByTestId("memory-center-delete-open-button"));

    expect(screen.getByTestId("memory-center-delete-confirm-modal")).toBeTruthy();
    expect(screen.getByText("memoryCenter.deleteConfirmBody")).toBeTruthy();

    fireEvent.press(screen.getByTestId("memory-center-delete-confirm-button"));

    await waitFor(() => {
      expect(mockQueueItemDelete).toHaveBeenCalledWith("user-1", "memory-1");
    });
  });

  it("shows offline state while keeping backend-confirmed rows visible", async () => {
    mockIsOffline = true;
    mockProjection = projection({
      items: [itemProjection()],
    });

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("memory-center-offline-state")).toBeTruthy();
      expect(screen.getByTestId("memory-center-item-memory-1")).toBeTruthy();
    });
  });
});
