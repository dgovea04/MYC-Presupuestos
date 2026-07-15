"use client";

const STORAGE_PREFIX = "work-schedule";

export function getCollapsedGroupsStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-collapsed-groups:${budgetId}`;
}

export function getCollapsedLevelIdsStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-collapsed-level-ids:${budgetId}`;
}

export function getActiveViewStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-active-view:${budgetId}`;
}

export function getEditingLineStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-editing-line:${budgetId}`;
}

export function getOverviewScrollStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-scroll:${budgetId}`;
}

export function getOverviewTimelinePanelWidthStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-timeline-panel-width:${budgetId}`;
}

export function getOverviewCostColumnsVisibilityStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-cost-columns-visibility:${budgetId}`;
}

export function getOverviewTimelineZoomStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-timeline-zoom:${budgetId}`;
}

export function getResourceCalendarModeStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-resource-calendar-mode:${budgetId}`;
}

export function getCriticalPathVisibilityStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-critical-path-visibility:${budgetId}`;
}

export function getOverviewFilterStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-filter:${budgetId}`;
}

export function getOverviewMeasuredHeightsStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-overview-measured-heights:${budgetId}`;
}

export function getExecutiveWorkbookScopeStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-executive-workbook-scope:${budgetId}`;
}

export function getValuationWorkbookScopeStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-valuation-workbook-scope:${budgetId}`;
}

export function getResourceWorkbookScopeStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-resource-workbook-scope:${budgetId}`;
}

export function getCurveWorkbookScopeStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-curve-workbook-scope:${budgetId}`;
}

export function getGenerationStrategyStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-strategy:${budgetId}`;
}

export function getGenerationLevelLinkageStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-level-linkage:${budgetId}`;
}

export function getGenerationParallelismStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-parallelism:${budgetId}`;
}

export function getGenerationStaggerDaysStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-stagger-days:${budgetId}`;
}

export function getGenerationMaxDurationStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-max-duration:${budgetId}`;
}

export function getGenerationSimilarityLagStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-similarity-lag:${budgetId}`;
}

export function getGenerationPreviewCollapsedGroupsStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-preview-collapsed-groups:${budgetId}`;
}

export function getGenerationReviewedItemsStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-generation-reviewed-items:${budgetId}`;
}

export function getNearCriticalSlackDaysStorageKey(budgetId: string) {
  return `${STORAGE_PREFIX}-near-critical-slack-days:${budgetId}`;
}

export function writeStringPreference(storageKey: string, value: string, defaultValue: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value === defaultValue) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, value);
  } catch {
    // Storage may be unavailable
  }
}

export function readStringPreference(storageKey: string, defaultValue: string): string {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function writeBooleanPreference(storageKey: string, value: boolean, defaultValue: boolean) {
  writeStringPreference(storageKey, value ? "1" : "0", defaultValue ? "1" : "0");
}

export function readBooleanPreference(storageKey: string, defaultValue: boolean): boolean {
  const raw = readStringPreference(storageKey, defaultValue ? "1" : "0");
  return raw === "1";
}

export function writeNumberPreference(storageKey: string, value: number, defaultValue: number) {
  writeStringPreference(storageKey, String(value), String(defaultValue));
}

export function readNumberPreference(storageKey: string, defaultValue: number): number {
  const raw = readStringPreference(storageKey, String(defaultValue));
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function writeJsonPreference<T>(storageKey: string, value: T, defaultValue: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage may be unavailable
  }
}

export function readJsonPreference<T>(storageKey: string, defaultValue: T): T {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return defaultValue;
    }

    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}
