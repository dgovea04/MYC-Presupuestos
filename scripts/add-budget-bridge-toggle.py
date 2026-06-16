import re

path = "components/budget/budget-editor.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add bridge imports after AiEndpointResult import
old_imports = """import type { AiEndpointResult, AiReviewStructuredData } from "@/lib/ai/types";
import { getExportDefinition } from "@/lib/exports/definitions";
import type { NoteTaskRecord } from "@/types/notes";
import type { BudgetTemplateCreationTraceability } from "@/lib/data/activity-events";"""

new_imports = """import type { AiEndpointResult, AiReviewStructuredData } from "@/lib/ai/types";
import {
  onMYCBridgeResponse,
  sendToMYCChatGPTBridge,
  type MYCBridgeResponse,
} from "@/lib/ai/myc-bridge-client";
import { buildBridgeTaskPayload } from "@/lib/ai/task-payloads";
import { readBridgeAiResult } from "@/lib/ai/bridge-parsing";
import { REVIEW_OUTPUT_JSON_SHAPE } from "@/lib/ai/prompts";
import { getExportDefinition } from "@/lib/exports/definitions";
import type { NoteTaskRecord } from "@/types/notes";
import type { BudgetTemplateCreationTraceability } from "@/lib/data/activity-events";"""

assert old_imports in content, "Could not find imports section"
content = content.replace(old_imports, new_imports, 1)

# 2. Add AiProvider type after headerActionMenu type
old_type = """type HeaderActionMenuState = {
  kind: "add" | "more";
  top: number;
  left: number;
  trigger: HTMLElement | null;
};"""

new_type = """type HeaderActionMenuState = {
  kind: "add" | "more";
  top: number;
  left: number;
  trigger: HTMLElement | null;
};

type AiProvider = "ollama" | "chatgpt-bridge";"""

assert old_type in content, "Could not find HeaderActionMenuState type"
content = content.replace(old_type, new_type, 1)

# 3. Add provider state after aiPanel state
old_ai_state = """  const [aiPanel, setAiPanel] = useState<AiBudgetPanelState | null>(null);"""

new_ai_state = """  const [aiPanel, setAiPanel] = useState<AiBudgetPanelState | null>(null);
  const [provider, setProvider] = useState<AiProvider>("ollama");"""

assert old_ai_state in content, "Could not find aiPanel state"
content = content.replace(old_ai_state, new_ai_state, 1)

# 4. Add bridge refs after headerActionMenuRef
old_refs = """  const levelActionMenuRef = useRef<HTMLDivElement | null>(null);
  const itemActionMenuRef = useRef<HTMLDivElement | null>(null);
  const headerActionMenuRef = useRef<HTMLDivElement | null>(null);"""

new_refs = """  const levelActionMenuRef = useRef<HTMLDivElement | null>(null);
  const itemActionMenuRef = useRef<HTMLDivElement | null>(null);
  const headerActionMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingBridgeRequestIdRef = useRef<string | null>(null);
  const pendingBridgeTimeoutRef = useRef<number | null>(null);"""

assert old_refs in content, "Could not find headerActionMenuRef"
content = content.replace(old_refs, new_refs, 1)

# 5. Add bridge useEffect after existing useEffects (before addLevel function)
old_before_addlevel = """  function addLevel(type: BudgetLevelType, parentId?: string | null) {"""

bridge_effect = """  useEffect(() => {
    const unsubscribeResponse = onMYCBridgeResponse((response) => {
      if (response.requestId && pendingBridgeRequestIdRef.current && response.requestId !== pendingBridgeRequestIdRef.current) return;
      clearPendingBridgeTimeoutInternal();
      pendingBridgeRequestIdRef.current = null;
      if (response.error) {
        setAiPanel((current) =>
          current && current.kind === "review" ? { ...current, loading: false, error: response.error! } : current,
        );
        return;
      }
      const nextResult = readBridgeAiResult(response);
      setAiPanel((current) =>
        current && current.kind === "review"
          ? { ...current, result: nextResult, loading: false, error: "" }
          : current,
      );
    });

    return () => {
      unsubscribeResponse();
      clearPendingBridgeTimeoutInternal();
    };
  }, []);

"""

content = content.replace(old_before_addlevel, bridge_effect + old_before_addlevel, 1)

# 6. Add clearPendingBridgeTimeoutInternal and submitBudgetBridgeReview
# Find a good location - after the closeExcelImport function (which is a small function)
# Or better, add it after the runAiBudgetReview function's existing close bracket

