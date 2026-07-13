/* @vitest-environment jsdom */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentChatPanel } from "@/components/ai/agent/AgentChatPanel";
import type { BundleSlug } from "@/components/ai/agent/BundleConfig";

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

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.ComponentPropsWithoutRef<"textarea">) => (
    <textarea data-testid="ui-textarea" {...props} />
  ),
}));

vi.mock("@/components/khipu/KhipuSymbol", () => ({
  KhipuSymbol: () => <span data-testid="khipu-symbol">MC</span>,
}));

vi.mock("@/lib/ai/formatting", () => ({
  formatAiText: (text: string) => text,
}));

vi.mock("@/components/ai/AIMessage", () => ({
  renderMarkdownLite: (text: string) => <span>{text}</span>,
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left">←</span>,
  CheckCircle2: () => <span data-testid="icon-check">✓</span>,
  XCircle: () => <span data-testid="icon-x">✗</span>,
  Send: () => <span data-testid="icon-send">→</span>,
  Loader2: () => <span data-testid="icon-loader">⟳</span>,
}));

// Mock BundleConfig
vi.mock("./BundleConfig", () => ({
  BUNDLE_CONFIG: [
    {
      slug: "asistente-general",
      bundleSlug: "khipu-agent",
      name: "Asistente General",
      description: "Acceso completo a herramientas",
      icon: () => <span data-testid="icon-general">★</span>,
      color: "from-blue-500 to-blue-600",
      bgLight: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      slug: "crear-presupuesto-base",
      bundleSlug: "budget-agent",
      name: "Presupuestos",
      description: "Crear y gestionar presupuestos",
      icon: () => <span data-testid="icon-budgets">$</span>,
      color: "from-emerald-500 to-emerald-600",
      bgLight: "bg-emerald-50",
      textColor: "text-emerald-700",
    },
  ] as const,
  BUNDLE_SLUG_LABELS: {
    "khipu-agent": "General",
    "budget-agent": "Presupuestos",
  } as Record<string, string>,
  BUNDLE_SUGGESTIONS: {
    "asistente-general": ["Sugerencia General A", "Sugerencia General B"],
    "crear-presupuesto-base": ["Crear presupuesto para hospital", "Clonar presupuesto"],
  } as Record<string, string[]>,
}));

