# Premium Production/Smoke Checklist

Run this on a real iOS/Android device with the intended production or smoke build.

## Runtime Config

- Confirm the build profile points at the intended backend:
  - production: `EXPO_PUBLIC_API_BASE_URL=https://fitaly-backend-production.up.railway.app`
  - smoke: `EXPO_PUBLIC_API_BASE_URL=https://fitaly-backend-smoke.up.railway.app`
- Confirm billing is enabled: `DISABLE_BILLING=false`.
- Confirm the platform RevenueCat SDK key is present in EAS:
  - iOS: `RC_IOS_API_KEY`
  - Android: `RC_ANDROID_API_KEY`
- Confirm backend env for the same environment:
  - `REVENUECAT_API_KEY`
  - `REVENUECAT_WEBHOOK_SECRET`
  - `FIREBASE_PROJECT_ID`
  - `FIRESTORE_DATABASE_ID`
  - `AI_CREDITS_PREMIUM`

## Device Flow

1. Sign in and note the Firebase UID from backend logs or authenticated debug tooling.
2. Open Manage Subscription and verify RevenueCat is ready, not disabled/not configured.
3. Start a new purchase.
4. Verify telemetry sequence:
   - `purchase_started`
   - `purchase_succeeded`
   - `entitlement_confirmed`
   - If `purchase_succeeded` is followed by `entitlement_confirmation_failed`, treat it as a P0/P1 guardrail and inspect the `reason`.
5. Verify backend `/api/v1/ai/credits/sync-tier` logs `revenuecat_sync_tier_reconciled` for the same UID.
6. Verify `/api/v1/billing/access-state` returns:
   - `tier: "premium"`
   - `entitlementStatus: "active"`
   - `credits.tier: "premium"`
   - `credits.allocation` equals `AI_CREDITS_PREMIUM`
7. Verify Manage Subscription shows Premium and concrete AI Credits balance/allocation, not `-`.
8. Kill and restart the app. Verify Premium and credits are still shown after refresh.
9. Tap Restore Purchases. Verify the same UID is used by `Purchases.logIn(uid)` and backend sync remains premium.
10. Tap Retry confirmation. Verify it does not downgrade an active RevenueCat entitlement to free when backend sync is degraded; it should show Premium pending confirmation with the actionable failure reason.

## Failure Reasons

- `rc_not_configured`: missing platform RevenueCat SDK key in the build.
- `no_active_entitlement`: RevenueCat returned no active `premium` entitlement for this UID.
- `uid_mismatch`: RevenueCat active entitlement belongs to a different app user ID than Firebase UID.
- `sync_tier_failed`: backend `/ai/credits/sync-tier` failed or RevenueCat REST API is unavailable.
- `access_unknown_degraded`: `/billing/access-state` failed or returned degraded/unknown.
- `credits_missing`: access-state returned no credits payload.
- `credits_not_premium`: backend credits did not reconcile to premium.
