import type { ExportFormat, ExportPreset, ExportRequest } from "@/lib/exports/definitions";

/**
 * Resolves the download filename from the Content-Disposition header,
 * falling back to a preset-format combination.
 */
function resolveDownloadFileName(response: Response, preset: ExportPreset, format: ExportFormat) {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? `${preset}.${format}`;
}

/**
 * POSTs an export request to /api/exports and returns the response blob
 * along with the resolved filename. Throws on non-OK responses.
 */
export async function requestExportBlob(payload: ExportRequest) {
  const response = await fetch("/api/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo generar la exportacion");
  }

  return {
    blob: await response.blob(),
    fileName: resolveDownloadFileName(response, payload.preset, payload.format),
  };
}

/**
 * Triggers a browser download for the given blob with the specified filename.
 */
export function downloadBlob(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
