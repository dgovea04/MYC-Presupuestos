import { describe, expect, it, vi } from "vitest";
import { McPresupuestosPriceApiProvider } from "@/lib/resource-pricing/provider";
import { lookupQuoteSchema } from "./contract";
import { createPriceApiHandler } from "./handler";

const token = "service-token-for-tests";
const fixedDate = new Date("2026-08-17T12:00:00.000Z");

function createHandler() {
  return createPriceApiHandler({
    serviceToken: token,
    maxBatchSize: 2,
    now: () => fixedDate,
  });
}

describe("mc-presupuestos-price-api V1", () => {
  it("requires service-to-service authentication", () => {
    const response = createHandler()({ method: "GET", path: "/v1/health", headers: {} });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "AUTHENTICATION_FAILED", message: "Credencial de servicio inválida." },
    });
  });

  it("returns readiness separately from health", () => {
    const response = createHandler()({
      method: "GET",
      path: "/v1/ready",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ ready: true, catalogVersion: "2026-08-17.1" }));
  });

  it("returns a versioned health response", () => {
    const response = createHandler()({
      method: "GET",
      path: "/v1/health",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      ok: true,
      service: "mc-presupuestos-price-api",
      version: "v1",
      catalogVersion: "2026-08-17.1",
      checkedAt: fixedDate.toISOString(),
    }));
  });

  it("looks up prices from the curated version without trusting currentPrice", () => {
    const response = createHandler()({
      method: "POST",
      path: "/v1/resource-prices:lookup",
      headers: { authorization: `Bearer ${token}` },
      body: {
        resources: [{
          externalResourceId: "cemento-portland-tipo-i",
          description: "Cemento Portland Tipo I",
          unit: "bol",
          currency: "PEN",
          currentPrice: "9999.0000",
        }],
      },
    });
    expect(response.status).toBe(200);
    const quote = (response.body as Array<Record<string, unknown>>)[0];
    expect(quote).toEqual(expect.objectContaining({ price: "27.4500", sourceVersion: "2026-08-17.1" }));
    expect(lookupQuoteSchema.safeParse(quote).success).toBe(true);
  });

  it("returns 429 after the configured lookup rate limit", () => {
    const handler = createPriceApiHandler({ serviceToken: token, rateLimitPerMinute: 1, now: () => fixedDate });
    const request = {
      method: "POST",
      path: "/v1/resource-prices:lookup",
      headers: { authorization: `Bearer ${token}` },
      body: { resources: [{ description: "Cemento Portland Tipo I", unit: "bol", currency: "PEN" }] },
    };
    expect(handler(request).status).toBe(200);
    const limited = handler(request);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual(expect.objectContaining({ error: { code: "RATE_LIMITED", message: expect.any(String) } }));
  });

  it("rejects batches over the configured service limit", () => {
    const response = createHandler()({
      method: "POST",
      path: "/v1/resource-prices:lookup",
      headers: { authorization: `Bearer ${token}` },
      body: {
        resources: [
          { description: "Cemento", unit: "bol", currency: "PEN" },
          { description: "Arena", unit: "m3", currency: "PEN" },
          { description: "Acero", unit: "kg", currency: "PEN" },
        ],
      },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: { code: "BATCH_LIMIT_EXCEEDED", message: expect.any(String) } }));
  });

  it("supports catalog pagination and rejects unknown versions", () => {
    const handler = createHandler();
    const page = handler({
      method: "GET",
      path: "/v1/catalog/resources?limit=2",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page.status).toBe(200);
    expect(page.body).toEqual(expect.objectContaining({
      version: "2026-08-17.1",
      resources: expect.any(Array),
      nextCursor: "2",
    }));

    const missingVersion = handler({
      method: "GET",
      path: "/v1/catalog/versions/unknown",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missingVersion.status).toBe(404);
  });

  it("passes the consumer contract through the WebApp adapter", async () => {
    const handler = createHandler();
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) as unknown : undefined;
      const response = handler({
        method: init?.method ?? "GET",
        path: new URL(String(_input)).pathname,
        headers: { authorization: String(new Headers(init?.headers).get("authorization")) },
        body,
      });
      return new Response(JSON.stringify(response.body), { status: response.status, headers: response.headers });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new McPresupuestosPriceApiProvider({
      name: "mc-presupuestos-price-api",
      baseUrl: "https://price-api.test",
      apiVersion: "v1",
      credential: token,
      timeoutMs: 1000,
    });
    const quotes = await provider.lookup([{
      externalResourceId: "cemento-portland-tipo-i",
      description: "Cemento Portland Tipo I",
      unit: "bol",
      currency: "PEN",
      currentPrice: "20.0000",
    }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(quotes[0]).toEqual(expect.objectContaining({ price: "27.4500", currency: "PEN" }));
  });
});
