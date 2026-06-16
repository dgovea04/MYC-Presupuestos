import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getDecryptedOpenaiApiKey, getDecryptedGeminiApiKey } from "@/lib/data/settings";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(userId) ?? [];
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = timestamps.filter((ts) => ts > windowStart);

  if (recent.length >= RATE_LIMIT_MAX) {
    const oldestRecent = recent[0]!;
    const retryAfterMs = oldestRecent + RATE_LIMIT_WINDOW_MS - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  recent.push(now);
  rateLimitStore.set(userId, recent);

  // Periodic cleanup: remove entries older than 2 windows
  if (Math.random() < 0.1) {
    for (const [key, entries] of rateLimitStore) {
      const fresh = entries.filter((ts) => ts > now - RATE_LIMIT_WINDOW_MS * 2);
      if (fresh.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, fresh);
      }
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(retryAfterMs / 1000)} segundos.`,
        retryAfterMs,
        remaining: 0,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
    }

    const provider = typeof body.provider === "string" ? body.provider : "";
    const providedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0
      ? body.apiKey.trim()
      : null;

    let apiKey = providedApiKey;

    // If no key provided in request, try to get the stored one
    if (!apiKey) {
      if (provider === "openai") {
        apiKey = await getDecryptedOpenaiApiKey(session.user.id);
      } else if (provider === "gemini") {
        apiKey = await getDecryptedGeminiApiKey(session.user.id);
      }
    }

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: "No API key configurada." }, { status: 400 });
    }

    if (provider === "openai") {
      const isValid = await testOpenaiKey(apiKey);
      return NextResponse.json({ valid: isValid });
    }

    if (provider === "gemini") {
      const isValid = await testGeminiKey(apiKey);
      return NextResponse.json({ valid: isValid });
    }

    return NextResponse.json({ valid: false, error: "Proveedor no soportado." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Error al probar conexión." },
      { status: 500 },
    );
  }
}

async function testOpenaiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [{ role: "user", content: "Respond with 'ok'." }],
      }),
    });

    // 401/403 = invalid key, 200 = valid, others = check
    if (response.status === 401 || response.status === 403) {
      return false;
    }

    return response.ok;
  } catch {
    return false;
  }
}

async function testGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Respond with 'ok'." }] }],
        }),
      },
    );

    // 400 with API_KEY_INVALID, 403 = invalid key
    if (response.status === 400 || response.status === 403) {
      const payload: unknown = await response.json();
      if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
        if (payload.error.message.includes("API_KEY_INVALID") || payload.error.message.includes("API key not valid")) {
          return false;
        }
      }
      return false;
    }

    return response.ok;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
