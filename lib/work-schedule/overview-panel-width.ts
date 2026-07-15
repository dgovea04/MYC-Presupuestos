export const WORK_SCHEDULE_TIMELINE_PANEL_WIDTH_COOKIE_NAME = "myc_work_schedule_timeline_panel_width" as const;
export const DEFAULT_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH = 972;
export const MIN_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH = 360;

export function clampWorkScheduleTimelinePanelWidth(width: number): number {
  return Math.max(MIN_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH, Math.round(width));
}

export function parseWorkScheduleTimelinePanelWidth(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return clampWorkScheduleTimelinePanelWidth(parsedValue);
}

export function getWorkScheduleTimelinePanelWidthCssValue(width: number): `${number}px` {
  return `${clampWorkScheduleTimelinePanelWidth(width)}px`;
}
