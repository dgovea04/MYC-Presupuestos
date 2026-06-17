# KHIPU AI PLATFORM V2
## PRD Maestro - MYC Presupuestos

Version: 2.0
Fecha: Junio 2026

---

# Resumen Ejecutivo

Khipu ya no es un concepto ni un módulo experimental.

Actualmente posee:

- Workspace IA operativo
- Ollama integrado
- ChatGPT Bridge integrado
- Streaming funcional
- Historial por proyecto
- Retrieval Evidence Layer
- Entitlements y control de consumo
- Generación y revisión de APU
- Chat técnico
- Autocomplete

Por tanto este PRD redefine la estrategia para evolucionar Khipu desde una capa IA funcional hacia un copiloto experto en costos y presupuestos de construcción.

---

# Estado Actual

## Implementado

### Workspace Khipu

- /ai
- licencia ai.local
- Chat técnico
- Generar APU
- Revisar presupuesto
- Autocompletar
- Ollama
- ChatGPT Bridge
- Runtime Health

### Backend

/api/ai/chat
/api/ai/chat/stream
/api/ai/apu
/api/ai/review
/api/ai/autocomplete
/api/ai/apu/generate
/api/ai/health

### Historial

AiProjectHistoryEntry
recordAiProjectHistory
getAiProjectHistory

### Streaming

Ollama Streaming
Server Sent Events
Fallback automático

### Retrieval

buildAiRetrievalEvidence()

Fuentes:

- Partidas catálogo
- Recursos
- Importaciones S10
- Snippets técnicos

### ChatGPT Bridge

MYCBridgeSendPrompt
MYCBridgeResponse
MYCBridgeState

---

# Arquitectura Objetivo V2

Khipu Workspace
      │
      ▼
AI Action Layer
      │
      ▼
AI Gateway
      │
      ├── Ollama Provider
      ├── ChatGPT Bridge Provider
      ├── OpenAI Provider
      ├── Gemini Provider
      └── OpenRouter Provider
      │
      ▼
Context Builder
      │
      ├── Project Context
      ├── Project History
      ├── Project Memory
      ├── Retrieval Evidence
      └── User Request
      │
      ▼
Skill Engine
      │
      ├── APU
      ├── Budget
      ├── Metrados
      ├── Formula Polinomica
      ├── Monte Carlo
      └── Catalog Intelligence

---

# Nuevo AI Gateway

Objetivo:

Abstraer completamente el proveedor IA.

La aplicación nunca debe depender directamente de:

- Ollama
- OpenAI
- Gemini
- ChatGPT Bridge
- OpenRouter

Toda llamada debe pasar por:

```ts
POST /api/ai/execute
```

Request:

```json
{
  "provider": "auto",
  "task": "review_apu",
  "payload": {}
}
```

---

# Providers

## Ollama

Uso:

- rápido
- económico
- local

Ideal para:

- autocomplete
- clasificación
- búsquedas

---

## ChatGPT Bridge

Uso:

- desarrollo
- pruebas
- validación

No producción.

---

## OpenAI Provider

Implementar:

```ts
provider: "openai"
```

Modelos iniciales:

- GPT-5
- GPT-5 Mini

Uso:

- revisión técnica compleja
- razonamiento
- generación avanzada

Variables:

```env
OPENAI_API_KEY=
```

Servicio:

```ts
executeOpenAI()
```

---

## Gemini Provider

Implementar:

```ts
provider: "gemini"
```

Modelos:

- Gemini 2.5 Pro
- Gemini 2.5 Flash

Uso:

- fallback
- análisis largos
- documentos extensos

Variables:

```env
GEMINI_API_KEY=
```

Servicio:

```ts
executeGemini()
```

---

## OpenRouter Provider

Implementar:

```ts
provider: "openrouter"
```

Modelos iniciales:

- DeepSeek Chat V3

Uso:

- fallback alternativo de nube
- pruebas de razonamiento
- acceso a modelos agregados

Variables:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Servicio:

```ts
executeOpenRouter()
```

---

# Routing Inteligente

Provider auto:

Autocomplete
→ Ollama

Review APU
→ OpenAI

Review Budget
→ OpenAI

Documentos grandes
→ Gemini

Desarrollo local
→ ChatGPT Bridge

Proveedor cloud alternativo
→ OpenRouter

Fallback:

OpenAI
↓
Gemini
↓
OpenRouter
↓
Ollama

---

# Project Memory

Nuevo módulo.

Actualmente existe historial.

No existe memoria.

Tabla:

project_ai_memory

Campos:

- id
- project_id
- memory_type
- fact
- confidence
- source
- created_at

Ejemplo:

"Proyecto utiliza excavadora CAT 320"

La IA debe recordarlo.

---

# Quality Feedback System

Estado:

Actualmente en implementación.

Reemplaza la sección "No implementado".

Objetivo:

Medir calidad real de sugerencias.

---

Tabla

khipu_suggestion_feedback

Campos:

- id
- project_id
- user_id
- provider
- model
- task
- suggestion_type
- action_type
- prompt_hash
- response_hash
- created_at

---

Acciones

Applied

Edited

Discarded

---

Métricas

Acceptance Rate

Applied / Total

Edit Rate

Edited / Total

Discard Rate

Discarded / Total

Provider Quality Score

OpenAI vs Gemini vs Ollama

---

# Retrieval Automático

Actualmente es opcional.

V2:

100% obligatorio.

Antes de llamar al modelo:

1. Project Context
2. Project History
3. Project Memory
4. Retrieval Evidence

Siempre.

---

# Catálogo Inteligente

Regla principal:

La IA no debe inventar recursos.

Proceso:

1 Buscar Partidas similares

2 Buscar Insumos similares

3 Calcular score

4 Proponer recursos existentes

5 Solo si no existe:
crear sugerencia nueva

---

# Skill Engine

## skill-apu

Generación y revisión APU

## skill-budget

Revisión presupuesto

## skill-metrados

Control metrados

## skill-formula-polinomica

Validación fórmula

## skill-risk

Monte Carlo

## skill-catalog

Catálogo inteligente

---

# Tasks Oficiales

review_apu

generate_apu

suggest_insumos

review_budget

generate_partida

review_formula_polinomica

review_quantity_takeoff

montecarlo_risk_analysis

chat

autocomplete

---

# Monte Carlo Roadmap

Fase 1

Desviación de metrados

Fase 2

Desviación de precios

Resultados:

P50

P80

P90

Costo esperado

Distribución

Histogramas

---

# Roadmap

## V2.1

Quality Feedback System

## V2.2

Project Memory

## V2.3

Retrieval Automático

## V2.4

OpenAI Provider

## V2.5

Gemini Provider

## V2.6

OpenRouter Provider

## V2.7

Skill Engine

## V3

Monte Carlo Assistant

## V4

Copiloto experto integral de costos y presupuestos

---

# Objetivo Final

Convertir Khipu en el copiloto especializado para presupuestos, APU, metrados, fórmula polinómica y gestión de riesgos para construcción en Perú, utilizando arquitectura multi-modelo, memoria de proyecto, catálogo inteligente y aprendizaje continuo basado en feedback real de usuarios.
