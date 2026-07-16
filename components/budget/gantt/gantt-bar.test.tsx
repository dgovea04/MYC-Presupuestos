/* @vitest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { GanttBar } from "@/components/budget/gantt/gantt-bar";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

let activeContainer: HTMLDivElement | null = null;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  if (activeContainer) {
    const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    activeContainer.remove();
    activeContainer = null;
  }
});

describe("GanttBar", () => {
  it("renders slim resize handles and keeps the connection dot offset from the bar edge", async () => {
    const { getByTestId } = await renderBar();

    const leftHandle = getByTestId("gantt-bar-handle-left");
    const rightHandle = getByTestId("gantt-bar-handle-right");
    const connectorDot = getByTestId("gantt-bar-connector-dot");

    expect(leftHandle.className).toContain("w-4");
    expect(rightHandle.className).toContain("peer/resize-right");
    expect(rightHandle.querySelector("span")?.className).toContain("w-1");
    expect(connectorDot.className).toContain("right-[-10px]");
    expect(connectorDot.className).toContain("peer-hover/resize-right:opacity-30");
  });
});

async function renderBar() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(
      <GanttBar
        line={createLine()}
        startIndex={0}
        endIndex={4}
        span={5}
        timelineDayWidth={16}
        timelineDayGap={1}
        timelineColumnWidth={17}
        showCriticalPath={false}
        highlighted={false}
        timelineStartIso="2026-03-01"
        timelineEndIso="2026-03-31"
        onChange={() => {}}
        onStartConnection={() => {}}
      />,
    );
  });

  return {
    getByTestId: (testId: string) => {
      const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!element) {
        throw new Error(`Missing test id ${testId}`);
      }
      return element;
    },
  };
}

function createLine(): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01",
    description: "Trazo",
    unit: "M2",
    quantity: 1,
    unitPrice: 1,
    partial: 1,
    subBudgetId: "sub-1",
    subBudgetName: "Estructuras",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    durationDays: 5,
    monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
  };
}