// Mock BundleSelector
vi.mock("./BundleSelector", () => ({
  BundleSelector: ({ onSelect }: { selected: BundleSlug | null; onSelect: (slug: BundleSlug) => void }) => (
    <div data-testid="bundle-selector">
      <button data-testid="select-general" onClick={() => onSelect("asistente-general")}>
        Select General
      </button>
      <button data-testid="select-budgets" onClick={() => onSelect("crear-presupuesto-base")}>
        Select Presupuestos
      </button>
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDefaultProps(overrides = {}) {
  return {
    objective: "",
    setObjective: vi.fn(),
    onObjectiveSubmit: vi.fn(),
    messages: [] as Array<{ role: "user" | "assistant" | "system"; content: string }>,
    streaming: false,
    loading: false,
    selectedBundleSlug: null as BundleSlug | null,
    onSelectBundle: vi.fn(),
    onClearBundle: vi.fn(),
    showConfirmation: false,
    fallbackChatMessage: null as string | null,
    onConfirmProceed: vi.fn(),
    onCancelProceed: vi.fn(),
    showPostCreateConfirmation: false,
    onPostCreateConfirm: vi.fn(),
    onPostCreateCancel: vi.fn(),
    ...overrides,
  };
}

describe("AgentChatPanel", () => {
  beforeEach(() => {
    // jsdom doesn't support scrollIntoView — stub it
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  it("renders the Khipu Agente header when no bundle selected", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    expect(screen.getByText(/Khipu Agente/)).toBeTruthy();
    expect(screen.getByText("Asistente técnico de obra")).toBeTruthy();
  });

  it("renders the BundleSelector when no messages and no bundle", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    expect(screen.getByTestId("bundle-selector")).toBeTruthy();
  });

  it("does NOT render BundleSelector when messages exist", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          messages: [{ role: "user", content: "Hola" }],
        })}
      />,
    );

    expect(screen.queryByTestId("bundle-selector")).toBeNull();
    expect(screen.getByText("Hola")).toBeTruthy();
  });

  // ─── Bundle selection ─────────────────────────────────────────────────────

  it("shows selected bundle name in header", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "crear-presupuesto-base" })}
      />,
    );

    expect(screen.getByText(/Khipu Presupuestos/)).toBeTruthy();
  });

  it("shows bundle badge with label", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "crear-presupuesto-base" })}
      />,
    );

    expect(screen.getByText("Presupuestos")).toBeTruthy();
  });

  it("shows clear-bundle button when bundle is selected", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "asistente-general" })}
      />,
    );

    expect(screen.getByLabelText("Cambiar especialidad")).toBeTruthy();
  });

  it("calls onClearBundle when clear button is clicked", async () => {
    const onClearBundle = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          selectedBundleSlug: "asistente-general",
          onClearBundle,
        })}
      />,
    );

    await userEvent.click(screen.getByLabelText("Cambiar especialidad"));
    expect(onClearBundle).toHaveBeenCalledTimes(1);
  });

  // ─── Messages ─────────────────────────────────────────────────────────────

  it("renders user messages", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          messages: [{ role: "user", content: "Crea un presupuesto" }],
        })}
      />,
    );

    expect(screen.getByText("Crea un presupuesto")).toBeTruthy();
  });

  it("renders assistant messages", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          messages: [{ role: "assistant", content: "Presupuesto creado con éxito." }],
        })}
      />,
    );

    expect(screen.getByText("Presupuesto creado con éxito.")).toBeTruthy();
  });

  it("renders system messages", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          messages: [{ role: "system", content: "Se requiere aprobación." }],
        })}
      />,
    );

    expect(screen.getByText("Se requiere aprobación.")).toBeTruthy();
  });

  it("shows streaming indicator when streaming", () => {
    render(<AgentChatPanel {...makeDefaultProps({ streaming: true })} />);

    expect(screen.getByText("Khipu está trabajando...")).toBeTruthy();
  });

  it("calls scrollIntoView when messages change", () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");

    const { rerender } = render(<AgentChatPanel {...makeDefaultProps()} />);

    // Initial render with no messages — scrollIntoView NOT called
    expect(spy).not.toHaveBeenCalled();

    // Add messages
    rerender(
      <AgentChatPanel
        {...makeDefaultProps({ messages: [{ role: "user", content: "Hola" }] })}
      />,
    );

    // scrollIntoView should be called
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // ─── Input ────────────────────────────────────────────────────────────────

  it("renders a textarea for objective input", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    const textareas = screen.getAllByTestId("ui-textarea");
    expect(textareas.length).toBeGreaterThan(0);
  });

  it("has placeholder text without bundle", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    const textarea = screen.getByTestId("ui-textarea") as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain("Describe tu objetivo");
  });

  it("has bundle-specific placeholder when bundle selected", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "crear-presupuesto-base" })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea") as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain("presupuestos");
  });

  it("calls onObjectiveSubmit on Enter without shift", () => {
    const onObjectiveSubmit = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          objective: "Hola mundo",
          onObjectiveSubmit,
        })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onObjectiveSubmit).toHaveBeenCalledWith("Hola mundo");
  });

  it("does NOT submit on Enter when objective is empty", () => {
    const onObjectiveSubmit = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          objective: "  ",
          onObjectiveSubmit,
        })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onObjectiveSubmit).not.toHaveBeenCalled();
  });

  it("does NOT submit on Enter when loading", () => {
    const onObjectiveSubmit = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          objective: "Hola",
          loading: true,
          onObjectiveSubmit,
        })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onObjectiveSubmit).not.toHaveBeenCalled();
  });

  it("calls onClearBundle on Escape when bundle selected", () => {
    const onClearBundle = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          selectedBundleSlug: "asistente-general",
          onClearBundle,
        })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onClearBundle).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClearBundle on Escape when no bundle", () => {
    const onClearBundle = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          selectedBundleSlug: null,
          onClearBundle,
        })}
      />,
    );

    const textarea = screen.getByTestId("ui-textarea");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onClearBundle).not.toHaveBeenCalled();
  });

  it("calls onObjectiveSubmit when send button is clicked", async () => {
    const onObjectiveSubmit = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          objective: "Hola",
          onObjectiveSubmit,
        })}
      />,
    );

    await userEvent.click(screen.getByLabelText("Enviar objetivo"));
    expect(onObjectiveSubmit).toHaveBeenCalledWith("Hola");
  });

  it("disables send button when loading", () => {
    render(<AgentChatPanel {...makeDefaultProps({ loading: true })} />);

    const btn = screen.getByLabelText("Enviar objetivo") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("disables send button when objective is empty", () => {
    render(<AgentChatPanel {...makeDefaultProps({ objective: "" })} />);

    const btn = screen.getByLabelText("Enviar objetivo") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // ─── Suggestions (bundle-specific) ────────────────────────────────────────

  it("shows bundle-specific suggestion buttons", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "crear-presupuesto-base" })}
      />,
    );

    expect(screen.getByText("Crear presupuesto para hospital")).toBeTruthy();
    expect(screen.getByText("Clonar presupuesto")).toBeTruthy();
  });

  it("calls onObjectiveSubmit when a suggestion is clicked", async () => {
    const onObjectiveSubmit = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          selectedBundleSlug: "crear-presupuesto-base",
          onObjectiveSubmit,
        })}
      />,
    );

    await userEvent.click(screen.getByText("Crear presupuesto para hospital"));
    expect(onObjectiveSubmit).toHaveBeenCalledWith("Crear presupuesto para hospital");
  });

  // ─── Confirmation buttons ─────────────────────────────────────────────────

  it("shows confirmation buttons when showConfirmation is true", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showConfirmation: true,
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    expect(screen.getByText("¿Generar presupuesto?")).toBeTruthy();
    expect(screen.getByText("Proceder")).toBeTruthy();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("calls onConfirmProceed when Proceder is clicked", async () => {
    const onConfirmProceed = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showConfirmation: true,
          onConfirmProceed,
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    await userEvent.click(screen.getByText("Proceder"));
    expect(onConfirmProceed).toHaveBeenCalledTimes(1);
  });

  it("calls onCancelProceed when Cancelar is clicked", async () => {
    const onCancelProceed = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showConfirmation: true,
          onCancelProceed,
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    await userEvent.click(screen.getByText("Cancelar"));
    expect(onCancelProceed).toHaveBeenCalledTimes(1);
  });

  // ─── Post-createProject confirmation ──────────────────────────────────────

  it("shows post-createProject buttons when showPostCreateConfirmation is true", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showPostCreateConfirmation: true,
          messages: [{ role: "assistant", content: "Proyecto creado" }],
        })}
      />,
    );

    expect(screen.getByText("¿Generar presupuesto para este proyecto?")).toBeTruthy();
    expect(screen.getByText("Sí, generar")).toBeTruthy();
    expect(screen.getByText("No, solo proyecto")).toBeTruthy();
  });

  it("calls onPostCreateConfirm when 'Sí, generar' is clicked", async () => {
    const onPostCreateConfirm = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showPostCreateConfirmation: true,
          onPostCreateConfirm,
          messages: [{ role: "assistant", content: "Proyecto creado" }],
        })}
      />,
    );

    await userEvent.click(screen.getByText("Sí, generar"));
    expect(onPostCreateConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onPostCreateCancel when 'No, solo proyecto' is clicked", async () => {
    const onPostCreateCancel = vi.fn();
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          showPostCreateConfirmation: true,
          onPostCreateCancel,
          messages: [{ role: "assistant", content: "Proyecto creado" }],
        })}
      />,
    );

    await userEvent.click(screen.getByText("No, solo proyecto"));
    expect(onPostCreateCancel).toHaveBeenCalledTimes(1);
  });

  // ─── Fallback message ─────────────────────────────────────────────────────

  it("shows fallback message when provided", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          fallbackChatMessage: "⚠️ Usando fallback directo...",
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    expect(screen.getByText(/Usando fallback directo/)).toBeTruthy();
  });

  it("does NOT show fallback message when null", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          fallbackChatMessage: null,
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    expect(screen.queryByText(/fallback/)).toBeNull();
  });

  // ─── Empty state with bundle ──────────────────────────────────────────────

  it("shows empty state when bundle selected but no messages", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "asistente-general" })}
      />,
    );

    expect(screen.getByText("¿Qué necesitas hacer?")).toBeTruthy();
  });

  it("shows bundle-specific description in empty state", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({ selectedBundleSlug: "crear-presupuesto-base" })}
      />,
    );

    expect(screen.getByText(/Describe tu objetivo para presupuestos/)).toBeTruthy();
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it("has region role on the panel", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    expect(screen.getByRole("region", { name: "Panel de chat de Khipu" })).toBeTruthy();
  });

  it("has aria-live on messages container", () => {
    render(<AgentChatPanel {...makeDefaultProps()} />);

    const messagesContainer = document.querySelector('[aria-live="polite"]');
    expect(messagesContainer).toBeTruthy();
  });

  it("has role alert on fallback message", () => {
    render(
      <AgentChatPanel
        {...makeDefaultProps({
          fallbackChatMessage: "Error",
          messages: [{ role: "assistant", content: "Preview" }],
        })}
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
