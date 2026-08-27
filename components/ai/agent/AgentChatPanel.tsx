"use client";

import { useRef, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { formatAiText } from "@/lib/ai/formatting";
import { renderMarkdownLite } from "@/components/ai/AIMessage";
import { BundleSelector } from "./BundleSelector";
import { BUNDLE_CONFIG, BUNDLE_SLUG_LABELS, BUNDLE_SUGGESTIONS } from "./BundleConfig";
import type { BundleSlug } from "./BundleConfig";

type AgentChatPanelProps = {
  objective: string;
  setObjective: (v: string) => void;
  onObjectiveSubmit: (objective: string) => void;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  streaming: boolean;
  loading: boolean;
  selectedBundleSlug: BundleSlug | null;
  onSelectBundle: (slug: BundleSlug) => void;
  onClearBundle: () => void;
  showConfirmation: boolean;
  fallbackChatMessage?: string | null;
  onConfirmProceed: () => void;
  onCancelProceed: () => void;
  showPostCreateConfirmation: boolean;
  onPostCreateConfirm: () => void;
  onPostCreateCancel: () => void;
};

export function AgentChatPanel({
  objective,
  setObjective,
  onObjectiveSubmit,
  messages,
  streaming,
  loading,
  selectedBundleSlug,
  onSelectBundle,
  onClearBundle,
  showConfirmation,
  fallbackChatMessage,
  onConfirmProceed,
  onCancelProceed,
  showPostCreateConfirmation,
  onPostCreateConfirm,
  onPostCreateCancel,
}: AgentChatPanelProps) {
  const selectedBundle = selectedBundleSlug
    ? BUNDLE_CONFIG.find((b) => b.slug === selectedBundleSlug) ?? null
    : null;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages.length]);

  const suggestions = selectedBundleSlug
    ? (BUNDLE_SUGGESTIONS[selectedBundleSlug] ?? BUNDLE_SUGGESTIONS["asistente-general"])
    : BUNDLE_SUGGESTIONS["asistente-general"];

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (objective.trim() && !loading && !streaming) {
        onObjectiveSubmit(objective.trim());
      }
    }
    if (e.key === "Escape") {
      if (selectedBundle) onClearBundle();
    }
  }

  return (
    <div className="flex h-full flex-col" role="region" aria-label="Panel de chat de Khipu">
      {/* Header */}
      <div className="relative flex items-center gap-4 border-b border-[var(--app-border)] px-6 py-5">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center shadow-sm",
          selectedBundle
            ? `rounded-xl bg-gradient-to-br text-white ${selectedBundle.color}`
            : "overflow-hidden rounded-full bg-transparent",
        )}>
          {selectedBundle ? <selectedBundle.icon className="h-5 w-5" /> : <KhipuSymbol className="h-10 w-10" />}
        </div>
        <div className="flex-1 pr-8">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-display font-bold text-[var(--app-text-strong)]">
              Khipu {selectedBundle ? selectedBundle.name : "Agente"}
            </h2>
            {selectedBundle && (
              <span className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                selectedBundle.bgLight,
                selectedBundle.textColor,
              )}>
                {BUNDLE_SLUG_LABELS[selectedBundle.bundleSlug] ?? selectedBundle.bundleSlug}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            {selectedBundle ? selectedBundle.description : "Asistente técnico de obra"}
          </p>
        </div>
        {selectedBundle && (
          <div className="group absolute right-4 top-4">
            <button
              type="button"
              onClick={onClearBundle}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-bg-strong)] hover:text-[var(--app-text-strong)]"
              aria-label="Cambiar especialidad"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-50 whitespace-nowrap rounded-md bg-[var(--app-surface-inverse)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--app-bg-elevated)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
              Cambiar especialidad
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && !selectedBundle ? (
          <BundleSelector
            selected={null}
            onSelect={onSelectBundle}
          />
        ) : messages.length === 0 && selectedBundle ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className={cn(
              "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
              selectedBundle.bgLight,
            )}>
              <selectedBundle.icon className={cn("h-7 w-7", selectedBundle.textColor)} />
            </div>
            <h3 className="text-lg font-display font-bold text-[var(--app-text-strong)]">
              ¿Qué necesitas hacer?
            </h3>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[var(--app-text-muted)]">
              Describe tu objetivo para {selectedBundle.name.toLowerCase()} o elige una sugerencia rápida
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 py-2 text-xs font-medium"
                  onClick={() => onObjectiveSubmit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role !== "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <KhipuSymbol className="h-7 w-7" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]",
                    msg.role === "system" && "border-amber-200 bg-amber-50 text-amber-800 text-xs",
                  )}
                >
                  {renderMarkdownLite(formatAiText(msg.content))}
                </div>
              </div>
            ))}
            {/* Fallback message when model didn't execute generateBudget */}
            {fallbackChatMessage && (
              <div className="flex justify-start" role="alert">
                <div className="max-w-[80%] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 shadow-sm">
                  <span className="font-semibold">⚠️</span> {fallbackChatMessage}
                </div>
              </div>
            )}
            {/* Confirmation buttons after preview */}
            {showConfirmation && (
              <div className="flex justify-start gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 shadow-sm">
                  <span className="text-xs font-medium text-emerald-800">¿Generar presupuesto?</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={onConfirmProceed}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.97]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Proceder
                    </button>
                    <button
                      type="button"
                      onClick={onCancelProceed}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-muted)] shadow-sm transition-all hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)] active:scale-[0.97]"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Post-createProject budget confirmation buttons */}
            {showPostCreateConfirmation && (
              <div className="flex justify-start gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 shadow-sm">
                  <span className="text-xs font-medium text-blue-800">¿Generar presupuesto para este proyecto?</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={onPostCreateConfirm}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.97]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sí, generar
                    </button>
                    <button
                      type="button"
                      onClick={onPostCreateCancel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-muted)] shadow-sm transition-all hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)] active:scale-[0.97]"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      No, solo proyecto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]" aria-live="polite">
            <Loader2 className="h-3 w-3 animate-spin" />
            Khipu está trabajando...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--app-border)] p-4">
        <div className="relative">
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={selectedBundle
              ? `Describe tu objetivo para ${selectedBundle.name.toLowerCase()}... (Ctrl+Enter para enviar)`
              : "Describe tu objetivo: 'Crea un presupuesto para un hospital de 4 pisos'... (Ctrl+Enter para enviar)"}
            className="min-h-0 pr-12"
            rows={3}
            data-testid="ui-textarea"
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            aria-label="Enviar objetivo"
            disabled={loading || !objective.trim()}
            className={cn(
              "absolute bottom-3 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all",
              loading || !objective.trim()
                ? "cursor-not-allowed bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
                : "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md",
            )}
            onClick={() => {
              if (objective.trim()) onObjectiveSubmit(objective.trim());
            }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
          Enter para enviar · Shift+Enter para nueva línea · Escape para volver
        </p>
      </div>
    </div>
  );
}
