import { describe, expect, it } from "vitest";
import { buildMarketingAlerts } from "@/lib/data/admin-marketing-alerts";
import type { AdminMarketingHealth } from "@/lib/data/admin-marketing-health";
import type { AdminMarketingReconciliation } from "@/lib/data/admin-marketing-reconciliation";

const healthyReconciliation: AdminMarketingReconciliation = {
  available: true,
  checkedAt: "2026-08-15T12:00:00.000Z",
  rows: [{
    key: "signup_completed",
    label: "Registros",
    source: "User.createdAt",
    internalCount: 2,
    sourceCount: 2,
    difference: 0,
    matchRate: 100,
    status: "match",
  }],
  ga4: { available: false, reason: "credentials missing" },
};

const healthyHealth: AdminMarketingHealth = {
  available: true,
  totalEvents: 10,
  lastEventAt: "2026-08-15T12:00:00.000Z",
  anonymousEvents: 2,
  unattributedSignups: 0,
  possibleDuplicates: 0,
  missingCoreEvents: [],
  eventCounts: [],
};

describe("marketing analytics alerts", () => {
  it("prioritizes large reconciliation differences before health warnings", () => {
    const alerts = buildMarketingAlerts({
      reconciliation: {
        ...healthyReconciliation,
        rows: [{
          ...healthyReconciliation.rows[0],
          internalCount: 1,
          sourceCount: 10,
          difference: -9,
          matchRate: 10,
          status: "review",
        }],
      },
      health: {
        ...healthyHealth,
        unattributedSignups: 2,
      },
    });

    expect(alerts[0]).toMatchObject({ severity: "error", key: "reconciliation-signup_completed" });
    expect(alerts[1]).toMatchObject({ severity: "warning", key: "unattributed-signups" });
  });

  it("returns no alerts when sources and instrumentation are healthy", () => {
    expect(buildMarketingAlerts({ reconciliation: healthyReconciliation, health: healthyHealth })).toEqual([]);
  });

  it("raises an error when either data source is unavailable", () => {
    const alerts = buildMarketingAlerts({
      reconciliation: { ...healthyReconciliation, available: false, rows: [] },
      health: { ...healthyHealth, available: false },
    });

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", key: "reconciliation-unavailable" }),
      expect.objectContaining({ severity: "error", key: "health-unavailable" }),
    ]));
  });
});
