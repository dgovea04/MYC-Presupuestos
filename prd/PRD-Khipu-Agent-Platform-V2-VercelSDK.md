# PRD --- Khipu Agent Platform (V2)

**Version:** 2.0\
**Product:** MC Presupuestos\
**Status:** Architectural Proposal

------------------------------------------------------------------------

# 1. Executive Summary

Khipu evolucionará desde un copiloto técnico hacia una plataforma de
agentes especializados capaz de comprender objetivos, planificar tareas,
ejecutar comandos internos de la webapp y construir presupuestos
completos utilizando exclusivamente las reglas de negocio y la
información de MC Presupuestos.

El LLM nunca accederá directamente a la base de datos. Toda interacción
se realizará mediante un Tool Framework respaldado por Services y
Prisma.

------------------------------------------------------------------------

# 2. Visión

Convertir MC Presupuestos en el primer sistema de presupuestos donde el
usuario trabaja por objetivos:

-   "Crea un presupuesto para un hospital."
-   "Genera el cronograma."
-   "Revisa partidas faltantes."
-   "Compara con proyectos similares."
-   "Actualiza precios."

------------------------------------------------------------------------

# 3. Principios

1.  Human-in-the-loop.
2.  Tool-first architecture.
3.  Determinismo en operaciones críticas.
4.  Auditoría completa.
5.  Reutilización del Gateway IA existente.
6.  Arquitectura desacoplada.

------------------------------------------------------------------------

# 4. Estado actual reutilizado

Se conserva íntegramente:

-   Gateway multi-provider
-   Router IA
-   Streaming
-   Retrieval Context
-   Historial
-   Feedback
-   Usage
-   Runtime
-   Guardrails
-   Skills
-   AI Memory

No se reemplaza ninguna pieza existente.

------------------------------------------------------------------------

# 5. Arquitectura General

``` text
UI
 ↓
Khipu Chat
 ↓
Agent API
 ↓
Agent Orchestrator
 ├── Planner
 ├── Memory
 ├── Policy Engine
 ├── Tool Executor
 └── Response Builder
 ↓
Tool Registry
 ↓
Application Services
 ↓
Prisma
 ↓
Database
```

------------------------------------------------------------------------

# 6. Componentes

## Agent Orchestrator

Responsabilidades: - interpretar intención - seleccionar herramientas -
administrar contexto - controlar aprobación - coordinar workflows

## Planner

Convierte objetivos en pasos.

Ejemplo:

Crear presupuesto

↓

Buscar plantilla

↓

Buscar partidas

↓

Crear capítulos

↓

Generar APU

↓

Calcular

↓

Solicitar aprobación

## Executor

Único componente autorizado para invocar herramientas.

## Memory

-   Conversation Memory
-   Project Memory
-   Company Memory
-   User Preferences

## Policy Engine

Decide:

-   requiere aprobación
-   requiere permisos
-   solo lectura
-   operación segura

------------------------------------------------------------------------

# 7. Agent Tool Framework

## Presupuestos

-   createBudget
-   cloneBudget
-   archiveBudget
-   calculateBudget
-   generateBudget
-   compareBudgets

## Capítulos

-   createChapter
-   moveChapter
-   deleteChapter

## Partidas

-   searchPartidas
-   addPartida
-   duplicatePartida
-   reorderPartidas
-   removePartida
-   suggestPartidas

## APU

-   createAPU
-   updateAPU
-   reviewAPU
-   calculateAPU
-   generateAPU
-   optimizeAPU

## Insumos

-   searchInsumos
-   addInsumo
-   replaceInsumo
-   updatePrecio

## Metrados

-   createTakeoff
-   reviewTakeoff
-   importTakeoff

## Cronograma

-   createSchedule
-   updateTask
-   linkPredecessor
-   moveTask
-   calculateCriticalPath

## Reportes

-   exportPDF
-   exportExcel
-   exportS10
-   dashboard

------------------------------------------------------------------------

# 8. Workflow Engine

Cada solicitud genera un Execution Plan.

Ejemplo:

Usuario: "Crea presupuesto de edificio"

Plan:

1 Buscar plantilla 2 Crear presupuesto draft 3 Crear capítulos 4 Buscar
partidas 5 Crear APU 6 Calcular 7 Reportar diferencias 8 Esperar
aprobación

------------------------------------------------------------------------

# 9. Estados

READ

PLAN

PROPOSE

SIMULATE

PENDING_APPROVAL

EXECUTED

ROLLED_BACK

------------------------------------------------------------------------

# 10. Seguridad

El modelo:

-   no ejecuta SQL
-   no modifica Prisma
-   no escribe archivos
-   no llama APIs internas sin Tool Registry

------------------------------------------------------------------------

# 11. Cambios Prisma

Agregar entidades:

AgentExecution

AgentExecutionStep

AgentToolInvocation

AgentApproval

AgentWorkflow

AgentRollback

------------------------------------------------------------------------

# 12. API

/app/api/ai/agent

/app/api/ai/tools

/app/api/ai/workflows

/app/api/ai/approvals

/app/api/ai/executions

------------------------------------------------------------------------

# 13. UI

Nueva pantalla:

Khipu Agent

Panel izquierdo: Chat

Centro: Plan de ejecución

Derecha: Herramientas Aprobaciones Actividad

