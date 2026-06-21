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
  /** When true, entries are initially truncated with individual expand/collapse on click */
  expandable?: boolean;
};

/**
 * Scrollable chat history showing past interactions as user + Khipu bubbles.
 * Newest entries appear at the bottom; the container auto-scrolls down on new entries.
 *
 * In expandable mode, each Khipu response is initially collapsed (showing only a portion)
 * and clicking the entry expands/collapses it individually. The container auto-scrolls
 * to the bottom on mount so the latest response is visible.
 */
export function ChatHistory({
  history,
  maxHeight = "max-h-72",
  onSelect,
  reducedMotion = false,
  truncateLength = 300,
  expandable = false,
}: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(history.length);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (history.length > prevLengthRef.current) {
      const el = bottomRef.current;
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      }
    }
    prevLengthRef.current = history.length;
  }, [history.length, reducedMotion]);

  // In expandable mode, scroll to bottom on mount so the latest response is visible
  useEffect(() => {
    if (expandable && history.length > 0) {
      const el = bottomRef.current;
      if (el && typeof el.scrollIntoView === "function") {
        // Use a microtask to ensure the DOM has rendered
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "auto" });
        });
      }
    }
  }, [expandable, history.length]);

  if (history.length === 0) {
    return null;
  }

  // history is newest-first; reverse so newest appears at bottom
  const chronological = [...history].reverse();

  return (
    <div
      className={cn("overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-slate-50/20 p-3", maxHeight)}
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
                {/* User message bubble */}
                <div className="flex justify-end">
                  <div
                    role="button"
                    tabIndex={0}
                    className="max-w-[82%] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-2xl cursor-pointer"
                    onClick={() => {
                      if (expandable) {
                        setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                      } else {
                        onSelect?.(entry);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (expandable) {
                          setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                        } else {
                          onSelect?.(entry);
                        }
                      }
                    }}
                  >
                    <AIMessage content={entry.summary} tone="user" />
                  </div>
                </div>

                {/* Khipu response bubble */}
                <div
                  role="button"
                  tabIndex={0}
                  className="max-w-[88%] text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-2xl cursor-pointer"
                  onClick={() => {
                    if (expandable) {
                      setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                    } else {
                      onSelect?.(entry);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (expandable) {
                        setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                      } else {
                        onSelect?.(entry);
                      }
                    }
                  }}
                >
                  <div className="space-y-1.5">
                    <AIMessage
                      content={displayText}
                      model={entry.result.model}
                      tone="assistant"
                    />
                    {expandable && needsTruncation && !isExpanded ? (
                      <p className="flex items-center gap-1 px-4 pb-2 text-[11px] font-medium text-blue-600">
                        <ChevronDown className="h-3 w-3" />
                        Ver más
                      </p>
                    ) : null}
                    {expandable && isExpanded ? (
                      <p className="flex items-center gap-1 px-4 pb-2 text-[11px] font-medium text-slate-400">
                        <ChevronDown className="h-3 w-3 rotate-180" />
                        Ver menos
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Timestamp divider */}
                <p className="text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {isLast && isRecent(entry.timestamp) ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-px w-6 bg-slate-200" />
                      Ahora
                      <span className="h-px w-6 bg-slate-200" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-px w-6 bg-slate-200" />
                      {formatTime(entry.timestamp)}
                      <span className="h-px w-6 bg-slate-200" />
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

  return `${text.slice(0, maxLength).trimEnd()}…`;
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
