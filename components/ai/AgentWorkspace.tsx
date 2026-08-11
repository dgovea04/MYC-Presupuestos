"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { agentToolMetadata } from "@/lib/ai/agent/tool-metadata";
import type { AgentToolRisk } from "@/lib/ai/agent/types";
import { AgentChatPanel } from "./agent/AgentChatPanel";
import { ExecutionPlanPanel } from "./agent/ExecutionPlanPanel";
import { AgentRightPanel } from "./agent/AgentRightPanel";
import { BUNDLE_CONFIG } from "./agent/BundleConfig";
import type { BundleSlug } from "./agent/BundleConfig";

// ─── Props ───────────────────────────────────────────────────────────────────

type AgentWorkspaceProps = {
  projectId?: string;
  className?: string;
  initialObjective?: string;
  defaultBundleSlug?: BundleSlug;
  workspaceId?: string;
  workspaceName?: string;
};

// ─── localStorage helpers ────────────────────────────────────────────────────

const RIGHT_PANEL_COLLAPSED_KEY = "myc-khipu-agent-right-panel-collapsed";
const CHAT_PANEL_WIDTH_KEY = "myc-khipu-agent-chat-panel-width";
const BUNDLE_SLUG_KEY = "myc-khipu-agent-selected-bundle";
const CHAT_PANEL_MIN_WIDTH = 280;
const CHAT_PANEL_MAX_WIDTH = 520;
const CHAT_PANEL_DEFAULT_WIDTH = 380;

function readStoredBoolean(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try { return window.localStorage.getItem(key) === "true"; } catch { return fallback; }
}

function persistBoolean(key: string, value: boolean) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* best effort */ }
}

function readStoredNumber(key: string, min: number, max: number, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= min && parsed <= max) return parsed;
    }
  } catch { /* best effort */ }
  return fallback;
}

function persistNumber(key: string, value: number) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* best effort */ }
}

function readStoredBundleSlug(): BundleSlug | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUNDLE_SLUG_KEY);
    if (raw && BUNDLE_CONFIG.some((b) => b.slug === raw)) return raw as BundleSlug;
  } catch { /* best effort */ }
  return null;
}

