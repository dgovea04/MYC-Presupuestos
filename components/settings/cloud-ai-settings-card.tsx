"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Key, Loader2, RefreshCw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AiProviderPreference = "auto" | "ollama" | "chatgpt_bridge" | "openai" | "gemini";

type AiProviderSettingsState = {
  aiProviderPreference: AiProviderPreference;
  openaiApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openaiModel: string;
  geminiModel: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
};

const PROVIDER_OPTIONS: Array<{ value: AiProviderPreference; label: string; description: string }> = [
  { value: "auto", label: "Automático (recomendado)", description: "Khipu elige el mejor proveedor según la tarea." },
  { value: "ollama", label: "Ollama local", description: "Modelos locales. Sin costo de API." },
  { value: "chatgpt_bridge", label: "ChatGPT Bridge", description: "Usa ChatGPT via extensión del navegador." },
  { value: "openai", label: "ChatGPT API", description: "API de OpenAI con tu propia key." },
  { value: "gemini", label: "Gemini API", description: "API de Google Gemini con tu propia key." },
];

import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_OPTIONS } from "@/lib/ai/gateway/providers/gemini-provider";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

function readProviderLabel(provider: AiProviderPreference): string {
  const match = PROVIDER_OPTIONS.find((option) => option.value === provider);
  return match?.label ?? provider;
}

