# E2E Runbook — Independencia entre Khipu Agente y Proveedores Cloud IA

> **Objetivo.** Verificar end-to-end que el modelo seleccionado en la tarjeta
> **Khipu Agente** no se sobreescribe cuando el usuario guarda cambios sólo
> en **Proveedores Cloud IA** (síntoma original: el agente regresaba a
> `openrouter/free` — el `DEFAULT_AGENT_MODEL` — al refrescar).

---

## 1. Contexto y causa raíz

- **Ruta:** `app/api/settings/ai-provider/route.ts`
- **Síntoma (antes del fix):** `PUT /api/settings/ai-provider` aplana la
  ausencia del campo a `agentModel = null`. Luego el data layer escribe
  `null` en la DB (`includesAgentModel !== undefined === true` cuando el valor
  es null). Al refrescar, Khipu Agente lee `agentModel = ""` y cae al
  `DEFAULT_AGENT_MODEL`.
- **Fix:** el handler distingue entre `hasOwnProperty('agentModel') === false`
  (preservar DB) y `=== true` con `null/""` (clear explícito). Myme
  contrato se extiende también a `aiProviderPreference`.

Ver también:
- Suite de tests unitarios en
  `app/api/settings/ai-provider/route.test.ts` (24 tests en el momento de
  redactar este runbook).
- Capa de datos en `lib/data/settings.ts` → `updateAiProviderSettings`
  (lanzará un error accionable si la migración
  `20260714000000_add_agent_model_to_user_settings` no se ha aplicado).

---

## 2. Pre-condiciones comunes

