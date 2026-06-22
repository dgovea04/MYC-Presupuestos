"use client";

import { useEffect, useRef, useState } from "react";
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
};

export function ChatHistory({
  history,
  maxHeight = "max-h-72",
  onSelect,
  reducedMotion = false,
  truncateLength = 300,
  expandable = false,
  theme = "light",
}: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(history.length);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const isDark = theme === "dark";

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

  const chronological = [...history].reverse();

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
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
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

function isRecent(timestamp: string): boolean {
  try {
    return Date.now() - new Date(timestamp).getTime() < 60_000;
  } catch {
    return false;
  }
}
