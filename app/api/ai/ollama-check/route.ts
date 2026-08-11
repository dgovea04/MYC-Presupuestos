import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listInstalledOllamaModels, OllamaConnectionError } from "@/lib/ai/ollama";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export type OllamaCheckResponse = {
  reachable: boolean;
  installedModels: string[];
  modelAvailable: boolean;
  checkedModel: string | null;
  error: string | null;
};

/**
 * GET /api/ai/ollama-check?model=llama3.1
 *
 * Verifica si Ollama está corriendo y si el modelo especificado está instalado.
 * Sin el query param `model`, solo verifica conectividad y lista modelos.
 */
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isLocalRuntimeEnabled()) {
    return NextResponse.json({ error: "Ollama solo esta disponible en la app local." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawModel = searchParams.get("model");
  const checkedModel = rawModel?.trim() ?? null;

  try {
    const installedModels = await listInstalledOllamaModels();

    let modelAvailable = false;
    if (checkedModel) {
      // Ollama devuelve nombres con tag (ej: "llama3.1:latest", "qwen2.5:14b")
      // Comparamos el nombre base ignorando el tag :latest
      modelAvailable = installedModels.some((installed) => {
        const installedBase = installed.split(":")[0];
        const checkedBase = checkedModel.split(":")[0];
        return installedBase === checkedBase || installed === checkedModel;
      });
    }

    return NextResponse.json({
      reachable: true,
      installedModels,
      modelAvailable: checkedModel ? modelAvailable : false,
      checkedModel,
      error: null,
    } satisfies OllamaCheckResponse);
  } catch (error) {
    if (error instanceof OllamaConnectionError) {
      return NextResponse.json({
        reachable: false,
        installedModels: [],
        modelAvailable: false,
        checkedModel,
        error: "No se pudo conectar con Ollama. Verifica que esté corriendo en http://localhost:11434.",
      } satisfies OllamaCheckResponse);
    }

    return NextResponse.json({
      reachable: false,
      installedModels: [],
      modelAvailable: false,
      checkedModel,
      error: error instanceof Error ? error.message : "Error desconocido al verificar Ollama.",
    } satisfies OllamaCheckResponse);
  }
}
