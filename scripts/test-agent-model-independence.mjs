#!/usr/bin/env node
// Requiere Node >= 20 (usa `Headers#getSetCookie()` para recoger múltiples
// `Set-Cookie` de la respuesta de login). El script tiene un fallback a
// `headers.get('set-cookie')` para runtimes antiguos, pero el flujo moderno
// lo evita — si lo corres con Node 18 y falla el login sin motivo aparente,
// revisa primero la versión.
//
// Reproducción programática del bug que el usuario reportó:
//
//   "el khipu agente no esta guardando la seleccion de modelo que hago"
//   (y el dual: configurar openrouter en Proveedores Cloud IA reseteaba
//    el modelo seleccionado en Khipu Agente al DEFAULT_AGENT_MODEL).
//
// El fix distingue en `app/api/settings/ai-provider/route.ts` entre
// `agentModel` ausente (`undefined`) y `agentModel` explícitamente null/"" —
// sólo el último caso escribe null a la DB. Este script verifica esa
// semántica a nivel de integración.
//
// Prerrequisitos:
//   - Servidor dev en http://localhost:3000 (`npm run dev`).
//   - DB sembrada (`npx tsx prisma/seed.ts` o equivalente).
//   - La migración que agrega agentModel a UserSettings debe estar aplicada.
//     Si no, la ruta responde 500 con un mensaje accionable y el script
//     aborta de forma clara.
//
// Uso:
//   node scripts/test-agent-model-independence.mjs
//
// Variables opcionales:
//   TEST_BASE_URL       (default http://localhost:3000)
//   TEST_USER_EMAIL     (default demo@mycpresupuestos.pe)
//   TEST_USER_PASSWORD  (default Demo12345)
//   TEST_AGENT_MODEL    (default google/gemini-3.1-flash-lite — el modelo que
//                        el usuario mencionó en el reporte original. Cualquier
//                        ID presente en lib/ai/agent/models.ts sirve.)
//   TEST_CLOUD_MODEL    (default openrouter/free — el que CloudAiSettingsCard
//                        enviará en su PUT para competir con la selección del
//                        agente.)
//   TEST_OPENROUTER_KEY (default un dummy `sk-or-test-v1-e2e-…` que sobreescribe
//                        la key real del usuario. Setea con tu propia key si
//                        quieres preservar la pre-existente.)
//   TEST_KEEP_STATE=1   (skip del cleanup al final, para inspección manual.)
//
// Salida: exit 0 = PASS, exit 1 = FAIL.

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_USER_EMAIL ?? "demo@mycpresupuestos.pe";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "Demo12345";
// Selección por defecto = el modelo que el usuario mencionó en el reporte
// original ("gemini 3.1"). Override con TEST_AGENT_MODEL=<id> si prefieres
// otro modelo no-default del catálogo curado.
const TARGET_AGENT_MODEL = process.env.TEST_AGENT_MODEL ?? "google/gemini-3.1-flash-lite";
// ⚠ NO asertes contra TARGET_CLOUD_MODEL en el campo `agentModel`: por
// defecto es `openrouter/free` que coincide con DEFAULT_AGENT_MODEL. Si
// alguien refactoriza la aserción a `final.agentModel !== TARGET_CLOUD_MODEL`
// el test pasaría siempre aunque el fix estuviera roto.
const TARGET_CLOUD_MODEL = process.env.TEST_CLOUD_MODEL ?? "openrouter/free";

const LOG_PREFIX = "[agent-model-independence]";

// Nombres de cookies que pueden venir como session-token / csrf-token en este
// proyecto. Cubrimos defaults de NextAuth y los nombres custom configurados
// en `lib/auth/cookies.ts` (`myc-presupuestos.session-token` y su variante
// `__Secure-` cuando NEXTAUTH_URL apunta a HTTPS).
const CSRF_COOKIE_NAMES = [
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
];
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  // Custom names (lib/auth/cookies.ts → authSessionCookieName).
  "myc-presupuestos.session-token",
  "__Secure-myc-presupuestos.session-token",
];

// Nota sobre cookies `Secure`: NextAuth v4 marca la cookie de sesión con el
// atributo `Secure` cuando NEXTAUTH_URL empieza por https. Los navegadores
// rechazan dispatchar cookies Secure sobre http://, pero Node `fetch` ignora
// ese flag (las semánticas del navegador no aplican a llamadas programáticas),
// por eso este script funciona igual sobre http://localhost aunque la cookie
// venga con `Secure` en sus atributos. Por eso listamos ambas variantes
// (`__Secure-…` y `…`) arriba.

