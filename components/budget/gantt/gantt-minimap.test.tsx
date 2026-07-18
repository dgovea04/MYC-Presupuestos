/* @vitest-environment jsdom */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { GanttMiniMap } from "@/components/budget/gantt/gantt-minimap";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
  onScrollTo: ReturnType<typeof vi.fn>;
  setCapture: MockInstance;
  releaseCapture: MockInstance;
  getByTestId: (testId: string) => HTMLElement;
};

const MINIMAP_RECT = { left: 0, top: 0, width: 400, height: 56 };

const activeRenders: RenderHandle[] = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  // jsdom does not implement the Pointer Capture API. Stub the minimum
  // surface the minimap relies on so we can assert on capture/release
  // calls without touching real browser internals.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => true);
  }
});

afterEach(async () => {
  while (activeRenders.length > 0) {
    const handle = activeRenders.pop();
    if (!handle) break;
    await act(async () => {
      handle.root.unmount();
    });
    handle.container.remove();
  }
  vi.restoreAllMocks();
});

describe("GanttMiniMap", () => {
  describe("click-to-scroll", () => {
    it("centers the clicked point in the viewport and calls onScrollTo", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      // rect.width = 400, click at clientX=200 → ratio = 0.5
      // target = 0.5 * 1000 - 300/2 = 350 (max scrollLeft = 700, no clamping)
      dispatchPointer(handle.getByTestId("gantt-minimap"), "pointerdown", 1, 200, 28);

      expect(handle.onScrollTo).toHaveBeenCalledTimes(1);
      expect(handle.onScrollTo).toHaveBeenLastCalledWith(350);
    });

    it("clamps the click target to the maximum scrollable position", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      // Click at the far right edge (ratio = 1) → raw target = 1000 - 150 = 850
      // max scrollLeft = timelineContentWidth - viewportWidth = 700
      dispatchPointer(handle.getByTestId("gantt-minimap"), "pointerdown", 1, 400, 28);

      expect(handle.onScrollTo).toHaveBeenLastCalledWith(700);
    });

    it("clamps a click past the left edge to zero", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      // Click at clientX = -50 with rect.left = 0 → clickX = -50 → ratio = -0.125
      // raw target = -125 - 150 = -275 → clamped to 0
      dispatchPointer(handle.getByTestId("gantt-minimap"), "pointerdown", 1, -50, 28);

      expect(handle.onScrollTo).toHaveBeenLastCalledWith(0);
    });
  });

  describe("drag-to-scroll with pointer capture", () => {
    it("captures the pointer on pointerdown and releases it on pointerup", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const minimap = handle.getByTestId("gantt-minimap");
      dispatchPointer(minimap, "pointerdown", 7, 200, 28);
      expect(handle.setCapture).toHaveBeenCalledWith(7);

      dispatchPointer(minimap, "pointerup", 7, 200, 28);
      expect(handle.releaseCapture).toHaveBeenCalledWith(7);
    });

    it("updates scrollLeft by the drag distance relative to the start position", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const minimap = handle.getByTestId("gantt-minimap");

      // Initial click at clientX=200, scrollLeft prop still 0
      // dragStartRef captures startScrollLeft = 0 (the *prop* value at click time)
      dispatchPointer(minimap, "pointerdown", 1, 200, 28);

      // Move 100px right with rect.width=400 → deltaRatio = 0.25
      // new scrollLeft = 0 + 0.25 * 1000 = 250
      dispatchPointer(minimap, "pointermove", 1, 300, 28);

      expect(handle.onScrollTo).toHaveBeenLastCalledWith(250);
    });

    it("keeps scrolling past the click target if drag movement extends further", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const minimap = handle.getByTestId("gantt-minimap");

      // Drag math is relative to the initial scrollLeft prop (0), not to
      // whatever onScrollTo was last called with, which keeps the math stable
      // and matches what a tracker must do.
      dispatchPointer(minimap, "pointerdown", 1, 200, 28);
      dispatchPointer(minimap, "pointermove", 1, 320, 28);
      // delta = 120, deltaRatio = 0.3, target = 0 + 0.3 * 1000 = 300
      expect(handle.onScrollTo).toHaveBeenLastCalledWith(300);

      dispatchPointer(minimap, "pointermove", 1, 360, 28);
      // delta = 160, deltaRatio = 0.4, target = 0 + 0.4 * 1000 = 400
      expect(handle.onScrollTo).toHaveBeenLastCalledWith(400);
    });

    it("clamps the drag to the maximum scrollable position on overshoot", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const minimap = handle.getByTestId("gantt-minimap");

      dispatchPointer(minimap, "pointerdown", 1, 0, 28);
      // Move 5000px to the right → deltaRatio = 12.5, target = 0 + 12500 = 12500
      // max scrollLeft = 700 → clamp to 700
      dispatchPointer(minimap, "pointermove", 1, 5000, 28);

      expect(handle.onScrollTo).toHaveBeenLastCalledWith(700);
    });

    it("does not scroll on pointermove when no drag is active", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const minimap = handle.getByTestId("gantt-minimap");

      // pointermove without a prior pointerdown
      dispatchPointer(minimap, "pointermove", 1, 300, 28);

      expect(handle.onScrollTo).not.toHaveBeenCalled();
    });
  });

  describe("viewport indicator clamping", () => {
    it("clamps scrollLeft < 0 by pinning the indicator to the left edge", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: -50,
        timelineDayCount: 100,
      });

      const indicator = handle.getByTestId("gantt-minimap-viewport");
      expect(indicator.style.left).toBe("0%");
      // width% = clamp(300/1000*100, 2, 100) = 30
      expect(indicator.style.width).toBe("30%");
    });

    it("clamps scrollLeft so the indicator never spills past the right edge", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        // raw left% = 80, width% = 30 → 80+30 = 110% spills past 100%
        // safe left% = clamp(80, 0, 100 - 30) = 70
        scrollLeft: 800,
        timelineDayCount: 100,
      });

      const indicator = handle.getByTestId("gantt-minimap-viewport");
      expect(indicator.style.left).toBe("70%");
      expect(indicator.style.width).toBe("30%");
    });

    it("clamps viewportWidth > timelineContentWidth so the indicator never overflows", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 2000,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const indicator = handle.getByTestId("gantt-minimap-viewport");
      // raw width% = 200 → clamped to 100
      expect(indicator.style.width).toBe("100%");
      // safe left% = clamp(0, 0, 100 - 100) = 0
      expect(indicator.style.left).toBe("0%");
    });

    it("keeps a minimum-width indicator when viewportWidth is vanishingly small", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 100_000,
        viewportWidth: 1, // 0.001% of content
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const indicator = handle.getByTestId("gantt-minimap-viewport");
      // MIN_VIEWPORT_PERCENT = 2: width% never goes below 2%
      expect(indicator.style.width).toBe("2%");
    });
  });

  describe("empty state placeholder", () => {
    it("shows the placeholder when no lines are scheduled", async () => {
      const handle = await renderMiniMap({
        allLines: [],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const wrapper = handle.getByTestId("gantt-minimap");
      const placeholder = wrapper.querySelector('[data-testid="gantt-minimap-empty"]');
      expect(placeholder).not.toBeNull();
      expect(placeholder?.textContent).toBe("Sin partidas programadas");
      // The overlay viewport indicator must NOT render in the empty state.
      expect(wrapper.querySelector('[data-testid="gantt-minimap-viewport"]')).toBeNull();
    });

    it("ignores lines without valid start/end/duration when computing the empty state", async () => {
      const handle = await renderMiniMap({
        allLines: [
          createLineWithoutDates(), // missing startDate/endDate/durationDays
          createLineWithZeroDuration(), // durationDays = 0
        ],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 0,
        timelineDayCount: 100,
      });

      const wrapper = handle.getByTestId("gantt-minimap");
      expect(wrapper.querySelector('[data-testid="gantt-minimap-empty"]')).not.toBeNull();
      expect(wrapper.querySelector('[data-testid="gantt-minimap-viewport"]')).toBeNull();
    });

    it("hides the placeholder and shows the viewport indicator when there are scheduled lines", async () => {
      const handle = await renderMiniMap({
        allLines: [createScheduledLine()],
        timelineContentWidth: 1000,
        viewportWidth: 300,
        scrollLeft: 100,
        timelineDayCount: 100,
      });

      const wrapper = handle.getByTestId("gantt-minimap");
      expect(wrapper.querySelector('[data-testid="gantt-minimap-empty"]')).toBeNull();
      expect(wrapper.querySelector('[data-testid="gantt-minimap-viewport"]')).not.toBeNull();
    });
  });

  describe("indicator tracks drag synchronously (regression)", () => {
    it("updates the viewport indicator as the parent commits new scrollLeft during drag", async () => {
      // Simulate the parent (OverviewView) behavior: the onScrollTo callback
      // commits scrollLeft state synchronously so the minimap indicator
      // moves with the drag in real time. Without this, the indicator waits
      // for the rAF-gated path inside handleOverviewScroll, and during
      // continuous drag that rAF is canceled on every pointermove before it
      // can fire — leaving the indicator stuck even though the gantt content
      // scrolls correctly.
      const line = createScheduledLine();
      const dayIndex = buildDayIndex([line]);
      const TIMELINE_CONTENT_WIDTH = 1000;
      const VIEWPORT_WIDTH = 300;
      const TIMELINE_DAY_COUNT = 100;
      const MINIMAP_RECT_WIDTH = 400;
      const MINIMAP_RECT_HEIGHT = 56;

      function Host() {
        const [scrollLeft, setScrollLeft] = React.useState(0);
        return (
          <GanttMiniMap
            allLines={[line]}
            timelineDayIndexByIso={dayIndex}
            timelineContentWidth={TIMELINE_CONTENT_WIDTH}
            timelineDayCount={TIMELINE_DAY_COUNT}
            scrollLeft={scrollLeft}
            viewportWidth={VIEWPORT_WIDTH}
            showCriticalPath={false}
            nearCriticalSlackDays={2}
            onScrollTo={setScrollLeft}
          />
        );
      }

      const hostContainer = document.createElement("div");
      document.body.appendChild(hostContainer);
      const hostRoot = createRoot(hostContainer);

      try {
        await act(async () => {
          hostRoot.render(<Host />);
        });

        const minimap = hostContainer.querySelector<HTMLElement>(
          '[data-testid="gantt-minimap"]',
        );
        if (!minimap) {
          throw new Error("gantt-minimap not found");
        }

        // jsdom returns a zero rect by default; install a fixed one so the
        // pointer handlers compute deterministic drag math.
        vi.spyOn(minimap, "getBoundingClientRect").mockImplementation(() => ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: MINIMAP_RECT_WIDTH,
          bottom: MINIMAP_RECT_HEIGHT,
          width: MINIMAP_RECT_WIDTH,
          height: MINIMAP_RECT_HEIGHT,
          toJSON: () => ({}),
        }));

        const indicator = hostContainer.querySelector<HTMLElement>(
          '[data-testid="gantt-minimap-viewport"]',
        );
        if (!indicator) {
          throw new Error("gantt-minimap-viewport not found");
        }

        // safeViewportWidthPercent = clamp(300/1000*100, 2, 100) = 30
        // safeViewportLeftPercent   = clamp(0/1000*100,   0, 100 - 30) = 0
        expect(indicator.style.left).toBe("0%");
        expect(indicator.style.width).toBe("30%");

        // Start drag at x=0: ratio = 0 → raw target = -150 → clamp 0
        // Host receives setScrollLeft(0); dragStartRef.startScrollLeft = 0.
        dispatchPointer(minimap, "pointerdown", 1, 0, 28);
        // Indicator remains at 0% because scrollLeft state is still 0.
        expect(indicator.style.left).toBe("0%");

        // Drag to x=300: deltaRatio = 0.75 → raw target = 750
        // max scrollLeft = 700 → clamp 700. setScrollLeft(700) on the host
        // propagates the new prop back so indicator updates synchronously.
        // safeViewportLeftPercent = clamp(700/1000*100, 0, 70) = 70
        dispatchPointer(minimap, "pointermove", 1, 300, 28);
        expect(indicator.style.left).toBe("70%");

        // Release the captured pointer so subsequent tests are unaffected.
        dispatchPointer(minimap, "pointerup", 1, 300, 28);
      } finally {
        await act(async () => {
          hostRoot.unmount();
        });
        hostContainer.remove();
      }
    });
  });
});

