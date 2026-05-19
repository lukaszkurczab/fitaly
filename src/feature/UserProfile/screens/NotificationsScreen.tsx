import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
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
import { useAuthContext } from "@/context/AuthContext";
import { useNotificationDiagnosticsState } from "@/feature/UserProfile/hooks/useNotificationDiagnosticsState";
import { useNotificationsScreenState } from "@/feature/UserProfile/hooks/useNotificationsScreenState";
import { useReminderDecision } from "@/hooks/useReminderDecision";
import { buildSmartReminderQaRows } from "@/services/reminders/reminderSettings";

type NotificationsNavigation = StackNavigationProp<
  RootStackParamList,
  "Notifications"
>;

type NotificationsScreenProps = {
  navigation: NotificationsNavigation;
};

function formatIds(ids: string[]): string {
  if (!ids.length) {
    return "none";
  }
  return ids.join(", ");
}

export default function NotificationsScreen({
  navigation,
}: NotificationsScreenProps) {
  const { uid } = useAuthContext();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("notifications");
  const smartReminderDecision = useReminderDecision({
    uid,
    fetchEnabled: __DEV__,
  });
  const smartReminderQaRows = useMemo(
    () =>
      buildSmartReminderQaRows({
        status: smartReminderDecision.status,
        source: smartReminderDecision.source,
        enabled: smartReminderDecision.enabled,
        decision: smartReminderDecision.decision,
        error: smartReminderDecision.error,
      }),
    [
      smartReminderDecision.decision,
      smartReminderDecision.enabled,
      smartReminderDecision.error,
      smartReminderDecision.source,
      smartReminderDecision.status,
    ],
  );

  const {
    loading,
    motivationEnabled,
    smartRemindersEnabled,
    statsEnabled,
    systemAllowed,
    settingsCtaVisible,
    lastSyncError,
    lastPrefsSyncStatus,
    lastPrefsSyncAt,
    setSettingsCtaVisible,
    openSettings,
    onToggleSmartReminders,
    onToggleMotivation,
    onToggleStats,
  } = useNotificationsScreenState(uid);
  const diagnosticsRefreshKey = [
    uid ?? "no_user",
    String(systemAllowed),
    smartReminderDecision.status,
    smartReminderDecision.source,
    smartReminderDecision.decision?.decision ?? "no_decision",
    smartReminderDecision.decision?.computedAt ?? "n/a",
    smartReminderDecision.decision?.validUntil ?? "n/a",
    smartRemindersEnabled ? "smart_enabled" : "smart_disabled",
    motivationEnabled ? "motivation_enabled" : "motivation_disabled",
    statsEnabled ? "stats_enabled" : "stats_disabled",
    lastPrefsSyncStatus,
    lastPrefsSyncAt ?? "no_sync_at",
    lastSyncError ?? "no_sync_error",
  ].join("|");
  const diagnostics = useNotificationDiagnosticsState({
    uid,
    refreshKey: diagnosticsRefreshKey,
  });
  const notificationDiagnosticsRows = useMemo(() => {
    const runtimeSnapshot = diagnostics.runtime.lastSnapshot;
    const runtimeResult = diagnostics.runtime.lastResult;
    const storedIds = diagnostics.storedSchedules
      ? diagnostics.storedSchedules.entries.flatMap((entry) => entry.ids)
      : [];

    return [
      { label: "triage", value: diagnostics.triage },
      {
        label: "env",
        value: `${diagnostics.environment.platform}, device=${diagnostics.environment.isPhysicalDevice}, ownership=${diagnostics.environment.appOwnership}, exec=${diagnostics.environment.executionEnvironment}`,
      },
      {
        label: "envReleaseSmokeSupported",
        value: diagnostics.environment.releaseSmokeSupported
          ? "true"
          : `false (${diagnostics.environment.limitationReason ?? "unknown"})`,
      },
      {
        label: "permission",
        value: `${diagnostics.permission.status}, granted=${diagnostics.permission.granted}, canAskAgain=${diagnostics.permission.canAskAgain}`,
      },
      {
        label: "permissionRequested",
        value: diagnostics.permission.requested
          ? `true (${diagnostics.permission.requestedAt ?? "unknown"})`
          : "false",
      },
      {
        label: "androidChannel",
        value: `${diagnostics.channel.platform}, ensured=${diagnostics.channel.ensured}, exists=${diagnostics.channel.exists}, error=${diagnostics.channel.errorMessage ?? "none"}`,
      },
      {
        label: "foregroundPresentation",
        value: `initialized=${diagnostics.foregroundPresentation.initialized}, banner=${diagnostics.foregroundPresentation.foregroundBehavior.shouldShowBanner}, list=${diagnostics.foregroundPresentation.foregroundBehavior.shouldShowList}`,
      },
      {
        label: "runtime",
        value: `initialized=${diagnostics.runtime.initialized}, uid=${diagnostics.runtime.currentUid ?? "none"}, appState=${diagnostics.runtime.currentAppState}, inFlight=${diagnostics.runtime.inFlight}`,
      },
      {
        label: "lastSchedulingResult",
        value: runtimeResult
          ? `${runtimeResult.outcome}/${runtimeResult.reason} (${runtimeResult.result.status})`
          : "none",
      },
      {
        label: "lastSchedulingFailure",
        value: runtimeSnapshot?.lastErrorStage
          ? `${runtimeSnapshot.lastErrorStage}: ${runtimeSnapshot.lastErrorMessage ?? "unknown"}`
          : "none",
      },
      {
        label: "lastSchedulingLocalKey",
        value: runtimeSnapshot?.localKey ?? "none",
      },
      {
        label: "activeScheduledIds:smartReminder(OS)",
        value: formatIds(diagnostics.scheduled.smartReminderIds),
      },
      {
        label: "activeScheduledIds:all(OS)",
        value: formatIds(diagnostics.scheduled.allIds),
      },
      {
        label: "activeScheduledIds:smartReminder(storage)",
        value: formatIds(storedIds),
      },
      {
        label: "prefs",
        value: `smart=${smartRemindersEnabled}, motivation=${motivationEnabled}, stats=${statsEnabled}`,
      },
      {
        label: "prefsSync",
        value: `status=${lastPrefsSyncStatus}, at=${lastPrefsSyncAt ?? "n/a"}, error=${lastSyncError ?? "none"}`,
      },
      {
        label: "diagnosticsRefreshedAt",
        value: diagnostics.refreshedAt ?? "never",
      },
    ];
  }, [
    diagnostics.channel,
    diagnostics.environment,
    diagnostics.foregroundPresentation,
    diagnostics.permission,
    diagnostics.refreshedAt,
    diagnostics.runtime,
    diagnostics.scheduled,
    diagnostics.storedSchedules,
    diagnostics.triage,
    lastPrefsSyncAt,
    lastPrefsSyncStatus,
    lastSyncError,
    motivationEnabled,
    smartRemindersEnabled,
    statsEnabled,
  ]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("AppSettings");
  };

  const permissionBlock =
    systemAllowed === false ? (
      <InfoBlock
        title={t("screen.permissionOffTitle")}
        body={t("screen.permissionOffBody")}
        tone="warning"
        icon={<AppIcon name="wifi-off" size={18} color={theme.warning.text} />}
      />
    ) : systemAllowed === true ? (
      <InfoBlock
        title={t("screen.permissionOnTitle")}
        body={t("screen.permissionOnBody")}
        tone="success"
        icon={<AppIcon name="check" size={18} color={theme.success.text} />}
      />
    ) : (
      <InfoBlock
        title={t("screen.permissionCheckingTitle")}
        body={t("screen.permissionCheckingBody")}
        tone="neutral"
        icon={<AppIcon name="info" size={18} color={theme.textSecondary} />}
      />
    );

  return (
    <>
      <FormScreenShell
        testID="notifications-screen"
        title={t("screen.title")}
        intro={t("screen.intro")}
        onBack={handleBack}
      >
        <View style={styles.content}>
          {permissionBlock}

          {systemAllowed === false ? (
            <Button
              testID="notifications-open-settings-button"
              label={t("permissions.openSettings")}
              variant="secondary"
              fullWidth={false}
              onPress={() => {
                void openSettings();
              }}
            />
          ) : null}

          <SettingsSection title={t("screen.preferenceTitle")}>
            <SettingsRow
              title={t("screen.smartReminders")}
              subtitle={t("screen.smartReminderHint")}
              trailing={
                <ButtonToggle
                  testID="notifications-smart-reminders-toggle"
                  value={smartRemindersEnabled}
                  onToggle={(enabled) => {
                    void onToggleSmartReminders(enabled);
                  }}
                />
              }
            />
            <SettingsRow
              title={t("screen.motivation")}
              subtitle={t("screen.motivationSubtitle")}
              trailing={
                <ButtonToggle
                  testID="notifications-motivation-toggle"
                  value={motivationEnabled}
                  onToggle={(enabled) => {
                    void onToggleMotivation(enabled);
                  }}
                />
              }
            />
            <SettingsRow
              title={t("screen.stats")}
              subtitle={t("screen.statsSubtitle")}
              trailing={
                <ButtonToggle
                  testID="notifications-stats-toggle"
                  value={statsEnabled}
                  onToggle={(enabled) => {
                    void onToggleStats(enabled);
                  }}
                />
              }
            />
          </SettingsSection>

          {__DEV__ ? (
            <>
              <SettingsSection title={t("screen.smartReminderDebugTitle")}>
                {smartReminderQaRows.map((row) => (
                  <SettingsRow
                    key={row.label}
                    title={row.label}
                    value={row.value}
                  />
                ))}
              </SettingsSection>
              <SettingsSection title="Notification Diagnostics">
                {notificationDiagnosticsRows.map((row) => (
                  <SettingsRow
                    key={row.label}
                    title={row.label}
                    value={row.value}
                  />
                ))}
                <Button
                  testID="notifications-refresh-diagnostics-button"
                  label={
                    diagnostics.loading
                      ? "Refreshing diagnostics..."
                      : "Refresh diagnostics"
                  }
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    void diagnostics.refresh();
                  }}
                />
              </SettingsSection>
            </>
          ) : null}

          {loading ? (
            <InfoBlock
              title={t("screen.loadingTitle")}
              body={t("screen.loadingBody")}
              tone="neutral"
            />
          ) : null}
        </View>
      </FormScreenShell>

      <Modal
        testID="notifications-permission-modal"
        visible={settingsCtaVisible}
        title={t("permissions.title")}
        message={t("permissions.message")}
        onClose={() => setSettingsCtaVisible(false)}
        primaryAction={{
          label: t("permissions.openSettings"),
          onPress: openSettings,
          testID: "open-settings",
        }}
        secondaryAction={{
          label: t("permissions.notNow"),
          onPress: () => setSettingsCtaVisible(false),
          testID: "not-now",
        }}
      />
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
  });