# Let me find the runAiBudgetReview function and modify it
old_run_review_start = """  async function runAiBudgetReview() {
    const title = "Revision IA del presupuesto";
    setAiPanel({ kind: "review", title, result: null, loading: true, error: "" });

    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budgetSummary: buildAiBudgetReviewSummary({
            budgetName: summary.name,
            currency: summary.currency,
            items: summary.items,
            totalDirectCost: summary.totals.totalDirectCost,
          }),
          context: {
            project: projectName,
            module: "Editor de presupuesto",
            activeTable: "Presupuesto",
          },
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readAiErrorMessage(payload));
      }

      setAiPanel({ kind: "review", title, result: readAiEndpointResult(payload), loading: false, error: "" });
    } catch (caughtError) {
      setAiPanel({
        kind: "review",
        title,
        result: null,
        loading: false,
        error: caughtError instanceof Error ? caughtError.message : "No se pudo revisar el presupuesto con IA.",
      });
    }
  }"""

new_run_review = """  async function runAiBudgetReview() {
    const title = "Revision IA del presupuesto";
    setAiPanel({ kind: "review", title, result: null, loading: true, error: "" });

    if (provider === "chatgpt-bridge") {
      const budgetSummary = buildAiBudgetReviewSummary({
        budgetName: summary.name,
        currency: summary.currency,
        items: summary.items,
        totalDirectCost: summary.totals.totalDirectCost,
      });
      submitBudgetBridgeReview(budgetSummary);
      return;
    }

    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budgetSummary: buildAiBudgetReviewSummary({
            budgetName: summary.name,
            currency: summary.currency,
            items: summary.items,
            totalDirectCost: summary.totals.totalDirectCost,
          }),
          context: {
            project: projectName,
            module: "Editor de presupuesto",
            activeTable: "Presupuesto",
          },
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readAiErrorMessage(payload));
      }

      setAiPanel({ kind: "review", title, result: readAiEndpointResult(payload), loading: false, error: "" });
    } catch (caughtError) {
      setAiPanel({
        kind: "review",
        title,
        result: null,
        loading: false,
        error: caughtError instanceof Error ? caughtError.message : "No se pudo revisar el presupuesto con IA.",
      });
    }
  }"""

assert old_run_review_start in content, "Could not find runAiBudgetReview function"
content = content.replace(old_run_review_start, new_run_review, 1)

# 7. Add submitBudgetBridgeReview, clearPendingBridgeTimeoutInternal, and buildBudgetBridgePrompt
# Find a good insertion point - after the closeExcelImport function
old_close_excel = """  function closeExcelImport() {
    setExcelImportTarget(null);
    setExcelImportText("");
    setExcelImportFileName("");
    setExcelImportLoading(false);
  }"""

new_functions = """  function closeExcelImport() {
    setExcelImportTarget(null);
    setExcelImportText("");
    setExcelImportFileName("");
    setExcelImportLoading(false);
  }

  function submitBudgetBridgeReview(budgetSummary: string) {
    try {
      const bridgePrompt = buildBudgetBridgePrompt(budgetSummary);
      const requestId = sendToMYCChatGPTBridge(bridgePrompt, {
        source: "myc-presupuestos",
        provider: "chatgpt-bridge",
        action: "review_budget",
      });
      pendingBridgeRequestIdRef.current = requestId;
      clearPendingBridgeTimeoutInternal();
      pendingBridgeTimeoutRef.current = window.setTimeout(() => {
        if (pendingBridgeRequestIdRef.current !== requestId) return;
        pendingBridgeRequestIdRef.current = null;
        setAiPanel((current) =>
          current && current.kind === "review"
            ? { ...current, loading: false, error: "ChatGPT Bridge no devolvi\u00f3 respuesta. Verifica que la extensi\u00f3n est\u00e9 cargada." }
            : current,
        );
      }, 600000);
    } catch (caughtError) {
      setAiPanel({
        kind: "review",
        title: "Revision IA del presupuesto",
        result: null,
        loading: false,
        error: caughtError instanceof Error ? caughtError.message : "No se pudo enviar la solicitud a ChatGPT Bridge.",
      });
    }
  }

  function clearPendingBridgeTimeoutInternal() {
    if (pendingBridgeTimeoutRef.current) {
      window.clearTimeout(pendingBridgeTimeoutRef.current);
      pendingBridgeTimeoutRef.current = null;
    }
  }

  function buildBudgetBridgePrompt(budgetSummary: string): Record<string, unknown> {
    const taskPayload = buildBridgeTaskPayload({
      action: "review",
      payload: {
        budgetSummary,
        context: {
          project: projectName,
          module: "Editor de presupuesto",
          activeTable: "Presupuesto",
        },
      },
    });
    return {
      ...taskPayload,
      output: {
        ...taskPayload.output,
        shape: REVIEW_OUTPUT_JSON_SHAPE,
      },
    };
  }"""