| Requisito | Cómo verificar |
| --- | --- |
| Servidor dev arriba | `curl http://localhost:3000/ → 200` o `npm run dev` muestra "Ready" |
| Migración aplicada | En Prisma Studio/PGStudio: `UserSettings` debe tener la columna `agentModel` (text, nullable) |
| DB sembrada | El usuario `demo@mycpresupuestos.pe` existe con `passwordHash != null` y `emailVerifiedAt != null` (`npx tsx prisma/seed.ts`) |
| Chrome instalado | `Google Chrome` disponible en el host (lo requiere `browser-use`) |
| Reachability | `curl http://localhost:3000/api/auth/csrf → 200 con `{csrfToken: "..."}` |

---

## 3. Reproducción automatizada HTTP (rápido + reproducible)

Corre un escenario end-to-end sin necesidad de Chrome. Login + PUT + GET +
assert + cleanup, todo en Node.

```bash
node scripts/test-agent-model-independence.mjs
```

Override de variables opcionales:

```bash
TEST_BASE_URL=https://staging.example.com \
TEST_USER_EMAIL=qa+indep@mycpresupuestos.pe \
TEST_USER_PASSWORD=qa-secret \
TEST_AGENT_MODEL=google/gemini-2.5-flash \
TEST_CLOUD_MODEL=openrouter/free \
node scripts/test-agent-model-independence.mjs
```

Escape hatch para inspección manual de la DB post-test:

```bash
TEST_KEEP_STATE=1 node scripts/test-agent-model-independence.mjs
# El script NO restaura el baseline; el estado queda en la DB para que
# puedas abrir /settings en el navegador y verificar el render visual.
```

**Salida esperada (PASS):**

```
[agent-model-independence] Servidor responde (probe @http://localhost:3000/ → 200).
[agent-model-independence] Login en http://localhost:3000 como demo@mycpresupuestos.pe…
[agent-model-independence] Capturando baseline del usuario demo…
[agent-model-independence]    baseline agentModel="openrouter/free", openrouterApiKey=vacío
[agent-model-independence] Paso 1 (Khipu Agente): PUT agentModel=google/gemini-3.1-flash-lite…
[agent-model-independence]    OK — agentModel guardado como google/gemini-3.1-flash-lite.
[agent-model-independence] Paso 2 (Proveedores Cloud IA): PUT solo openrouterApiKey + openrouterModel=openrouter/free (sin agentModel)…
[agent-model-independence] Verificación: GET /api/settings/ai-provider…
[agent-model-independence] ✅ PASS — agentModel se preservó correctamente: "google/gemini-3.1-flash-lite"
[agent-model-independence] Cleanup: restaurando baseline…
[agent-model-independence]    OK — baseline restaurado.
```

**Exit codes:**
- `0` → todos los pasos pasaron.
- `1` → fallo (mensaje accionable en stderr). Casos cubiertos:
  - Servidor no reachable → sugiere `npm run dev`.
  - Credenciales inválidas → sugiere revisar `emailVerifiedAt`.
  - Migración pendiente → sugiere `npx prisma migrate deploy`.
  - `agentModel` sobreescrito → muestra el valor antes/después para diff.

---

## 4. Reproducción manual / Browser-Use (UI real en Chrome)

Pensado para ejecutarse con un agente `browser-use` o para QA manual cuando
se quiere validar también el render y la respuesta visual.

### Paso 1 — Login
1. Abrir http://localhost:3000/login.
2. Escribir `demo@mycpresupuestos.pe` en el campo email.
3. Escribir `Demo12345` en el campo password.
4. Click **Iniciar sesión**.
5. Esperar la redirección al dashboard.

### Paso 2 — Navegar a Configuración
- Abre http://localhost:3000/settings.
- Espera que carguen las dos tarjetas: **Khipu Agente** (arriba) y
  **Proveedores Cloud IA** (más abajo).

### Paso 3 — Khipu Agente selecciona `Gemini 3.1 Flash Lite`
1. En la tarjeta Khipu Agente, si el modelo actual es el default
   (`openrouter/free`), ciérralo explícitamente.
2. Click en **Ver modelos más** si la lista está colapsada.
3. Click sobre la tarjeta del modelo **Gemini 3.1 Flash Lite**
   (`google/gemini-3.1-flash-lite`).
4. Verifica que aparece el pin azul a la derecha y el borde resaltado.
5. Click **Guardar** en la esquina superior derecha de la tarjeta.
6. **Esperar** el toast verde: "Modelo guardado correctamente"
   (desaparece tras ~4s).

### Paso 4 — Proveedores Cloud IA configura OpenRouter (sin tocar agente)
1. Scroll hasta la tarjeta **Proveedores Cloud IA**.
2. En la sub-tarjeta **OpenRouter API**, en el campo **Modelo (opcional)**
   escribe `openrouter/free`.
3. (Opcional) añade un valor dummy al campo **API Key** (cualquier string;
   no se validará conexión real durante este test).
4. En el **Proveedor por defecto** del select superior, elige
   `OpenRouter` (o déjalo en `Automático` si prefieres).
5. Click **Guardar** en la tarjeta Proveedores Cloud IA.
6. **Esperar** el toast verde: "Configuración guardada correctamente".

### Paso 5 — Aserción visual (la más importante)
1. **Refresca la página** (F5 o Ctrl+R).
2. En la tarjeta Khipu Agente, verifica que **Gemini 3.1 Flash Lite** sigue
   marcado con el pin azul — NO debe haber vuelto a `openrouter/free`
   (u otro default).
3. **Aserción equivalente vía DevTools** (opcional, para fixer browser-use):
   ```js
   await page.evaluate(() =>
     fetch("/api/settings/ai-provider").then((r) => r.json()).then((j) => j.agentModel),
   );
   // → debe ser "google/gemini-3.1-flash-lite"
   ```

---

## 5. Modo de fallo esperado (para verificar que el test detecta regresiones)

Si alguien revierte el fix y vuelve al comportamiento original
(`input.agentModel = null` cuando el caller omite el campo), el script
HTTP reportará:

```
[agent-model-independence] ❌ FAIL — agentModel fue sobreescrito: esperaba "google/gemini-3.1-flash-lite", recibí "openrouter/free".
```

El runbook manual detectará la regresión porque el paso 5 (aserción visual)
mostrará `openrouter/free` activo en lugar de `Gemini 3.1 Flash Lite`.

---

## 6. Limitaciones / TODO conocido

- **DB pollution mitigada por cleanup best-effort** en el script HTTP. Para
  CI real considerar un rollback transaccional o una DB efímera.
- **Sin cobertura de la migración ausente** — el script aborta con un
  mensaje accionable en lugar de fallar silenciosamente. Si quieres
  cobertura explícita, agregar un test unitario que mockee el data layer
  con `supportsAgentModel = false`.
- **El runbook manual asume una sola cuenta** — si Khipu Agente y
  Proveedores Cloud IA pertenecen a usuarios distintos (multi-tenant),
  el flujo de selección + guardado debe repetirse por cada usuario.

---

## 7. Próximos pasos sugeridos

- Portar este runbook a un spec de Playwright en `e2e/specs/`
  (`@playwright/test` ya viene como dependencia transitiva en
  `package-lock.json`).
- Agregar un set análogo para `aiProviderPreference` (similar a este
  mismo runbook, pero intercambiando los roles: Cloud IA guarda
  preferencia → Khipu Agente guarda modelo → refresh preserva
  preferencia).
- La inspección manual post-test ya está soportada vía
  `TEST_KEEP_STATE=1` (definida en el script).
