"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonForm } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { PDF_IMPORT_PROVIDER_OPTIONS, type PdfImportProvider } from "@/types/settings";

type PdfImportSettingsState = {
  provider: PdfImportProvider;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  openrouterConfigured: boolean;
};

const PROVIDERS: Array<{
  value: PdfImportProvider;
  label: string;
  description: string;
  configuredKey: keyof Omit<PdfImportSettingsState, "provider">;
}> = [
  {
    value: "openai",
    label: "OpenAI",
    description: "OCR/visión y estructuración con modelos de OpenAI.",
    configuredKey: "openaiConfigured",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "OCR/visión y estructuración con modelos de Gemini.",
    configuredKey: "geminiConfigured",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Usa el modelo configurado en OpenRouter; debe soportar entrada PDF/visión.",
    configuredKey: "openrouterConfigured",
  },
];

export function PdfImportAiSettingsCard() {
  const [settings, setSettings] = useState<PdfImportSettingsState | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PdfImportProvider>("openai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/settings/ai-provider");
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload)) {
        throw new Error(readError(payload, "No se pudo cargar la configuración del importador PDF."));
      }

      const provider = readPdfImportProvider(payload.pdfImportProvider);
      const nextSettings: PdfImportSettingsState = {
        provider,
        openaiConfigured: payload.openaiConfigured === true,
        geminiConfigured: payload.geminiConfigured === true,
        openrouterConfigured: payload.openrouterConfigured === true,
      };
      setSettings(nextSettings);
      setSelectedProvider(provider);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar la configuración del importador PDF.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadSettings]);

  async function saveProvider() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfImportProvider: selectedProvider }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload)) {
        throw new Error(readError(payload, "No se pudo guardar el proveedor del importador PDF."));
      }

      const provider = readPdfImportProvider(payload.pdfImportProvider);
      setSelectedProvider(provider);
      setSettings({
        provider,
        openaiConfigured: payload.openaiConfigured === true,
        geminiConfigured: payload.geminiConfigured === true,
        openrouterConfigured: payload.openrouterConfigured === true,
      });
      setSuccess("Proveedor del importador PDF guardado correctamente.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo guardar el proveedor del importador PDF.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Importador PDF IA</CardTitle>
              <CardDescription>
                Elige de forma independiente el proveedor que analizará tus presupuestos, APUs y subpartidas PDF.
                Las API keys se configuran arriba en Proveedores Cloud IA.
              </CardDescription>
            </div>
          </div>
          <Button type="button" onClick={() => void saveProvider()} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">{success}</p> : null}

        {loading || !settings ? (
          <SkeletonForm aria-label="Cargando configuración del importador PDF" fieldsPerSection={1} sections={1} />
        ) : (
          <>
            <div className="grid gap-3">
              {PROVIDERS.map((provider) => {
                const isSelected = selectedProvider === provider.value;
                const isConfigured = settings[provider.configuredKey];

                return (
                  <button
                    key={provider.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedProvider(provider.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-[var(--app-primary)]/30 bg-[var(--app-primary-muted)] ring-2 ring-[var(--app-primary)]/10"
                        : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]",
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      isSelected ? "bg-[var(--app-primary)] text-[var(--app-primary-foreground)]" : "bg-[var(--app-bg-strong)] text-[var(--app-text-muted)]",
                    )}>
                      {isSelected ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{provider.label}</p>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          isConfigured ? "theme-status-success theme-status-success-strong" : "theme-status-warning theme-status-warning-strong",
                        )}>
                          {isConfigured ? "API key configurada" : "Configura la API key"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">{provider.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--app-text-muted)]">
              Proveedor seleccionado: <strong>{PROVIDERS.find((provider) => provider.value === selectedProvider)?.label}</strong>.
              La selección no modifica el proveedor predeterminado de Khipu Agente.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function readPdfImportProvider(value: unknown): PdfImportProvider {
  return typeof value === "string" && PDF_IMPORT_PROVIDER_OPTIONS.includes(value as PdfImportProvider)
    ? (value as PdfImportProvider)
    : "openai";
}

function readError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