function logStep(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logPass(message) {
  console.log(`✅ PASS — ${message}`);
}

function logFail(message) {
  console.error(`❌ FAIL — ${message}`);
}

// ─── Helpers de fetch ───────────────────────────────────────────────────────

function collectSetCookies(response) {
  // Node's fetch exposes Headers#getSetCookie() (Node 19.7+, Node 20+).
  // Retorna un array de strings "cookie=value; Path=/; ...".
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function parseCookieValue(setCookieStrings, names) {
  // Extrae `nombre=valor` de los strings set-cookie (sin atributos).
  for (const line of setCookieStrings) {
    const [pair] = line.split(";");
    const [name, ...rest] = pair.split("=");
    if (names.includes(name.trim())) {
      return `${name.trim()}=${rest.join("=")}`;
    }
  }
  return null;
}

function joinCookies(...pairs) {
  // Une pares `nombre=valor` filtrando nulls y duplicados (el último gana).
  const map = new Map();
  for (const pair of pairs) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1);
    map.set(name, value);
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function fetchRaw(method, path, body, headers) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    redirect: "manual",
  });
}

// ─── Login via Credentials provider ─────────────────────────────────────────

async function login() {
  logStep(`Login en ${BASE_URL} como ${EMAIL}…`);

  // (1) CSRF token para que next-auth valide el POST.
  const csrfResponse = await fetchRaw("GET", "/api/auth/csrf", null, {});
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF: ${csrfResponse.status}`);
  }
  const csrfJson = await csrfResponse.json();
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = collectSetCookies(csrfResponse);
  const csrfCookieValue = parseCookieValue(csrfCookies, CSRF_COOKIE_NAMES);
  if (!csrfToken) {
    throw new Error("next-auth no devolvió csrfToken.");
  }
  if (!csrfCookieValue) {
    throw new Error("next-auth no estableció next-auth.csrf-token en la respuesta.");
  }

  // (2) POST credenciales. Devuelve el session-token en set-cookie.
  const formBody = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE_URL}/dashboard`,
    json: "true",
  });
  const loginResponse = await fetchRaw(
    "POST",
    "/api/auth/callback/credentials",
    formBody.toString(),
    {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookieValue,
    },
  );
  const loginCookies = collectSetCookies(loginResponse);
  const sessionCookieValue = parseCookieValue(loginCookies, SESSION_COOKIE_NAMES);
  if (!sessionCookieValue) {
    throw new Error(
      `Login no devolvió session-token (status=${loginResponse.status}). ` +
        "¿EMAIL/PASSWORD correctos y usuario con emailVerifiedAt?",
    );
  }
  return joinCookies(csrfCookieValue, sessionCookieValue);
}

// ─── Lectura/escritura de settings ──────────────────────────────────────────

