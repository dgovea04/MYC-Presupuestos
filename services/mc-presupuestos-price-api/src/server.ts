import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPriceApiHandler } from "./handler";

const port = parsePort(process.env.PRICE_API_PORT);
const serviceToken = process.env.PRICE_API_SERVICE_TOKEN ?? "";
const maxBatchSize = parseBatchSize(process.env.PRICE_API_MAX_BATCH_SIZE);
const rateLimitPerMinute = parseRateLimit(process.env.PRICE_API_RATE_LIMIT_PER_MINUTE);
const handle = createPriceApiHandler({ serviceToken, maxBatchSize, rateLimitPerMinute });
const maxBodyBytes = 1_048_576;

const server = createServer(async (request, response) => {
  const startedAt = Date.now();
  try {
    const body = await readJsonBody(request);
    const result = handle({
      method: request.method ?? "GET",
      path: request.url ?? "/",
      headers: normalizeHeaders(request),
      body,
    });
    writeResponse(response, result.status, result.headers, result.body);
    console.log(JSON.stringify({
      service: "mc-presupuestos-price-api",
      requestId: result.headers["x-request-id"] ?? null,
      method: request.method ?? "GET",
      path: sanitizePath(request.url ?? "/"),
      status: result.status,
      latencyMs: Date.now() - startedAt,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Solicitud inválida.";
    writeResponse(response, 400, { "content-type": "application/json; charset=utf-8" }, {
      error: { code: "INVALID_REQUEST", message },
    });
    console.log(JSON.stringify({
      service: "mc-presupuestos-price-api",
      requestId: null,
      method: request.method ?? "GET",
      path: sanitizePath(request.url ?? "/"),
      status: 400,
      latencyMs: Date.now() - startedAt,
    }));
  }
});

server.listen(port, () => {
  console.log(`[${new Date().toISOString()}] mc-presupuestos-price-api escuchando en ${port}`);
});

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new Error("El cuerpo de la solicitud supera el límite permitido.");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function normalizeHeaders(request: IncomingMessage) {
  return Object.fromEntries(
    Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value]),
  );
}

function writeResponse(response: ServerResponse, status: number, headers: Record<string, string>, body: unknown) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function parsePort(value: string | undefined) {
  const parsed = Number(value ?? "8787");
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8787;
}

function parseRateLimit(value: string | undefined) {
  const parsed = Number(value ?? "120");
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10000 ? parsed : 120;
}

function sanitizePath(value: string) {
  try {
    return new URL(value, "http://mc-presupuestos-price-api.local").pathname;
  } catch {
    return "/invalid";
  }
}

function parseBatchSize(value: string | undefined) {
  const parsed = Number(value ?? "50");
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 50;
}
