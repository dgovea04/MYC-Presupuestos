# Notas del proveedor Gemma (Gemini API)

> Última actualización: 2026-06-15

## Modelo restringido

`gemma-4-31b-it` está restringido a **autocomplete-only**. Para chat, APU, review y demás tareas, se hace fallback automático a `gemini-2.5-flash-lite`.

### Evidencia

Se probaron 4 enfoques distintos, todos con el mismo resultado: Gemma outputea su chain-of-thought/planning en inglés como respuesta, sin producir nunca una respuesta final.

| Prueba | System prompt | Formato | Resultado |
|--------|:---:|:---:|-----|
| `system_instruction` nativo | ✅ complejo | Gemini nativo | ❌ planning en inglés |
| + anti-razonamiento | ✅ con "IMPORTANTE" | Gemini nativo | ❌ planning en inglés |
| Flat prompt (`SYSTEM:`) | ✅ simplificado | Ollama-style | ❌ planning en inglés |
| Prompt desnudo (curl) | ❌ ninguno | Solo user msg | ❌ planning en inglés |

El modelo lee las instrucciones (incluyendo "IMPORTANTE: No incluyas tu proceso de razonamiento...") pero las incorpora como parte de su monólogo interno en vez de obedecerlas.

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `lib/ai/gateway/providers/gemini-provider.ts` | 6 fixes/features |
| `lib/ai/gateway/providers/gemini-provider.test.ts` | 21 tests (6 nuevos) |
| `lib/ai/service.ts` | 2 cambios en streaming path |

## Cambios implementados

### 1. Fix de regex en `simplifyMessagesForGemma` (bug)

Las regex originales eliminaban el texto de reglas pero dejaban el prefijo `"- "` huérfano, produciendo cadenas corruptas `"- - - - No modifiques..."`.

**Fix**: Las regex ahora matchean la línea completa incluyendo el bullet, con limpieza de bullets vacíos.

```ts
.replace(/- No uses markdown cuando el output\.format sea json_only\.\s*/g, "")
.replace(/^\s*-\s*$/gm, "")
.replace(/\n{3,}/g, "\n\n")
```

### 2. Instrucción anti-razonamiento

Se agregó al system prompt simplificado para Gemma:
```
IMPORTANTE: No incluyas tu proceso de razonamiento, esquemas ni planificacion en tu respuesta.
Responde DIRECTAMENTE con el contenido solicitado, sin anteponer un indice ni un outline mental.
```

No funcionó con `gemma-4-31b-it`, pero se mantiene para posibles modelos Gemma futuros.

### 3. Flat prompt para Gemma

Cambiado `useFlatPrompt: false` → `useFlatPrompt: isGemma`. Los modelos Gemma ahora reciben el system prompt como `SYSTEM:\n` prefix en `contents` (formato Ollama), en vez del campo `system_instruction` nativo de Gemini.

### 4. Preservación de contexto pre-construido

`simplifyMessagesForGemma` ahora detecta bloques de contexto que empiezan con `"Contexto operativo de MYC Presupuestos:"` (formato de `buildChatMessages` / `buildContextString`). Antes solo detectaba el formato `"Solicitud del usuario"` de los task payloads.

### 5. Restricción autocomplete-only

- `AUTOCOMPLETE_ONLY_MODELS = new Set(["gemma-4-31b-it"])`
- `resolveEffectiveGeminiModel(requestedModel, task?)` → fallback a `DEFAULT_GEMINI_MODEL` si el modelo es Gemma y task ≠ `"autocomplete"`
- Usado en `executeGeminiProvider` (recibe `task`) y `streamChatAiResponse` (hardcodea `"chat"`)

### 6. Tests

| Test | Archivo |
|------|---------|
| Simplificación de mensajes con bullets | `gemini-provider.test.ts` |
| Contexto pre-construido preservado | `gemini-provider.test.ts` |
| `resolveEffectiveGeminiModel` (4 casos) | `gemini-provider.test.ts` |
| Integración: Gemma + chat → fallback a default | `gemini-provider.test.ts` |

## Cómo agregar un nuevo modelo Gemma en el futuro

Si se agrega un nuevo modelo Gemma que sí funcione correctamente:

1. Agregarlo a `GEMINI_MODEL_OPTIONS` en `gemini-provider.ts`
2. **No** agregarlo a `AUTOCOMPLETE_ONLY_MODELS` a menos que tenga el mismo problema
3. Si es un modelo Gemma (prefijo `gemma-`), automáticamente usará flat prompt y simplificación de mensajes
