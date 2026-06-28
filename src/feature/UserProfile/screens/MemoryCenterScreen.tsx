import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  ButtonToggle,
  FormScreenShell,
  InfoBlock,
  Modal,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import RuntimeFeatureDisabledState from "@/components/RuntimeFeatureDisabledState";
import { useUserProfileContext } from "@/context/UserProfileContext";
import { isRuntimeFeatureEnabled } from "@/services/core/featureFlagGuard";
import {
  queueSmartMemoryItemDelete,
  queueSmartMemoryItemMute,
  queueSmartMemoryItemRestore,
  queueSmartMemorySettingsDisable,
  queueSmartMemorySettingsEnable,
  readSmartMemoryProjection,
  discardFailedSmartMemoryControls,
  retryFailedSmartMemoryControls,
  selectMemoryCenterState,
} from "@/services/smartMemory/smartMemoryService";
import type {
  SmartMemoryProjection,
  SmartMemoryProjectionCandidate,
  SmartMemoryProjectionItem,
  SmartMemoryProjectionSettings,
} from "@/services/smartMemory/smartMemoryProjectionRepository";
import { useMonitoredNetInfo } from "@/services/core/connectivityMonitor";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  trackMemoryDeleted,
  trackMemoryMuted,
} from "@/services/telemetry/telemetryInstrumentation";
import type {
  SmartMemoryItem,
  SmartMemoryProjectionState,
  SmartMemoryType,
  SmartMemoryUserValue,
} from "@/types/smartMemory";

type MemoryCenterNavigation = StackNavigationProp<
  RootStackParamList,
  "MemoryCenter"
>;

type MemoryCenterScreenProps = {
  navigation: MemoryCenterNavigation;
};

type LoadState = "loading" | "ready" | "error";

type PendingAction =
  | "settings"
  | "mute"
  | "restore"
  | "delete"
  | "retry"
  | "discard"
  | null;

