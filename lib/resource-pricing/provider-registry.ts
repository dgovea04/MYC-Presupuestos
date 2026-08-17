import { getPrimaryResourcePriceProviderConfig } from "@/lib/resource-pricing/admin-config";
import { FakeResourcePriceProvider, McPresupuestosPriceApiProvider, ResourcePriceProviderError, type ResourcePriceProvider } from "@/lib/resource-pricing/provider";

export function createResourcePriceProvider(config: Awaited<ReturnType<typeof getPrimaryResourcePriceProviderConfig>>): ResourcePriceProvider {
  if (config.provider === "fake") {
    return new FakeResourcePriceProvider();
  }
  if (config.provider === "mc-presupuestos-price-api") {
    return new McPresupuestosPriceApiProvider({
      name: config.provider,
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion,
      credential: config.credential,
      timeoutMs: config.timeoutMs,
    });
  }
  throw new ResourcePriceProviderError("CONFIGURATION", "Proveedor de precios no aprobado.");
}

export async function resolvePrimaryResourcePriceProvider() {
  const config = await getPrimaryResourcePriceProviderConfig();
  if (config.status === "DISABLED" || config.status === "SUSPENDED") {
    throw new ResourcePriceProviderError("DISABLED", "El proveedor principal de precios está deshabilitado.");
  }
  if (config.status !== "HEALTHY" && config.status !== "DEGRADED") {
    throw new ResourcePriceProviderError("CONFIGURATION", "El proveedor principal no está disponible.");
  }
  return { provider: createResourcePriceProvider(config), config };
}

export async function listResourcePriceProviders() {
  const config = await getPrimaryResourcePriceProviderConfig();
  return [
    {
      name: "mc-presupuestos-price-api" as const,
      firstParty: true,
      active: config.provider === "mc-presupuestos-price-api",
      status: config.provider === "mc-presupuestos-price-api" ? config.status : "DISABLED" as const,
    },
    {
      name: "fake" as const,
      firstParty: false,
      active: config.provider === "fake",
      status: config.provider === "fake" ? config.status : "DISABLED" as const,
    },
  ];
}
