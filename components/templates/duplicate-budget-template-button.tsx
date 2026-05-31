"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DuplicateBudgetTemplateButton({
  templateId,
  templateName,
  templateDescription,
}: {
  templateId: string;
  templateName: string;
  templateDescription: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDuplicate() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/templates/budget/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${templateName} copia`,
          description: templateDescription,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readApiError(payload));
      }

      const duplicatedId = readTemplateId(payload);
      if (!duplicatedId) {
        throw new Error("La plantilla se duplico, pero no se recibio el identificador de la copia");
      }

      router.push(`/templates/budget/${duplicatedId}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo duplicar la plantilla");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={() => void handleDuplicate()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Duplicar
      </Button>
      {error ? <p className="max-w-64 text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  );
}

function readApiError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return "No se pudo duplicar la plantilla";
}

function readTemplateId(payload: unknown) {
  if (payload && typeof payload === "object" && "id" in payload) {
    const id = (payload as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}