assert old_close_excel in content, "Could not find closeExcelImport function"
content = content.replace(old_close_excel, new_functions, 1)

# 8. Add provider toggle UI in the header toolbar near the "Revisar Presupuesto" button
# Find the Revisar Presupuesto button and add the toggle before it
old_review_button = """                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runAiBudgetReview()}
                  className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)]"
                >
                  <BotMessageSquare className="mr-2 h-4 w-4" />
                  Revisar Presupuesto
                </Button>"""

new_review_button = """                <div className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 p-0.5 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.24)]">
                  <button
                    type="button"
                    onClick={() => setProvider("ollama")}
                    aria-pressed={provider === "ollama"}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                      provider === "ollama" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    Ollama
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider("chatgpt-bridge")}
                    aria-pressed={provider === "chatgpt-bridge"}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                      provider === "chatgpt-bridge" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    ChatGPT
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runAiBudgetReview()}
                  className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)]"
                >
                  <BotMessageSquare className="mr-2 h-4 w-4" />
                  Revisar Presupuesto
                </Button>"""

assert old_review_button in content, "Could not find Revisar Presupuesto button"
content = content.replace(old_review_button, new_review_button, 1)

# 9. Update AiBudgetActionDialog to show provider name in loading message
old_loading = """          {panel.loading ? <p className="mt-4 shrink-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">Consultando Ollama local...</p> : null}"""

new_loading = """          {panel.loading ? <p className="mt-4 shrink-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">Consultando {panel.kind === "review" ? "Ollama" : "IA"}...</p> : null}"""

# Actually, the AiBudgetActionDialog doesn't have access to the `provider` state since it's a separate function component.
# I need to pass it as a prop or use a different approach.
# Let me update the AiBudgetActionDialog to accept a provider prop

# First, let me find the AiBudgetActionDialog definition
old_dialog_props = """function AiBudgetActionDialog({
  panel,
  onClose,
  onApplyAutocomplete,
}: {
  panel: AiBudgetPanelState;
  onClose: () => void;
  onApplyAutocomplete: () => void;
}) {"""

new_dialog_props = """function AiBudgetActionDialog({
  panel,
  onClose,
  onApplyAutocomplete,
  provider = "ollama",
}: {
  panel: AiBudgetPanelState;
  onClose: () => void;
  onApplyAutocomplete: () => void;
  provider?: AiProvider;
}) {"""

assert old_dialog_props in content, "Could not find AiBudgetActionDialog"
content = content.replace(old_dialog_props, new_dialog_props, 1)

# Update the loading message
old_loading_dialog = """          {panel.loading ? <p className="mt-4 shrink-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">Consultando Ollama local...</p> : null}"""

new_loading_dialog = """          {panel.loading ? <p className="mt-4 shrink-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">{provider === "chatgpt-bridge" ? "Enviando a ChatGPT..." : "Consultando Ollama local..."}</p> : null}"""

assert old_loading_dialog in content, "Could not find loading message in dialog"
content = content.replace(old_loading_dialog, new_loading_dialog, 1)

# Update the AiBudgetActionDialog invocation to pass provider
old_dialog_invoke = """      {aiPanel ? (
        <AiBudgetActionDialog panel={aiPanel} onClose={() => setAiPanel(null)} onApplyAutocomplete={applyAiAutocomplete} />
      ) : null}"""

new_dialog_invoke = """      {aiPanel ? (
        <AiBudgetActionDialog panel={aiPanel} onClose={() => setAiPanel(null)} onApplyAutocomplete={applyAiAutocomplete} provider={provider} />
      ) : null}"""

assert old_dialog_invoke in content, "Could not find AiBudgetActionDialog invocation"
content = content.replace(old_dialog_invoke, new_dialog_invoke, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("All changes applied successfully.")