async function renderMiniMap(props: {
  allLines: WorkScheduleLineRecord[];
  timelineContentWidth: number;
  viewportWidth: number;
  scrollLeft: number;
  timelineDayCount: number;
}): Promise<RenderHandle> {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  const onScrollTo = vi.fn();

  await act(async () => {
    root.render(
      <GanttMiniMap
        allLines={props.allLines}
        timelineDayIndexByIso={buildDayIndex(props.allLines)}
        timelineContentWidth={props.timelineContentWidth}
        timelineDayCount={props.timelineDayCount}
        scrollLeft={props.scrollLeft}
        viewportWidth={props.viewportWidth}
        showCriticalPath={false}
        nearCriticalSlackDays={2}
        onScrollTo={onScrollTo}
      />,
    );
  });

  const minimap = container.querySelector<HTMLElement>('[data-testid="gantt-minimap"]');
  if (!minimap) {
    throw new Error("gantt-minimap not rendered");
  }

  // jsdom returns a zero rect by default. Override it on the minimap so the
  // pointer handlers can compute deterministic click/drag math.
  vi.spyOn(minimap, "getBoundingClientRect").mockImplementation(() => ({
    x: MINIMAP_RECT.left,
    y: MINIMAP_RECT.top,
    left: MINIMAP_RECT.left,
    top: MINIMAP_RECT.top,
    right: MINIMAP_RECT.left + MINIMAP_RECT.width,
    bottom: MINIMAP_RECT.top + MINIMAP_RECT.height,
    width: MINIMAP_RECT.width,
    height: MINIMAP_RECT.height,
    toJSON: () => ({}),
  }));

  const setCapture = vi.spyOn(minimap, "setPointerCapture");
  const releaseCapture = vi.spyOn(minimap, "releasePointerCapture");

  const handle: RenderHandle = {
    container,
    root,
    onScrollTo,
    setCapture,
    releaseCapture,
    getByTestId: (testId: string): HTMLElement => {
      const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!element) {
        throw new Error(`Missing test id ${testId}`);
      }
      return element;
    },
  };
  activeRenders.push(handle);
  return handle;
}

