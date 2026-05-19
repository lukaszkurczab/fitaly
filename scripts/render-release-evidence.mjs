#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("release-evidence.md");
const exportSummaryPath = (process.env.EXPORT_SUMMARY_PATH || "").trim();
const exportSummary = exportSummaryPath ? JSON.parse(fs.readFileSync(exportSummaryPath, "utf8")) : null;
const flowSummaryPath = (process.env.FLOW_SUMMARY_PATH || "").trim();
const flowSummary = flowSummaryPath ? JSON.parse(fs.readFileSync(flowSummaryPath, "utf8")) : null;

function value(name, fallback = "not provided") {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

function bullet(label, content) {
  return `- ${label}: ${content}`;
}

const lines = [
  "# Release Evidence",
  "",
  bullet("Generated at", value("EVIDENCE_GENERATED_AT", new Date().toISOString())),
  bullet("Mobile commit SHA", value("MOBILE_SHA", "unknown")),
  bullet("Backend commit SHA", value("BACKEND_SHA", "unknown")),
  bullet("Mobile CI", value("MOBILE_CI_STATUS", "unknown")),
  bullet("Backend CI", value("BACKEND_CI_STATUS", "unknown")),
  bullet("Selected E2E platform", value("E2E_PLATFORM", "unknown")),
  bullet("Smoke E2E", value("SMOKE_E2E_STATUS", "unknown")),
  bullet("P0 E2E", value("P0_E2E_STATUS", "unknown")),
  bullet("E2E results artifact", value("E2E_RESULTS_ARTIFACT_PATH", "unknown")),
  bullet("Skipped E2E suites", value("E2E_SKIPPED_SUITES", "none")),
  bullet("Smoke export", value("SMOKE_EXPORT_STATUS", "unknown")),
  bullet("Smoke flow contracts", value("SMOKE_FLOW_CONTRACT_STATUS", "unknown")),
  bullet("Android targetSdk check", value("TARGET_SDK_STATUS", "unknown")),
  bullet("Android AAB check", value("AAB_STATUS", "unknown")),
  bullet("Latest Firestore backup", value("BACKUP_RUN_URL", "missing")),
  bullet("Latest restore drill", value("RESTORE_RUN_URL", "missing")),
  bullet("Delete smoke evidence", value("DELETE_EVIDENCE_URL", "pending manual attachment")),
  bullet("Delete smoke note", value("DELETE_EVIDENCE_NOTE", "pending manual attachment")),
  bullet("P0.1 Chat integrity tests", value("CHAT_INTEGRITY_TEST_STATUS", "unknown")),
  bullet("P0.2 Atomic onboarding contract", value("ONBOARDING_ATOMIC_CONTRACT_STATUS", "unknown")),
  bullet("P0.3 Weekly Report premium gate", value("WEEKLY_REPORT_PREMIUM_GATE_STATUS", "unknown")),
  bullet("P0.4 Paywall truthfulness", value("PAYWALL_TRUTHFULNESS_STATUS", "pending manual attachment")),
  bullet("P0.5 Privacy-safe logging e2e", value("PRIVACY_LOGGING_E2E_STATUS", "pending manual attachment")),
  bullet("Sentry scrubbing evidence", value("SENTRY_SCRUBBING_EVIDENCE_URL", "pending manual attachment")),
  bullet("P0.6 Compliance evidence packet", value("COMPLIANCE_PACKET_URL", "pending manual attachment")),
  bullet("P0.7 Rollback rehearsal note", value("RC_ROLLBACK_REHEARSAL_URL", "pending manual attachment")),
  "",
  "## Smoke Export Summary",
];

if (exportSummary) {
  lines.push(
    bullet("Checked at", exportSummary.checkedAt || "unknown"),
    bullet("Smoke API", exportSummary.smokeApiBaseUrl || "unknown"),
    bullet("Smoke user", exportSummary.smokeUserEmail || exportSummary.smokeUserId || "unknown"),
    bullet("Meals count", String(exportSummary.counts?.meals ?? "unknown")),
    bullet("Saved meals count", String(exportSummary.counts?.myMeals ?? "unknown")),
    bullet("Chat messages count", String(exportSummary.counts?.chatMessages ?? "unknown")),
    bullet("Notifications count", String(exportSummary.counts?.notifications ?? "unknown")),
    bullet("Feedback count", String(exportSummary.counts?.feedback ?? "unknown")),
  );
} else {
  lines.push("- Smoke export summary was not generated.");
}

if (flowSummary) {
  lines.push("", "## Smoke Flow Contract Summary");
  lines.push(
    bullet("Checked at", flowSummary.checkedAt || "unknown"),
    bullet("Smoke API", flowSummary.smokeApiBaseUrl || "unknown"),
    bullet("Smoke user", flowSummary.smokeUserEmail || flowSummary.smokeUserId || "unknown"),
  );
  for (const check of flowSummary.checks || []) {
    lines.push(
      bullet(
        `Check ${check.name || "unknown"}`,
        `status=${check.status ?? "unknown"}, latency=${check.latencyMs ?? "unknown"}ms`,
      ),
    );
  }
} else {
  lines.push("", "## Smoke Flow Contract Summary", "- Smoke flow summary was not generated.");
}

lines.push(
  "",
  "## Manual Follow-ups",
  "- Attach the disposable smoke delete log before final release approval.",
  "- Attach paywall screenshot + purchase/restore smoke note for visible offer.",
  "- Attach fake-PII logging evidence and Sentry data-scrubbing/retention screenshots.",
  "- Attach compliance packet link (retention matrix, processor list, DPA/SCC status, export/delete trail).",
  "- Attach rollback rehearsal note with candidate version/build identifiers.",
  "- Review any missing manual evidence explicitly as the release owner before rollout.",
  "- Confirm Sentry production alerts for backend 5xx spike and mobile crash/session drop route to Discord.",
  "",
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`${outputPath}\n`);
