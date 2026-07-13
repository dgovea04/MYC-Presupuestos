/* @vitest-environment jsdom */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionPlanPanel, stateBadge, CardSectionHeader } from "@/components/ai/agent/ExecutionPlanPanel";
import type { AgentExecutionState } from "@/lib/ai/agent/types";
import { Zap } from "lucide-react";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("stateBadge", () => {
  it("renders 'Leyendo' for READ state", () => {
    const { container } = render(stateBadge("READ"));
    expect(container.textContent).toContain("Leyendo");
  });

  it("renders 'Planificando' for PLAN state", () => {
    const { container } = render(stateBadge("PLAN"));
    expect(container.textContent).toContain("Planificando");
  });

  it("renders 'Ejecutando' for EXECUTING state", () => {
    const { container } = render(stateBadge("EXECUTING"));
    expect(container.textContent).toContain("Ejecutando");
  });

  it("renders 'Completado' for EXECUTED state", () => {
    const { container } = render(stateBadge("EXECUTED"));
    expect(container.textContent).toContain("Completado");
  });

  it("renders 'Falló' for FAILED state", () => {
    const { container } = render(stateBadge("FAILED"));
    expect(container.textContent).toContain("Falló");
  });

  it("renders 'Revertido' for ROLLED_BACK state", () => {
    const { container } = render(stateBadge("ROLLED_BACK"));
    expect(container.textContent).toContain("Revertido");
  });

  it("renders the raw state string for unknown states", () => {
    const unknown = "MYSTERY" as AgentExecutionState;
    const { container } = render(stateBadge(unknown));
    expect(container.textContent).toContain("MYSTERY");
  });

  it("uses rounded-full badge styling", () => {
    const { container } = render(stateBadge("READ"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("rounded-full");
  });
});

describe("CardSectionHeader", () => {
  it("renders the label text", () => {
    render(<CardSectionHeader icon={Zap} label="Contexto" />);

    expect(screen.getByText("Contexto")).toBeTruthy();
  });

  it("renders the icon", () => {
    render(<CardSectionHeader icon={Zap} label="Test" />);

    // Zap renders as an SVG element
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("applies optional className", () => {
    const { container } = render(<CardSectionHeader icon={Zap} label="Test" className="extra-class" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("extra-class");
  });
});

describe("ExecutionPlanPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  function makeStreamExecution(overrides = {}) {
    return {
      state: null as AgentExecutionState | null,
      toolActivity: [] as Array<{
        toolName: string;
        success: boolean;
        latencyMs?: number;
        summary: string;
      }>,
      summary: null as string | null,
      ...overrides,
    };
  }

  // ─── Idle state ───────────────────────────────────────────────────────────

  it("shows 'Sin plan de ejecución' when idle", () => {
    render(<ExecutionPlanPanel streaming={false} streamExecution={makeStreamExecution()} />);

    expect(screen.getByText("Sin plan de ejecución")).toBeTruthy();
  });

  it("shows idle state when no state and not streaming", () => {
    render(<ExecutionPlanPanel streaming={false} streamExecution={makeStreamExecution()} />);

    expect(
      screen.getByText("Envía un objetivo en el panel de chat para que Khipu planifique los pasos necesarios."),
    ).toBeTruthy();
  });

  // ─── Streaming state ──────────────────────────────────────────────────────

  it("shows 'En vivo' badge when streaming", () => {
    render(
      <ExecutionPlanPanel
        streaming
        streamExecution={makeStreamExecution({ state: "EXECUTING" })}
      />,
    );

    expect(screen.getByText("En vivo")).toBeTruthy();
  });

  it("shows real-time execution banner when streaming", () => {
    render(
      <ExecutionPlanPanel
        streaming
        streamExecution={makeStreamExecution({ state: "EXECUTING" })}
      />,
    );

    expect(screen.getByText("Ejecución en tiempo real")).toBeTruthy();
  });

  it("shows state badge when state is present", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({ state: "EXECUTED" })}
      />,
    );

    expect(screen.getByText("Completado")).toBeTruthy();
  });

  // ─── Tool activity ────────────────────────────────────────────────────────

  it("shows tool activity count when tools ran", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "Encontradas 5" },
            { toolName: "previewBudget", success: true, latencyMs: 200, summary: "Preview OK" },
          ],
        })}
      />,
    );

    expect(screen.getByText(/Herramientas ejecutadas.*2/)).toBeTruthy();
  });

  it("renders tool names in activity list", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "Encontradas 5" },
          ],
        })}
      />,
    );

    expect(screen.getByText("searchPartidas")).toBeTruthy();
  });

  it("renders tool summaries in activity list", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "Encontradas 5" },
          ],
        })}
      />,
    );

    expect(screen.getByText("Encontradas 5")).toBeTruthy();
  });

  it("shows latency in ms for completed tools", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 350, summary: "OK" },
          ],
        })}
      />,
    );

    expect(screen.getByText("350ms")).toBeTruthy();
  });

  it("shows spinner for tool in progress (no latency)", () => {
    render(
      <ExecutionPlanPanel
        streaming
        streamExecution={makeStreamExecution({
          state: "EXECUTING",
          toolActivity: [
            { toolName: "searchPartidas", success: false, latencyMs: undefined, summary: "Buscando..." },
          ],
        })}
      />,
    );

    // The tool activity row should exist
    expect(screen.getByText("searchPartidas")).toBeTruthy();
    expect(screen.getByText("Buscando...")).toBeTruthy();
  });

  // ─── Fallback activity ────────────────────────────────────────────────────

  it("shows fallback activity when provided", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          toolActivity: [],
        })}
        fallbackStatus="done"
        fallbackActivity={{
          toolName: "generateBudget (fallback)",
          success: true,
          latencyMs: 500,
          summary: "Presupuesto generado: 10 partidas",
        }}
      />,
    );

    expect(screen.getByText("⚠️ Fallback — Generación directa")).toBeTruthy();
    expect(screen.getByText("generateBudget (fallback)")).toBeTruthy();
  });

  // ─── Failed state ─────────────────────────────────────────────────────────

  it("shows failure message when state is FAILED", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({ state: "FAILED" })}
      />,
    );

    expect(screen.getByText("La ejecución falló")).toBeTruthy();
  });

  it("shows completion message when state is EXECUTED with no tools", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({ state: "EXECUTED" })}
      />,
    );

    expect(screen.getByText("Ejecución completada")).toBeTruthy();
  });

  // ─── Summary footer ───────────────────────────────────────────────────────

  it("shows summary footer when summary is present", () => {
    render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          summary: "Todas las operaciones completadas exitosamente.",
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "OK" },
          ],
        })}
      />,
    );

    expect(screen.getByText("Todas las operaciones completadas exitosamente.")).toBeTruthy();
  });

  it("does not show summary footer when summary is null", () => {
    const { container } = render(
      <ExecutionPlanPanel
        streaming={false}
        streamExecution={makeStreamExecution({
          state: "EXECUTED",
          summary: null,
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "OK" },
          ],
        })}
      />,
    );

    // The summary footer should not be present
    const text = container.textContent ?? "";
    expect(text).not.toContain("Todas las operaciones");
  });
});
