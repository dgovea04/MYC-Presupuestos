"use client";

import { Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AIMessage({
  content,
  model,
  tone = "assistant",
}: {
  content: string;
  model?: string;
  tone?: "assistant" | "user" | "error";
}) {
  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <article
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
        tone === "assistant" && "border-sky-100 bg-sky-50/70 text-slate-800",
        tone === "user" && "border-slate-200 bg-white text-slate-800",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">{renderMarkdownLite(content)}</div>
        {tone !== "error" ? (
          <Button aria-label="Copiar respuesta" className="h-8 shrink-0 px-2" size="sm" variant="ghost" onClick={copyContent}>
            <Clipboard className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {model ? <p className="mt-3 text-xs font-medium text-slate-500">Modelo local: {model}</p> : null}
    </article>
  );
}

function renderMarkdownLite(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block, index) => {
      const trimmed = block.trim();

      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={`${trimmed}-${index}`} className="text-base font-semibold text-slate-950">
            {trimmed.replace(/^###\s+/, "")}
          </h4>
        );
      }

      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={`${trimmed}-${index}`} className="text-lg font-semibold text-slate-950">
            {trimmed.replace(/^##\s+/, "")}
          </h3>
        );
      }

      const lines = trimmed.split("\n");
      const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()));

      if (isList) {
        return (
          <ul key={`${trimmed}-${index}`} className="list-disc space-y-1 pl-5">
            {lines.map((line) => (
              <li key={line}>{line.replace(/^[-*]\s+/, "")}</li>
            ))}
          </ul>
        );
      }

      return (
        <p key={`${trimmed}-${index}`} className="whitespace-pre-wrap">
          {trimmed}
        </p>
      );
    });
}
