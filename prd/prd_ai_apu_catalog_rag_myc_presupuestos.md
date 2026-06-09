# PRD — Sistema Inteligente de Generación APU con IA + Catálogos

# Proyecto
MYC Presupuestos — AI Assisted APU Generation Engine

---

# Objetivo

Construir un sistema inteligente de generación de Análisis de Precios Unitarios (APU) utilizando:

- IA local con Ollama
- Catálogo de Partidas
- Catálogo de Insumos
- búsqueda semántica
- validaciones de negocio
- generación estructurada JSON

El sistema NO debe comportarse como un chatbot genérico.

Debe funcionar como:

# Khipu Engineering AI

Especializado en:

- presupuestos
- APU
- costos unitarios
- metrados
- ingeniería civil
- construcción en Perú

---

# Problema Actual

Los modelos LLM generan:

- insumos inventados
- estructuras incorrectas
- unidades inconsistentes
- APU poco realistas
- respuestas demasiado libres

Esto reduce:

- precisión
- confianza
- consistencia técnica

---

# Objetivo Principal

La IA debe:

1. Buscar partidas similares existentes
2. Reutilizar estructuras APU existentes
3. Utilizar únicamente insumos válidos del catálogo
4. Generar propuestas editables
5. Validar resultados antes de guardar
6. Mantener consistencia técnica

---

# Resultado Esperado

Cuando el usuario solicite:

```txt
Concreto f'c=210 kg/cm2 para columnas
```

El sistema debe:

```txt
1. Buscar partidas similares
2. Encontrar la más parecida
3. Extraer estructura APU
4. Buscar insumos relacionados
5. Generar propuesta basada en catálogo
6. Validar salida
7. Mostrar sugerencia editable
```

---

# Principio Arquitectónico

# El catálogo es la fuente de verdad.

La IA:

- NO debe inventar insumos libremente
- NO debe guardar automáticamente
- NO debe modificar presupuestos sin validación

La IA solo:

- sugiere
- estructura
- ayuda
- optimiza

---

# Stack Tecnológico

## Frontend

- Next.js App Router
- React
- TypeScript
- TailwindCSS
- Shadcn UI

---

## Backend

- Route Handlers
- Server Actions

---

## IA Local

- Ollama
- llama3.1
- mistral
- deepseek-coder

---

## Base de Datos

- PostgreSQL

---

## Búsqueda

### MVP

- PostgreSQL Full Text Search
- Fuse.js

---

### Futuro

- pgvector
- embeddings
- semantic search
- vector retrieval

---

# Arquitectura General

```txt
Usuario
   ↓
AI UI
   ↓
AI Route
   ↓
Context Builder
   ↓
Catalog Search
   ↓
AI Prompt Builder
   ↓
Ollama
   ↓
JSON Validator
   ↓
Editable Proposal
```

---

# Arquitectura de Carpetas

```txt
app/
 ├── api/
 │    └── ai/
 │         └── apu/
 │              ├── generate/
 │              ├── review/
 │              └── explain/
 │
components/
 ├── ai/
 │    ├── APUGenerator.tsx
 │    ├── AIReviewPanel.tsx
 │    ├── AISuggestions.tsx
 │    ├── SimilarPartidas.tsx
 │    ├── ResourceValidation.tsx
 │    └── AIWarnings.tsx
 │
lib/
 ├── ai/
 │    ├── apu-context-builder.ts
 │    ├── apu-generator.ts
 │    ├── apu-validator.ts
 │    ├── catalog-search.ts
 │    ├── prompts.ts
 │    ├── schemas.ts
 │    ├── models.ts
 │    └── similarity-engine.ts
```

---

# Flujo Principal

# Generar APU

```txt
1. Usuario escribe nombre de partida
2. Sistema busca partidas similares
3. Sistema busca insumos relevantes
4. Se construye contexto compacto
5. Se llama a Ollama
6. IA devuelve JSON estructurado
7. Backend valida resultado
8. Usuario revisa propuesta
9. Usuario confirma guardado
```

---

# FASE 1 — Búsqueda de Partidas Similares

# Objetivo

Encontrar partidas existentes que sirvan como base estructural.

---

# Datos a Buscar

- nombre
- descripción
- unidad
- categoría
- subcategoría
- estructura APU
- insumos utilizados
- tipo de obra

---

# Resultado Esperado

```json
[
  {
    "id": "PAR-001",
    "name": "Concreto f'c=210 kg/cm2 en columnas",
    "unit": "m3",
    "similarity": 0.91,
    "apu": {}
  }
]
```

---

# Estrategia Inicial

## MVP

Usar:

- full text search
- keywords
- Fuse.js
- similarity scoring

---

# Estrategia Avanzada

Implementar:

- embeddings
- vector similarity
- semantic retrieval

---

# FASE 2 — Búsqueda de Insumos

# Objetivo

La IA solo puede usar insumos válidos del catálogo.

---

# Reglas

## REGLA CRÍTICA

La IA:

- NO puede inventar recursos
- NO puede crear códigos nuevos
- NO puede modificar unidades

---

# Si no existe un insumo

Debe devolver:

```json
{
  "type": "suggested_new_resource",
  "reason": "No existe recurso equivalente",
  "based_on": "Cemento Portland Tipo I"
}
```

---

# Datos de Insumo

```json
{
  "id": "INS-001",
  "name": "Cemento Portland Tipo I",
  "unit": "bol",
  "category": "material"
}
```

---

# FASE 3 — Context Builder