async function apiGet(sessionCookie, path) {
  const response = await fetchRaw("GET", path, null, { Cookie: sessionCookie });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} ${response.status}: ${text}`);
  }
  return response.json();
}

async function apiPut(sessionCookie, path, body) {
  const response = await fetchRaw("PUT", path, JSON.stringify(body), {
    Cookie: sessionCookie,
    "Content-Type": "application/json",
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

// ─── Flujo principal ────────────────────────────────────────────────────────

async function main() {
  // 0. Servidor reachable.
  try {
    const probe = await fetch(BASE_URL, { method: "HEAD", redirect: "manual" });
    logStep(`Servidor responde (probe @${BASE_URL}/ → ${probe.status}).`);
  } catch (error) {
    logFail(`Servidor no responde en ${BASE_URL}. Levanta el dev con \`npm run dev\`.`);
    console.error(error);
    process.exit(1);
  }

  // 1. Login + capturar cookie.
  const sessionCookie = await login();

  // 2. Baseline: leer valores actuales para restaurar al final.
  logStep("Capturando baseline del usuario demo…");
  let baseline;
  try {
    baseline = await apiGet(sessionCookie, "/api/settings/ai-provider");
  } catch (error) {
    logFail(`No se pudo leer el estado inicial: ${error.message}`);
    throw error;
  }
  const baselineAgentModel = baseline.agentModel ?? "";
  const baselineOpenrouterKey = baseline.openrouterApiKeyMasked ? "present" : "";
  logStep(
    `   baseline agentModel=${JSON.stringify(baselineAgentModel)}, ` +
      `openrouterApiKey=${baselineOpenrouterKey || "vacío"}`,
  );

  try {
    // 3. Paso 1 — Khipu Agente guarda TARGET_AGENT_MODEL.
    logStep(`Paso 1 (Khipu Agente): PUT agentModel=${TARGET_AGENT_MODEL}…`);
    const step1 = await apiPut(sessionCookie, "/api/settings/ai-provider", {
      agentModel: TARGET_AGENT_MODEL,
      aiProviderPreference: "auto",
    });
    if (step1.status !== 200) {
      const errorText = JSON.stringify(step1.body ?? {});
      if (errorText.includes("agentModel") && errorText.includes("migracion")) {
        logFail(
          "MIGRACIÓN PENDIENTE: la columna agentModel no existe en UserSettings. " +
            "Aplica la migración `20260714000000_add_agent_model_to_user_settings` " +
            "con `npx prisma migrate deploy` y vuelve a correr.",
        );
        process.exit(1);
      }
      logFail(`Paso 1 devolvió ${step1.status}: ${errorText}`);
      process.exit(1);
    }
    if (step1.body?.agentModel !== TARGET_AGENT_MODEL) {
      logFail(
        `Paso 1 esperaba agentModel=${TARGET_AGENT_MODEL}, recibió ${JSON.stringify(step1.body?.agentModel)}.`,
      );
      process.exit(1);
    }
    logStep(`   OK — agentModel guardado como ${TARGET_AGENT_MODEL}.`);

    // 4. Paso 2 — Proveedores Cloud IA guarda openrouter SIN incluir agentModel.
    logStep(
      `Paso 2 (Proveedores Cloud IA): PUT solo openrouterApiKey + openrouterModel=${TARGET_CLOUD_MODEL} (sin agentModel)…`,
    );
    // El dummy key se sobreescribe sólo cuando el operador NO aportó su
    // propio `TEST_OPENROUTER_KEY` (útil para QA que quiere conservar la
    // key real pre-existente en la DB en lugar de contaminarla con un
    // string de test).
    const dummyOpenrouterKey =
      process.env.TEST_OPENROUTER_KEY ??
      "sk-or-test-v1-e2e-fake-key-not-real";
    const step2 = await apiPut(sessionCookie, "/api/settings/ai-provider", {
      openrouterApiKey: dummyOpenrouterKey,
      openrouterModel: TARGET_CLOUD_MODEL,
      aiProviderPreference: "openrouter",
    });
    if (step2.status !== 200) {
      logFail(`Paso 2 devolvió ${step2.status}: ${JSON.stringify(step2.body ?? {})}`);
      process.exit(1);
    }
    if (step2.body?.openrouterModel !== TARGET_CLOUD_MODEL) {
      logFail(
        `Paso 2 esperaba openrouterModel=${TARGET_CLOUD_MODEL}, recibió ${JSON.stringify(step2.body?.openrouterModel)}.`,
      );
      process.exit(1);
    }

    // 5. Verificación: reload /api/settings/ai-provider debe seguir mostrando gemini.
    logStep("Verificación: GET /api/settings/ai-provider…");
    const final = await apiGet(sessionCookie, "/api/settings/ai-provider");
    if (final.agentModel === TARGET_AGENT_MODEL) {
      logPass(
        `agentModel se preservó correctamente: ${JSON.stringify(final.agentModel)} ` +
          `(NO se sobreescribió a ${JSON.stringify(final.agentModel) === '""' ? "default" : "null/otro"}).`,
      );
    } else {
      logFail(
        `agentModel fue sobreescrito: esperaba ${JSON.stringify(TARGET_AGENT_MODEL)}, ` +
          `recibí ${JSON.stringify(final.agentModel)}.`,
      );
      process.exit(1);
    }
  } finally {
    // 6. Cleanup: restaurar el estado baseline (best-effort, no afecta el exit code).
    // Escape hatch para QA manual: con TEST_KEEP_STATE=1 la DB queda en el
    // estado post-test (útil para inspeccionar visualmente en el navegador).
    if (process.env.TEST_KEEP_STATE === "1") {
      logStep("Cleanup omitido (TEST_KEEP_STATE=1). El estado post-test queda en la DB.");
    } else {
      // Advertencia explícita cuando el usuario tenía una key real pre-test
      // y el cleanup la va a sobreescribir con "". El operador puede
      // entonces decidir abortar con Ctrl+C y re-correr con TEST_KEEP_STATE=1
      // para inspeccionar primero.
      if (baselineOpenrouterKey === "present") {
        logStep(
          "   AVISO — el usuario tenía openrouterApiKey configurada; el cleanup " +
            "la va a limpiar. Usa TEST_KEEP_STATE=1 para conservar el estado post-test.",
        );
      }
      try {
        logStep("Cleanup: restaurando baseline…");
        await apiPut(sessionCookie, "/api/settings/ai-provider", {
          agentModel: baselineAgentModel.length > 0 ? baselineAgentModel : null,
          openrouterApiKey: "",
          openrouterModel: "",
        });
        logStep("   OK — baseline restaurado.");
      } catch (error) {
        logStep(`   WARN — cleanup falló: ${error.message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`${LOG_PREFIX} Error inesperado:`, error);
  process.exit(1);
});
