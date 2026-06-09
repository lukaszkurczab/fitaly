import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import {
  FormScreenShell,
  Button,
  ButtonToggle,
  InfoBlock,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";
import { useUserProfileContext } from "@/context/UserProfileContext";
import {
  getAiConsentLocalRevokeGuard,
  grantAiConsentRemote,
  publishAiConsentRevokeLocalInactive,
  revokeAiConsentRemote,
} from "@/services/user/userProfileRepository";
import type { UserAiConsent } from "@/types";

type PrivacyAiSettingsNavigation = StackNavigationProp<
  RootStackParamList,
  "PrivacyAiSettings"
>;

type PrivacyAiSettingsScreenProps = {
  navigation: PrivacyAiSettingsNavigation;
};

type ConsentStateCopy = {
  label: string;
  title: string;
  body: string;
  tone: "neutral" | "success" | "warning" | "error";
};

type ConsentActionState =
  | "idle"
  | "granting"
  | "revoking"
  | "grant_failed"
  | "revoke_failed";

type RevokeInFlight = {
  uid: string;
  requestId: number;
};

export const PRIVACY_AI_REVOKE_RETRY_DELAY_MS = 5_000;

export default function PrivacyAiSettingsScreen({
  navigation,
}: PrivacyAiSettingsScreenProps) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { userData } = useUserProfileContext();
  const [actionState, setActionState] =
    useState<ConsentActionState>("idle");
  const [localAiConsent, setLocalAiConsent] =
    useState<UserAiConsent | null>(null);
  const uid = userData?.uid ?? null;
  const latestUidRef = useRef<string | null>(uid);
  const revokeInFlightRef = useRef<RevokeInFlight | null>(null);
  const revokeRequestSequenceRef = useRef(0);
  const revokeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const performRevokeRef = useRef<(() => Promise<void>) | null>(null);
  const isMountedRef = useRef(true);
  const profileAiConsent = userData?.profile.aiConsent ?? null;
  const aiConsent = localAiConsent ?? profileAiConsent;
  const isActionInFlight = actionState === "granting" || actionState === "revoking";
  const isLocallyInactive =
    actionState === "granting" ||
    actionState === "revoking" ||
    actionState === "revoke_failed";
  const isToggleActive = isLocallyInactive ? false : isAiConsentActive(aiConsent);
  const isToggleDisabled =
    !uid || isActionInFlight || actionState === "revoke_failed";
  const consentCopy = getConsentStateCopy(aiConsent, actionState, t);

  const clearScheduledRevokeRetry = useCallback(() => {
    if (revokeRetryTimerRef.current) {
      clearTimeout(revokeRetryTimerRef.current);
      revokeRetryTimerRef.current = null;
    }
  }, []);

  const scheduleAutomaticRevokeRetry = useCallback(() => {
    if (!uid || revokeRetryTimerRef.current) return;

    const scheduledUid = uid;
    revokeRetryTimerRef.current = setTimeout(() => {
      revokeRetryTimerRef.current = null;
      if (latestUidRef.current !== scheduledUid) return;

      void performRevokeRef.current?.();
    }, PRIVACY_AI_REVOKE_RETRY_DELAY_MS);
  }, [uid]);

  const isCurrentRevokeRequest = useCallback(
    (request: RevokeInFlight) =>
      isMountedRef.current &&
      latestUidRef.current === request.uid &&
      revokeInFlightRef.current?.uid === request.uid &&
      revokeInFlightRef.current.requestId === request.requestId,
    [],
  );

  const performRevoke = useCallback(async () => {
    const requestUid = uid;
    if (!requestUid || revokeInFlightRef.current?.uid === requestUid) return;

    clearScheduledRevokeRetry();
    const request: RevokeInFlight = {
      uid: requestUid,
      requestId: revokeRequestSequenceRef.current + 1,
    };
    revokeRequestSequenceRef.current = request.requestId;
    revokeInFlightRef.current = request;
    setActionState("revoking");
    const localInactiveAiConsent = publishAiConsentRevokeLocalInactive(
      requestUid,
      userData,
    );
    if (
      localInactiveAiConsent &&
      isMountedRef.current &&
      latestUidRef.current === requestUid
    ) {
      setLocalAiConsent(localInactiveAiConsent);
    }
    try {
      const response = await revokeAiConsentRemote(requestUid);
      if (!isCurrentRevokeRequest(request)) return;

      clearScheduledRevokeRetry();
      setLocalAiConsent(response.aiConsent);
      setActionState("idle");
    } catch {
      if (!isCurrentRevokeRequest(request)) return;

      setActionState("revoke_failed");
      scheduleAutomaticRevokeRetry();
    } finally {
      if (
        revokeInFlightRef.current?.uid === request.uid &&
        revokeInFlightRef.current.requestId === request.requestId
      ) {
        revokeInFlightRef.current = null;
      }
    }
  }, [
    clearScheduledRevokeRetry,
    isCurrentRevokeRequest,
    scheduleAutomaticRevokeRetry,
    uid,
    userData,
  ]);

  useEffect(() => {
    performRevokeRef.current = performRevoke;
  }, [performRevoke]);

  useEffect(() => {
    latestUidRef.current = uid;
    revokeInFlightRef.current = null;
    clearScheduledRevokeRetry();
    if (!uid) {
      setActionState("idle");
      setLocalAiConsent(null);
      return;
    }

    const localRevokeGuard = getAiConsentLocalRevokeGuard(uid);
    if (localRevokeGuard) {
      setLocalAiConsent(localRevokeGuard);
      setActionState("revoke_failed");
      scheduleAutomaticRevokeRetry();
      return;
    }

    setActionState("idle");
    setLocalAiConsent(null);
  }, [clearScheduledRevokeRetry, scheduleAutomaticRevokeRetry, uid]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      performRevokeRef.current = null;
      clearScheduledRevokeRetry();
    },
    [clearScheduledRevokeRetry],
  );

  const handleConsentToggle = async (nextValue: boolean) => {
    const requestUid = uid;
    if (!requestUid || isActionInFlight || actionState === "revoke_failed") {
      return;
    }

    if (nextValue) {
      setActionState("granting");
      try {
        const response = await grantAiConsentRemote(requestUid);
        if (
          !isMountedRef.current ||
          latestUidRef.current !== requestUid
        ) {
          return;
        }
        setLocalAiConsent(response.aiConsent);
        setActionState("idle");
      } catch {
        if (
          !isMountedRef.current ||
          latestUidRef.current !== requestUid
        ) {
          return;
        }
        setActionState("grant_failed");
      }
      return;
    }

    await performRevoke();
  };

  const handleRetryRevoke = async () => {
    await performRevoke();
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("LegalPrivacyHub");
  };

  return (
    <FormScreenShell
      testID="privacy-ai-settings-screen"
      title={t("privacyAiSettingsTitle", {
        defaultValue: "Privacy & AI",
      })}
      onBack={handleBack}
    >
      <View style={styles.content}>
        <InfoBlock
          title={t("privacyAiSettingsInfoTitle", {
            defaultValue: "One global AI consent",
          })}
          body={t("privacyAiSettingsInfoBody", {
            defaultValue:
              "This account-level consent covers the current-release AI surfaces in Fitaly.",
          })}
          tone="neutral"
          style={styles.infoBlock}
          icon={
            <AppIcon
              name="assistant"
              size={18}
              color={theme.textSecondary}
            />
          }
        />

        <SettingsSection
          title={t("privacyAiSettingsStatusSectionTitle", {
            defaultValue: "Consent state",
          })}
          contentStyle={styles.sectionGroup}
        >
          <SettingsRow
            leading={
              <View style={styles.rowIcon}>
                <AppIcon
                  name={isToggleActive ? "check" : "lock"}
                  size={20}
                  color={isToggleActive ? theme.success.text : theme.warning.text}
                />
              </View>
            }
            title={t("privacyAiSettingsCurrentStateTitle", {
              defaultValue: "Current AI consent",
            })}
            value={consentCopy.label}
            valueTestID="privacy-ai-consent-state-value"
            testID="privacy-ai-consent-state-row"
            showChevron={false}
          />
          <SettingsRow
            leading={
              <View style={styles.rowIcon}>
                <AppIcon
                  name="assistant"
                  size={20}
                  color={isToggleActive ? theme.primaryStrong : theme.textSecondary}
                />
              </View>
            }
            title={t("privacyAiSettingsToggleTitle", {
              defaultValue: "Use AI features",
            })}
            subtitle={t("privacyAiSettingsToggleSubtitle", {
              defaultValue:
                "Grant or revoke the one account-level AI consent for current-release AI surfaces.",
            })}
            subtitleNumberOfLines={3}
            trailing={
              <ButtonToggle
                testID="privacy-ai-consent-toggle"
                accessibilityLabel={t("privacyAiSettingsToggleTitle", {
                  defaultValue: "Use AI features",
                })}
                value={isToggleActive}
                disabled={isToggleDisabled}
                onToggle={(enabled) => {
                  void handleConsentToggle(enabled);
                }}
              />
            }
            testID={`privacy-ai-consent-toggle-row-${
              isToggleActive ? "on" : "off"
            }`}
            showChevron={false}
          />
        </SettingsSection>

        <InfoBlock
          testID="privacy-ai-consent-state-copy"
          title={consentCopy.title}
          body={consentCopy.body}
          tone={consentCopy.tone}
          style={styles.infoBlock}
          icon={
            <AppIcon
              name={isToggleActive ? "check" : "info"}
              size={18}
              color={isToggleActive ? theme.success.text : theme.warning.text}
            />
          }
        />
        {actionState === "revoke_failed" ? (
          <Button
            testID="privacy-ai-consent-retry-button"
            label={t("privacyAiSettingsRetryRevokeCta", {
              defaultValue: "Retry revoke",
            })}
            variant="secondary"
            disabled={!uid || isActionInFlight}
            onPress={() => {
              void handleRetryRevoke();
            }}
          />
        ) : null}

        <SettingsSection
          title={t("privacyAiSettingsSurfacesSectionTitle", {
            defaultValue: "Covered AI surfaces",
          })}
          contentStyle={styles.sectionGroup}
        >
          <SettingsRow
            leading={
              <View style={styles.rowIcon}>
                <AppIcon name="camera" size={20} color={theme.primaryStrong} />
              </View>
            }
            title={t("privacyAiSettingsPhotoAnalysisTitle", {
              defaultValue: "Add Meal photo analysis",
            })}
            subtitle={t("privacyAiSettingsPhotoAnalysisSubtitle", {
              defaultValue:
                "AI analysis for meal photos you choose to submit.",
            })}
            subtitleNumberOfLines={3}
            testID="privacy-ai-surface-photo-analysis"
            showChevron={false}
          />
          <SettingsRow
            leading={
              <View style={styles.rowIcon}>
                <AppIcon name="text" size={20} color={theme.primaryStrong} />
              </View>
            }
            title={t("privacyAiSettingsTextAnalysisTitle", {
              defaultValue: "Add Meal text analysis",
            })}
            subtitle={t("privacyAiSettingsTextAnalysisSubtitle", {
              defaultValue:
                "AI analysis for meal descriptions you choose to submit.",
            })}
            subtitleNumberOfLines={3}
            testID="privacy-ai-surface-text-analysis"
            showChevron={false}
          />
          <SettingsRow
            leading={
              <View style={styles.rowIcon}>
                <AppIcon name="chat" size={20} color={theme.primaryStrong} />
              </View>
            }
            title={t("privacyAiSettingsChatTitle", {
              defaultValue: "AI Chat",
            })}
            subtitle={t("privacyAiSettingsChatSubtitle", {
              defaultValue:
                "AI nutrition chat for questions you choose to send.",
            })}
            subtitleNumberOfLines={3}
            testID="privacy-ai-surface-chat"
            showChevron={false}
          />
        </SettingsSection>
      </View>
    </FormScreenShell>
  );
}