------------------------------------------------------------------------

# 14. Auditoría

Registrar:

-   prompt
-   proveedor
-   modelo
-   herramientas
-   argumentos
-   tiempo
-   tokens
-   usuario
-   proyecto
-   rollback

------------------------------------------------------------------------

# 15. Multi-Agent (Futuro)

Budget Agent

APU Agent

Planning Agent

Review Agent

Procurement Agent

Reporting Agent

Todos coordinados por Khipu Core.

------------------------------------------------------------------------

# 16. Roadmap

Fase 1 Agent Core

Fase 2 Planner

Fase 3 Tool Registry

Fase 4 Budget Agent

Fase 5 Workflow Engine

Fase 6 Approval Engine

Fase 7 UI Copilot

Fase 8 Multi-Agent

------------------------------------------------------------------------

# 17. KPIs

-   Tiempo creación presupuesto
-   \% herramientas exitosas
-   \% aprobaciones
-   Tiempo medio de ejecución
-   Calidad percibida
-   Precisión técnica
-   Uso por módulo

------------------------------------------------------------------------

# 18. Testing

Unit tests

Integration tests

Tool tests

Workflow tests

E2E

Stress tests

------------------------------------------------------------------------

# 19. Riesgos

-   Hallucinations
-   Loops infinitos
-   Herramientas mal configuradas
-   Costos IA
-   Permisos

Mitigación:

-   límites de pasos
-   validación Zod
-   approval engine
-   rollback

------------------------------------------------------------------------

# 20. Checklist Codex

-   Agent Core
-   Planner
-   Executor
-   Tool Registry
-   Approval Engine
-   Memory
-   Budget Tools
-   APU Tools
-   Schedule Tools
-   Reporting Tools
-   UI
-   Telemetry
-   QA

------------------------------------------------------------------------

# Conclusión

Khipu deja de ser un chat y pasa a convertirse en el sistema operativo
inteligente de MC Presupuestos. El conocimiento permanece en la
plataforma; el LLM aporta razonamiento y planificación, mientras que
todas las operaciones se ejecutan mediante herramientas seguras
respaldadas por la arquitectura existente.


---

# 21. Integración con Vercel AI SDK

## Objetivo

La arquitectura definida en este PRD se mantiene íntegramente. La incorporación de **Vercel AI SDK** no reemplaza componentes existentes; actúa como la capa estándar para interacción con modelos, streaming y ejecución de herramientas.

## Rol dentro de la arquitectura

```text
UI
 ↓
Khipu Chat
 ↓
Agent API
 ↓
Vercel AI SDK
 ↓
Agent Orchestrator
 ├── Planner
 ├── Memory
 ├── Policy Engine
 ├── Tool Executor
 └── Response Builder
 ↓
Tool Registry
 ↓
Application Services
 ↓
Prisma
 ↓
Database
```

El Agent Orchestrator continúa siendo el responsable de la lógica de negocio. Vercel AI SDK únicamente facilita la comunicación con los modelos y el ciclo de herramientas.

## Responsabilidades del SDK

- Streaming de respuestas.
- Tool Calling.
- Multi-provider.
- Gestión de contexto del chat.
- Mensajes estructurados.
- Integración con React/Next.js.
- Cambio transparente entre modelos.

## Funcionalidades del SDK

### Streaming

Todas las conversaciones utilizarán streaming.

### Tool Calling

Cada Tool del Tool Registry será expuesta como Tool del SDK.

Ejemplos:

- createBudget
- generateBudget
- reviewAPU
- searchPartidas
- calculateBudget
- exportPDF

La validación seguirá realizándose mediante Zod antes de invocar los Application Services.

### Modelos soportados

El Gateway existente seguirá siendo el punto de configuración para:

- OpenAI
- Gemini
- Modelos futuros

La selección de modelo permanecerá desacoplada del Agent.

## Compatibilidad con la arquitectura existente

Se mantienen sin modificaciones:

- Gateway Multi Provider
- Router IA
- Skills
- Runtime
- Retrieval Context
- AI Memory
- Guardrails
- Historial
- Feedback
- Usage

Vercel AI SDK consumirá estos componentes, no los sustituirá.

## Flujo de ejecución

1. Usuario envía una solicitud.
2. Agent API prepara el contexto.
3. Vercel AI SDK invoca el modelo.
4. El modelo solicita Tools.
5. Tool Executor valida permisos.
6. Tool Registry ejecuta Services.
7. Prisma accede a la base de datos.
8. El resultado retorna al SDK.
9. Se construye la respuesta final.
10. Si existe operación de escritura, se solicita aprobación antes de ejecutar.

## Beneficios

- Reduce código de infraestructura.
- Mantiene compatibilidad con OpenAI y Gemini.
- Facilita streaming y tool calling.
- Permite cambiar de proveedor sin modificar la arquitectura.
- Compatible con una futura evolución Multi-Agent.

## Roadmap actualizado

La incorporación del SDK no modifica las fases del proyecto.

Se añade únicamente una tarea transversal al inicio:

**Fase 0**
- Integración de Vercel AI SDK.
- Adaptación del Gateway existente.
- Registro de Tools.
- Streaming unificado.

Las fases posteriores (Agent Core, Planner, Tool Registry, Workflow Engine, Approval Engine y Multi-Agent) permanecen exactamente iguales.