function dispatchPointer(
  target: Element,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
) {
  // Wrap in act() so React flushes the setIsDragging(true) state update
  // committed by pointerdown before pointermove reads it back. Without this
  // the pointermove handler exits early on the stale state and the drag
  // callbacks never fire, producing false negatives in the assertions.
  act(() => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      clientX,
      clientY,
      pointerType: "mouse",
      isPrimary: true,
    });
    target.dispatchEvent(event);
  });
}

function createScheduledLine(): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01.01",
    description: "Trazo y replanteo",
    unit: "M2",
    quantity: 120,
    unitPrice: 4.5,
    partial: 540,
    subBudgetId: "sub-1",
    subBudgetName: "Obras provisionales",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    durationDays: 5,
    monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
  };
}

function createLineWithoutDates(): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-2",
    itemCode: "01.02.01",
    description: "Sin fechas asignadas",
    unit: "GLL",
    quantity: 1,
    unitPrice: 100,
    partial: 100,
    subBudgetId: "sub-1",
    subBudgetName: "Obras provisionales",
    startDate: null,
    endDate: null,
    durationDays: null,
    monthlyDistributions: [],
  };
}

function createLineWithZeroDuration(): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-3",
    itemCode: "01.02.02",
    description: "Duracion cero",
    unit: "UND",
    quantity: 1,
    unitPrice: 50,
    partial: 50,
    subBudgetId: "sub-2",
    subBudgetName: "Estructuras",
    startDate: "2026-03-10",
    endDate: "2026-03-10",
    durationDays: 0,
    monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
  };
}

function buildDayIndex(lines: WorkScheduleLineRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  lines.forEach((line) => {
    if (line.startDate) map.set(line.startDate, map.size);
    if (line.endDate && line.endDate !== line.startDate) map.set(line.endDate, map.size);
  });
  return map;
}