function isAiConsentActive(aiConsent: UserAiConsent | null): boolean {
  return (
    aiConsent?.status === "granted" &&
    Boolean(aiConsent.grantedAt) &&
    aiConsent.revokedAt === null
  );
}

function getConsentStateCopy(
  aiConsent: UserAiConsent | null,
  actionState: ConsentActionState,
  t: TFunction<"profile">,
): ConsentStateCopy {
  switch (actionState) {
    case "granting":
      return {
        label: t("privacyAiSettingsStatusGrantingLabel", {
          defaultValue: "Granting...",
        }),
        title: t("privacyAiSettingsGrantingTitle", {
          defaultValue: "AI consent is being granted",
        }),
        body: t("privacyAiSettingsGrantingBody", {
          defaultValue:
            "AI features stay off until the backend confirms consent.",
        }),
        tone: "neutral",
      };
    case "revoking":
      return {
        label: t("privacyAiSettingsStatusRevokingLabel", {
          defaultValue: "Revoking...",
        }),
        title: t("privacyAiSettingsRevokingTitle", {
          defaultValue: "AI consent is being revoked",
        }),
        body: t("privacyAiSettingsRevokingBody", {
          defaultValue:
            "AI features are off locally while Fitaly confirms the revoke with the backend.",
        }),
        tone: "warning",
      };
    case "grant_failed":
      return {
        label: t("privacyAiSettingsStatusGrantFailedLabel", {
          defaultValue: "Grant failed",
        }),
        title: t("privacyAiSettingsGrantFailedTitle", {
          defaultValue: "AI consent was not granted",
        }),
        body: t("privacyAiSettingsGrantFailedBody", {
          defaultValue:
            "The backend did not confirm consent, so AI features remain off.",
        }),
        tone: "error",
      };
    case "revoke_failed":
      return {
        label: t("privacyAiSettingsStatusRevokeFailedLabel", {
          defaultValue: "Revoke needs retry",
        }),
        title: t("privacyAiSettingsRevokeFailedTitle", {
          defaultValue: "Backend revoke failed",
        }),
        body: t("privacyAiSettingsRevokeFailedBody", {
          defaultValue:
            "AI features are off locally. Fitaly will retry automatically, and you can retry now.",
        }),
        tone: "error",
      };
    case "idle":
      break;
  }

  switch (aiConsent?.status) {
    case "granted":
      if (!isAiConsentActive(aiConsent)) {
        return {
          label: t("privacyAiSettingsStatusNotGrantedLabel", {
            defaultValue: "Not granted",
          }),
          title: t("privacyAiSettingsNotGrantedTitle", {
            defaultValue: "AI consent is not granted",
          }),
          body: t("privacyAiSettingsNotGrantedBody", {
            defaultValue:
              "The current-release AI surfaces listed below should remain off until consent is granted.",
          }),
          tone: "warning",
        };
      }

      return {
        label: t("privacyAiSettingsStatusGrantedLabel", {
          defaultValue: "Granted",
        }),
        title: t("privacyAiSettingsGrantedTitle", {
          defaultValue: "AI consent is granted",
        }),
        body: t("privacyAiSettingsGrantedBody", {
          defaultValue:
            "The current-release AI surfaces listed below can use account-level AI consent.",
        }),
        tone: "success",
      };
    case "revoked":
      return {
        label: t("privacyAiSettingsStatusRevokedLabel", {
          defaultValue: "Revoked",
        }),
        title: t("privacyAiSettingsRevokedTitle", {
          defaultValue: "AI consent is revoked",
        }),
        body: t("privacyAiSettingsRevokedBody", {
          defaultValue:
            "The current-release AI surfaces listed below should remain off until consent is granted again.",
        }),
        tone: "warning",
      };
    case "not_granted":
      return {
        label: t("privacyAiSettingsStatusNotGrantedLabel", {
          defaultValue: "Not granted",
        }),
        title: t("privacyAiSettingsNotGrantedTitle", {
          defaultValue: "AI consent is not granted",
        }),
        body: t("privacyAiSettingsNotGrantedBody", {
          defaultValue:
            "The current-release AI surfaces listed below should remain off until consent is granted.",
        }),
        tone: "warning",
      };
    default:
      return {
        label: t("privacyAiSettingsStatusUnavailableLabel", {
          defaultValue: "Profile unavailable",
        }),
        title: t("privacyAiSettingsUnavailableTitle", {
          defaultValue: "AI consent state unavailable",
        }),
        body: t("privacyAiSettingsUnavailableBody", {
          defaultValue:
            "Fitaly could not read the current profile consent object right now.",
        }),
        tone: "neutral",
      };
  }
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
    infoBlock: {
      ...theme.depth.raised,
    },
    sectionGroup: {
      ...theme.depth.raised,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.rounded.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
  });
