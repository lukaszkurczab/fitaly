import { describe, expect, it } from "@jest/globals";
import { buildSmartReminderQaRows } from "@/services/reminders/reminderSettings";

describe("reminderSettings", () => {
  it("builds QA rows for a live send decision", () => {
    const rows = buildSmartReminderQaRows({
      status: "live_success",
      source: "remote",
      enabled: true,
      decision: {
        dayKey: "2026-03-20",
        computedAt: "2026-03-20T18:00:00Z",
        decision: "send",
        kind: "log_next_meal",
        reasonCodes: ["preferred_window_open", "day_partially_logged"],
        scheduledAtUtc: "2026-03-20T18:30:00Z",
        confidence: 0.84,
        validUntil: "2026-03-20T19:30:00Z",
      },
      error: null,
    });

    expect(rows).toEqual([
      { label: "status", value: "live_success" },
      { label: "source", value: "remote" },
      { label: "enabled", value: "true" },
      { label: "decision", value: "send" },
      { label: "dayKey", value: "2026-03-20" },
      { label: "kind", value: "log_next_meal" },
      { label: "computedAt", value: "2026-03-20T18:00:00Z" },
      { label: "validUntil", value: "2026-03-20T19:30:00Z" },
      {
        label: "reasonCodes",
        value: "preferred_window_open, day_partially_logged",
      },
      {
        label: "schedule",
        value: "2026-03-20T18:30:00Z -> 2026-03-20T19:30:00Z",
      },
      { label: "confidence", value: "0.84" },
    ]);
  });

  it("builds explicit error QA rows when no decision is available", () => {
    const rows = buildSmartReminderQaRows({
      status: "invalid_payload",
      source: "error",
      enabled: true,
      decision: null,
      error: new Error("contract drift"),
    });

    expect(rows).toEqual([
      { label: "status", value: "invalid_payload" },
      { label: "source", value: "error" },
      { label: "enabled", value: "true" },
      { label: "decision", value: "n/a" },
      { label: "reasonCodes", value: "n/a" },
      { label: "error", value: "contract drift" },
    ]);
  });
});