export function CloudAiSettingsCard() {
  const [settings, setSettings] = useState<AiProviderSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [providerPreference, setProviderPreference] = useState<AiProviderPreference>("auto");
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiModel, setGeminiModel] = useState("");

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<"idle" | "ok" | "fail">("idle");
  const [geminiTestResult, setGeminiTestResult] = useState<"idle" | "ok" | "fail">("idle");

  const [clearingOpenai, setClearingOpenai] = useState(false);
  const [clearingGemini, setClearingGemini] = useState(false);

  const [confirmClearOpenai, setConfirmClearOpenai] = useState(false);
  const [confirmClearGemini, setConfirmClearGemini] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings/ai-provider");
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al cargar configuración.");
      }
      const data = readAiProviderSettings(payload);
      setSettings(data);
      setProviderPreference(data.aiProviderPreference);
      setOpenaiModel(data.openaiModel || "");
      setGeminiModel(data.geminiModel || "");
      setOpenaiKey("");
      setGeminiKey("");
      setShowOpenaiKey(false);
      setShowGeminiKey(false);
      setOpenaiTestResult("idle");
      setGeminiTestResult("idle");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar configuración.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const body: Record<string, unknown> = {
      aiProviderPreference: providerPreference,
      openaiModel: openaiModel.trim() || null,
      geminiModel: geminiModel.trim() || null,
    };

    if (openaiKey.trim()) {
      body.openaiApiKey = openaiKey.trim();
    }
    if (geminiKey.trim()) {
      body.geminiApiKey = geminiKey.trim();
    }

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al guardar configuración.");
      }
      const data = readAiProviderSettings(payload);
      setSettings(data);
      setOpenaiKey("");
      setGeminiKey("");
      setShowOpenaiKey(false);
      setShowGeminiKey(false);
      setOpenaiTestResult("idle");
      setGeminiTestResult("idle");
      setSuccessMessage("Configuración guardada correctamente.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Error al guardar configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function testOpenaiConnection() {
    setTestingOpenai(true);
    setOpenaiTestResult("idle");
    setError("");

    const keyToTest = openaiKey.trim() || null;

    try {
      const response = await fetch("/api/settings/ai-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: keyToTest }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || payload.valid !== true) {
        setOpenaiTestResult("fail");
        return;
      }
      setOpenaiTestResult("ok");
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

    const keyToTest = geminiKey.trim() || null;

    try {
      const response = await fetch("/api/settings/ai-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", apiKey: keyToTest }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || payload.valid !== true) {
        setGeminiTestResult("fail");
        return;
      }
      setGeminiTestResult("ok");
    } catch {
      setGeminiTestResult("fail");
    } finally {
      setTestingGemini(false);
    }
  }

  async function clearOpenaiKey() {
    setClearingOpenai(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProviderPreference: providerPreference,
          openaiApiKey: "",
          openaiModel: openaiModel.trim() || null,
          geminiModel: geminiModel.trim() || null,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al limpiar la key.");
      }
      const data = readAiProviderSettings(payload);
      setSettings(data);
      setOpenaiKey("");
      setShowOpenaiKey(false);
      setOpenaiTestResult("idle");
      setSuccessMessage("API key de OpenAI eliminada.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo limpiar la key.");
    } finally {
      setClearingOpenai(false);
    }
  }

  async function clearGeminiKey() {
    setClearingGemini(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProviderPreference: providerPreference,
          geminiApiKey: "",
          openaiModel: openaiModel.trim() || null,
          geminiModel: geminiModel.trim() || null,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "Error al limpiar la key.");
      }
      const data = readAiProviderSettings(payload);
      setSettings(data);
      setGeminiKey("");
      setShowGeminiKey(false);
      setGeminiTestResult("idle");
      setSuccessMessage("API key de Gemini eliminada.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo limpiar la key.");
    } finally {
      setClearingGemini(false);
    }
  }

  return (
    <Card className="border-violet-100 bg-[linear-gradient(135deg,#ffffff_0%,#faf5ff_48%,#f5f3ff_100%)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-violet-100 p-2 text-violet-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Proveedores Cloud IA</CardTitle>
              <CardDescription>
                Configura tus API keys de OpenAI y Gemini para usar modelos en la nube con tu propia cuenta.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        {successMessage ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p> : null}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Provider Preference */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Proveedor por defecto</p>
              <p className="mt-1 text-sm text-slate-500">Define qué motor de IA prefieres usar por defecto en Khipu.</p>
              <select
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
                value={providerPreference}
                onChange={(event) => setProviderPreference(event.target.value as AiProviderPreference)}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                {PROVIDER_OPTIONS.find((o) => o.value === providerPreference)?.description}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* OpenAI */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">OpenAI (ChatGPT API)</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {settings?.openaiConfigured ? "Configurado" : "Pendiente"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      settings?.openaiConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <Key className="h-3 w-3" />
                    {settings?.openaiConfigured ? "Activo" : "Sin key"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-slate-600">
                    API Key
                    {settings?.openaiConfigured && !showOpenaiKey ? (
                      <span className="ml-1 text-slate-400">({settings.openaiApiKeyMasked})</span>
                    ) : null}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showOpenaiKey ? "text" : "password"}
                        value={openaiKey}
                        onChange={(event) => setOpenaiKey(event.target.value)}
                        placeholder={settings?.openaiConfigured ? "Dejar vacío para mantener la key actual" : "sk-..."}
                        className="pr-10"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey((current) => !current)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void testOpenaiConnection()}
                      disabled={testingOpenai}
                      className="shrink-0"
                    >
                      {testingOpenai ? <Loader2 className="h-4 w-4 animate-spin" /> : "Probar"}
                    </Button>
                  </div>
                  {openaiTestResult === "ok" ? (
                    <p className="text-xs text-emerald-600">Conexión exitosa con OpenAI.</p>
                  ) : openaiTestResult === "fail" ? (
                    <p className="text-xs text-rose-600">No se pudo conectar. Verifica la API key.</p>
                  ) : null}
                </div>

                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Modelo (opcional)
                </label>
                <div className="mt-1 flex gap-2">
                  <Input
                    className="flex-1"
                    value={openaiModel}
                    onChange={(event) => setOpenaiModel(event.target.value)}
                    placeholder={DEFAULT_OPENAI_MODEL}
                    autoComplete="off"
                  />
                  {settings?.openaiConfigured ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmClearOpenai(true)}
                      disabled={clearingOpenai}
                      className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Eliminar API key"
                    >
                      {clearingOpenai ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
                {confirmClearOpenai ? (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="flex-1 text-xs font-medium text-rose-800">
                      ¿Eliminar la API key de OpenAI? Esta acción no se puede deshacer.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmClearOpenai(false)}
                      className="text-xs text-slate-600 hover:bg-white"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setConfirmClearOpenai(false);
                        void clearOpenaiKey();
                      }}
                      className="bg-rose-600 text-xs hover:bg-rose-700"
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Gemini */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Google Gemini API</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {settings?.geminiConfigured ? "Configurado" : "Pendiente"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      settings?.geminiConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <Key className="h-3 w-3" />
                    {settings?.geminiConfigured ? "Activo" : "Sin key"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-slate-600">
                    API Key
                    {settings?.geminiConfigured && !showGeminiKey ? (
                      <span className="ml-1 text-slate-400">({settings.geminiApiKeyMasked})</span>
                    ) : null}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showGeminiKey ? "text" : "password"}
                        value={geminiKey}
                        onChange={(event) => setGeminiKey(event.target.value)}
                        placeholder={settings?.geminiConfigured ? "Dejar vacío para mantener la key actual" : "AIza..."}
                        className="pr-10"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey((current) => !current)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void testGeminiConnection()}
                      disabled={testingGemini}
                      className="shrink-0"
                    >
                      {testingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : "Probar"}
                    </Button>
                  </div>
                  {geminiTestResult === "ok" ? (
                    <p className="text-xs text-emerald-600">Conexión exitosa con Gemini.</p>
                  ) : geminiTestResult === "fail" ? (
                    <p className="text-xs text-rose-600">No se pudo conectar. Verifica la API key.</p>
                  ) : null}
                </div>

                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Modelo (opcional)
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={geminiModel || DEFAULT_GEMINI_MODEL}
                    onChange={(event) => setGeminiModel(event.target.value)}
                  >
                    {GEMINI_MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {settings?.geminiConfigured ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmClearGemini(true)}
                      disabled={clearingGemini}
                      className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Eliminar API key"
                    >
                      {clearingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
                {confirmClearGemini ? (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="flex-1 text-xs font-medium text-rose-800">
                      ¿Eliminar la API key de Gemini? Esta acción no se puede deshacer.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmClearGemini(false)}
                      className="text-xs text-slate-600 hover:bg-white"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setConfirmClearGemini(false);
                        void clearGeminiKey();
                      }}
                      className="bg-rose-600 text-xs hover:bg-rose-700"
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Safety notice */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Seguridad de tus API keys</p>
                <p className="mt-1 text-xs text-slate-600">
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

function readAiProviderSettings(payload: unknown): AiProviderSettingsState {
  if (!isRecord(payload)) {
    throw new Error("Formato de respuesta inválido.");
  }

  return {
    aiProviderPreference: readProviderPreference(payload.aiProviderPreference),
    openaiApiKeyMasked: typeof payload.openaiApiKeyMasked === "string" ? payload.openaiApiKeyMasked : "",
    geminiApiKeyMasked: typeof payload.geminiApiKeyMasked === "string" ? payload.geminiApiKeyMasked : "",
    openaiModel: typeof payload.openaiModel === "string" ? payload.openaiModel : "",
    geminiModel: typeof payload.geminiModel === "string" ? payload.geminiModel : "",
    openaiConfigured: payload.openaiConfigured === true,
    geminiConfigured: payload.geminiConfigured === true,
  };
}

function readProviderPreference(value: unknown): AiProviderPreference {
  if (typeof value === "string" && ["auto", "ollama", "chatgpt_bridge", "openai", "gemini"].includes(value)) {
    return value as AiProviderPreference;
  }
  return "auto";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
