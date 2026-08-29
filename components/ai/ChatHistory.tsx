"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { AIMessage } from "@/components/ai/AIMessage";
import type { AiHistoryEntry } from "@/components/ai/use-ai-assistant-controller";
import { cn } from "@/lib/utils";

type ChatHistoryProps = {
  history: AiHistoryEntry[];
  maxHeight?: string;
  onSelect?: (entry: AiHistoryEntry) => void;
  reducedMotion?: boolean;
  truncateLength?: number | false;
  expandable?: boolean;
  theme?: "light" | "dark";
  feedbackByHistoryId?: Record<string, "APPLIED" | "EDITED" | "DISMISSED">;
};

export function ChatHistory({
  history,
  maxHeight = "max-h-72",
  onSelect,
  reducedMotion = false,
  truncateLength = 300,
  expandable = false,
  theme = "light",
  feedbackByHistoryId = {},
}: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(history.length);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AiHistoryEntry["action"] | "all">("all");
  const isDark = theme === "dark";
  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return history.filter((entry) => {
      const matchesAction = actionFilter === "all" || entry.action === actionFilter;
      const matchesSearch = !normalizedSearch || `${entry.summary} ${entry.result.answer} ${entry.result.provider ?? ""}`.toLocaleLowerCase().includes(normalizedSearch);
      return matchesAction && matchesSearch;
    });
  }, [actionFilter, history, search]);

  useEffect(() => {
    if (history.length > prevLengthRef.current) {
      const element = bottomRef.current;
      if (element && typeof element.scrollIntoView === "function") {
        element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      }
    }
    prevLengthRef.current = history.length;
  }, [history.length, reducedMotion]);

  useEffect(() => {
    if (expandable && history.length > 0) {
      const element = bottomRef.current;
      if (element && typeof element.scrollIntoView === "function") {
        requestAnimationFrame(() => {
          element.scrollIntoView({ behavior: "auto" });
        });
      }
    }
  }, [expandable, history.length]);

  if (history.length === 0) {
    return null;
  }

  const chronological = [...filteredHistory].reverse();

  return (
    <div
      className={cn(
        "overflow-y-auto overscroll-contain rounded-2xl border p-3",
        isDark
          ? "border-[var(--khipu-dark-hairline-strong)] bg-[var(--khipu-dark-canvas-deep)]"
          : "border-slate-100 bg-gradient-to-b from-slate-50/60 to-slate-50/20",
        maxHeight,
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="khipu-history-search">Buscar en el historial</label>
          <input
            id="khipu-history-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en el historial"
            className={cn("min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500", isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900")}
          />
          <label className="sr-only" htmlFor="khipu-history-action-filter">Filtrar por acción</label>
          <select
            id="khipu-history-action-filter"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as AiHistoryEntry["action"] | "all")}
            className={cn("rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500", isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900")}
          >
            <option value="all">Todas las acciones</option>
            <option value="chat">Chat técnico</option>
            <option value="apu">APU</option>
            <option value="review">Revisión</option>
            <option value="autocomplete">Autocompletar</option>
          </select>
        </div>
        {filteredHistory.length === 0 ? <p className={cn("px-2 py-4 text-center text-xs", isDark ? "text-slate-400" : "text-slate-500")}>No hay resultados para estos filtros.</p> : null}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {chronological.map((entry, index) => {
            const isLast = index === chronological.length - 1;
            const isExpanded = expandable && expandedEntryId === entry.id;
            const responseText = entry.result.answer;
            const needsTruncation = truncateLength !== false && responseText.length > truncateLength;
            const displayText =
              truncateLength !== false && (!expandable || !isExpanded)
                ? truncateText(responseText, truncateLength)
                : responseText;

            return (
              <motion.div
                key={entry.id}
                initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-2"
              >
                <div className="flex justify-end">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir consulta: ${entry.summary}`}
                    className="max-w-[82%] cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    onClick={() => {
                      if (expandable) {
                        setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                      } else {
                        onSelect?.(entry);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (expandable) {
                          setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                        } else {
                          onSelect?.(entry);
                        }
                      }
                    }}
                  >
                    <AIMessage content={entry.summary} tone="user" theme={theme} />
                  </div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${expandable ? (isExpanded ? "Contraer" : "Expandir") : "Abrir"} respuesta de Khipu`}
                  aria-expanded={expandable ? isExpanded : undefined}
                  className="w-full max-w-[88%] cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  onClick={() => {
                    if (expandable) {
                      setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                    } else {
                      onSelect?.(entry);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (expandable) {
                        setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                      } else {
                        onSelect?.(entry);
                      }
                    }
                  }}
                >
                  <div className="space-y-1.5">
                    <AIMessage content={displayText} model={entry.result.model} tone="assistant" theme={theme} />
                    {expandable && needsTruncation && !isExpanded ? (
                      <p className={cn("flex items-center gap-1 px-4 pb-2 text-[11px] font-medium", isDark ? "text-blue-300" : "text-blue-600")}>
                        <ChevronDown className="h-3 w-3" />
                        Ver más
                      </p>
                    ) : null}
                    {expandable && isExpanded ? (
                      <p className={cn("flex items-center gap-1 px-4 pb-2 text-[11px] font-medium", isDark ? "text-[var(--khipu-dark-muted)]" : "text-slate-400")}>
                        <ChevronDown className="h-3 w-3 rotate-180" />
                        Ver menos
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <p className={cn("text-center text-[10px] font-medium uppercase tracking-[0.14em]", isDark ? "text-[var(--khipu-dark-muted-soft)]" : "text-slate-400")}>
                    {isLast && isRecent(entry.timestamp) ? (
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-px w-6", isDark ? "bg-[var(--khipu-dark-hairline-strong)]" : "bg-slate-200")} />
                      Ahora
                      <span className={cn("h-px w-6", isDark ? "bg-[var(--khipu-dark-hairline-strong)]" : "bg-slate-200")} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-px w-6", isDark ? "bg-[var(--khipu-dark-hairline-strong)]" : "bg-slate-200")} />
                      {formatTime(entry.timestamp)}
                      <span className={cn("h-px w-6", isDark ? "bg-[var(--khipu-dark-hairline-strong)]" : "bg-slate-200")} />
                    </span>
                    )}
                  </p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", isDark ? "bg-[var(--khipu-dark-surface)] text-[var(--khipu-dark-muted)]" : "bg-slate-100 text-slate-500")}>
                    {readActionLabel(entry.action)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", isDark ? "bg-[var(--khipu-dark-surface)] text-[var(--khipu-dark-muted)]" : "bg-slate-100 text-slate-500")}>
                    {entry.result.provider ?? "Proveedor local"}
                  </span>
                  {feedbackByHistoryId[entry.id] ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", isDark ? "bg-emerald-950 text-emerald-300" : "bg-emerald-50 text-emerald-700")}>
                      {readFeedbackLabel(feedbackByHistoryId[entry.id])}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
      </div>
    </div>
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function readActionLabel(action: AiHistoryEntry["action"]): string {
  const labels: Record<AiHistoryEntry["action"], string> = {
    chat: "Chat técnico",
    apu: "APU",
    review: "Revisión",
    autocomplete: "Autocompletar",
  };
  return labels[action];
}

function readFeedbackLabel(feedback: "APPLIED" | "EDITED" | "DISMISSED"): string {
  const labels = { APPLIED: "Aplicada", EDITED: "Editada", DISMISSED: "Descartada" } satisfies Record<typeof feedback, string>;
  return labels[feedback];
}

function isRecent(timestamp: string): boolean {
  try {
    return Date.now() - new Date(timestamp).getTime() < 60_000;
  } catch {
    return false;
  }
}
