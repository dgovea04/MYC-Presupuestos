"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, Key, Loader2, RefreshCw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_OPTIONS } from "@/lib/ai/gateway/providers/gemini-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonForm } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isLocalClientRuntimeEnabled } from "@/lib/runtime/local-capabilities";

type AiProviderPreference = "auto" | "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter";
type TestResult = "idle" | "ok" | "fail";

type AiProviderSettingsState = {
  aiProviderPreference: AiProviderPreference;
  openaiApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openrouterApiKeyMasked: string;
  openaiModel: string;
  geminiModel: string;
  openrouterModel: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  openrouterConfigured: boolean;
};

const PROVIDER_OPTIONS: Array<{ value: AiProviderPreference; label: string; description: string }> = [
  { value: "auto", label: "Automatico (recomendado)", description: "Khipu elige el mejor proveedor segun la tarea." },
  ...(isLocalClientRuntimeEnabled()
    ? [{ value: "ollama" as const, label: "Ollama local", description: "Modelos locales. Sin costo de API." }]
    : []),
  { value: "chatgpt_bridge", label: "ChatGPT Bridge", description: "Usa ChatGPT via extension del navegador." },
  { value: "openai", label: "ChatGPT API", description: "API de OpenAI con tu propia key." },
  { value: "gemini", label: "Gemini API", description: "API de Google Gemini con tu propia key." },
  { value: "openrouter", label: "OpenRouter", description: "OpenRouter con tu propia key y modelo configurable." },
];

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export function CloudAiSettingsCard() {
  const [settings, setSettings] = useState<AiProviderSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [providerPreference, setProviderPreference] = useState<AiProviderPreference>("auto");

  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");

  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);

  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingOpenrouter, setTestingOpenrouter] = useState(false);

  const [openaiTestResult, setOpenaiTestResult] = useState<TestResult>("idle");
  const [geminiTestResult, setGeminiTestResult] = useState<TestResult>("idle");
  const [openrouterTestResult, setOpenrouterTestResult] = useState<TestResult>("idle");

  const [clearingOpenai, setClearingOpenai] = useState(false);
  const [clearingGemini, setClearingGemini] = useState(false);
  const [clearingOpenrouter, setClearingOpenrouter] = useState(false);

  const [confirmClearOpenai, setConfirmClearOpenai] = useState(false);
  const [confirmClearGemini, setConfirmClearGemini] = useState(false);
  const [confirmClearOpenrouter, setConfirmClearOpenrouter] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings/ai-provider");
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al cargar configuracion.");
      }

      const data = readAiProviderSettings(payload);
      setSettings(data);
      setProviderPreference(data.aiProviderPreference);
      setOpenaiModel(data.openaiModel);
      setGeminiModel(data.geminiModel);
      setOpenrouterModel(data.openrouterModel);
      resetKeyEditors();
      resetTests();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar configuracion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSettings();
    });
  }, [loadSettings]);

  function resetKeyEditors() {
    setOpenaiKey("");
    setGeminiKey("");
    setOpenrouterKey("");
    setShowOpenaiKey(false);
    setShowGeminiKey(false);
    setShowOpenrouterKey(false);
  }

  function resetTests() {
    setOpenaiTestResult("idle");
    setGeminiTestResult("idle");
    setOpenrouterTestResult("idle");
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const body: Record<string, unknown> = {
      aiProviderPreference: providerPreference,
      openaiModel: openaiModel.trim() || null,
      geminiModel: geminiModel.trim() || null,
      openrouterModel: openrouterModel.trim() || null,
    };

    if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim();
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();
    if (openrouterKey.trim()) body.openrouterApiKey = openrouterKey.trim();

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al guardar configuracion.");
      }

      const data = readAiProviderSettings(payload);
      setSettings(data);
      resetKeyEditors();
      resetTests();
      setSuccessMessage("Configuracion guardada correctamente.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Error al guardar configuracion.");
    } finally {
      setSaving(false);
    }
  }

  async function testProviderConnection(provider: "openai" | "gemini" | "openrouter", apiKey: string | null) {
    const response = await fetch("/api/settings/ai-provider/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    const payload: unknown = await response.json();
    return response.ok && isRecord(payload) && payload.valid === true;
  }

  async function testOpenaiConnection() {
    setTestingOpenai(true);
    setOpenaiTestResult("idle");
    setError("");
    try {
      setOpenaiTestResult(await testProviderConnection("openai", openaiKey.trim() || null) ? "ok" : "fail");
    } catch {
      setOpenaiTestResult("fail");
    } finally {
      setTestingOpenai(false);
    }
  }

  async function testGeminiConnection() {
    setTestingGemini(true);
    setGeminiTestResult("idle");
    setError("");
    try {
      setGeminiTestResult(await testProviderConnection("gemini", geminiKey.trim() || null) ? "ok" : "fail");
    } catch {
      setGeminiTestResult("fail");
    } finally {
      setTestingGemini(false);
    }
  }

  async function testOpenrouterConnection() {
    setTestingOpenrouter(true);
    setOpenrouterTestResult("idle");
    setError("");
    try {
      setOpenrouterTestResult(await testProviderConnection("openrouter", openrouterKey.trim() || null) ? "ok" : "fail");
    } catch {
      setOpenrouterTestResult("fail");
    } finally {
      setTestingOpenrouter(false);
    }
  }

  async function clearProviderKey(provider: "openai" | "gemini" | "openrouter") {
    const setClearing =
      provider === "openai" ? setClearingOpenai : provider === "gemini" ? setClearingGemini : setClearingOpenrouter;
    const successLabel = provider === "openai" ? "OpenAI" : provider === "gemini" ? "Gemini" : "OpenRouter";

    setClearing(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProviderPreference: providerPreference,
          openaiApiKey: provider === "openai" ? "" : null,
          geminiApiKey: provider === "gemini" ? "" : null,
          openrouterApiKey: provider === "openrouter" ? "" : null,
          openaiModel: openaiModel.trim() || null,
          geminiModel: geminiModel.trim() || null,
          openrouterModel: openrouterModel.trim() || null,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al limpiar la key.");
      }

      const data = readAiProviderSettings(payload);
      setSettings(data);
      resetKeyEditors();
      resetTests();
      setSuccessMessage(`API key de ${successLabel} eliminada.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo limpiar la key.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Proveedores Cloud IA</CardTitle>
              <CardDescription>
                Configura tus API keys de OpenAI, Gemini y OpenRouter para usar modelos en la nube con tu propia cuenta.
              </CardDescription>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
            <Button type="button" variant="outline" onClick={() => void loadSettings()} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Recargar
            </Button>
            <Button type="button" onClick={() => void saveSettings()} disabled={saving || loading} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {successMessage ? <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">{successMessage}</p> : null}

        {loading ? (
          <SkeletonForm
            aria-label="Cargando proveedores Cloud IA"
            fieldsPerSection={2}
            sections={3}
          />
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">Proveedor por defecto</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Define que motor de IA prefieres usar por defecto en Khipu.</p>
              <select
                className="mt-3 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={providerPreference}
                onChange={(event) => setProviderPreference(event.target.value as AiProviderPreference)}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                {PROVIDER_OPTIONS.find((option) => option.value === providerPreference)?.description}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ProviderCard
                title="OpenAI (ChatGPT API)"
                configured={settings?.openaiConfigured === true}
                maskedKey={settings?.openaiApiKeyMasked ?? ""}
                showKey={showOpenaiKey}
                keyValue={openaiKey}
                modelValue={openaiModel}
                modelPlaceholder={DEFAULT_OPENAI_MODEL}
                testing={testingOpenai}
                testResult={openaiTestResult}
                clearing={clearingOpenai}
                confirmClear={confirmClearOpenai}
                emptyKeyPlaceholder="sk-..."
                successText="Conexion exitosa con OpenAI."
                onToggleShowKey={() => setShowOpenaiKey((current) => !current)}
                onChangeKey={setOpenaiKey}
                onTest={() => void testOpenaiConnection()}
                onChangeModel={setOpenaiModel}
                onRequestClear={() => setConfirmClearOpenai(true)}
                onCancelClear={() => setConfirmClearOpenai(false)}
                onConfirmClear={() => {
                  setConfirmClearOpenai(false);
                  void clearProviderKey("openai");
                }}
              />

              <ProviderCard
                title="Google Gemini API"
                configured={settings?.geminiConfigured === true}
                maskedKey={settings?.geminiApiKeyMasked ?? ""}
                showKey={showGeminiKey}
                keyValue={geminiKey}
                modelValue={geminiModel}
                modelPlaceholder={DEFAULT_GEMINI_MODEL}
                testing={testingGemini}
                testResult={geminiTestResult}
                clearing={clearingGemini}
                confirmClear={confirmClearGemini}
                emptyKeyPlaceholder="AIza..."
                successText="Conexion exitosa con Gemini."
                onToggleShowKey={() => setShowGeminiKey((current) => !current)}
                onChangeKey={setGeminiKey}
                onTest={() => void testGeminiConnection()}
                onChangeModel={setGeminiModel}
                onRequestClear={() => setConfirmClearGemini(true)}
                onCancelClear={() => setConfirmClearGemini(false)}
                onConfirmClear={() => {
                  setConfirmClearGemini(false);
                  void clearProviderKey("gemini");
                }}
                modelControl={
                  <select
                    className="flex-1 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    value={geminiModel || DEFAULT_GEMINI_MODEL}
                    onChange={(event) => setGeminiModel(event.target.value)}
                  >
                    {GEMINI_MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <ProviderCard
                title="OpenRouter API"
                configured={settings?.openrouterConfigured === true}
                maskedKey={settings?.openrouterApiKeyMasked ?? ""}
                showKey={showOpenrouterKey}
                keyValue={openrouterKey}
                modelValue={openrouterModel}
                modelPlaceholder="openrouter/free"
                testing={testingOpenrouter}
                testResult={openrouterTestResult}
                clearing={clearingOpenrouter}
                confirmClear={confirmClearOpenrouter}
                emptyKeyPlaceholder="sk-or-v1-..."
                successText="Conexion exitosa con OpenRouter."
                onToggleShowKey={() => setShowOpenrouterKey((current) => !current)}
                onChangeKey={setOpenrouterKey}
                onTest={() => void testOpenrouterConnection()}
                onChangeModel={setOpenrouterModel}
                onRequestClear={() => setConfirmClearOpenrouter(true)}
                onCancelClear={() => setConfirmClearOpenrouter(false)}
                onConfirmClear={() => {
                  setConfirmClearOpenrouter(false);
                  void clearProviderKey("openrouter");
                }}
              />
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-sm font-medium text-[var(--app-text-strong)]">Seguridad de tus API keys</p>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Tus API keys se almacenan encriptadas (AES-256-GCM) en la base de datos y nunca se exponen al navegador sin encriptar.
                  Solo el servidor puede desencriptarlas para hacer llamadas a las APIs.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderCard({
  title,
  configured,
  maskedKey,
  showKey,
  keyValue,
  modelValue,
  modelPlaceholder,
  testing,
  testResult,
  clearing,
  confirmClear,
  emptyKeyPlaceholder,
  successText,
  onToggleShowKey,
  onChangeKey,
  onTest,
  onChangeModel,
  onRequestClear,
  onCancelClear,
  onConfirmClear,
  modelControl,
}: {
  title: string;
  configured: boolean;
  maskedKey: string;
  showKey: boolean;
  keyValue: string;
  modelValue: string;
  modelPlaceholder: string;
  testing: boolean;
  testResult: TestResult;
  clearing: boolean;
  confirmClear: boolean;
  emptyKeyPlaceholder: string;
  successText: string;
  onToggleShowKey: () => void;
  onChangeKey: (value: string) => void;
  onTest: () => void;
  onChangeModel: (value: string) => void;
  onRequestClear: () => void;
  onCancelClear: () => void;
  onConfirmClear: () => void;
  modelControl?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">{configured ? "Configurado" : "Pendiente"}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            configured
              ? "theme-status-success theme-status-success-strong"
              : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]",
          )}
        >
          <Key className="h-3 w-3" />
          {configured ? "Activo" : "Sin key"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-[var(--app-text-muted)]">
          API Key
          {configured && !showKey ? <span className="ml-1 text-[var(--app-text-subtle)]">({maskedKey})</span> : null}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={keyValue}
              onChange={(event) => onChangeKey(event.target.value)}
              placeholder={configured ? "Dejar vacio para mantener la key actual" : emptyKeyPlaceholder}
              className="pr-10"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={onToggleShowKey}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--app-text-subtle)] hover:text-[var(--app-text-muted)]"
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testing} className="shrink-0">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Probar"}
          </Button>
        </div>
        {testResult === "ok" ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-300">{successText}</p>
        ) : testResult === "fail" ? (
          <p className="text-xs text-rose-600">No se pudo conectar. Verifica la API key.</p>
        ) : null}
      </div>

      <label className="mt-3 block text-xs font-medium text-[var(--app-text-muted)]">Modelo (opcional)</label>
      <div className="mt-1 flex gap-2">
        {modelControl ?? (
          <Input
            className="flex-1"
            value={modelValue}
            onChange={(event) => onChangeModel(event.target.value)}
            placeholder={modelPlaceholder}
            autoComplete="off"
          />
        )}
        {configured ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRequestClear}
            disabled={clearing}
            className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            title="Eliminar API key"
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      {confirmClear ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="flex-1 text-xs font-medium text-rose-800">¿Eliminar la API key? Esta accion no se puede deshacer.</p>
          <Button type="button" size="sm" variant="ghost" onClick={onCancelClear} className="text-xs text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]">
            Cancelar
          </Button>
          <Button type="button" size="sm" variant="default" onClick={onConfirmClear} className="bg-rose-600 text-xs hover:bg-rose-700">
            Eliminar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function readAiProviderSettings(payload: unknown): AiProviderSettingsState {
  if (!isRecord(payload)) {
    throw new Error("Formato de respuesta invalido.");
  }

  return {
    aiProviderPreference: readProviderPreference(payload.aiProviderPreference),
    openaiApiKeyMasked: typeof payload.openaiApiKeyMasked === "string" ? payload.openaiApiKeyMasked : "",
    geminiApiKeyMasked: typeof payload.geminiApiKeyMasked === "string" ? payload.geminiApiKeyMasked : "",
    openrouterApiKeyMasked: typeof payload.openrouterApiKeyMasked === "string" ? payload.openrouterApiKeyMasked : "",
    openaiModel: typeof payload.openaiModel === "string" ? payload.openaiModel : "",
    geminiModel: typeof payload.geminiModel === "string" ? payload.geminiModel : "",
    openrouterModel: typeof payload.openrouterModel === "string" ? payload.openrouterModel : "",
    openaiConfigured: payload.openaiConfigured === true,
    geminiConfigured: payload.geminiConfigured === true,
    openrouterConfigured: payload.openrouterConfigured === true,
  };
}

function readProviderPreference(value: unknown): AiProviderPreference {
  if (typeof value === "string" && ["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"].includes(value)) {
    if (value === "ollama" && !isLocalClientRuntimeEnabled()) return "auto";
    return value as AiProviderPreference;
  }
  return "auto";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
