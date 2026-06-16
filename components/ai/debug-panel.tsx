import type { AiApuCatalogGenerationResult, AiEndpointResult } from "@/lib/ai/types";

export function PreviewDebugPanel({
  debug,
}: {
  debug: AiApuCatalogGenerationResult["debug"] | AiEndpointResult["debug"];
}) {
  if (!debug) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Debug IA desarrollo
      </div>
      <div className="grid gap-2 p-3">
        <DebugJsonBlock title="Contexto backend" value={"context" in debug ? debug.context : null} />
        <DebugJsonBlock title="Mensajes enviados al modelo" value={"messages" in debug ? debug.messages : null} />
        <DebugJsonBlock title="Request body API (enviado al proveedor)" value={"requestBody" in debug ? debug.requestBody : null} />
        <DebugJsonBlock title="Respuesta cruda IA" value={"ai" in debug ? debug.ai : debug} />
        <DebugJsonBlock title="Fallback y sugerencias" value={"fallback" in debug ? debug.fallback : null} />
        <DebugJsonBlock title="Advertencias de validacion" value={"validationWarnings" in debug ? debug.validationWarnings : null} />
      </div>
    </div>
  );
}

export function DebugJsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  return (
    <details className="rounded-lg border border-slate-800 bg-slate-900">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-200">{title}</summary>
      <pre className="max-h-80 overflow-auto border-t border-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
        {formatDebugValue(value)}
      </pre>
    </details>
  );
}

export function formatDebugValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
