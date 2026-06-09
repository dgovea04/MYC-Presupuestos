# PRD — Integración de IA Local para MYC Presupuestos

## Proyecto
MYC Presupuestos — AI Local Integration

---

# Objetivo

Implementar un sistema de IA local dentro de MYC Presupuestos utilizando:

- Next.js App Router
- Ollama
- Llama 3.1
- Mistral
- DeepSeek Coder

La IA debe funcionar inicialmente como:

1. Chat técnico
2. Asistente contextual
3. Generador de APU
4. Revisor de presupuestos
5. Autocompletado técnico
6. Khipu contextual estilo Cursor / Notion AI

---

# Objetivos del Producto

La IA debe ayudar a:

- Ingenieros civiles
- Contratistas
- Oficinas técnicas
- Estudiantes de construcción
- Empresas constructoras

A:

- generar presupuestos
- estructurar análisis de precios unitarios
- revisar inconsistencias
- generar descripciones técnicas
- analizar metrados
- detectar errores
- mejorar productividad

---

# Stack Tecnológico

## Frontend

- Next.js 15+
- React
- TypeScript
- TailwindCSS
- Shadcn UI

---

## Backend

- Next.js Route Handlers
- Server Actions

---

## IA Local

- Ollama
- llama3.1
- mistral
- deepseek-coder

---

# Instalación Inicial

## Instalar Ollama

https://ollama.com

---

## Descargar modelos

```bash
ollama pull llama3.1
ollama pull mistral
ollama pull deepseek-coder
```

---

# Arquitectura General

```txt
Frontend (Next.js)
        ↓
AI Components
        ↓
API Routes
        ↓
Ollama Local Server
        ↓
LLM Local
```

---

# Arquitectura Recomendada

## Directorios

```txt
app/
 ├── api/
 │    └── ai/
 │         ├── chat/
 │         ├── apu/
 │         ├── review/
 │         └── autocomplete/
 │
 ├── ai/
 │    └── page.tsx
 │
components/
 ├── ai/
 │    ├── AIChat.tsx
 │    ├── AIInput.tsx
 │    ├── AIMessage.tsx
 │    ├── AIReviewPanel.tsx
 │    ├── APUGenerator.tsx
 │    └── ContextSidebar.tsx
 │
lib/
 ├── ai/
 │    ├── ollama.ts
 │    ├── prompts.ts
 │    ├── context-builder.ts
 │    └── models.ts
```

---

# FASE 1 — Chat IA Básico

## Objetivo

Permitir interacción básica con IA local.

---

## Features

### Chat UI

- input textarea
- streaming responses
- markdown support
- loading states
- retry message
- copy response

---

## API Route

```txt
POST /api/ai/chat
```

---

## Request

```json
{
  "message": "Genera un APU para concreto armado"
}
```

---

## Response

```json
{
  "answer": "..."
}
```

---

# FASE 2 — IA Contextual

## Objetivo

La IA debe entender:

- proyecto actual
- partida seleccionada
- módulo abierto
- unidad
- costos
- tabla activa

---

## Ejemplo

```json
{
  "project": "Edificio Multifamiliar",
  "module": "APU",
  "selectedItem": "Concreto f'c=210",
  "unit": "m3",
  "currentCost": 420
}
```

---

# FASE 3 — Generador de APU

## Objetivo

Generar automáticamente:

- materiales
- mano de obra
- equipos
- rendimiento
- unidad
- cuadrilla

---

## Acción UI

```txt
[ Generar APU con IA ]
```

---

## Prompt Base

```txt
Genera un análisis de precios unitarios para una partida de construcción en Perú.

Incluye:
- materiales
- mano de obra
- equipos
- unidad
- rendimiento
- observaciones técnicas
```

---

# FASE 4 — Revisión Inteligente

## Objetivo

Detectar:

- partidas duplicadas
- costos anormales
- unidades incorrectas
- inconsistencias
- metrados sospechosos

---

## Acción UI

```txt
[ Revisar Presupuesto ]
```

---

# FASE 5 — Autocompletado Técnico

## Objetivo

Completar automáticamente:

- descripciones
- observaciones
- especificaciones técnicas
- nombres de partidas

---

## Ejemplo

Input:

```txt
Excavación manual en
```

Output:

```txt
Excavación manual en terreno normal hasta 1.50m de profundidad
```

---

# Model Routing

## Recomendado

| Acción | Modelo |
|---|---|
| Chat general | llama3.1 |
| Generación APU | mistral |
| JSON / parsing | deepseek-coder |
| Código | deepseek-coder |
| Explicaciones | llama3.1 |

---

# Archivo models.ts

```ts
export const AI_MODELS = {
  CHAT: "llama3.1",
  APU: "mistral",
  CODE: "deepseek-coder",
};
```

---

# Servicio Ollama

## lib/ai/ollama.ts

```ts
export async function askOllama({
  model,
  messages,
}: {
  model: string;
  messages: any[];
}) {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  return response.json();
}
```

---

# Prompt System Recomendado

```txt
Eres un asistente experto en:

- presupuestos de construcción
- análisis de precios unitarios
- costos y metrados
- fórmula polinómica
- ingeniería civil
- construcción en Perú

Debes responder de forma:
- técnica
- clara
- estructurada
- profesional
```

---

# UI Recomendado

## Inspiración

- Linear
- Cursor
- Notion AI
- Retool AI

---

# Componentes UI

## AI Sidebar

Sidebar contextual.

---

## Floating AI Button

Botón flotante para abrir AI.

---

## Inline AI Actions

Botones pequeños:

```txt
✨ Explicar
✨ Generar
✨ Revisar
✨ Optimizar
```

---

# Seguridad

## IMPORTANTE

La IA local NO debe:

- ejecutar SQL
- modificar presupuestos automáticamente
- borrar información
- ejecutar código arbitrario

Sin confirmación explícita.

---

# Performance

## Recomendaciones

- streaming responses
- debounce inputs
- caching
- limitar contexto
- resumir historial largo

---

# Futuras Mejoras

## RAG

Implementar:

- vector database
- embeddings
- documentos técnicos
- normativa peruana
- catálogos S10

---

## AI Memory

Recordar:

- proyectos recientes
- partidas frecuentes
- estilo del usuario

---

## Voice AI

Posible integración futura:

- dictado técnico
- comandos por voz

---

# Roadmap

## MVP

### Semana 1

- Ollama integration
- chat básico
- AI route

---

### Semana 2

- contextual AI
- APU generator
- UI improvements

---

### Semana 3

- review engine
- autocomplete
- streaming

---

### Semana 4

- optimization
- prompt tuning
- UX polish

---

# KPIs

## Métricas

- tiempo ahorrado
- prompts usados
- generación de APU
- precisión de sugerencias
- retención
- engagement AI

---

# Resultado Esperado

MYC Presupuestos debe evolucionar hacia:

- plataforma SaaS moderna
- Khipu como asistente de ingeniería
- sistema inteligente de presupuestos
- asistente contextual para construcción

No debe sentirse como:

- chatbot genérico
- IA aislada

Debe sentirse como:

- AI-native construction platform
- engineering assistant
- modern construction SaaS