# Objetivo

Construir contexto compacto y optimizado para Ollama.

---

# IMPORTANTE

NO enviar:

- catálogo completo
- miles de insumos
- miles de partidas

---

# Estrategia

Enviar solamente:

- Top 5 partidas similares
- Top 30 insumos relevantes
- reglas del sistema
- esquema JSON esperado

---

# Estructura del Contexto

```json
{
  "query": "Concreto f'c=210 para columnas",
  "similarPartidas": [],
  "matchingInsumos": [],
  "rules": [],
  "outputSchema": {}
}
```

---

# FASE 4 — Prompt Engineering

# Prompt System

```txt
Eres un asistente experto en análisis de precios unitarios para construcción en Perú.

REGLAS OBLIGATORIAS:

1. Usa como referencia principal las partidas similares entregadas.
2. Mantén la estructura del APU más parecido cuando sea técnicamente razonable.
3. Usa únicamente insumos existentes en el catálogo proporcionado.
4. No inventes códigos ni nombres.
5. No inventes unidades.
6. Si falta un recurso, devuélvelo como suggested_new_resource.
7. Devuelve solamente JSON válido.
8. Marca cualquier dato incierto con requires_review=true.
9. Nunca respondas texto libre.
```

---

# FASE 5 — Generación JSON

# Objetivo

Toda salida IA debe ser estructurada.

---

# Ejemplo de Output

```json
{
  "partida_name": "Concreto f'c=210 kg/cm2 para columnas",
  "unit": "m3",
  "based_on_partida_id": "PAR-001",
  "confidence": 0.87,
  "items": [
    {
      "resource_id": "INS-001",
      "name": "Cemento Portland Tipo I",
      "type": "material",
      "unit": "bol",
      "quantity": 7.5,
      "source": "catalog",
      "requires_review": false
    }
  ],
  "suggested_new_resources": [],
  "warnings": [],
  "requires_human_review": true
}
```

---

# FASE 6 — Validación Backend

# Objetivo

El backend valida toda salida IA.

---

# Validaciones

## Validar:

- IDs existentes
- unidades válidas
- categorías
- cantidades sospechosas
- duplicados
- estructura JSON

---

# Flujo

```txt
IA genera JSON
       ↓
Backend valida
       ↓
Si falla → error
       ↓
Si pasa → mostrar propuesta
```

---

# IMPORTANTE

La IA nunca debe guardar directamente.

---

# FASE 7 — UI Inteligente

# Objetivo

Mostrar sugerencias transparentes y editables.

---

# Componentes

## Similar Partidas

Mostrar:

- partidas usadas como referencia
- score de similitud

---

## AI Warnings

Mostrar:

- cantidades sospechosas
- insumos faltantes
- recursos sugeridos

---

## Editable Proposal

El usuario debe:

- editar cantidades
- cambiar recursos
- aprobar manualmente

---

# UI Recomendado

Inspiración:

- Cursor
- Linear
- Retool
- Notion AI

---

# Model Routing

| Acción | Modelo |
|---|---|
| Chat general | llama3.1 |
| Generación APU | mistral |
| JSON estructurado | deepseek-coder |
| Validaciones | deepseek-coder |
| Explicaciones | llama3.1 |

---

# models.ts

```ts
export const AI_MODELS = {
  CHAT: "llama3.1",
  APU: "mistral",
  JSON: "deepseek-coder",
};
```

---

# API Routes

# POST

```txt
/api/ai/apu/generate
```

---

# Request

```json
{
  "query": "Concreto f'c=210 para columnas",
  "unit": "m3",
  "category": "estructura",
  "project_type": "edificación"
}
```

---

# Response

```json
{
  "proposal": {},
  "similar_partidas": [],
  "warnings": [],
  "confidence": 0.87
}
```

---

# Optimización de Performance

# Recomendaciones

## IMPORTANTES

- contexto compacto
- top-k retrieval
- streaming responses
- caching
- debounce
- evitar prompts gigantes

---

# NO HACER

## NO enviar:

- todo el catálogo
- miles de insumos
- presupuestos completos

A Ollama.

---

# Roadmap

# MVP

## Semana 1

- integración Ollama
- búsqueda simple
- generación JSON

---

## Semana 2

- validaciones backend
- UI inteligente
- review system

---

## Semana 3

- similarity engine
- scoring
- mejoras prompts

---

## Semana 4

- embeddings
- pgvector
- semantic retrieval

---

# Futuro

# Features Avanzadas

## RAG Técnico

- normas peruanas
- S10
- especificaciones técnicas
- catálogos históricos

---

## AI Cost Review

Detectar:

- precios fuera de rango
- errores de metrados
- duplicados
- inconsistencias técnicas

---

## Khipu Contextual

La IA entiende:

- módulo abierto
- partida seleccionada
- tabla activa
- proyecto actual
- historial reciente

---

# KPIs

## Métricas

- tiempo ahorrado
- precisión de sugerencias
- reutilización de catálogo
- reducción de errores
- aprobación de propuestas IA
- recursos reutilizados

---

# Resultado Esperado Final

MYC Presupuestos debe evolucionar hacia:

# AI-Native Construction Cost Platform

La IA debe sentirse como:

- Khipu técnico
- asistente especializado
- sistema inteligente de presupuestos

NO como:

- chatbot genérico
- generador libre de texto

---

# Filosofía del Sistema

```txt
Catálogo = fuente de verdad
IA = asistente
Backend = validador
Usuario = aprobador final
```
