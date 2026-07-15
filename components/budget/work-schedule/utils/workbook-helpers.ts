"use client";

import type { WorkbookExportScope } from "../types";
import type { ActiveView } from "../types";

export function getWorkbookExportTargetLabel(activeView: ActiveView) {
  if (activeView === "overview") {
    return "Paquete ejecutivo del cronograma";
  }

  if (activeView === "valuation") {
    return "Calendario valorizado mensual";
  }

  if (activeView === "resources") {
    return "Calendario de insumos (recursos)";
  }

  return "Curva S del cronograma";
}

export function getSupportedWorkbookProfiles(_activeView: ActiveView) {
  return ["minimal", "executive", "analytical"] as const;
}

export function getWorkbookExportProfileLabel(profile: string) {
  if (profile === "minimal") {
    return "Minimal";
  }

  if (profile === "executive") {
    return "Ejecutivo";
  }

  return "Analitico";
}

export function getWorkbookExportScopeForView(
  _activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
): WorkbookExportScope {
  if (_activeView === "overview") {
    return scopes.executiveWorkbookScope;
  }

  if (_activeView === "valuation") {
    return scopes.valuationWorkbookScope;
  }

  if (_activeView === "resources") {
    return scopes.resourceWorkbookScope;
  }

  return scopes.curveWorkbookScope;
}

export function getWorkbookExportProfileFromScope(
  _activeView: ActiveView,
  scope: WorkbookExportScope,
): string {
  if (scope === "detail_only") {
    return "minimal";
  }

  if (scope === "detail_and_total") {
    return "executive";
  }

  return "analytical";
}

export function getWorkbookExportScopeFromProfile(
  _activeView: ActiveView,
  profile: string,
): WorkbookExportScope {
  if (profile === "minimal") {
    return "detail_only";
  }

  if (profile === "executive") {
    return "detail_and_total";
  }

  return "detail_subtotals_and_total";
}

export function buildWorkbookScopePreview(target: string, scope: WorkbookExportScope, detailUnit: string) {
  if (scope === "detail_only") {
    return `Solo ${detailUnit} de ${target}`;
  }

  if (scope === "detail_and_total") {
    return `${detailUnit} + total de ${target}`;
  }

  return `${detailUnit} + subtotales + total de ${target}`;
}

export function buildWorkbookExportPreviewBadges(
  _activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  const scope = getWorkbookExportScopeForView(_activeView, scopes);
  const targetLabel = getWorkbookExportTargetLabel(_activeView);

  return [scope === "detail_only" ? "Solo detalle" : scope === "detail_and_total" ? "Detalle + total" : "Detalle + subtotales + total", targetLabel];
}

export function describeWorkbookExportPreview(
  _activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  const scope = getWorkbookExportScopeForView(_activeView, scopes);
  const targetLabel = getWorkbookExportTargetLabel(_activeView);

  return `El archivo XLSX incluira: ${buildWorkbookScopePreview(targetLabel, scope, scope === "detail_only" ? "la tabla de detalle" : scope === "detail_and_total" ? "la tabla de detalle y fila de totales" : "la tabla de detalle, subtotales por especialidad y fila de totales")}.`;
}
