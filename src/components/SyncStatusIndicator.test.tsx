import { describe, expect, it, jest } from "@jest/globals";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => {
  const { createElement } =
    jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: ({ name, testID }: { name: string; testID?: string }) =>
      createElement(Text, { testID }, `icon:${name}`),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SyncStatusIndicator", () => {
  it("renders pending sync as a semantic compact status", () => {
    const screen = renderWithTheme(
      <SyncStatusIndicator syncState="pending" testID="sync-pending" />,
    );

    expect(screen.getByTestId("sync-pending")).toBeTruthy();
    expect(screen.getByTestId("sync-pending-icon")).toBeTruthy();
    expect(
      screen.queryByText("history.syncStatus.pending.label"),
    ).toBeNull();
    expect(
      screen.getByLabelText("history.syncStatus.pending.label"),
    ).toBeTruthy();
  });

  it("renders failed sync distinct from pending", () => {
    const screen = renderWithTheme(
      <SyncStatusIndicator syncState="failed" testID="sync-failed" />,
    );

    expect(screen.getByTestId("sync-failed")).toBeTruthy();
    expect(screen.getByText("icon:wifi-off")).toBeTruthy();
    expect(screen.getByLabelText("history.syncStatus.failed.label")).toBeTruthy();
    expect(screen.queryByText("history.syncStatus.failed.label")).toBeNull();
    expect(
      screen.queryByText("history.syncStatus.pending.label"),
    ).toBeNull();
  });

  it("renders details copy when requested", () => {
    const screen = renderWithTheme(
      <SyncStatusIndicator
        syncState="conflict"
        testID="sync-conflict"
        variant="detail"
      />,
    );

    expect(screen.getByText("history.syncStatus.conflict.label")).toBeTruthy();
    expect(
      screen.getByText("history.syncStatus.conflict.description"),
    ).toBeTruthy();
  });

  it("does not render status noise for synced meals", () => {
    const screen = renderWithTheme(
      <SyncStatusIndicator syncState="synced" testID="sync-synced" />,
    );

    expect(screen.queryByTestId("sync-synced")).toBeNull();
  });
});
