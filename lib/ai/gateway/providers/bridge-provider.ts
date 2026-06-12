import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";

export async function executeBridgeProvider(request: AiProviderRequest): Promise<AiProviderResult> {
  void request;
  throw new Error("ChatGPT Bridge es un proveedor de navegador y no puede ejecutarse desde el servidor.");
}
