/* @vitest-environment jsdom */

import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResourceRecord } from "@/types/resource";

const unmountSpy = vi.fn();

vi.mock("@/components/resources/resource-create-sheet", () => ({
  ResourceCreateSheet: () => null,
}));

vi.mock("@/components/resources/resources-table", () => ({
  ResourcesTable: ({ resources }: { resources: ResourceRecord[] }) => {
    const [marker] = useState(() => Math.random().toString(36).slice(2));

    useEffect(() => () => unmountSpy(), []);

    return (
      <div data-testid="resources-table" data-marker={marker}>
        {resources.map((resource) => resource.description).join(",")}
      </div>
    );
  },
}));

import { ResourcesPageContent } from "@/components/resources/resources-page-content";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

function makeResource(overrides: Partial<ResourceRecord> = {}): ResourceRecord {
  return {
    id: overrides.id ?? "resource-1",
    code: overrides.code ?? "IMP-0001",
    description: overrides.description ?? "Arena gruesa",
    category: overrides.category ?? "MATERIAL",
    unit: overrides.unit ?? "und",
    unitPrice: overrides.unitPrice ?? 65,
    currency: overrides.currency ?? "PEN",
    iu: overrides.iu ?? null,
    iuCurrent: overrides.iuCurrent ?? null,
    iuCurrentReviewStatus: overrides.iuCurrentReviewStatus ?? null,
    source: overrides.source ?? "mcp-import",
    subcategory: overrides.subcategory ?? null,
    companyId: overrides.companyId ?? "company-1",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

afterEach(async () => {
  unmountSpy.mockReset();

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

describe("ResourcesPageContent", () => {
  it("updates resources without remounting the table", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    await act(async () => {
      root.render(
        <ResourcesPageContent
          companyId="company-1"
          resources={[makeResource()]}
          unifiedIndexDictionaryRows={[]}
          unifiedIndexRows={[]}
        />,
      );
    });
    const firstMarker = container.querySelector("[data-testid='resources-table']")?.getAttribute("data-marker");

    await act(async () => {
      root.render(
        <ResourcesPageContent
          companyId="company-1"
          resources={[makeResource({ description: "Arena gruesa importada" })]}
          unifiedIndexDictionaryRows={[]}
          unifiedIndexRows={[]}
        />,
      );
    });

    expect(container.textContent).toContain("Arena gruesa importada");
    expect(container.querySelector("[data-testid='resources-table']")?.getAttribute("data-marker")).toBe(firstMarker);
    expect(unmountSpy).not.toHaveBeenCalled();
  });
});
