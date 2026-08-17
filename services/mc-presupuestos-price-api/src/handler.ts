import { randomUUID, timingSafeEqual } from "node:crypto";
import { getCuratedCatalog, hasCatalogVersion, lookupCuratedPrices } from "./catalog";
import { API_VERSION, CATALOG_VERSION, lookupRequestSchema, SERVICE_NAME } from "./contract";

export type PriceApiHandlerConfig = {
  serviceToken: string;
  maxBatchSize?: number;
  rateLimitPerMinute?: number;
  now?: () => Date;
};

type HandlerRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
};

export type HandlerResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export function createPriceApiHandler(config: PriceApiHandlerConfig) {
  const maxBatchSize = config.maxBatchSize ?? 50;
  const rateLimitPerMinute = config.rateLimitPerMinute ?? 120;
  const now = config.now ?? (() => new Date());
  const lookupRateLimit = { windowStartedAt: 0, attempts: 0 };

  return function handle(request: HandlerRequest): HandlerResponse {
    const requestId = request.headers["x-request-id"]?.slice(0, 100) || randomUUID();
    const baseHeaders = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    };

    if (!config.serviceToken) {
      return json(503, baseHeaders, {
        error: { code: "SERVICE_NOT_CONFIGURED", message: "El token del servicio no está configurado." },
      });
    }

    if (!isAuthorized(request.headers.authorization, config.serviceToken)) {
      return json(401, baseHeaders, {
        error: { code: "AUTHENTICATION_FAILED", message: "Credencial de servicio inválida." },
      });
    }

    const url = new URL(request.path, "http://mc-presupuestos-price-api.local");
    if (request.method === "GET" && url.pathname === `/${API_VERSION}/health`) {
      return json(200, baseHeaders, {
        ok: true,
        service: SERVICE_NAME,
        version: API_VERSION,
        catalogVersion: CATALOG_VERSION,
        checkedAt: now().toISOString(),
      });
    }

    if (request.method === "GET" && url.pathname === `/${API_VERSION}/ready`) {
      const ready = getCuratedCatalog().length > 0;
      return json(ready ? 200 : 503, baseHeaders, {
        ready,
        service: SERVICE_NAME,
        version: API_VERSION,
        catalogVersion: CATALOG_VERSION,
      });
    }

    if (request.method === "POST" && url.pathname === `/${API_VERSION}/resource-prices:lookup`) {
      const rateLimit = consumeLookupRateLimit(lookupRateLimit, now().getTime(), rateLimitPerMinute);
      if (!rateLimit.allowed) {
        return json(429, { ...baseHeaders, "retry-after": String(rateLimit.retryAfterSeconds), "x-ratelimit-remaining": "0" }, {
          error: { code: "RATE_LIMITED", message: "Se alcanzó el límite de consultas del proveedor." },
        });
      }

      const parsed = lookupRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return json(400, baseHeaders, {
          error: { code: "INVALID_REQUEST", message: "El lote de recursos no cumple el contrato V1." },
        });
      }
      if (parsed.data.resources.length > maxBatchSize) {
        return json(400, baseHeaders, {
          error: { code: "BATCH_LIMIT_EXCEEDED", message: `El lote máximo es de ${maxBatchSize} recursos.` },
        });
      }

      return json(200, { ...baseHeaders, "x-ratelimit-remaining": String(rateLimit.remaining) }, lookupCuratedPrices(parsed.data.resources, now()));
    }

    if (request.method === "GET" && url.pathname === `/${API_VERSION}/catalog/resources`) {
      const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 100);
      const cursor = parsePositiveInteger(url.searchParams.get("cursor"), 0, Number.MAX_SAFE_INTEGER);
      const resources = getCuratedCatalog();
      const page = resources.slice(cursor, cursor + limit);
      const nextCursor = cursor + page.length < resources.length ? String(cursor + page.length) : null;
      return json(200, baseHeaders, { version: CATALOG_VERSION, resources: page, nextCursor });
    }

    const versionPrefix = `/${API_VERSION}/catalog/versions/`;
    if (request.method === "GET" && url.pathname.startsWith(versionPrefix)) {
      const version = decodeURIComponent(url.pathname.slice(versionPrefix.length));
      if (!hasCatalogVersion(version)) {
        return json(404, baseHeaders, {
          error: { code: "VERSION_NOT_FOUND", message: "La versión de catálogo no existe." },
        });
      }
      return json(200, baseHeaders, { version, resources: getCuratedCatalog() });
    }

    return json(404, baseHeaders, {
      error: { code: "NOT_FOUND", message: "Endpoint no encontrado." },
    });
  };
}

function isAuthorized(authorization: string | undefined, expectedToken: string) {
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(provided);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function consumeLookupRateLimit(state: { windowStartedAt: number; attempts: number }, nowMs: number, maxAttempts: number) {
  const windowMs = 60_000;
  if (state.windowStartedAt === 0 || nowMs - state.windowStartedAt >= windowMs) {
    state.windowStartedAt = nowMs;
    state.attempts = 0;
  }

  state.attempts += 1;
  const allowed = state.attempts <= maxAttempts;
  return {
    allowed,
    remaining: Math.max(0, maxAttempts - state.attempts),
    retryAfterSeconds: Math.max(1, Math.ceil((state.windowStartedAt + windowMs - nowMs) / 1000)),
  };
}

function parsePositiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function json(status: number, headers: Record<string, string>, body: unknown): HandlerResponse {
  return { status, headers, body };
}
