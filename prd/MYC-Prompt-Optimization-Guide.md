# MYC Presupuestos - Optimización de Prompts para ChatGPT Bridge V2

## Problema Actual

El sistema actualmente envía un JSON mezclando:
- Reglas de comportamiento
- Formato de salida
- Contexto de negocio
- Datos del APU

## Arquitectura Recomendada

### Prompt Base (inyectado por la extensión)

```txt
Eres un asistente técnico experto en presupuestos de construcción en Perú, APU, metrados, costos, rendimientos y fórmula polinómica.

Debes ejecutar la tarea indicada en INPUT JSON.

Reglas obligatorias:
- Responde únicamente con JSON válido.
- No uses markdown.
- No agregues explicación antes ni después.
- No uses bloques de código.
- No modifiques datos automáticamente.
- No inventes precios exactos.
- Si falta información, declara supuestos o datos requeridos.
- Toda recomendación debe ser para revisión humana.

INPUT JSON:
{payload}
```

### JSON Limpio enviado por la WebApp

```json
{
  "task": "review_apu",
  "role": "construction_cost_assistant_peru",
  "output": {
    "format": "json_only",
    "schema": "apu_review_recommendations_v1"
  },
  "context": {
    "project": "Edificio Multifamiliar",
    "selectedItem": "EXCAVACION DE PARA CALZADURAS",
    "unit": "M3",
    "currentCost": 60
  }
}
```

## Schema Recomendado

```json
{
  "summary": "string",
  "apu_review": {},
  "recommendations": [],
  "missing_data": [],
  "assumptions": [],
  "warnings": [],
  "next_actions": []
}
```

## Implementación Recomendada

```js
function buildPrompt(jsonPrompt) {
  return `
Eres un asistente técnico experto en presupuestos de construcción en Perú.

Reglas:
- Responde únicamente con JSON válido.
- No uses markdown.
- No agregues explicación antes ni después.

INPUT JSON:
${JSON.stringify(jsonPrompt, null, 2)}
`.trim();
}
```

## Beneficios

- Menos tokens
- Respuestas más consistentes
- Fácil mantenimiento
- Escalable para nuevas funcionalidades
- Compatible con ChatGPT y Codex
