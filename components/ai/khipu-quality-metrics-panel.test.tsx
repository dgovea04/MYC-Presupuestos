/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KhipuQualityMetricsPanel } from "@/components/ai/khipu-quality-metrics-panel";

describe("KhipuQualityMetricsPanel", () => {
  it("shows a semantic metrics skeleton while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<KhipuQualityMetricsPanel />);

    const loadingRegion = screen.getByRole("status", { name: "Cargando metricas de calidad Khipu" });
    expect(loadingRegion.getAttribute("aria-busy")).toBe("true");
    expect(loadingRegion.querySelector(".animate-spin")).toBeFalsy();
  });
});
