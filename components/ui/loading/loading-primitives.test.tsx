/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { SkeletonBlock, SkeletonButton, SkeletonCard, SkeletonIcon, SkeletonText } from "@/components/ui/loading";

describe("loading primitives", () => {
  it("renders decorative skeleton blocks as aria-hidden", () => {
    const { container } = render(<SkeletonBlock className="h-4 w-24" />);

    const block = container.firstElementChild;
    expect(block?.getAttribute("aria-hidden")).toBe("true");
    expect(block?.classList.contains("animate-pulse")).toBe(true);
    expect(block?.classList.contains("h-4")).toBe(true);
    expect(block?.classList.contains("w-24")).toBe(true);
  });

  it("keeps AppSkeletonBlock backwards compatible", () => {
    const { container } = render(<AppSkeletonBlock className="h-6 w-40" />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.classList.contains("h-6")).toBe(true);
    expect(container.firstElementChild?.classList.contains("w-40")).toBe(true);
  });

  it("renders skeleton text lines with configured widths", () => {
    const { container } = render(<SkeletonText lines={2} widths={["w-32", "w-20"]} />);

    const lines = container.querySelectorAll("[aria-hidden='true']");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.classList.contains("w-32")).toBe(true);
    expect(lines[1]?.classList.contains("w-20")).toBe(true);
  });

  it("supports a single width shorthand for repeated text lines", () => {
    const { container } = render(<SkeletonText lines={2} width="w-28" />);

    expect(container.querySelectorAll(".w-28")).toHaveLength(2);
  });

  it("renders a busy skeleton card with an accessible label", () => {
    render(
      <SkeletonCard busyLabel="Cargando configuracion">
        <SkeletonIcon />
        <SkeletonButton />
      </SkeletonCard>,
    );

    const region = screen.getByRole("status", { name: "Cargando configuracion" });
    expect(region.getAttribute("aria-busy")).toBe("true");
  });
});
