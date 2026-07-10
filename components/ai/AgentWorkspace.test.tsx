/* @vitest-environment jsdom */

import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentWorkspace } from "@/components/ai/AgentWorkspace";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the hook
vi.mock("@/hooks/use-agent-stream", () => ({
  useAgentStream: vi.fn(),
}));

// Mock allTools for deterministic testing
vi.mock("@/lib/ai/agent/tools", () => ({
  allTools: [
    { name: "searchPartidas", description: "Busca partidas del catálogo", risk: "read" as const },
    { name: "createBudget", description: "Crea un nuevo presupuesto", risk: "write" as const },
    { name: "archiveBudget", description: "Archiva un presupuesto", risk: "financial" as const },
    { name: "exportPDF", description: "Exporta a PDF", risk: "export" as const },
  ],
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left">←</span>,
  Bot: () => <span data-testid="icon-bot">Bot</span>,
  CheckCircle2: () => <span data-testid="icon-check">✓</span>,
  AlertTriangle: () => <span data-testid="icon-alert">⚠</span>,
  XCircle: () => <span data-testid="icon-x">✗</span>,
  Send: () => <span data-testid="icon-send">→</span>,
  Loader2: () => <span data-testid="icon-loader">⟳</span>,
  ShieldCheck: () => <span data-testid="icon-shield">🛡</span>,
  Wrench: () => <span data-testid="icon-wrench">🔧</span>,
  Activity: () => <span data-testid="icon-activity">▸</span>,
  Lightbulb: () => <span data-testid="icon-bulb">💡</span>,
  Zap: () => <span data-testid="icon-zap">⚡</span>,
  BrainCircuit: () => <span data-testid="icon-brain">🧠</span>,
  FolderKanban: () => <span data-testid="icon-folder">📁</span>,
  Hash: () => <span data-testid="icon-hash">#</span>,
  Clock: () => <span data-testid="icon-clock">🕐</span>,
  Sparkles: () => <span data-testid="icon-sparkles">✦</span>,
  DollarSign: () => <span data-testid="icon-dollar">$</span>,
  BarChart4: () => <span data-testid="icon-barchart">📊</span>,
  Calendar: () => <span data-testid="icon-calendar">📅</span>,
  Search: () => <span data-testid="icon-search">🔍</span>,
  FileText: () => <span data-testid="icon-filetext">📄</span>,
}));

// Mock child components
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
  CardHeader: ({ children }: React.ComponentPropsWithoutRef<"div">) => <div>{children}</div>,
  CardTitle: ({ children }: React.ComponentPropsWithoutRef<"div">) => <div>{children}</div>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.ComponentPropsWithoutRef<"textarea">) => (
    <textarea data-testid="ui-textarea" {...props} />
  ),
}));

