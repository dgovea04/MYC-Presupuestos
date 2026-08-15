import type { AdminMarketingHealth } from "@/lib/data/admin-marketing-health";
import type { AdminMarketingReconciliation } from "@/lib/data/admin-marketing-reconciliation";

export type MarketingAlertSeverity = "error" | "warning" | "info";

export type MarketingAlert = {
  key: string;
  severity: MarketingAlertSeverity;
  title: string;
  detail: string;
};

export function buildMarketingAlerts(input: {
  reconciliation: AdminMarketingReconciliation;
  health: AdminMarketingHealth;
}): MarketingAlert[] {
  const alerts: MarketingAlert[] = [];

  if (!input.reconciliation.available) {
    alerts.push({
      key: "reconciliation-unavailable",
      severity: "error",
      title: "Reconciliación no disponible",
      detail: "No se pudo consultar la tabla de eventos y las fuentes oficiales.",
    });
  } else {
    for (const row of input.reconciliation.rows) {
      if (row.status === "match") {
        continue;
      }

      const threshold = Math.max(1, Math.ceil(row.sourceCount * 0.1));
      alerts.push({
        key: `reconciliation-${row.key}`,
        severity: Math.abs(row.difference) > threshold ? "error" : "warning",
        title: `Diferencia en ${row.label}`,
        detail: `Evento interno: ${row.internalCount}; fuente oficial: ${row.sourceCount}; diferencia: ${formatDifference(row.difference)}.`,
      });
    }
  }

  if (!input.health.available) {
    alerts.push({
      key: "health-unavailable",
      severity: "error",
      title: "Salud de analytics no disponible",
      detail: "No se pudo consultar la instrumentación interna.",
    });
  } else {
    if (input.health.missingCoreEvents.length > 0) {
      alerts.push({
        key: "missing-core-events",
        severity: "warning",
        title: "Faltan eventos principales",
        detail: input.health.missingCoreEvents.join(", "),
      });
    }

    if (input.health.unattributedSignups > 0) {
      alerts.push({
        key: "unattributed-signups",
        severity: "warning",
        title: "Signup sin atribución",
        detail: `${input.health.unattributedSignups} signup(s) no tienen UTM first-touch ni last-touch.`,
      });
    }

    if (input.health.possibleDuplicates > 0) {
      alerts.push({
        key: "possible-duplicates",
        severity: "warning",
        title: "Posibles eventos duplicados",
        detail: `${input.health.possibleDuplicates} evento(s) comparten identidad, tipo y minuto.`,
      });
    }
  }

  return alerts.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
}

function severityWeight(severity: MarketingAlertSeverity) {
  return severity === "error" ? 3 : severity === "warning" ? 2 : 1;
}

function formatDifference(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
