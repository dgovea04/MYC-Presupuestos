// Fix: move barrel import to top and remove duplicate
const fs = require('fs');
const p = 'C:/MYC-Presupuestos/components/budget/work-schedule-page-content.tsx';
let c = fs.readFileSync(p, 'utf8');

// 1. Remove any existing barrel import (at any location)
const barrelPattern = /import \{[\s\S]*?deriveEffectiveReviewSummary,[\s\S]*?normalizeWorkScheduleView,[\s\S]*?\} from "\.\/work-schedule";\r?\n/s;
c = c.replace(barrelPattern, '');

// 2. Insert barrel import right before 'export function WorkSchedulePageContent'
const marker = '\r\nexport function WorkSchedulePageContent({ initialData }';

const barrelImport = [
'import {',
'  type ActiveView,',
'  type DerivedCalendarView,',
'  type WorkbookExportScope,',
'  type WorkbookExportProfile,',
'  type WorkbookCell,',
'  type WorkbookTableData,',
'  type EditableLine,',
'  type OverviewFilter,',
'  type ResourceCalendarMode,',
'  type OverviewVirtualItem,',
'  type OverviewMeasuredHeightsCache,',
'  type PredecessorRowNumberMaps,',
'  type DerivedDataLoadState,',
'  type PeriodRangeSelection,',
'  type WorkScheduleGenerationFormState,',
'  type GenerationLevelPreviewRow,',
'  type GenerationLevelPreviewGroup,',
'  type TimelineDay,',
'  type VisibleTimelineLinePosition,',
'  type WorkSchedulePageContentProps,',
'  dayFormatter,',
'  timelineWeekFormatter,',
'  DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH,',
'  MIN_OVERVIEW_TIMELINE_PANEL_WIDTH,',
'  OVERVIEW_HEADER_HEIGHT_CLASS,',
'  OVERVIEW_GROUP_ROW_HEIGHT_CLASS,',
'  OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS,',
'  OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR,',
'  OVERVIEW_VIRTUAL_SCROLL_FALLBACK_HEIGHT,',
'  OVERVIEW_VIRTUAL_OVERSCAN_PX,',
'  OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT,',
'  OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,',
'  OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,',
'  OVERVIEW_TIMELINE_DAY_WIDTH_PX,',
'  OVERVIEW_TIMELINE_DAY_GAP_PX,',
'  MIN_OVERVIEW_TIMELINE_ZOOM_PERCENT,',
'  MAX_OVERVIEW_TIMELINE_ZOOM_PERCENT,',
'  DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT,',
'  MIN_LEGIBLE_TIMELINE_DAY_WIDTH_PX,',
'  OVERVIEW_TABLE_COLUMN_WIDTHS,',
'  InfoTile,',
'  ViewButton,',
'  ExportPreferenceButton,',
'  WorkScheduleExportMenuButton,',
'  Field,',
'  areEditableLinesEqual,',
'  areMonthlyDistributionsEqual,',
'  WorkScheduleDateInput,',
'  WorkScheduleEditorSheet,',
'  WorkScheduleGenerationDialog,',
'  DerivedViewLoadingCard,',
'  DerivedViewUnavailableCard,',
'  DerivedTableCard,',
'  ValuationCalendarView,',
'  ResourceCalendarView,',
'  CurveSView,',
'  buildPreviewWorkScheduleView,',
'  createEditableLine,',
'  serializeEditableLine,',
'  applyEditableDraftToLine,',
'  updateEditableLineDates,',
'  updateEditableLineCrew,',
'  updateEditableLinePredecessor,',
'  updateDistribution,',
'  createNextDistribution,',
'  formatPredecessorForDisplay,',
'  formatPredecessorForStorage,',
'  formatPredecessorToken,',
'  parseEditableCrew,',
'  buildGenerationOptionsPayload,',
'  parseOptionalPositiveInteger,',
'  parseOptionalNonNegativeInteger,',
'  deriveEffectiveReviewSummary,',
'  normalizeWorkScheduleView,',
'} from "./work-schedule";',
].join('\r\n');

c = c.replace(marker, '\r\n' + barrelImport + marker);

fs.writeFileSync(p, c, 'utf8');
console.log('Done. Barrel import moved to top.');
