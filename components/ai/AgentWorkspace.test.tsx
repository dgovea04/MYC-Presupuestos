/* @vitest-environment jsdom */

import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentWorkspace } from "@/components/ai/AgentWorkspace";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the hook
vi.mock("@/hooks/use-agent-stream", () => ({
  useAgentStream: vi.fn(),
}));

// Mock tool metadata for deterministic testing
vi.mock("@/lib/ai/agent/tool-metadata", () => ({
  agentToolMetadata: [
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
  PanelRightClose: () => <span data-testid="icon-panel-right-close">◀</span>,
  PanelRightOpen: () => <span data-testid="icon-panel-right-open">▶</span>,
  GripVertical: () => <span data-testid="icon-grip-vertical">⋮</span>,
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
    intent: null,
    pendingAction: null,
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
    localStorage.clear();
  });

  // ─── Empty state ─────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("renders the 3-panel layout", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid).toBeTruthy();
      expect(grid.className).toContain("grid");
      // Should have 3 direct children (panels) — left, center, right-wrapper
      expect(grid.children.length).toBeGreaterThanOrEqual(3);
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

      // Now suggestion buttons should appear (bundle-specific)
      const suggestionBtns = screen.getAllByRole("button");
      const suggestions = suggestionBtns.filter(
        (b) => b.textContent === "Crear presupuesto para vivienda de 3 pisos"
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
        messages: [{ role: "user", content: "Crear presupuesto" }],
        projectId: undefined,
        workspaceId: undefined,
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
        messages: [{ role: "user", content: "Crear presupuesto" }],
        projectId: undefined,
        workspaceId: undefined,
        mode: "goal",
        workflowId: undefined,
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
        messages: [{ role: "user", content: "Crear presupuesto para hospital" }],
        projectId: undefined,
        workspaceId: undefined,
        mode: "goal",
        workflowId: undefined,
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

      // Click a suggestion (bundle-specific)
      await clickSuggestionButton("Crear presupuesto para vivienda de 3 pisos");

      expect(connect).toHaveBeenCalledWith({
        message: "Crear presupuesto para vivienda de 3 pisos",
        messages: [{ role: "user", content: "Crear presupuesto para vivienda de 3 pisos" }],
        projectId: undefined,
        workspaceId: undefined,
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
        messages: [{ role: "user", content: "Crear presupuesto para hospital" }],
        projectId: "project-99",
        workspaceId: undefined,
        mode: "goal",
        workflowId: undefined,
      });
    });
  });

  // ─── Fallback directo (cuando el modelo no llama generateBudget) ──────

  describe("fallback directo", () => {
    const confirmedState = {
      ...makeDefaultHookReturn(),
      status: "done" as const,
      messages: [
        { role: "user" as const, content: "genera presupuesto para casa de 120m2 en el proyecto Perez" },
        { role: "assistant" as const, content: "Preview: 77 partidas" },
      ],
      execution: {
        executionId: "exec-1",
        state: "EXECUTED" as const,
        summary: "Vista previa completada",
        pendingApproval: null,
        toolActivity: [
          { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa: 77 partidas" },
        ],
        warnings: [],
        latencyMs: 500,
      },
    };

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it("muestra mensaje de fallback en el chat cuando el modelo no ejecuta generateBudget", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      // Click "Proceder" → esto activa el ref y luego el useEffect de fallback
      await userEvent.click(screen.getByText("Proceder"));

      // El botón de Proceder desaparece inmediatamente
      expect(screen.queryByText("Proceder")).toBeNull();

      // Aparece el mensaje de fallback en el chat
      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });
    });

    it("muestra la actividad de fallback en el panel central de ejecución", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      // El panel central debe mostrar la sección de fallback
      await waitFor(() => {
        expect(screen.getByText(/Fallback — Generación directa/)).toBeTruthy();
      });
      expect(screen.getByText("generateBudget (fallback)")).toBeTruthy();
    });

    it("muestra spinner de carga mientras el fallback se ejecuta", async () => {
      // Mantener la promesa sin resolver para ver el estado "executing"
      let resolvePromise!: (value: unknown) => void;
      globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      // El spinner debe aparecer (Loader2 con animate-spin)
      await waitFor(() => {
        const spinner = document.querySelector('[data-testid="icon-loader"]');
        expect(spinner).toBeTruthy();
      });

      // Resolver la promesa para limpiar
      resolvePromise!({ ok: true, json: async () => ({ totalItemsAdded: 10 }) });
    });

    it("muestra resultado exitoso cuando el fallback completa", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 77,
          fromMcp: 50,
          fromTemplates: 20,
          fromCatalog: 7,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      // Esperar a que el fallback se complete exitosamente
      await waitFor(() => {
        expect(screen.getByText(/Presupuesto generado/)).toBeTruthy();
      });
      const partidasElements = screen.getAllByText(/77 partidas/);
      expect(partidasElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/50 desde .mcp/)).toBeTruthy();
    });

    it("muestra error cuando el fallback falla", async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Error de conexión"));

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Fallback falló/)).toBeTruthy();
      });
      expect(screen.getByText(/Error de conexión/)).toBeTruthy();
    });

    it("muestra error HTTP cuando el endpoint responde con error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "projectId es requerido" }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Fallback falló/)).toBeTruthy();
      });
      expect(screen.getByText(/projectId es requerido/)).toBeTruthy();
    });

    // ── Edge cases: sin projectId ──────────────────────────────────────

    it("muestra error cuando no hay projectId en el componente", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "projectId es requerido" }),
      });

      // Renderizar SIN projectId
      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      // El fallback debe mostrar el error de projectId faltante
      await waitFor(() => {
        expect(screen.getByText(/Fallback falló/)).toBeTruthy();
      });
      expect(screen.getByText(/projectId es requerido/)).toBeTruthy();
    });

    it("fallback envia projectId vacio al API cuando no se provee como prop", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />); // sin projectId

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      // Verificar que fetch fue llamado con projectId vacío y description correcta
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.projectId).toBe("");
      expect(body.description).toContain("genera presupuesto para casa");
    });

    // ── Edge cases: sin lastConstructionDescription ───────────────────────

    it("fallback envia description vacia al API cuando no hay mensajes de usuario", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      // Solo mensajes del asistente, ningún mensaje de usuario
      const noUserMessagesState = {
        ...makeDefaultHookReturn(),
        status: "done" as const,
        messages: [
          { role: "assistant" as const, content: "Aquí tienes la vista previa del presupuesto con 77 partidas." },
        ],
        execution: {
          executionId: "exec-1",
          state: "EXECUTED" as const,
          summary: "Vista previa completada",
          pendingApproval: null,
          toolActivity: [
            { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa: 77 partidas" },
          ],
          warnings: [],
          latencyMs: 500,
        },
      };

      mockUseAgentStream.mockReturnValue(noUserMessagesState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace projectId="project-99" />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      // Verificar que fetch fue llamado con description vacía
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.description).toBe("");
      // projectId sí se envía porque se pasó como prop
      expect(body.projectId).toBe("project-99");
    });

    it("fallback envia description vacia cuando solo hay mensajes cortos (< 30 chars)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      // Mensaje de usuario pero demasiado corto (< 30 chars)
      const shortMessageState = {
        ...makeDefaultHookReturn(),
        status: "done" as const,
        messages: [
          { role: "user" as const, content: "Hola" },
          { role: "assistant" as const, content: "Preview completa con 77 partidas" },
        ],
        execution: {
          executionId: "exec-1",
          state: "EXECUTED" as const,
          summary: "Vista previa completada",
          pendingApproval: null,
          toolActivity: [
            { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa: 77 partidas" },
          ],
          warnings: [],
          latencyMs: 500,
        },
      };

      mockUseAgentStream.mockReturnValue(shortMessageState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace projectId="project-99" />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      // Verificar description vacía en el fetch
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.description).toBe("");
    });

    // ── Edge cases: workspaceId presente sin projectId ────────────────

    it("fallback envia workspaceId al API cuando está presente, aunque falte projectId", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 10,
          fromMcp: 5,
          fromTemplates: 3,
          fromCatalog: 2,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      // Renderizar con workspaceId pero SIN projectId
      render(<AgentWorkspace workspaceId="workspace-42" />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      // workspaceId debe pasarse al API
      expect(body.workspaceId).toBe("workspace-42");
      // projectId vacío porque no se proveyó como prop
      expect(body.projectId).toBe("");
      // description sí está presente (desde los mensajes)
      expect(body.description).toContain("genera presupuesto para casa");
    });

    it("muestra error cuando workspaceId está presente y projectId no, API devuelve 400", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "projectId es requerido" }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace workspaceId="workspace-42" />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Fallback falló/)).toBeTruthy();
      });
      expect(screen.getByText(/projectId es requerido/)).toBeTruthy();
    });

    // ── Edge cases: workspaceId y projectId ambos presentes ──────────────

    it("fallback envia workspaceId y projectId al API cuando ambos están presentes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 77,
          fromMcp: 50,
          fromTemplates: 20,
          fromCatalog: 7,
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace workspaceId="workspace-42" projectId="project-99" />);

      await userEvent.click(screen.getByText("Proceder"));

      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      // Verificar que fetch envía ambos IDs
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.projectId).toBe("project-99");
      expect(body.workspaceId).toBe("workspace-42");
      expect(body.description).toContain("genera presupuesto para casa");
    });

    it("fallback exitoso muestra resultado cuando workspaceId y projectId están presentes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalItemsAdded: 77,
          fromMcp: 50,
          fromTemplates: 20,
          fromCatalog: 7,
          message: "Presupuesto generado exitosamente.",
        }),
      });

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace workspaceId="workspace-42" projectId="project-99" />);

      await userEvent.click(screen.getByText("Proceder"));

      // Verificar resultado exitoso en el panel central
      await waitFor(() => {
        expect(screen.getByText(/Presupuesto generado/)).toBeTruthy();
      });
      const partidasElements = screen.getAllByText(/77 partidas/);
      expect(partidasElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/50 desde .mcp/)).toBeTruthy();
    });

    it("fallback con ambos IDs oculta botones de confirmación durante la ejecución", async () => {
      // Promesa sin resolver para mantener el fallback en ejecución
      let resolvePromise!: (value: unknown) => void;
      globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace workspaceId="workspace-42" projectId="project-99" />);

      await userEvent.click(screen.getByText("Proceder"));

      // Los botones de confirmación deben desaparecer durante el fallback
      await waitFor(() => {
        expect(screen.queryByText("Proceder")).toBeNull();
        expect(screen.queryByText("Cancelar")).toBeNull();
      });

      // El spinner debe estar visible
      const spinner = document.querySelector('[data-testid="icon-loader"]');
      expect(spinner).toBeTruthy();

      // Resolver para limpiar
      resolvePromise!({ ok: true, json: async () => ({ totalItemsAdded: 10 }) });
    });

    // ── Edge cases: concurrencia (doble click en Proceder) ─────────────────

    it("doble click rapido en Proceder solo ejecuta una llamada fetch", async () => {
      // Promesa sin resolver para mantener el fallback en ejecución
      let resolvePromise!: (value: unknown) => void;
      globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Usar fireEvent.click para ambos clics (síncrono) para simular
      // doble click rápido sin re-render intermedio
      const procederBtn = screen.getByText("Proceder");
      fireEvent.click(procederBtn);
      fireEvent.click(procederBtn);

      // Verificar que fetch fue llamado SOLO una vez (guardado por fallbackTriggeredRef)
      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // connect() se llamó al menos 1 vez (dependiendo del batching de React
      // en el entorno jsdom, ambos fireEvent.click pueden ser procesados
      // en el mismo lote y el segundo puede ser absorbido por React)
      expect(connect).toHaveBeenCalledTimes(1);

      // Resolver promesa para limpiar
      resolvePromise!({ ok: true, json: async () => ({ totalItemsAdded: 10 }) });
    });

    it("boton Proceder se oculta durante la ejecucion del fallback", async () => {
      // Promesa sin resolver
      let resolvePromise!: (value: unknown) => void;
      globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      // Click en Proceder una vez
      await userEvent.click(screen.getByText("Proceder"));

      // El botón de Proceder desaparece inmediatamente (showConfirmation incluye fallbackStatus === 'idle')
      await waitFor(() => {
        expect(screen.queryByText("Proceder")).toBeNull();
        expect(screen.queryByText("Cancelar")).toBeNull();
      });

      // Spinner visible
      const spinner = document.querySelector('[data-testid="icon-loader"]');
      expect(spinner).toBeTruthy();

      // fetch fue llamado exactamente una vez
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Resolver promesa
      resolvePromise!({ ok: true, json: async () => ({ totalItemsAdded: 10 }) });
    });

    // ── Edge cases: timeout ────────────────────────────────────────────

    it("muestra mensaje de timeout cuando el fallback excede 30 segundos", async () => {
      // Simular que fetch rechaza con AbortError (como haría AbortController
      // al abortar después del timeout de 30s). No usamos fake timers porque
      // interfieren con waitFor y React act().
      globalThis.fetch = vi.fn().mockRejectedValueOnce(
        new DOMException("The operation was aborted", "AbortError"),
      );

      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      // Click en Proceder
      fireEvent.click(screen.getByText("Proceder"));

      // El fallback arranca (mensaje en el chat)
      await waitFor(() => {
        expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
      });

      // El mensaje específico de timeout debe aparecer
      await waitFor(() => {
        expect(screen.getByText(/excedió el tiempo de espera/)).toBeTruthy();
        expect(screen.getByText(/Fallback falló/)).toBeTruthy();
      });
    });

    it("no activa fallback si el modelo SI ejecutó generateBudget", async () => {
      const successState = {
        ...confirmedState,
        execution: {
          ...confirmedState.execution,
          toolActivity: [
            { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa" },
            { toolName: "generateBudget", success: true, latencyMs: 2000, summary: "Generado" },
          ],
        },
      };

      mockUseAgentStream.mockReturnValue(successState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      // Botón de Proceder no aparece porque generateBudget ya se ejecutó
      expect(screen.queryByText("Proceder")).toBeNull();
      expect(screen.queryByText(/Fallback/)).toBeNull();
    });
  });

  // ─── Confirmation buttons (Proceder / Cancelar) ─────────────────────────

  describe("confirmation buttons", () => {
    const confirmedState = {
      ...makeDefaultHookReturn(),
      status: "done" as const,
      messages: [
        { role: "user" as const, content: "genera presupuesto para casa de 120m2 en el proyecto Perez" },
        { role: "assistant" as const, content: "Preview: 77 partidas" },
      ],
      execution: {
        executionId: "exec-1",
        state: "EXECUTED" as const,
        summary: "Vista previa completada",
        pendingApproval: null,
        toolActivity: [
          { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa: 77 partidas" },
        ],
        warnings: [],
        latencyMs: 500,
      },
    };

    it("does NOT show confirmation buttons when idle (no tool activity)", () => {
      mockUseAgentStream.mockReturnValue(makeDefaultHookReturn() as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto?")).toBeNull();
      expect(screen.queryByText("Proceder")).toBeNull();
      expect(screen.queryByText("Cancelar")).toBeNull();
    });

    it("shows confirmation buttons when previewBudgetGeneration succeeded", () => {
      mockUseAgentStream.mockReturnValue(confirmedState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      expect(screen.getByText("¿Generar presupuesto?")).toBeTruthy();
      expect(screen.getByText("Proceder")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });

    it("does NOT show confirmation buttons when generateBudget already ran", () => {
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        execution: {
          ...confirmedState.execution,
          toolActivity: [
            { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa" },
            { toolName: "generateBudget", success: true, latencyMs: 2000, summary: "Generado" },
          ],
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto?")).toBeNull();
    });

    it("does NOT show confirmation buttons while streaming", () => {
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        status: "streaming",
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto?")).toBeNull();
    });

    it("calls connect with displayMessage and skipMessageAdd when Proceder is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      expect(connect).toHaveBeenCalledTimes(1);
      const callArgs = connect.mock.calls[0][0];

      // Debe incluir el comando interno como message
      expect(callArgs.message).toContain("EJECUTA generateBudget");
      expect(callArgs.message).toContain("Descripción: \"genera presupuesto para casa");

      // Debe mostrar "Sí confirmado" en la UI
      expect(callArgs.displayMessage).toBe("Sí confirmado");

      // No debe agregar el mensaje automaticamente
      expect(callArgs.skipMessageAdd).toBe(true);

      // Debe incluir el comando interno en el messages array
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.role).toBe("user");
      expect(lastMsg.content).toBe(callArgs.message);

      // Debe pasar el projectId (undefined en este caso)
      expect(callArgs.projectId).toBeUndefined();
    });

    it("does NOT call connect when loading and Proceder is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        status: "connecting",
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      // Los botones no se muestran cuando loading, asi que no deberian existir
      expect(screen.queryByText("Proceder")).toBeNull();
      expect(connect).not.toHaveBeenCalled();
    });

    it("calls connect with displayMessage 'No, cancelar' when Cancelar is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...confirmedState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Cancelar"));

      expect(connect).toHaveBeenCalledTimes(1);
      const callArgs = connect.mock.calls[0][0];

      expect(callArgs.displayMessage).toBe("No, cancelar");
      expect(callArgs.message).toBe("No por ahora. Cancela la generación del presupuesto.");
      expect(callArgs.skipMessageAdd).toBe(true);

      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.role).toBe("user");
      expect(lastMsg.content).toBe("No por ahora. Cancela la generación del presupuesto.");
    });

    it("uses last non-confirmation user message as description hint", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "done",
        messages: [
          { role: "user", content: "genera presupuesto para casa de 120m2" },
          { role: "assistant", content: "Preview." },
        ],
        execution: confirmedState.execution,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      const callArgs = connect.mock.calls[0][0];
      expect(callArgs.message).toContain("Descripción: \"genera presupuesto para casa de 120m2\"");
    });

    it("does not include confirmation messages themselves in description hint", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...makeDefaultHookReturn(),
        status: "done",
        messages: [
          { role: "user", content: "genera presupuesto para casa de 120m2" },
          { role: "assistant", content: "Preview." },
          { role: "user", content: "Confirmado. Procede." },
        ],
        execution: confirmedState.execution,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Proceder"));

      const callArgs = connect.mock.calls[0][0];
      // The hint should use the construction message, not the confirmation one
      expect(callArgs.message).toContain("Descripción: \"genera presupuesto para casa de 120m2\"");
      expect(callArgs.message).not.toContain("Confirmado. Procede.");
    });
  });

  // ─── Post-createProject confirmation buttons (Sí, generar / No, solo proyecto) ─

  describe("post-createProject confirmation buttons", () => {
    const postCreateState = {
      ...makeDefaultHookReturn(),
      status: "done" as const,
      messages: [
        { role: "user" as const, content: "Crea proyecto San Felipe" },
        { role: "assistant" as const, content: "Proyecto 'San Felipe' creado exitosamente (ID: cmv5h1234...). ¿Quieres que genere el presupuesto ahora?" },
      ],
      execution: {
        executionId: "exec-1",
        state: "EXECUTED" as const,
        summary: "Proyecto creado exitosamente",
        pendingApproval: null,
        toolActivity: [
          { toolName: "createProject", success: true, latencyMs: 350, summary: "Proyecto \"San Felipe\" creado exitosamente (ID: cmv5h1234...)" },
        ],
        warnings: [],
        latencyMs: 350,
      },
    };

    it("does NOT show post-create buttons when idle (no tool activity)", () => {
      mockUseAgentStream.mockReturnValue(makeDefaultHookReturn() as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
      expect(screen.queryByText("Sí, generar")).toBeNull();
      expect(screen.queryByText("No, solo proyecto")).toBeNull();
    });

    it("shows post-create confirmation buttons when createProject succeeded", () => {
      mockUseAgentStream.mockReturnValue(postCreateState as unknown as ReturnType<typeof useAgentStream>);
      render(<AgentWorkspace />);

      expect(screen.getByText("¿Generar presupuesto para este proyecto?")).toBeTruthy();
      expect(screen.getByText("Sí, generar")).toBeTruthy();
      expect(screen.getByText("No, solo proyecto")).toBeTruthy();
    });

    it("does NOT show post-create buttons when previewBudgetGeneration already ran", () => {
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        execution: {
          ...postCreateState.execution,
          toolActivity: [
            { toolName: "createProject", success: true, latencyMs: 350, summary: "Proyecto creado" },
            { toolName: "previewBudgetGeneration", success: true, latencyMs: 500, summary: "Vista previa" },
          ],
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });

    it("does NOT show post-create buttons when generateBudget already ran", () => {
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        execution: {
          ...postCreateState.execution,
          toolActivity: [
            { toolName: "createProject", success: true, latencyMs: 350, summary: "Proyecto creado" },
            { toolName: "generateBudget", success: true, latencyMs: 2000, summary: "Generado" },
          ],
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });

    it("does NOT show post-create buttons while streaming", () => {
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        status: "streaming",
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });

    it("does NOT show post-create buttons when createProject failed", () => {
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        execution: {
          ...postCreateState.execution,
          toolActivity: [
            { toolName: "createProject", success: false, latencyMs: 350, summary: "Error: nombre requerido" },
          ],
        },
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });

    it("calls connect with displayMessage 'Sí, generar presupuesto' and skipMessageAdd when 'Sí, generar' is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("Sí, generar"));

      expect(connect).toHaveBeenCalledTimes(1);
      const callArgs = connect.mock.calls[0][0];

      // El comando interno debe pedir previewBudgetGeneration
      expect(callArgs.message).toContain("EJECUTA previewBudgetGeneration");
      expect(callArgs.message).toContain("LLAMA previewBudgetGeneration INMEDIATAMENTE");

      // Debe mostrar "Sí, generar presupuesto" en la UI
      expect(callArgs.displayMessage).toBe("Sí, generar presupuesto");

      // No debe agregar el mensaje automáticamente
      expect(callArgs.skipMessageAdd).toBe(true);

      // El messages array debe incluir el comando interno
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.role).toBe("user");
      expect(lastMsg.content).toBe(callArgs.message);
    });

    it("calls connect with displayMessage 'No, solo el proyecto' and skipMessageAdd when 'No, solo proyecto' is clicked", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      render(<AgentWorkspace />);

      await userEvent.click(screen.getByText("No, solo proyecto"));

      expect(connect).toHaveBeenCalledTimes(1);
      const callArgs = connect.mock.calls[0][0];

      expect(callArgs.displayMessage).toBe("No, solo el proyecto");
      expect(callArgs.message).toContain("No quiero generar presupuesto ahora");
      expect(callArgs.message).toContain("El proyecto vacío es suficiente");
      expect(callArgs.skipMessageAdd).toBe(true);

      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.role).toBe("user");
      expect(lastMsg.content).toContain("No quiero generar presupuesto ahora");
    });

    it("hides post-create buttons after 'No, solo proyecto' is clicked (dismissed ref prevents re-appearance)", async () => {
      const connect = vi.fn();
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      const { rerender } = render(<AgentWorkspace />);

      // Los botones aparecen inicialmente
      expect(screen.getByText("Sí, generar")).toBeTruthy();

      // Clic en "No, solo proyecto"
      await userEvent.click(screen.getByText("No, solo proyecto"));

      // Ahora simulamos que el estado cambia: el stream se reinicia
      // y vuelve a "done" (porque el modelo respondió).
      // El dismissed ref debe evitar que los botones reaparezcan.
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      rerender(<AgentWorkspace />);

      // Los botones NO deben reaparecer
      expect(screen.queryByText("Sí, generar")).toBeNull();
      expect(screen.queryByText("No, solo proyecto")).toBeNull();
      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });

    it("dismissed ref persists across stream cycles — buttons stay hidden after No", async () => {
      const connect = vi.fn();

      // Estado inicial: post-create visible
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);

      const { rerender } = render(<AgentWorkspace />);

      expect(screen.getByText("Sí, generar")).toBeTruthy();

      // Clic en "No" → dismissed ref = true
      await userEvent.click(screen.getByText("No, solo proyecto"));

      // Simular nuevo stream (connecting → el useEffect ya NO resetea el ref)
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        status: "connecting",
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);
      rerender(<AgentWorkspace />);

      // Simular que el stream termina de nuevo en "done"
      mockUseAgentStream.mockReturnValue({
        ...postCreateState,
        connect,
      } as unknown as ReturnType<typeof useAgentStream>);
      rerender(<AgentWorkspace />);

      // Los botones NO deben reaparecer porque el dismissed ref persiste
      expect(screen.queryByText("Sí, generar")).toBeNull();
      expect(screen.queryByText("¿Generar presupuesto para este proyecto?")).toBeNull();
    });
  });

  // ─── Resize handle ───────────────────────────────────────────────────────

  describe("resize handle", () => {
    /** Helper: mock getBoundingClientRect on the grid to a known left offset */
    function mockGridRect(grid: HTMLElement, rect: Partial<DOMRect>) {
      const original = grid.getBoundingClientRect;
      grid.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          width: 900,
          height: 600,
          top: 0,
          right: 900,
          bottom: 600,
          left: 0,
          ...rect,
        }) as DOMRect;
      return () => {
        grid.getBoundingClientRect = original;
      };
    }

    it("renders the resize handle with correct ARIA attributes", () => {
      const { container } = render(<AgentWorkspace />);

      const handle = container.querySelector('[role="separator"]');
      expect(handle).toBeTruthy();
      expect(handle!.getAttribute("aria-orientation")).toBe("vertical");
      expect(handle!.getAttribute("aria-label")).toBe("Ajustar ancho del panel de chat");
      expect(handle!.getAttribute("tabindex")).toBe("0");
    });

    it("renders the GripVertical icon inside the handle", () => {
      render(<AgentWorkspace />);

      const icon = screen.getByTestId("icon-grip-vertical");
      expect(icon).toBeTruthy();
    });

    it("uses default width of 380px in the CSS variable", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid.style.getPropertyValue("--chat-width")).toBe("380px");
    });

    it("changes width on mousedown + mousemove drag", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const restore = mockGridRect(grid, { left: 100 });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Start drag
      fireEvent.mouseDown(handle, { clientX: 480 });

      // Move to position 520 (relative to grid left = 100 → newWidth = 520 - 100 = 420)
      fireEvent.mouseMove(document, { clientX: 520 });

      expect(grid.style.getPropertyValue("--chat-width")).toBe("420px");

      restore();
    });

    it("clamps width to minimum 280px when dragging below", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const restore = mockGridRect(grid, { left: 0 });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Start drag
      fireEvent.mouseDown(handle, { clientX: 350 });

      // Drag below minimum
      fireEvent.mouseMove(document, { clientX: 200 });

      expect(grid.style.getPropertyValue("--chat-width")).toBe("280px");

      restore();
    });

    it("clamps width to maximum 520px when dragging above", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const restore = mockGridRect(grid, { left: 0 });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Start drag
      fireEvent.mouseDown(handle, { clientX: 400 });

      // Drag above maximum
      fireEvent.mouseMove(document, { clientX: 700 });

      expect(grid.style.getPropertyValue("--chat-width")).toBe("520px");

      restore();
    });

    it("resets body cursor and userSelect on mouseup after drag", () => {
      const { container } = render(<AgentWorkspace />);

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Start drag
      fireEvent.mouseDown(handle, { clientX: 400 });

      expect(document.body.style.cursor).toBe("col-resize");
      expect(document.body.style.userSelect).toBe("none");

      // End drag
      fireEvent.mouseUp(document);

      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
    });

    it("does not resize when mousemove happens without mousedown", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const restore = mockGridRect(grid, { left: 0 });

      // Move mouse without starting drag
      fireEvent.mouseMove(document, { clientX: 500 });

      // Width should remain at default
      expect(grid.style.getPropertyValue("--chat-width")).toBe("380px");

      restore();
    });

    it("persists width to localStorage after drag", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const restore = mockGridRect(grid, { left: 100 });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      fireEvent.mouseDown(handle, { clientX: 480 });
      fireEvent.mouseMove(document, { clientX: 550 });
      fireEvent.mouseUp(document);

      // Should be 550 - 100 = 450
      expect(grid.style.getPropertyValue("--chat-width")).toBe("450px");
      expect(localStorage.getItem("myc-khipu-agent-chat-panel-width")).toBe("450");

      restore();
    });

    it("reads initial width from localStorage if previously persisted", () => {
      localStorage.setItem("myc-khipu-agent-chat-panel-width", "420");

      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid.style.getPropertyValue("--chat-width")).toBe("420px");
    });

    it("ignores invalid localStorage values and uses default", () => {
      localStorage.setItem("myc-khipu-agent-chat-panel-width", "not-a-number");

      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid.style.getPropertyValue("--chat-width")).toBe("380px");
    });

    it("ignores out-of-range localStorage values and uses default", () => {
      localStorage.setItem("myc-khipu-agent-chat-panel-width", "100");

      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid.style.getPropertyValue("--chat-width")).toBe("380px");
    });

    it("ignores localStorage values above maximum and uses default", () => {
      localStorage.setItem("myc-khipu-agent-chat-panel-width", "600");

      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      expect(grid.style.getPropertyValue("--chat-width")).toBe("380px");
    });

    // ─── Keyboard resize ────────────────────────────────────────────────

    it("decreases width by 10px on ArrowLeft", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      fireEvent.keyDown(handle, { key: "ArrowLeft" });

      expect(grid.style.getPropertyValue("--chat-width")).toBe("370px");
    });

    it("increases width by 10px on ArrowRight", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      fireEvent.keyDown(handle, { key: "ArrowRight" });

      expect(grid.style.getPropertyValue("--chat-width")).toBe("390px");
    });

    it("clamps to min width with multiple ArrowLeft presses", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Press ArrowLeft 20 times (380 - 200 = 180, clamped to 280)
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(handle, { key: "ArrowLeft" });
      }

      expect(grid.style.getPropertyValue("--chat-width")).toBe("280px");
    });

    it("clamps to max width with multiple ArrowRight presses", () => {
      const { container } = render(<AgentWorkspace />);

      const grid = container.firstChild as HTMLElement;
      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      // Press ArrowRight 20 times (380 + 200 = 580, clamped to 520)
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(handle, { key: "ArrowRight" });
      }

      expect(grid.style.getPropertyValue("--chat-width")).toBe("520px");
    });

    it("persists width after keyboard resize", () => {
      const { container } = render(<AgentWorkspace />);

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      fireEvent.keyDown(handle, { key: "ArrowRight" });
      fireEvent.keyDown(handle, { key: "ArrowRight" });

      expect(localStorage.getItem("myc-khipu-agent-chat-panel-width")).toBe("400");
    });
  });
});
