"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyBudgetTemplateLinkButton({ templateId }: { templateId: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copyTemplateLink() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("No se pudo acceder al portapapeles");
      }

      const href = `/templates/budget/${templateId}`;
      const absoluteHref = typeof window === "undefined" ? href : new URL(href, window.location.origin).toString();

      await navigator.clipboard.writeText(absoluteHref);
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setError("No se pudo copiar el enlace");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" className="gap-2" onClick={() => void copyTemplateLink()}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar enlace"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
