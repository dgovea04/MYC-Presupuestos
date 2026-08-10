/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkeletonChart, SkeletonForm, SkeletonTable, SkeletonToolbar } from "@/components/ui/loading";

afterEach(() => {
  cleanup();
});

describe("semantic loading skeletons", () => {
  it("renders a busy table skeleton with headers and rows", () => {
    render(
      <SkeletonTable
        aria-label="Cargando presupuesto"
        columns={[
          { id: "code", width: "w-20" },
          { id: "description", width: "w-full" },
          { id: "partial", width: "w-24", align: "right" },
        ]}
        rowCount={4}
      />,
    );

    const table = screen.getByRole("table", { name: "Cargando presupuesto" });
    expect(table.getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getAllByRole("row").every((row) => row.className.includes("h-12"))).toBe(true);
  });

  it("keeps compact table skeleton rows aligned to compact table density", () => {
    render(
      <SkeletonTable
        aria-label="Cargando tabla compacta"
        columns={[
          { id: "code", width: "w-20" },
          { id: "description", width: "w-full" },
        ]}
        compact
        rowCount={2}
      />,
    );

    expect(screen.getAllByRole("row").every((row) => row.className.includes("h-10"))).toBe(true);
  });

  it("renders toolbar filters and actions", () => {
    const { container } = render(<SkeletonToolbar search filters={2} actions={2} />);

    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(5);
    expect(container.firstElementChild?.className).toContain("min-h-10");
  });

  it("renders a busy form skeleton", () => {
    const { container } = render(<SkeletonForm aria-label="Cargando ajustes" sections={2} fieldsPerSection={2} />);

    expect(screen.getByRole("status", { name: "Cargando ajustes" }).getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".min-h-\\[190px\\]")).toHaveLength(2);
  });

  it("renders a chart skeleton without a spinner", () => {
    const { container } = render(<SkeletonChart aria-label="Cargando curva S" bars={6} />);

    expect(screen.getByRole("img", { name: "Cargando curva S" }).getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".min-h-\\[320px\\]")).toBeTruthy();
    expect(container.querySelector(".h-60")).toBeTruthy();
  });
});