export default function MemoryCenterScreen({
  navigation,
}: MemoryCenterScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { userData } = useUserProfileContext();
  const uid = userData?.uid ?? null;
  const netInfo = useMonitoredNetInfo();
  const isOffline = isOfflineNetState(netInfo);
  const smartMemoryEnabled = isRuntimeFeatureEnabled("smartMemory");
  const isMountedRef = useRef(true);
  const [projection, setProjection] = useState<SmartMemoryProjection | null>(
    null,
  );
  const centerState = useMemo(
    () => selectMemoryCenterState(projection),
    [projection],
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionInFlight, setActionInFlight] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] =
    useState<SmartMemoryProjectionItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<SmartMemoryProjectionItem | null>(null);

  const loadProjection = useCallback(async () => {
    if (!smartMemoryEnabled) {
      setProjection(null);
      setLoadState("ready");
      return;
    }

    if (!uid) {
      setProjection(null);
      setLoadState("ready");
      return;
    }

    setLoadState((current) => (current === "ready" ? current : "loading"));
    try {
      const nextProjection = await readSmartMemoryProjection(uid);
      if (!isMountedRef.current) return;
      setProjection(nextProjection);
      setLoadState("ready");
    } catch {
      if (!isMountedRef.current) return;
      setLoadState("error");
    }
  }, [smartMemoryEnabled, uid]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadProjection();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadProjection]);

  const settings = centerState.settings;
  const accountEnabled = centerState.accountEnabled;
  const hasRows = centerState.hasRows;
  const hasPendingRows = centerState.hasPendingRows;
  const hasFailedRows = centerState.hasFailedRows;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Profile");
  };

  if (!smartMemoryEnabled) {
    return (
      <FormScreenShell
        testID="memory-center-screen"
        title={t("memoryCenter.title")}
        intro={t("memoryCenter.intro")}
        onBack={handleBack}
      >
        <RuntimeFeatureDisabledState
          testID="memory-center-feature-disabled-state"
          icon="sparkles"
          title={t("memoryCenter.featureDisabledTitle", {
            defaultValue: "Smart Memory is unavailable",
          })}
          body={t("memoryCenter.featureDisabledBody", {
            defaultValue:
              "This feature is turned off for this build. No memory data was loaded or changed.",
          })}
        />
      </FormScreenShell>
    );
  }

  const runAction = async (
    action: Exclude<PendingAction, null>,
    task: () => Promise<void>,
  ) => {
    setActionError(null);
    setActionInFlight(action);
    try {
      await task();
      await loadProjection();
    } catch {
      setActionError(t("memoryCenter.actionFailed"));
    } finally {
      if (isMountedRef.current) {
        setActionInFlight(null);
      }
    }
  };

  const handleToggleMemory = (nextValue: boolean) => {
    if (!uid || actionInFlight) return;
    void runAction("settings", async () => {
      if (nextValue) {
        await queueSmartMemorySettingsEnable(uid);
        return;
      }
      await queueSmartMemorySettingsDisable(uid);
    });
  };

  const handleMuteRestore = (item: SmartMemoryProjectionItem) => {
    if (!uid || actionInFlight) return;
    const shouldRestore = item.projectionState === "muted";
    void runAction(shouldRestore ? "restore" : "mute", async () => {
      if (shouldRestore) {
        await queueSmartMemoryItemRestore(uid, item.item.memoryItemId);
        return;
      }
      await queueSmartMemoryItemMute(uid, item.item.memoryItemId);
      void trackMemoryMuted({
        memoryType: item.item.memoryType,
        surface: "memory_center",
        actionResult: "queued",
        featureState: "enabled",
      });
    });
  };

  const handleDeleteConfirmed = () => {
    if (!uid || !deleteTarget || actionInFlight) return;
    const target = deleteTarget;
    void runAction("delete", async () => {
      await queueSmartMemoryItemDelete(uid, target.item.memoryItemId);
      void trackMemoryDeleted({
        memoryType: target.item.memoryType,
        surface: "memory_center",
        actionResult: "queued",
        featureState: "enabled",
      });
      setDeleteTarget(null);
      setSelectedItem(null);
    });
  };

  const handleOpenDeleteConfirmation = (item: SmartMemoryProjectionItem) => {
    setDeleteTarget(item);
    setSelectedItem(null);
  };

  const handleRetryFailed = () => {
    if (!uid || actionInFlight) return;
    void runAction("retry", async () => {
      await retryFailedSmartMemoryControls(uid);
    });
  };

  const handleDiscardFailed = () => {
    if (!uid || actionInFlight) return;
    void runAction("discard", async () => {
      await discardFailedSmartMemoryControls(uid);
    });
  };

  const renderStatus = () => {
    if (!uid) {
      return (
        <InfoBlock
          testID="memory-center-no-user-state"
          title={t("memoryCenter.noUserTitle")}
          body={t("memoryCenter.noUserBody")}
          tone="warning"
          icon={<AppIcon name="lock" size={18} color={theme.accentWarmStrong} />}
        />
      );
    }

    if (loadState === "loading") {
      return (
        <View style={styles.loadingState} testID="memory-center-loading-state">
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.mutedText}>{t("common:loading")}</Text>
        </View>
      );
    }

    if (loadState === "error") {
      return (
        <InfoBlock
          testID="memory-center-load-error-state"
          title={t("memoryCenter.loadErrorTitle")}
          body={t("memoryCenter.loadErrorBody")}
          tone="error"
          icon={<AppIcon name="wifi-off" size={18} color={theme.error.main} />}
        />
      );
    }

    if (isOffline) {
      return (
        <InfoBlock
          testID="memory-center-offline-state"
          title={t("memoryCenter.offlineTitle")}
          body={t("memoryCenter.offlineBody")}
          tone="warning"
          icon={<AppIcon name="wifi-off" size={18} color={theme.accentWarmStrong} />}
        />
      );
    }

    if (hasFailedRows) {
      return (
        <InfoBlock
          testID="memory-center-sync-failed-state"
          title={t("memoryCenter.syncFailedTitle")}
          body={t("memoryCenter.syncFailedBody")}
          tone="error"
          icon={<AppIcon name="info" size={18} color={theme.error.main} />}
        />
      );
    }

    if (hasPendingRows) {
      return (
        <InfoBlock
          testID="memory-center-pending-state"
          title={t("memoryCenter.pendingTitle")}
          body={t("memoryCenter.pendingBody")}
          tone="warning"
          icon={<AppIcon name="refresh" size={18} color={theme.accentWarmStrong} />}
        />
      );
    }

    if (!accountEnabled) {
      return (
        <InfoBlock
          testID="memory-center-empty-disabled-state"
          title={t("memoryCenter.emptyDisabledTitle")}
          body={t("memoryCenter.emptyDisabledBody")}
          tone="neutral"
          icon={<AppIcon name="eye-off" size={18} color={theme.textSecondary} />}
        />
      );
    }

    if (!hasRows) {
      return (
        <InfoBlock
          testID="memory-center-empty-enabled-state"
          title={t("memoryCenter.emptyEnabledTitle")}
          body={t("memoryCenter.emptyEnabledBody")}
          tone="neutral"
          icon={<AppIcon name="sparkles" size={18} color={theme.primaryStrong} />}
        />
      );
    }

    return (
      <InfoBlock
        testID="memory-center-ready-state"
        title={t("memoryCenter.readyTitle")}
        body={t("memoryCenter.readyBody")}
        tone="success"
        icon={<AppIcon name="check" size={18} color={theme.success.main} />}
      />
    );
  };

  const renderItemRow = (item: SmartMemoryProjectionItem) => {
    const statusLabel = getProjectionStatusLabel(item, t);
    return (
      <SettingsRow
        key={item.item.memoryItemId}
        testID={`memory-center-item-${item.item.memoryItemId}`}
        title={getMemoryItemTitle(item.item, t)}
        subtitle={getMemoryItemSubtitle(item.item, item.projectionState, t)}
        subtitleNumberOfLines={3}
        value={statusLabel}
        accessibilityHint={t("memoryCenter.itemRowHint")}
        leading={
          <View style={styles.rowIcon}>
            <AppIcon
              name={getMemoryTypeIcon(item.item.memoryType)}
              size={20}
              color={theme.primaryStrong}
            />
          </View>
        }
        onPress={() => setSelectedItem(item)}
      />
    );
  };

  const renderCandidateRow = (candidate: SmartMemoryProjectionCandidate) => (
    <SettingsRow
      key={candidateKey(candidate)}
      testID={`memory-center-candidate-${candidateKey(candidate)}`}
      title={t(`memoryCenter.type.${candidate.candidate.memoryType}`)}
      subtitle={t("memoryCenter.candidateSubtitle")}
      subtitleNumberOfLines={3}
      value={getProjectionStatusLabel(candidate, t)}
      leading={
        <View style={styles.rowIcon}>
          <AppIcon name="refresh" size={20} color={theme.accentWarmStrong} />
        </View>
      }
      showChevron={false}
    />
  );

  return (
    <>
      <FormScreenShell
        testID="memory-center-screen"
        title={t("memoryCenter.title")}
        intro={t("memoryCenter.intro")}
        onBack={handleBack}
        trailingAction={{
          icon: "refresh",
          onPress: () => {
            void loadProjection();
          },
          accessibilityLabel: t("memoryCenter.refresh"),
          testID: "memory-center-refresh-button",
        }}
      >
        <View style={styles.content}>
          {renderStatus()}

          {hasFailedRows ? (
            <View
              style={styles.recoveryActions}
              testID="memory-center-sync-recovery-actions"
            >
              <Button
                label={t("memoryCenter.retry")}
                variant="secondary"
                loading={actionInFlight === "retry"}
                disabled={Boolean(actionInFlight)}
                onPress={handleRetryFailed}
                testID="memory-center-retry-button"
                accessibilityHint={t("memoryCenter.retryHint")}
              />
              <Button
                label={t("memoryCenter.discard")}
                variant="destructive"
                loading={actionInFlight === "discard"}
                disabled={Boolean(actionInFlight)}
                onPress={handleDiscardFailed}
                testID="memory-center-discard-button"
                accessibilityHint={t("memoryCenter.discardHint")}
              />
            </View>
          ) : null}

          {actionError ? (
            <InfoBlock
              testID="memory-center-action-error-state"
              title={t("memoryCenter.actionFailedTitle")}
              body={actionError}
              tone="error"
              icon={<AppIcon name="info" size={18} color={theme.error.main} />}
            />
          ) : null}

          <SettingsSection
            title={t("memoryCenter.accountSectionTitle")}
            contentStyle={styles.sectionGroup}
          >
            <SettingsRow
              testID="memory-center-account-toggle-row"
              title={t("memoryCenter.accountToggleTitle")}
              subtitle={getAccountSubtitle(settings, accountEnabled, t)}
              subtitleNumberOfLines={3}
              leading={
                <View style={styles.rowIcon}>
                  <AppIcon
                    name={accountEnabled ? "sparkles" : "eye-off"}
                    size={20}
                    color={accountEnabled ? theme.primaryStrong : theme.textSecondary}
                  />
                </View>
              }
              trailing={
                <ButtonToggle
                  testID="memory-center-account-toggle"
                  value={accountEnabled}
                  disabled={!uid || Boolean(actionInFlight)}
                  onToggle={handleToggleMemory}
                  accessibilityLabel={t("memoryCenter.accountToggleTitle")}
                />
              }
              showChevron={false}
            />
          </SettingsSection>

          <MemoryGroup
            title={t("memoryCenter.group.portions")}
            items={centerState.portionItems}
            renderItem={renderItemRow}
            emptyCopy={t("memoryCenter.groupEmpty.portions")}
          />
          <MemoryGroup
            title={t("memoryCenter.group.corrections")}
            items={centerState.correctionItems}
            renderItem={renderItemRow}
            emptyCopy={t("memoryCenter.groupEmpty.corrections")}
          />
          <MemoryGroup
            title={t("memoryCenter.group.ingredientsProducts")}
            items={centerState.ingredientProductItems}
            renderItem={renderItemRow}
            emptyCopy={t("memoryCenter.groupEmpty.ingredientsProducts")}
          />

          {centerState.candidates.length ? (
            <SettingsSection
              title={t("memoryCenter.pendingSectionTitle")}
              contentStyle={styles.sectionGroup}
            >
              {centerState.candidates.map(renderCandidateRow)}
            </SettingsSection>
          ) : null}
        </View>
      </FormScreenShell>

      <Modal
        visible={selectedItem !== null}
        testID="memory-center-detail-modal"
        closeButtonTestID="memory-center-detail-close-button"
        title={
          selectedItem ? getMemoryItemTitle(selectedItem.item, t) : undefined
        }
        onClose={() => setSelectedItem(null)}
        primaryAction={
          selectedItem
            ? {
                label:
                  selectedItem.projectionState === "muted"
                    ? t("memoryCenter.restore")
                    : t("memoryCenter.mute"),
                onPress: () => handleMuteRestore(selectedItem),
                loading:
                  actionInFlight === "mute" || actionInFlight === "restore",
                disabled: Boolean(actionInFlight),
                testID:
                  selectedItem.projectionState === "muted"
                    ? "memory-center-restore-button"
                    : "memory-center-mute-button",
              }
            : undefined
        }
        secondaryAction={
          selectedItem
            ? {
                label: t("memoryCenter.delete"),
                tone: "destructive",
                onPress: () => handleOpenDeleteConfirmation(selectedItem),
                disabled: Boolean(actionInFlight),
                testID: "memory-center-delete-open-button",
              }
            : undefined
        }
        stackActions
      >
        {selectedItem ? (
          <View style={styles.detailStack}>
            <DetailLine
              label={t("memoryCenter.detailType")}
              value={t(`memoryCenter.type.${selectedItem.item.memoryType}`)}
            />
            <DetailLine
              label={t("memoryCenter.detailStatus")}
              value={getProjectionStatusLabel(selectedItem, t)}
            />
            <DetailLine
              label={t("memoryCenter.detailValue")}
              value={formatUserValue(selectedItem.item.userValue, t)}
            />
            {selectedItem.queuedOperation ? (
              <DetailLine
                label={t("memoryCenter.detailPendingOperation")}
                value={t(
                  `memoryCenter.operation.${selectedItem.queuedOperation.operation}`,
                )}
              />
            ) : null}
            {selectedItem.lastErrorMessage || selectedItem.lastErrorCode ? (
              <Text testID="memory-center-detail-error" style={styles.errorText}>
                {selectedItem.lastErrorMessage ??
                  selectedItem.lastErrorCode ??
                  t("memoryCenter.syncFailedTitle")}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={deleteTarget !== null}
        testID="memory-center-delete-confirm-modal"
        title={t("memoryCenter.deleteConfirmTitle")}
        message={t("memoryCenter.deleteConfirmBody")}
        onClose={() => setDeleteTarget(null)}
        primaryAction={{
          label: t("memoryCenter.deleteConfirmAction"),
          tone: "destructive",
          onPress: handleDeleteConfirmed,
          loading: actionInFlight === "delete",
          disabled: Boolean(actionInFlight && actionInFlight !== "delete"),
          testID: "memory-center-delete-confirm-button",
        }}
        secondaryAction={{
          label: t("cancel"),
          onPress: () => setDeleteTarget(null),
          disabled: Boolean(actionInFlight),
          testID: "memory-center-delete-cancel-button",
        }}
      />
    </>
  );
}

function MemoryGroup({
  title,
  items,
  renderItem,
  emptyCopy,
}: {
  title: string;
  items: SmartMemoryProjectionItem[];
  renderItem: (item: SmartMemoryProjectionItem) => ReactNode;
  emptyCopy: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!items.length) {
    return (
      <SettingsSection title={title} contentStyle={styles.sectionGroup}>
        <View style={styles.emptyGroupRow}>
          <Text style={styles.mutedText}>{emptyCopy}</Text>
        </View>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={title} contentStyle={styles.sectionGroup}>
      {items.map(renderItem)}
    </SettingsSection>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function getMemoryTypeIcon(type: SmartMemoryType) {
  if (type === "typical_portion") return "macro-calories-flame";
  if (type === "review_correction") return "edit";
  return "saved-items";
}

function getAccountSubtitle(
  settings: SmartMemoryProjectionSettings | null,
  enabled: boolean,
  t: TFunction<"profile">,
): string {
  if (settings?.queuedOperation?.operation === "settings_disable") {
    return t("memoryCenter.accountDisabling");
  }
  if (settings?.queuedOperation?.operation === "settings_enable") {
    return t("memoryCenter.accountEnabling");
  }
  return enabled
    ? t("memoryCenter.accountEnabled")
    : t("memoryCenter.accountDisabled");
}

function getProjectionStatusLabel(
  entry: {
    projectionState: SmartMemoryProjectionState;
    syncState: string;
    queuedOperation: { status: string } | null;
  },
  t: TFunction<"profile">,
): string {
  if (entry.queuedOperation?.status === "dead_letter") {
    return t("memoryCenter.status.deadLetter");
  }
  if (entry.queuedOperation?.status === "sync_failed") {
    return t("memoryCenter.status.syncFailed");
  }
  if (entry.queuedOperation) {
    return t("memoryCenter.status.pending");
  }
  if (entry.syncState === "dead_letter") return t("memoryCenter.status.deadLetter");
  if (entry.syncState === "sync_failed") return t("memoryCenter.status.syncFailed");
  if (entry.syncState === "conflicted") return t("memoryCenter.status.conflicted");
  return t(`memoryCenter.status.${entry.projectionState}`);
}

function getMemoryItemTitle(item: SmartMemoryItem, t: TFunction<"profile">): string {
  const subjectLabel = getStringField(item.subject, [
    "displayLabel",
    "name",
    "alias",
    "ingredientName",
    "productName",
  ]);
  if (subjectLabel) return subjectLabel;

  const userValueLabel = getStringField(item.userValue, ["displayLabel", "alias"]);
  if (userValueLabel) return userValueLabel;

  return t(`memoryCenter.type.${item.memoryType}`);
}

function getMemoryItemSubtitle(
  item: SmartMemoryItem,
  projectionState: SmartMemoryProjectionState,
  t: TFunction<"profile">,
): string {
  return t("memoryCenter.itemSubtitle", {
    type: t(`memoryCenter.type.${item.memoryType}`),
    value: formatUserValue(item.userValue, t),
    status: t(`memoryCenter.status.${projectionState}`),
  });
}

function formatUserValue(
  value: SmartMemoryUserValue,
  t: TFunction<"profile">,
): string {
  if ("amount" in value && typeof value.amount === "number") {
    return t("memoryCenter.value.portion", {
      amount: value.amount,
      unit: value.unit,
    });
  }
  const label = getStringField(value, ["displayLabel", "alias"]);
  return label ?? t("memoryCenter.value.notShown");
}

function getStringField(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

function candidateKey(candidate: SmartMemoryProjectionCandidate): string {
  const raw = candidate.candidate as { candidateId?: unknown };
  if (typeof raw.candidateId === "string") return raw.candidateId;
  return `${candidate.candidate.memoryType}-${candidate.queuedOperation?.clientMutationId ?? "pending"}`;
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
    sectionGroup: {
      ...theme.depth.raised,
    },
    loadingState: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.cardPadding,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.surfaceElevated,
    },
    recoveryActions: {
      gap: theme.spacing.sm,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    emptyGroupRow: {
      minHeight: 56,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.cardPadding,
      paddingVertical: theme.spacing.md,
    },
    mutedText: {
      color: theme.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    detailStack: {
      gap: theme.spacing.md,
    },
    detailLine: {
      gap: theme.spacing.xxs,
    },
    detailLabel: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
    detailValue: {
      color: theme.text,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
    },
    errorText: {
      color: theme.error.main,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
    },
  });