function persistBundleSlug(slug: BundleSlug | null) {
  try {
    if (slug) window.localStorage.setItem(BUNDLE_SLUG_KEY, slug);
    else window.localStorage.removeItem(BUNDLE_SLUG_KEY);
  } catch { /* best effort */ }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAvailableTools(): Array<{ name: string; description: string; risk: AgentToolRisk }> {
  return agentToolMetadata.map((t) => ({
    name: t.name,
    description: t.description,
    risk: t.risk,
  }));
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AgentWorkspace({
  projectId,
  className,
  initialObjective = "",
  defaultBundleSlug,
  workspaceId,
  workspaceName,
}: AgentWorkspaceProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [objective, setObjective] = useState(initialObjective);
  const [approving, setApproving] = useState(false);
  const [selectedBundleSlug, setSelectedBundleSlug] = useState<BundleSlug | null>(
    () => defaultBundleSlug ?? readStoredBundleSlug(),
  );

  // ── Fallback ─────────────────────────────────────────────────────────────
  const [fallbackChatMessage, setFallbackChatMessage] = useState<string | null>(null);
  const [fallbackStatus, setFallbackStatus] = useState<"idle" | "executing" | "done" | "failed">("idle");
  const [fallbackActivity, setFallbackActivity] = useState<{
    toolName: string; success: boolean; latencyMs?: number; summary: string;
  } | null>(null);
  const [forcefulCommandSent, setForcefulCommandSent] = useState(false);
  const fallbackTriggeredRef = useRef(false);
  const [postCreateDismissed, setPostCreateDismissed] = useState(false);
  const prevCreateProjectCountRef = useRef(0);

  // ── Panel layout ─────────────────────────────────────────────────────────
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => readStoredBoolean(RIGHT_PANEL_COLLAPSED_KEY));
  const [chatPanelWidth, setChatPanelWidth] = useState(() =>
    readStoredNumber(CHAT_PANEL_WIDTH_KEY, CHAT_PANEL_MIN_WIDTH, CHAT_PANEL_MAX_WIDTH, CHAT_PANEL_DEFAULT_WIDTH),
  );
  const isResizingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Persist layout prefs ─────────────────────────────────────────────────
  useEffect(() => { persistBoolean(RIGHT_PANEL_COLLAPSED_KEY, rightPanelCollapsed); }, [rightPanelCollapsed]);
  useEffect(() => { persistNumber(CHAT_PANEL_WIDTH_KEY, chatPanelWidth); }, [chatPanelWidth]);
  useEffect(() => { persistBundleSlug(selectedBundleSlug); }, [selectedBundleSlug]);

  // Sync CSS variable to document.documentElement before paint to prevent SSR flash
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--chat-width", `${chatPanelWidth}px`);
  }, [chatPanelWidth]);

  // ── Drag-to-resize ───────────────────────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizingRef.current || !gridRef.current) return;
      e.preventDefault();
      const rect = gridRef.current.getBoundingClientRect();
      const newWidth = Math.round(e.clientX - rect.left);
      setChatPanelWidth(Math.min(CHAT_PANEL_MAX_WIDTH, Math.max(CHAT_PANEL_MIN_WIDTH, newWidth)));
    }
    function onMouseUp() {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleResizeStart() {
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // ── Stream hook ──────────────────────────────────────────────────────────
  const {
    status,
    messages,
    execution: streamExec,
    intent,
    pendingAction,
    connect,
    disconnect,
  } = useAgentStream();

  const loading = status === "connecting";
  const streaming = status === "streaming";



  // ── Derived state ────────────────────────────────────────────────────────
  const showConfirmation =
    !streaming && status === "done" && fallbackStatus === "idle" &&
    streamExec.toolActivity.length > 0 &&
    streamExec.toolActivity.some((a) => a.toolName === "previewBudgetGeneration" && a.success === true) &&
    !streamExec.toolActivity.some((a) => a.toolName === "generateBudget");

  const showPostCreateConfirmation =
    !streaming && status === "done" && fallbackStatus === "idle" &&
    !postCreateDismissed &&
    streamExec.toolActivity.length > 0 &&
    streamExec.toolActivity.some((a) => a.toolName === "createProject" && a.success === true) &&
    !streamExec.toolActivity.some((a) => a.toolName === "previewBudgetGeneration") &&
    !streamExec.toolActivity.some((a) => a.toolName === "generateBudget");

  // ── Bundle selection ─────────────────────────────────────────────────────
  function handleSelectBundle(slug: BundleSlug) {
    setSelectedBundleSlug(slug);
  }

  function handleClearBundle() {
    setSelectedBundleSlug(null);
  }

  // ── Goal submission ──────────────────────────────────────────────────────
  const handleObjectiveSubmit = useCallback((obj: string) => {
    if (!obj.trim() || loading || streaming) return;
    setObjective("");
    connect({
      message: obj.trim(),
      messages: [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: obj.trim() },
      ],
      projectId,
      workspaceId,
      mode: selectedBundleSlug ? "workflow" : "goal",
      workflowId: selectedBundleSlug ?? undefined,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages]);

  // ── Last construction description ────────────────────────────────────────
  const lastConstructionDescription = useMemo(() => {
    const nonConfirmationMsgs = messages.filter(
      (m) =>
        m.role === "user" &&
        !m.content.startsWith("Confirmado") &&
        !m.content.startsWith("No por ahora") &&
        !m.content.startsWith("¡SÍ") &&
        m.content.length > 30,
    );
    return nonConfirmationMsgs[nonConfirmationMsgs.length - 1]?.content ?? "";
  }, [messages]);

  // ── Fallback logic ───────────────────────────────────────────────────────
  const triggerFallback = useCallback(async () => {
    if (fallbackTriggeredRef.current) return;
    fallbackTriggeredRef.current = true;

    const fallbackStartTime = Date.now();
    setFallbackChatMessage("⚠️ El modelo no ejecutó generateBudget automáticamente. Usando fallback directo...");
    setFallbackStatus("executing");
    setFallbackActivity({ toolName: "generateBudget (fallback)", success: false, summary: "Ejecutando generación directa..." });

    const desc = lastConstructionDescription || "";
    const projId = projectId || "";
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 30000);

    try {
      const response = await fetch("/api/ai/agent/generate-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId, description: desc, workspaceId, templateSource: "auto" }),
        signal: abortController.signal,
      });
      const latencyMs = Date.now() - fallbackStartTime;
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorBody.error || `Error HTTP ${response.status}`);
      }
      const result = await response.json();
      setFallbackStatus("done");
      setFallbackActivity({
        toolName: "generateBudget (fallback)", success: true, latencyMs,
        summary: `✅ Presupuesto generado: ${result.totalItemsAdded} partidas (${result.fromMcp || 0} desde .mcp, ${result.fromTemplates || 0} desde plantillas, ${result.fromCatalog || 0} desde catálogo)`,
      });
    } catch (error) {
      const elapsedMs = Date.now() - fallbackStartTime;
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      setFallbackStatus("failed");
      setFallbackActivity({
        toolName: "generateBudget (fallback)", success: false, latencyMs: elapsedMs,
        summary: isTimeout ? `❌ Fallback falló: La solicitud excedió el tiempo de espera (30s)` : `❌ Fallback falló: ${error instanceof Error ? error.message : "Error desconocido"}`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }, [projectId, workspaceId, lastConstructionDescription]);

  useEffect(() => {
    if (status === "done" && !streaming && showConfirmation && forcefulCommandSent && !fallbackTriggeredRef.current) {
      triggerFallback();
    }
  }, [status, streaming, showConfirmation, forcefulCommandSent, triggerFallback]);

  useEffect(() => {
    if (status === "streaming" || status === "connecting") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallbackChatMessage(null);
      setFallbackStatus("idle");
      setFallbackActivity(null);
      fallbackTriggeredRef.current = false;
      setForcefulCommandSent(false);
    }
  }, [status]);

  useEffect(() => {
    const createProjectCount = streamExec.toolActivity.filter((a) => a.toolName === "createProject" && a.success).length;
    if (createProjectCount > prevCreateProjectCountRef.current) {
      setPostCreateDismissed(false);
    }
    prevCreateProjectCountRef.current = createProjectCount;
  }, [streamExec.toolActivity]);

  // ── Confirmation handlers ────────────────────────────────────────────────
  const handleConfirmProceed = useCallback(() => {
    if (loading || streaming) return;
    let descriptionHint = "";
    if (lastConstructionDescription) {
      const clean = lastConstructionDescription.length > 120 ? lastConstructionDescription.substring(0, 120) + "..." : lastConstructionDescription;
      descriptionHint = ` Descripción: "${clean}".`;
    }
    const forcefulCommand = "¡SÍ! CONFIRMADO. EJECUTA generateBudget AHORA MISMO." + descriptionHint + " SOLO llama la herramienta generateBudget. NO generes texto de respuesta. NO preguntes de nuevo. USA los mismos projectId y description que en previewBudgetGeneration. LLAMA generateBudget INMEDIATAMENTE.";
    setForcefulCommandSent(true);
    setObjective("");
    connect({
      message: forcefulCommand, displayMessage: "Sí confirmado",
      messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: forcefulCommand }],
      projectId, workspaceId, mode: selectedBundleSlug ? "workflow" : "goal", workflowId: selectedBundleSlug ?? undefined, skipMessageAdd: true,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages, lastConstructionDescription]);

  const handleCancelProceed = useCallback(() => {
    if (loading || streaming) return;
    setObjective("");
    connect({
      message: "No por ahora. Cancela la generación del presupuesto.", displayMessage: "No, cancelar",
      messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: "No por ahora. Cancela la generación del presupuesto." }],
      projectId, workspaceId, mode: selectedBundleSlug ? "workflow" : "goal", workflowId: selectedBundleSlug ?? undefined, skipMessageAdd: true,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages]);

  const handlePostCreateConfirm = useCallback(() => {
    if (loading || streaming) return;
    const forcefulCommand = "¡SÍ! CONFIRMADO. Quiero generar el presupuesto para el proyecto recién creado. EJECUTA previewBudgetGeneration AHORA MISMO usando el proyecto que acabas de crear con createProject. NO generes texto de respuesta. NO preguntes de nuevo. LLAMA previewBudgetGeneration INMEDIATAMENTE.";
    setObjective("");
    connect({
      message: forcefulCommand, displayMessage: "Sí, generar presupuesto",
      messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: forcefulCommand }],
      projectId, workspaceId, mode: selectedBundleSlug ? "workflow" : "goal", workflowId: selectedBundleSlug ?? undefined, skipMessageAdd: true,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages]);

  const handlePostCreateCancel = useCallback(() => {
    if (loading || streaming) return;
    setPostCreateDismissed(true);
    setObjective("");
    connect({
      message: "No quiero generar presupuesto ahora. El proyecto vacío es suficiente. Confirma que el proyecto fue creado exitosamente y espera instrucciones.", displayMessage: "No, solo el proyecto",
      messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: "No quiero generar presupuesto ahora. El proyecto vacío es suficiente. Confirma que el proyecto fue creado exitosamente y espera instrucciones." }],
      projectId, workspaceId, mode: selectedBundleSlug ? "workflow" : "goal", workflowId: selectedBundleSlug ?? undefined, skipMessageAdd: true,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages]);

  // ── Approvals ────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (approvalId: string) => {
    setApproving(true);
    try {
      await fetch("/api/ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision: "approve" }),
      });
    } catch { console.error("[AgentWorkspace] Error processing approval"); } finally { setApproving(false); }
  }, []);

  const handleReject = useCallback(async (approvalId: string) => {
    setApproving(true);
    try {
      await fetch("/api/ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision: "reject", reason: "Rechazado por el usuario." }),
      });
      disconnect();
    } catch { console.error("[AgentWorkspace] Error processing rejection"); } finally { setApproving(false); }
  }, [disconnect]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={gridRef}
      className={cn(
        "group/agent relative grid gap-0 border border-[var(--app-border)] rounded-2xl bg-[var(--app-surface)] shadow-sm transition-all duration-300",
        rightPanelCollapsed ? "md:grid-cols-[var(--chat-width)_1fr]" : "md:grid-cols-[var(--chat-width)_1fr_300px]",
        className,
      )}
    >
      {/* Left: Chat + Objective */}
      <div className="relative border-r border-[var(--app-border)]">
        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar ancho del panel de chat"
          tabIndex={0}
          className="group absolute -right-[5px] top-0 z-20 hidden h-full w-[10px] cursor-col-resize items-center justify-center transition-colors hover:bg-blue-500/10 active:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:flex"
          onMouseDown={(e) => { e.preventDefault(); handleResizeStart(); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setChatPanelWidth((w) => Math.max(CHAT_PANEL_MIN_WIDTH, w - 10));
            if (e.key === "ArrowRight") setChatPanelWidth((w) => Math.min(CHAT_PANEL_MAX_WIDTH, w + 10));
          }}
        >
          <GripVertical className="pointer-events-none h-4 w-4 text-[var(--app-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <AgentChatPanel
          objective={objective}
          setObjective={setObjective}
          onObjectiveSubmit={handleObjectiveSubmit}
          messages={messages}
          streaming={streaming}
          loading={loading}
          selectedBundleSlug={selectedBundleSlug}
          onSelectBundle={handleSelectBundle}
          onClearBundle={handleClearBundle}
          showConfirmation={showConfirmation}
          fallbackChatMessage={fallbackChatMessage}
          onConfirmProceed={handleConfirmProceed}
          onCancelProceed={handleCancelProceed}
          showPostCreateConfirmation={showPostCreateConfirmation}
          onPostCreateConfirm={handlePostCreateConfirm}
          onPostCreateCancel={handlePostCreateCancel}
        />
      </div>

      {/* Center: Execution Plan */}
      <div className={cn("border-r border-[var(--app-border)]", rightPanelCollapsed && "md:border-r-0")}>
        <ExecutionPlanPanel
          streaming={streaming}
          streamExecution={streamExec}
          fallbackStatus={fallbackStatus}
          fallbackActivity={fallbackActivity}
        />
      </div>

      {/* Right: Tools + Approvals + Activity */}
      {rightPanelCollapsed && (
        <button
          type="button"
          className="absolute right-0 top-4 z-10 flex h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-md transition-all hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] hover:shadow-lg"
          onClick={() => setRightPanelCollapsed(false)}
          aria-label="Mostrar panel lateral"
          title="Mostrar panel lateral"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
      )}
      <div className={cn("relative transition-all duration-300", rightPanelCollapsed && "hidden md:hidden")}>
        <button
          type="button"
          className="absolute left-0 top-4 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-sm transition-all hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] hover:shadow-md"
          onClick={() => setRightPanelCollapsed(true)}
          aria-label="Ocultar panel lateral"
          title="Ocultar panel lateral"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
        <div className="h-full overflow-y-auto">
          <AgentRightPanel
            streamExecution={streamExec}
            streaming={streaming}
            projectId={projectId}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            allTools={getAvailableTools()}
            onApprove={handleApprove}
            onReject={handleReject}
            approving={approving}
            intent={intent}
            pendingAction={pendingAction}
          />
        </div>
      </div>
    </div>
  );
}
