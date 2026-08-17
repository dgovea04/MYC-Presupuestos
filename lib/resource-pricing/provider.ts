import { resourcePriceQuoteSchema } from "@/lib/validations/resource-pricing";
import type { ResourcePriceLookup, ResourcePriceQuote } from "@/types/resource-pricing";

export type ResourcePriceProviderHealth = {
  ok: boolean;
  latencyMs: number;
  message?: string;
};

export type ResourcePriceProviderConfig = {
  name: "mc-presupuestos-price-api" | "fake";
  baseUrl: string | null;
  apiVersion: string;
  credential: string;
  timeoutMs: number;
};

export interface ResourcePriceProvider {
  readonly name: ResourcePriceProviderConfig["name"];
  lookup(input: ResourcePriceLookup[], signal?: AbortSignal): Promise<ResourcePriceQuote[]>;
  healthCheck(signal?: AbortSignal): Promise<ResourcePriceProviderHealth>;
}

export class ResourcePriceProviderError extends Error {
  readonly code: "DISABLED" | "UNAVAILABLE" | "RATE_LIMITED" | "INVALID_RESPONSE" | "CONFIGURATION";

  constructor(
    code: ResourcePriceProviderError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ResourcePriceProviderError";
    this.code = code;
  }
}

export class FakeResourcePriceProvider implements ResourcePriceProvider {
  readonly name = "fake" as const;

  async lookup(input: ResourcePriceLookup[]): Promise<ResourcePriceQuote[]> {
    return input.map((resource) => ({
      externalResourceId: resource.externalResourceId ?? resource.code ?? resource.description,
      externalCode: resource.code ?? null,
      description: resource.description,
      category: resource.category ?? null,
      unit: resource.unit,
      currency: resource.currency,
      price: resource.currentPrice ?? "0",
      observedAt: new Date().toISOString(),
      sourceLabel: "Fake provider (desarrollo)",
      sourceVersion: "fake-v1",
      rawHash: `fake:${resource.externalResourceId ?? resource.description}`,
    }));
  }

  async healthCheck(): Promise<ResourcePriceProviderHealth> {
    return { ok: true, latencyMs: 0, message: "Fake provider disponible" };
  }
}

export class McPresupuestosPriceApiProvider implements ResourcePriceProvider {
  readonly name = "mc-presupuestos-price-api" as const;

  constructor(private readonly config: ResourcePriceProviderConfig) {}

  async lookup(input: ResourcePriceLookup[], signal?: AbortSignal): Promise<ResourcePriceQuote[]> {
    const response = await this.request("resource-prices:lookup", input, signal);
    const parsed = resourcePriceQuoteSchema.array().safeParse(response);
    if (!parsed.success || parsed.data.length > input.length) {
      throw new ResourcePriceProviderError("INVALID_RESPONSE", "El proveedor devolvió una respuesta inválida.");
    }
    return parsed.data;
  }

  async healthCheck(signal?: AbortSignal): Promise<ResourcePriceProviderHealth> {
    const startedAt = Date.now();
    try {
      await this.request("health", undefined, signal, "GET");
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "No se pudo verificar el proveedor.",
      };
    }
  }

  private async request(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    method: "GET" | "POST" = "POST",
  ): Promise<unknown> {
    if (!this.config.baseUrl || !this.config.credential) {
      throw new ResourcePriceProviderError("CONFIGURATION", "El proveedor propio no está configurado.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const abortHandler = () => controller.abort();
    signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/v${this.config.apiVersion.replace(/^v/, "")}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.credential}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify({ resources: body }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        throw new ResourcePriceProviderError("RATE_LIMITED", "El proveedor limitó la frecuencia de solicitudes.");
      }
      if (!response.ok) {
        throw new ResourcePriceProviderError("UNAVAILABLE", `El proveedor respondió ${response.status}.`);
      }

      try {
        return await response.json();
      } catch {
        throw new ResourcePriceProviderError("INVALID_RESPONSE", "El proveedor no devolvió JSON válido.");
      }
    } catch (error) {
      if (error instanceof ResourcePriceProviderError) throw error;
      throw new ResourcePriceProviderError("UNAVAILABLE", error instanceof Error ? error.message : "Proveedor no disponible.");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortHandler);
    }
  }
}
