/* @vitest-environment jsdom */

import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentRightPanel, riskBadge } from "@/components/ai/agent/AgentRightPanel";
import type { AgentToolRisk } from "@/lib/ai/agent/types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<"button"> & { size?: string; variant?: string }) => (
    <button data-testid="ui-button" {...props}>{children}</button>
  ),
  buttonVariants: () => "",
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: React.ComponentPropsWithoutRef<"div">) => (
    <div data-testid="ui-card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: React.ComponentPropsWithoutRef<"div">) => (
    <div data-testid="ui-card-content" className={className}>{children}</div>
  ),
}));

vi.mock("./ExecutionPlanPanel", () => ({
  CardSectionHeader: ({ icon: Icon, label }: { icon: unknown; label: string }) => (
    <div data-testid="card-section-header">{label}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  Building2: () => <span data-testid="icon-building">🏢</span>,
  CheckCircle2: () => <span data-testid="icon-check">✓</span>,
  AlertTriangle: () => <span data-testid="icon-alert">⚠</span>,
  XCircle: () => <span data-testid="icon-x">✗</span>,
  Loader2: () => <span data-testid="icon-loader">⟳</span>,
  ShieldCheck: () => <span data-testid="icon-shield">🛡</span>,
  Wrench: () => <span data-testid="icon-wrench">🔧</span>,
  Activity: () => <span data-testid="icon-activity">▸</span>,
  BrainCircuit: () => <span data-testid="icon-brain">🧠</span>,
  FolderKanban: () => <span data-testid="icon-folder">📁</span>,
  Hash: () => <span data-testid="icon-hash">#</span>,
  Clock: () => <span data-testid="icon-clock">🕐</span>,
}));

// ─── riskBadge tests ────────────────────────────────────────────────────────

describe("riskBadge", () => {
  it("renders 'read' with emerald styling", () => {
    const { container } = render(riskBadge("read"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-emerald-50");
    expect(span?.className).toContain("text-emerald-700");
    expect(container.textContent).toContain("read");
  });

  it("renders 'write' with amber styling", () => {
    const { container } = render(riskBadge("write"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-amber-50");
  });

  it("renders 'financial' with rose styling", () => {
    const { container } = render(riskBadge("financial"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-rose-50");
  });

  it("renders 'export' with purple styling", () => {
    const { container } = render(riskBadge("export"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-purple-50");
  });

  it("renders unknown risk with default muted styling", () => {
    const { container } = render(riskBadge("unknown" as AgentToolRisk));
    const span = container.querySelector("span");
    expect(span?.textContent).toContain("unknown");
  });

  it("uses uppercase text", () => {
    const { container } = render(riskBadge("read"));
    const span = container.querySelector("span");
    expect(span?.className).toContain("uppercase");
  });
});

// ─── AgentRightPanel tests ──────────────────────────────────────────────────

describe("AgentRightPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const defaultProps = {
    streamExecution: {
      state: null as string | null,
      summary: null as string | null,
      pendingApproval: null as {
        approvalId: string;
        toolName: string;
        reason: string;
      } | null,
      toolActivity: [] as Array<{
        toolName: string;
        success: boolean;
        latencyMs?: number;
        summary: string;
      }>,
      warnings: [] as string[],
      latencyMs: null as number | null,
    },
    streaming: false,
    allTools: [] as Array<{ name: string; description: string; risk: AgentToolRisk }>,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    approving: false,
    intent: null as { type: string; confidence: string; reason?: string } | null,
    pendingAction: null as { type: string } | null,
  };

  // ─── Context panel ────────────────────────────────────────────────────────

  it("renders the Contexto section", () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.getByText("Contexto")).toBeTruthy();
  });

  it("shows idle message when no state and not streaming", () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.getByText("Sin contexto activo. Envía un objetivo para comenzar.")).toBeTruthy();
  });

  it("shows workspace name when workspaceId and workspaceName provided", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        workspaceId="ws-1"
        workspaceName="Constructora Perez"
      />,
    );

    expect(screen.getByText("Constructora Perez")).toBeTruthy();
    expect(screen.getByText("Empresa")).toBeTruthy();
  });

  it("does NOT show workspace info without workspaceId", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        workspaceName="Constructora Perez"
      />,
    );

    expect(screen.queryByText("Constructora Perez")).toBeNull();
  });

  it("shows projectId when provided", () => {
    render(<AgentRightPanel {...defaultProps} projectId="project-42" />);

    expect(screen.getByText("project-42")).toBeTruthy();
    expect(screen.getByText("Proyecto")).toBeTruthy();
  });

  it("does NOT show projectId section when not provided", () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.queryByText("Proyecto")).toBeNull();
  });

  it("shows latency when available", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{ ...defaultProps.streamExecution, latencyMs: 2500 }}
      />,
    );

    expect(screen.getByText("2.5s")).toBeTruthy();
  });

  // ─── Tools panel ──────────────────────────────────────────────────────────

  it("shows tools section with count", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        allTools={[
          { name: "searchPartidas", description: "Busca partidas", risk: "read" as AgentToolRisk },
          { name: "createBudget", description: "Crea presupuesto", risk: "write" as AgentToolRisk },
        ]}
      />,
    );

    expect(screen.getByText("Herramientas (2)")).toBeTruthy();
  });

  it("renders tool names in the tools list", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        allTools={[
          { name: "searchPartidas", description: "Busca partidas", risk: "read" as AgentToolRisk },
        ]}
      />,
    );

    expect(screen.getByText("searchPartidas")).toBeTruthy();
  });

  it("renders tool descriptions", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        allTools={[
          { name: "searchPartidas", description: "Busca partidas del catálogo", risk: "read" as AgentToolRisk },
        ]}
      />,
    );

    expect(screen.getByText("Busca partidas del catálogo")).toBeTruthy();
  });

  it("renders risk badges on tools", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        allTools={[
          { name: "deleteBudget", description: "Elimina presupuesto", risk: "financial" as AgentToolRisk },
        ]}
      />,
    );

    expect(screen.getByText("financial")).toBeTruthy();
  });

  // ─── Approvals ────────────────────────────────────────────────────────────

  it('shows "Sin aprobaciones pendientes" when no approval pending', () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.getByText("Sin aprobaciones pendientes.")).toBeTruthy();
  });

  it("shows approve/reject buttons when approval is pending", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{
          ...defaultProps.streamExecution,
          pendingApproval: {
            approvalId: "appr-1",
            toolName: "deleteChapter",
            reason: "Eliminar capítulo del presupuesto",
          },
        }}
      />,
    );

    expect(screen.getByText("Aprobar")).toBeTruthy();
    expect(screen.getByText("Rechazar")).toBeTruthy();
    expect(screen.getByText("deleteChapter")).toBeTruthy();
  });

  it("disables buttons when approving", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        approving
        streamExecution={{
          ...defaultProps.streamExecution,
          pendingApproval: {
            approvalId: "appr-1",
            toolName: "deleteChapter",
            reason: "Eliminar capítulo",
          },
        }}
      />,
    );

    const approveBtn = screen.getByText("Aprobar");
    expect(approveBtn.closest("button")?.disabled).toBe(true);
  });

  it("calls onApprove with approvalId when Aprobar is clicked", async () => {
    const onApprove = vi.fn();
    render(
      <AgentRightPanel
        {...defaultProps}
        onApprove={onApprove}
        streamExecution={{
          ...defaultProps.streamExecution,
          pendingApproval: {
            approvalId: "appr-42",
            toolName: "deleteChapter",
            reason: "Eliminar capítulo",
          },
        }}
      />,
    );

    await userEvent.click(screen.getByText("Aprobar"));

    expect(onApprove).toHaveBeenCalledWith("appr-42");
  });

  it("calls onReject with toolName when Rechazar is clicked", async () => {
    const onReject = vi.fn();
    render(
      <AgentRightPanel
        {...defaultProps}
        onReject={onReject}
        streamExecution={{
          ...defaultProps.streamExecution,
          pendingApproval: {
            approvalId: "appr-42",
            toolName: "deleteChapter",
            reason: "Eliminar capítulo",
          },
        }}
      />,
    );

    await userEvent.click(screen.getByText("Rechazar"));

    expect(onReject).toHaveBeenCalledWith("deleteChapter");
  });

  // ─── Activity timeline ────────────────────────────────────────────────────

  it("shows activity section", () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.getByText("Actividad")).toBeTruthy();
  });

  it("shows activity items when tool activity exists", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{
          ...defaultProps.streamExecution,
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "5 resultados" },
          ],
        }}
      />,
    );

    // Activity appears in both the Activity panel and the tool activity list
    expect(screen.getByText("5 resultados")).toBeTruthy();
  });

  it('shows "Sin actividad registrada" when no activity', () => {
    render(<AgentRightPanel {...defaultProps} />);

    expect(screen.getByText("Sin actividad registrada.")).toBeTruthy();
  });

  // ─── Warnings ─────────────────────────────────────────────────────────────

  it("shows warnings section when warnings exist", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{
          ...defaultProps.streamExecution,
          warnings: ["Precio sospechoso en partida 01.02"],
        }}
      />,
    );

    expect(screen.getByText("Advertencias")).toBeTruthy();
    expect(screen.getByText("Precio sospechoso en partida 01.02")).toBeTruthy();
  });

  it("does not show warnings section when no warnings", () => {
    const { container } = render(<AgentRightPanel {...defaultProps} />);

    expect(container.textContent).not.toContain("Advertencias");
  });

  it("shows warning count in context panel", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{
          ...defaultProps.streamExecution,
          warnings: ["Warning A", "Warning B", "Warning C"],
        }}
      />,
    );

    expect(screen.getByText(/3 advertencias/)).toBeTruthy();
  });

  // ─── Intent ───────────────────────────────────────────────────────────────

  it("shows intent when type is not general_chat", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        intent={{ type: "create_budget", confidence: "0.95", reason: "User asked to create" }}
      />,
    );

    expect(screen.getByText("Intención")).toBeTruthy();
    expect(screen.getByText("create_budget")).toBeTruthy();
    expect(screen.getByText("0.95")).toBeTruthy();
  });

  it("does NOT show intent for general_chat", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        intent={{ type: "general_chat", confidence: "0.80" }}
      />,
    );

    expect(screen.queryByText("Intención")).toBeNull();
  });

  // ─── Pending action ───────────────────────────────────────────────────────

  it("shows pending action when present", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        pendingAction={{ type: "approval_required" }}
      />,
    );

    expect(screen.getByText("Acción pendiente")).toBeTruthy();
    expect(screen.getByText("approval_required")).toBeTruthy();
  });

  // ─── Completed/failed tool counts ─────────────────────────────────────────

  it("shows completed tool count in context section", () => {
    render(
      <AgentRightPanel
        {...defaultProps}
        streamExecution={{
          ...defaultProps.streamExecution,
          toolActivity: [
            { toolName: "a", success: true, latencyMs: 100, summary: "ok" },
            { toolName: "b", success: true, latencyMs: 200, summary: "ok" },
          ],
        }}
      />,
    );

    // Context section is the first card, should reflect completed tool count (2)
    const cards = screen.getAllByTestId("ui-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].textContent).toContain("2");
  });
});
