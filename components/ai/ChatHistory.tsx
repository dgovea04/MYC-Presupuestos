"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AIMessage } from "@/components/ai/AIMessage";
import type { AiHistoryEntry } from "@/components/ai/use-ai-assistant-controller";
import { cn } from "@/lib/utils";

type ChatHistoryProps = {
  history: AiHistoryEntry[];
  maxHeight?: string;
  onSelect?: (entry: AiHistoryEntry) => void;
  reducedMotion?: boolean;
  truncateLength?: number | false;
};

/**
 * Scrollable chat history showing past interactions as user + Khipu bubbles.
 * Newest entries appear at the bottom; the container auto-scrolls down on new entries.
 */
export function ChatHistory({ history, maxHeight = "max-h-72", onSelect, reducedMotion = false, truncateLength = 300 }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(history.length);

  useEffect(() => {
    // Only auto-scroll when new entries are added (not on initial render or removal)
    if (history.length > prevLengthRef.current) {
      const el = bottomRef.current;
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      }
    }
    prevLengthRef.current = history.length;
  }, [history.length, reducedMotion]);

  if (history.length === 0) {
    return null;
  }

  // history is newest-first; reverse so newest appears at bottom
  const chronological = [...history].reverse();

  return (
    <div className={cn("overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-slate-50/20 p-3", maxHeight)}>
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {chronological.map((entry, index) => {
            const isLast = index === chronological.length - 1;

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
                    onClick={() => onSelect?.(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect?.(entry);
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
                  onClick={() => onSelect?.(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(entry);
                    }
                  }}
                >
                  <AIMessage
                    content={truncateLength === false ? entry.result.answer : truncateText(entry.result.answer, truncateLength)}
                    model={entry.result.model}
                    tone="assistant"
                  />
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
