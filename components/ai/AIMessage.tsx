"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { cn } from "@/lib/utils";
import { formatAiText } from "@/lib/ai/formatting";

export function AIMessage({
  content,
  model,
  streaming = false,
  tone = "assistant",
}: {
  content: string;
  model?: string;
  streaming?: boolean;
  tone?: "assistant" | "user" | "error";
}) {
  const revealedText = useTypewriter(content, streaming);

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
  };

  const formatted = formatAiText(revealedText);

  return (
    <div className={cn("flex items-start gap-2.5", tone === "user" && "flex-row-reverse")}>
      {tone === "assistant" ? <KhipuSymbol className="mt-0.5 h-6 w-6 shrink-0" /> : null}
      <article
        className={cn(
          "min-w-0 rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
          tone === "assistant" && "border-sky-100 bg-sky-50/70 text-slate-800",
          tone === "user" && "border-slate-200 bg-white text-slate-800",
          tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">{renderMarkdownLite(formatted)}</div>
          {tone !== "error" ? (
            <Button aria-label="Copiar respuesta" className="h-8 shrink-0 px-2" size="sm" variant="ghost" onClick={copyContent}>
              <Clipboard className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {model ? <p className="mt-3 text-xs font-medium text-slate-500">Modelo local: {model}</p> : null}
      </article>
    </div>
  );
}

export function renderMarkdownLite(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block, index) => {
      const trimmed = block.trim();
      const lines = trimmed.split("\n");

      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={`${trimmed}-${index}`} className="text-base font-semibold text-slate-950">
            {renderInlineFormatting(trimmed.replace(/^###\s+/, ""))}
          </h4>
        );
      }

      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={`${trimmed}-${index}`} className="text-lg font-semibold text-slate-950">
            {renderInlineFormatting(trimmed.replace(/^##\s+/, ""))}
          </h3>
        );
      }

      if (isMarkdownTable(lines)) {
        return renderMarkdownTable(lines, index);
      }

      const isBlockquote = lines.every((line) => /^>\s?/.test(line.trim()));

      if (isBlockquote) {
        return (
          <blockquote
            key={`${trimmed}-${index}`}
            className="border-l-4 border-slate-300 pl-4 italic text-slate-600"
          >
            {lines.map((line, lineIndex) => (
              <p key={lineIndex} className={lineIndex > 0 ? "mt-1" : ""}>
                {renderInlineFormatting(line.trim().replace(/^>\s?/, ""))}
              </p>
            ))}
          </blockquote>
        );
      }

      // Horizontal rule: ---, ***, or ___ (3+ chars, optionally space-separated)
      if (lines.length === 1 && /^(\s*[-*_]\s*){3,}$/.test(trimmed)) {
        return <hr key={`${trimmed}-${index}`} className="my-4 border-slate-200" />;
      }

      const isBulletList = lines.every((line) => /^[-*]\s+/.test(line.trim()));
      const isOrderedList = lines.every((line) => /^\d+[.)]\s+/.test(line.trim()));

      if (isBulletList) {
        return (
          <ul key={`${trimmed}-${index}`} className="list-disc space-y-1 pl-5">
            {lines.map((line) => (
              <li key={line}>{renderInlineFormatting(line.replace(/^[-*]\s+/, ""))}</li>
            ))}
          </ul>
        );
      }

      if (isOrderedList) {
        return (
          <ol key={`${trimmed}-${index}`} className="list-decimal space-y-1 pl-5">
            {lines.map((line) => (
              <li key={line}>{renderInlineFormatting(line.replace(/^\d+[.)]\s+/, ""))}</li>
            ))}
          </ol>
        );
      }

      return (
        <p key={`${trimmed}-${index}`} className="whitespace-pre-wrap">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });
}

/**
 * Detects whether a block of lines is a markdown table.
 * Requires: at least 2 lines (header + separator), all lines contain pipes,
 * and the second line is a valid separator (dashes, pipes, colons, spaces only).
 */
/**
 * Typewriter hook — reveals text character by character for a
 * natural streaming feel. When disabled, returns the full text immediately.
 */
function useTypewriter(text: string, enabled: boolean, speedMs = 18): string {
  const [cursor, setCursor] = useState(0);
  const prevTextRef = useRef(text);

  // Reset cursor when text changes completely (new response)
  useEffect(() => {
    if (text !== prevTextRef.current && !text.startsWith(prevTextRef.current)) {
      setCursor(0);
    }
    prevTextRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!enabled) {
      setCursor(text.length);
      return;
    }

    if (cursor >= text.length) return;

    const id = setTimeout(
      () => setCursor((c) => Math.min(c + 1, text.length)),
      speedMs,
    );
    return () => clearTimeout(id);
  }, [cursor, text.length, enabled, speedMs]);

  return enabled ? text.slice(0, cursor) : text;
}

function isMarkdownTable(lines: string[]): boolean {
  if (lines.length < 2) return false;

  const trimmedLines = lines.map((line) => line.trim());

  // All lines must contain a pipe
  if (!trimmedLines.every((line) => line.includes("|"))) return false;

  // Second line must be a separator: only |, -, :, and spaces
  const separator = trimmedLines[1];
  return /^[\s|\-:]+$/.test(separator) && separator.includes("-");
}

/**
 * Parses a markdown table into headers, alignment info, and data rows.
 */
function parseMarkdownTable(lines: string[]): {
  headers: string[];
  alignments: Array<"left" | "center" | "right">;
  rows: string[][];
} {
  const splitRow = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const parseAlignment = (cell: string): "left" | "center" | "right" => {
    const starts = cell.startsWith(":");
    const ends = cell.endsWith(":");
    if (starts && ends) return "center";
    if (ends) return "right";
    return "left";
  };

  const headers = splitRow(lines[0]);
  const alignments = splitRow(lines[1]).map(parseAlignment);

  // Pad alignments to match header count (in case of short separator rows)
  while (alignments.length < headers.length) {
    alignments.push("left");
  }

  const rows = lines.slice(2).map(splitRow);

  return { headers, alignments, rows };
}

const TABLE_ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Renders a markdown table as a styled JSX element.
 */
function renderMarkdownTable(lines: string[], blockIndex: number) {
  const { headers, alignments, rows } = parseMarkdownTable(lines);

  return (
    <div key={`table-${blockIndex}`} className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {headers.map((header, colIndex) => (
              <th
                key={colIndex}
                className={cn(
                  "px-3 py-2 font-semibold text-slate-900",
                  TABLE_ALIGN_CLASS[alignments[colIndex] ?? "left"],
                )}
              >
                {renderInlineFormatting(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "border-b border-slate-100 last:border-b-0",
                rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40",
              )}
            >
              {headers.map((_, colIndex) => (
                <td
                  key={colIndex}
                  className={cn(
                    "px-3 py-2 text-slate-700",
                    TABLE_ALIGN_CLASS[alignments[colIndex] ?? "left"],
                  )}
                >
                  {renderInlineFormatting(row[colIndex] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Processes inline markdown formatting within a single block of text:
 * - **bold** → <strong>
 * - *italic* → <em>
 * - `code` → <code>
 * - [text](url) → <a>
 * - ~~strikethrough~~ → <del>
 *
 * Handles these patterns without a heavy markdown parser.
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Match inline markdown patterns (checked in priority order)
  const parts = text.split(
    /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g,
  );

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) => {
    // **bold**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    // ~~strikethrough~~
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
      return <del key={index}>{part.slice(2, -2)}</del>;
    }
    // `inline code`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="rounded bg-slate-200/70 px-1 py-0.5 text-[0.9em] font-mono text-slate-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    // [text](url)
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const closeBracket = part.indexOf("](");
      const linkText = part.slice(1, closeBracket);
      const linkUrl = part.slice(closeBracket + 2, -1);
      if (linkText && linkUrl) {
        return (
          <a
            key={index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
          >
            {linkText}
          </a>
        );
      }
    }
    // *italic*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