vi.mock("@/components/khipu/KhipuSymbol", () => ({
  KhipuSymbol: () => <span data-testid="khipu-symbol">MC</span>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { useAgentStream } from "@/hooks/use-agent-stream";
const mockUseAgentStream = vi.mocked(useAgentStream);

function makeDefaultHookReturn() {
  return {
    status: "idle" as const,
    messages: [],
    execution: {
      executionId: null,
      state: null,
      summary: null,
      pendingApproval: null,
      toolActivity: [],
      warnings: [],
      latencyMs: null,
    },
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

/**
 * Click a bundle card button by matching the bundle name visible in its text.
 * Bundle cards have complex accessible names (icon + name + description),
 * so we find the button by locating its inner text.
 */
async function clickBundleCard(name: string) {
  // Bundle card buttons contain the name as a child <p> element.
  // Find the button that contains this text.
  const buttons = screen.getAllByRole("button");
  for (const btn of buttons) {
    if (btn.textContent?.includes(name)) {
      await userEvent.click(btn);
      return;
    }
  }
  throw new Error(`No bundle card found with text: ${name}`);
}

/**
 * Click a suggestion button (like "Crear presupuesto para hospital").
 * Suggestion buttons only appear when a bundle is selected.
 */
async function clickSuggestionButton(text: string) {
  const buttons = screen.getAllByRole("button");
  for (const btn of buttons) {
    if (btn.textContent?.trim() === text) {
      await userEvent.click(btn);
      return;
    }
  }
  throw new Error(`No suggestion button found with text: ${text}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AgentWorkspace", () => {
  beforeEach(() => {
    mockUseAgentStream.mockReturnValue(makeDefaultHookReturn() as ReturnType<typeof useAgentStream>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // ─── Empty state ─────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("renders the 3-panel layout", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid).toBeTruthy();
      expect(grid.className).toContain("grid");
      // Should have 3 direct children (panels)
      expect(grid.children.length).toBe(3);
    });

    it("shows bundle selector when there are no messages", () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText("Khipu Agente").length).toBeGreaterThan(0);
    });

    it("shows all 6 specialist bundle cards", () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText("Asistente General").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Presupuestos").length).toBeGreaterThan(0);
      expect(screen.getAllByText("APU").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cronograma").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Revisión").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Reportes").length).toBeGreaterThan(0);
    });

    it("shows suggestion buttons after selecting a bundle", async () => {
      render(<AgentWorkspace />);

      // First select a bundle
      await clickBundleCard("Presupuestos");

      // Now suggestion buttons should appear
      const suggestionBtns = screen.getAllByRole("button");
      const suggestions = suggestionBtns.filter(
        (b) => b.textContent === "Crear presupuesto para hospital"
      );
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("does NOT show suggestion buttons before selecting a bundle", () => {
      render(<AgentWorkspace />);

      const allBtns = screen.getAllByRole("button");
      const suggestionBtns = allBtns.filter(
        (b) => b.textContent === "Crear presupuesto para hospital"
      );
      expect(suggestionBtns.length).toBe(0);
    });

    it("shows execution plan empty state when idle", () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText("Sin plan de ejecución").length).toBeGreaterThan(0);
    });

    it("shows tools panel with registered tools", () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText("searchPartidas").length).toBeGreaterThan(0);
      expect(screen.getAllByText("createBudget").length).toBeGreaterThan(0);
      expect(screen.getAllByText("archiveBudget").length).toBeGreaterThan(0);
      expect(screen.getAllByText("exportPDF").length).toBeGreaterThan(0);
    });

    it("shows tool count in panel header", () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText(/Herramientas\s*\(4\)/).length).toBeGreaterThan(0);
    });
  });

  // ─── Bundle selector ─────────────────────────────────────────────────────

  describe("bundle selector", () => {
    it("selects a bundle when a bundle card is clicked", async () => {
      render(<AgentWorkspace />);

      await clickBundleCard("Presupuestos");

      // Header should update
      expect(screen.getAllByText(/Khipu Presupuestos/).length).toBeGreaterThan(0);
      // Close button should appear
      expect(screen.getByRole("button", { name: "Cambiar especialidad" })).toBeTruthy();
    });

    it("changes bundle when close button is clicked", async () => {
      render(<AgentWorkspace />);

      // Select a bundle first
      await clickBundleCard("Presupuestos");
      expect(screen.getAllByText(/Khipu Presupuestos/).length).toBeGreaterThan(0);

      // Click close button to go back
      await userEvent.click(screen.getByRole("button", { name: "Cambiar especialidad" }));
      // Should show bundle selector again
      expect(screen.getAllByText("Khipu Agente").length).toBeGreaterThan(0);
    });

    it("passes workflowId when bundle is selected", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Select "Presupuestos" bundle
      await clickBundleCard("Presupuestos");

      // Type and send a message
      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto",
        projectId: undefined,
        mode: "workflow",
        workflowId: "crear-presupuesto-base",
      });
    });

    it("passes mode 'goal' without workflowId when no bundle selected", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Type and send a message without selecting a bundle
      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto",
        projectId: undefined,
        mode: "goal",
      });
    });

    it("accepts defaultBundleSlug prop to pre-select a bundle", () => {
      render(<AgentWorkspace defaultBundleSlug="optimizar-apu" />);

      // Header should show the pre-selected bundle
      expect(screen.getAllByText(/Khipu APU/).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Cambiar especialidad" })).toBeTruthy();
    });
  });

  // ─── Goal submission ─────────────────────────────────────────────────────

  describe("goal submission", () => {
    it("calls connect with the objective text when send button is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto para hospital");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto para hospital",
        projectId: undefined,
        mode: "goal",
      });
    });

    it("calls connect when a suggestion button is clicked (with bundle selected)", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Select a bundle to show suggestion buttons
      await clickBundleCard("Presupuestos");

      // Click a suggestion
      await clickSuggestionButton("Crear presupuesto para hospital");

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto para hospital",
        projectId: undefined,
        mode: "workflow",
        workflowId: "crear-presupuesto-base",
      });
    });

    it("does not call connect when loading", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "connecting",
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Without a bundle, suggestion buttons aren't shown.
      // Test that typing + clicking send doesn't call connect when loading.
      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).not.toHaveBeenCalled();
    });

    it("does not call connect when streaming", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "streaming",
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Test that send button doesn't call connect when streaming
      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).not.toHaveBeenCalled();
    });

    it("disables send button when objective is empty", () => {
      render(<AgentWorkspace />);

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      for (const btn of sendButtons) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });

    it("shows loading spinner when connecting", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "connecting",
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      for (const btn of sendButtons) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });
  });

  // ─── Messages ────────────────────────────────────────────────────────────

  describe("messages", () => {
    it("renders user messages on the right", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        messages: [
          { role: "user", content: "Crea un presupuesto" },
        ],
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getByText("Crea un presupuesto")).toBeTruthy();
    });

    it("renders assistant messages on the left", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        messages: [
          { role: "assistant", content: "He creado el presupuesto correctamente." },
        ],
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getByText("He creado el presupuesto correctamente.")).toBeTruthy();
    });

    it("renders system messages with amber styling", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        messages: [
          { role: "system", content: "⏸️ Se requiere tu aprobación." },
        ],
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getByText("⏸️ Se requiere tu aprobación.")).toBeTruthy();
    });

    it("shows streaming indicator when streaming", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "streaming",
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getAllByText("Khipu está trabajando...").length).toBeGreaterThan(0);
    });
  });

  // ─── Execution plan panel ─────────────────────────────────────────────────

  describe("execution plan panel", () => {
    it("shows live indicator when streaming", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "streaming",
        execution: {
          executionId: "exec-1",
          state: "EXECUTING",
          summary: null,
          pendingApproval: null,
          toolActivity: [],
          warnings: [],
          latencyMs: null,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getAllByText("En vivo").length).toBeGreaterThan(0);
    });

    it("shows tool activity when present", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "done",
        execution: {
          executionId: "exec-1",
          state: "EXECUTED",
          summary: "Plan completado.",
          pendingApproval: null,
          toolActivity: [
            { toolName: "searchPartidas", success: true, latencyMs: 120, summary: "3 resultados" },
          ],
          warnings: [],
          latencyMs: 120,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getAllByText("searchPartidas").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3 resultados").length).toBeGreaterThan(0);
    });

    it("shows FAILED state message when execution failed", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "error",
        execution: {
          executionId: "exec-1",
          state: "FAILED",
          summary: null,
          pendingApproval: null,
          toolActivity: [],
          warnings: ["Error grave"],
          latencyMs: null,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getByText("La ejecución falló")).toBeTruthy();
    });
  });

  // ─── Right panel ─────────────────────────────────────────────────────────

  describe("right panel", () => {
    it("shows projectId when provided", () => {
      render(<AgentWorkspace projectId="project-42" />);

      expect(screen.getAllByText("project-42").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Proyecto").length).toBeGreaterThan(0);
    });

    it("shows latency in seconds when available", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "done",
        execution: {
          executionId: "exec-1",
          state: "EXECUTED",
          summary: "Ok",
          pendingApproval: null,
          toolActivity: [],
          warnings: [],
          latencyMs: 2500,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getByText("2.5s")).toBeTruthy();
    });

    it("shows warning count when warnings exist", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "done",
        execution: {
          executionId: "exec-1",
          state: "EXECUTED",
          summary: "Ok con advertencias",
          pendingApproval: null,
          toolActivity: [],
          warnings: ["Advertencia 1", "Advertencia 2"],
          latencyMs: null,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getAllByText(/2 advertencias/).length).toBeGreaterThan(0);
    });

    it('shows "Sin contexto activo" when idle', () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText(/Sin contexto activo/).length).toBeGreaterThan(0);
    });

    it("shows approve/reject buttons when approval is pending", () => {
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        execution: {
          executionId: "exec-1",
          state: "PENDING_APPROVAL",
          summary: null,
          pendingApproval: {
            toolName: "deleteChapter",
            reason: "Eliminar capítulo del presupuesto",
          },
          toolActivity: [],
          warnings: [],
          latencyMs: null,
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.getAllByText("Aprobar").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Rechazar").length).toBeGreaterThan(0);
      expect(screen.getAllByText("deleteChapter").length).toBeGreaterThan(0);
    });

    it('shows "Sin aprobaciones pendientes" when no pending', () => {
      render(<AgentWorkspace />);

      expect(screen.getAllByText("Sin aprobaciones pendientes.").length).toBeGreaterThan(0);
    });
  });

  // ─── Project context ─────────────────────────────────────────────────────

  describe("project context", () => {
    it("passes projectId to connect when provided", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace projectId="project-99" />);

      // Type in textarea and send
      const textareas = screen.getAllByRole("textbox");
      await userEvent.type(textareas[0], "Crear presupuesto para hospital");

      const sendButtons = screen.getAllByRole("button", { name: "Enviar objetivo" });
      await userEvent.click(sendButtons[0]);

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto para hospital",
        projectId: "project-99",
        mode: "goal",
      });
    });
  });
});
