/* @vitest-environment jsdom */

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useParams } from "next/navigation";
import { BudgetDetailLoading } from "@/components/loading/budget-detail-loading";

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

describe("BudgetDetailLoading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: "budget-1" });
  });

  it("keeps a neutral layout before the budget kind is resolved", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = render(<BudgetDetailLoading />);

    expect(container.querySelector('[data-skeleton-section="resolving-content"]')).toBeDefined();
    expect(container.querySelector('[data-skeleton-section="overview"]')).toBeNull();
  });

  it("renders the sub budget editor skeleton after resolving SUB_BUDGET", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kind: "SUB_BUDGET" }), { status: 200 }),
    ));

    const { container } = render(<BudgetDetailLoading />);

    await waitFor(() => {
      expect(container.querySelector('[data-skeleton-section="editor-flow"]')).toBeDefined();
    });

    expect(container.querySelector('[data-skeleton-section="overview"]')).toBeNull();
    expect(container.querySelector('[data-skeleton-section="consolidated-table"]')).toBeNull();
  });

  it("renders the general budget skeleton after resolving GENERAL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kind: "GENERAL" }), { status: 200 }),
    ));

    const { container } = render(<BudgetDetailLoading />);

    await waitFor(() => {
      expect(container.querySelector('[data-skeleton-section="overview"]')).toBeDefined();
    });

    expect(container.querySelector('[data-skeleton-section="editor-flow"]')).toBeNull();
    expect(container.querySelector('[data-skeleton-section="consolidated-table"]')).toBeDefined();
  });
});
