# Khipu Agent Platform V2 + Vercel AI SDK Design

**Fecha:** 2026-07-09

**PRD fuente:** `prd/PRD-Khipu-Agent-Platform-V2-VercelSDK.md`

## Objetivo

Definir la arquitectura objetivo para convertir Khipu en una plataforma de agentes especializados capaz de interpretar objetivos, planificar pasos, ejecutar herramientas seguras sobre MC Presupuestos y registrar auditoria end-to-end, usando `Vercel AI SDK` como capa estandar de interaccion con modelos sin reemplazar el gateway ni los servicios actuales.

## Alcance

Este diseno cubre:

- Agent Orchestrator
- Planner
- Tool Registry
- Tool Executor
- Policy Engine
- Approval Engine
- Execution Ledger
- Rollback
- Integracion con Vercel AI SDK
- APIs agenticas
- UI operacional de Khipu Agent

Este diseno no cubre:

- Acceso directo del modelo a SQL, Prisma o archivos
- Browser automation
- Multi-agent paralelo real
- Orquestacion distribuida
- Reescritura de los servicios financieros existentes

## Estado actual

La aplicacion ya tiene una base AI reutilizable:

- endpoint canonico `app/api/ai/execute/route.ts`
- streaming via `app/api/ai/chat/stream/route.ts`
- providers y routing en `lib/ai/gateway/*`
- contexto ensamblado en `lib/ai/context/assembled-context.ts`
- memoria y historial de proyecto
- feedback y quality metrics
- UI de workspace AI y asistente global

La distancia con el PRD no esta en modelos o chat basico, sino en la falta de una capa de ejecucion agentica con boundaries claros entre:

- razonamiento del modelo
- seleccion de herramientas
- permisos y aprobaciones
- persistencia de ejecucion
- recuperacion ante fallo

## Principios de arquitectura

## 1. Tool-first de verdad

El modelo no escribe en la base de datos, no construye SQL y no llama services arbitrariamente. Toda accion observable pasa por una herramienta registrada y validada.

## 2. Razonamiento separado de ejecucion

El modelo propone planes, solicita herramientas y redacta respuestas. El sistema decide si una herramienta existe, si el input es valido, si esta permitida y si requiere aprobacion.

## 3. Reutilizacion por encima de reemplazo

Se conserva:

- gateway multi-provider
- historial
- memoria
- feedback
- assembled context
- runtime y usage

`Vercel AI SDK` entra como estandar de mensajeria/tool-calling, no como nuevo backend de negocio.

## 4. Determinismo en operaciones criticas

Calculos financieros, cambios sobre presupuestos, APU, cronogramas, metrados o exportaciones deben seguir ocurriendo en services testeables y reutilizables.

## 5. Human-in-the-loop

Toda operacion de escritura relevante debe poder pausar ejecucion, presentar plan y esperar decision del usuario sin perder contexto.

## Arquitectura propuesta

```text
UI
  -> Khipu Agent Workspace
  -> Agent API
  -> Agent Orchestrator
      -> Planner
      -> Policy Engine
      -> Tool Executor
      -> Response Builder
      -> Approval Engine
      -> Execution Ledger
  -> Vercel AI SDK Adapter
  -> Existing AI Gateway
  -> Tool Registry
  -> Application Services
  -> Prisma
  -> Database
```

## Rol exacto de Vercel AI SDK

`Vercel AI SDK` resuelve cuatro problemas:

- mensajes estructurados
- tool-calling estandar
- streaming
- abstraccion uniforme de interaccion con modelos

No resuelve por si mismo:

- permisos
- ownership
- aprobaciones
- auditoria de negocio
- persistencia de ejecucion
- rollback

Por eso se introduce un adapter local `lib/ai/agent/vercel-sdk-adapter.ts` y no llamadas dispersas al SDK desde routes o componentes.

## Dominios principales

## 1. Agent Orchestrator

Es el coordinador central. Su contrato de entrada recomendado:

```ts
type RunAgentRequest = {
  userId: string;
  projectId?: string;
  message: string;
  mode: "chat" | "goal" | "workflow";
  workflowId?: string;
  executionId?: string;
};
```

Responsabilidades:

- cargar contexto ensamblado
- resolver si se inicia o continua una ejecucion
- invocar planner
- crear plan inicial
- registrar steps
- solicitar tool-calls al modelo a traves del adapter
- validar cada tool-call
- preguntar al policy engine
- pausar por aprobacion
- ejecutar herramientas
- consolidar respuesta final
- auditar todo

No debe contener:

- SQL ad hoc
- logica UI
- formulas financieras
- llamadas directas a Prisma fuera de repositorios/servicios autorizados

## 2. Planner

El planner convierte una meta conversacional en un plan operacional corto, legible y reanudable.

Salida recomendada:

```ts
type PlannedStep = {
  id: string;
  title: string;
  objective: string;
  toolName?: string;
  expectedOutcome: string;
  dependsOn: string[];
  approvalBoundary: boolean;
};
```

El planner no ejecuta nada. Solo propone secuencia y estructura.

## 3. Tool Registry

Es la fuente de verdad de herramientas disponibles. Cada entrada debe incluir:

- nombre estable
- descripcion para el modelo
- esquema Zod
- riesgo
- permisos
- relacion con proyecto si aplica
- capacidad de rollback si existe

Contrato recomendado:

```ts
type AgentToolDefinition<TInput, TResult> = {
  name: string;
  description: string;
  risk: "read" | "write" | "financial" | "export";
  requiresProjectId: boolean;
  inputSchema: z.ZodType<TInput>;
  supportsRollback?: boolean;
  execute: (input: TInput, context: AgentToolContext) => Promise<TResult>;
};
```

## 4. Tool Executor

Es el unico componente autorizado para invocar herramientas. Flujo:

1. recibe una tool call solicitada por el modelo
2. busca la herramienta en el registry
3. valida input con Zod
4. consulta policy engine
5. si requiere aprobacion, registra pausa
6. si esta permitido, ejecuta
7. registra invocation y resumen
8. devuelve resultado estructurado al loop del modelo

## 5. Policy Engine

Toma decisiones de seguridad y gobernanza. Insumos:

- tipo de herramienta
- modo de ejecucion
- proyecto y usuario
- estado del execution
- feature flags futuras

Decisiones minimas:

- `allowed`
- `approvalRequirement`
- `policyReason`

Ejemplos:

- `searchPartidas`: permitido sin aprobacion
- `createBudget`: permitido pero con aprobacion previa
- `archiveBudget`: siempre con aprobacion
- `exportPDF`: permitido con auditoria

## 6. Approval Engine

Separa la pausa operacional de la respuesta conversacional.

Debe soportar:

- aprobacion total
- rechazo con motivo
- aprobacion por step o bloque
- reanudacion desde `executionId`

La aprobacion no recrea el plan; reanuda la misma ejecucion persistida.

## 7. Response Builder

Convierte el ledger interno en una respuesta legible para UI. Debe producir:

- resumen ejecutivo
- estado actual
- pasos completados
- pasos pendientes
- aprobaciones requeridas
- advertencias

Esto evita que la UI deba reconstruir semantica desde eventos crudos.

## Estado y ciclo de vida

Estados recomendados:

- `READ`
- `PLAN`
- `PROPOSE`
- `SIMULATE`
- `PENDING_APPROVAL`
- `EXECUTING`
- `EXECUTED`
- `FAILED`
- `ROLLED_BACK`

Semantica:

- `READ`: entender objetivo y contexto
- `PLAN`: construir secuencia de trabajo
- `PROPOSE`: presentar o fijar plan
- `SIMULATE`: evaluar tools y impactos antes de escribir
- `PENDING_APPROVAL`: esperar decision humana
- `EXECUTING`: correr steps autorizados
- `EXECUTED`: finalizado
- `FAILED`: fallo terminal
- `ROLLED_BACK`: se revirtio una ejecucion o parte critica

## Modelo de datos

## AgentExecution

Representa una corrida completa.

Campos sugeridos:

- `id`
- `userId`
- `projectId`
- `mode`
- `state`
- `goal`
- `summary`
- `provider`
- `model`
- `startedAt`
- `finishedAt`
- `lastError`
- `contextSnapshotJson`

## AgentExecutionStep

Representa un paso planificado o ejecutado.

Campos sugeridos:

- `id`
- `executionId`
- `sequence`
- `title`
- `objective`
- `toolName`
- `status`
- `approvalRequired`
- `inputJson`
- `resultSummary`
- `startedAt`
- `finishedAt`

## AgentToolInvocation

Audita invocaciones concretas.

- `executionId`
- `stepId`
- `toolName`
- `argumentsJson`
- `resultJson`
- `latencyMs`
- `success`
- `errorMessage`

## AgentApproval

- `executionId`
- `stepId?`
- `decision`
- `reason`
- `requestedAt`
- `decidedAt`
- `decidedByUserId`

## AgentRollback

- `executionId`
- `stepId?`
- `rollbackToolName`
- `rollbackInputJson`
- `rollbackResultJson`
- `success`
- `errorMessage`

## AgentWorkflow

Plantillas reutilizables.

- `id`
- `slug`
- `name`
- `description`
- `initialGoalTemplate`
- `allowedToolsJson`
- `defaultMode`

## Tool taxonomy inicial

## Presupuestos

- `createBudget`
- `cloneBudget`
- `archiveBudget`
- `calculateBudget`
- `generateBudget`
- `compareBudgets`

## Capitulos

- `createChapter`
- `moveChapter`
- `deleteChapter`

## Partidas

- `searchPartidas`
- `addPartida`
- `duplicatePartida`
- `reorderPartidas`
- `removePartida`
- `suggestPartidas`

## APU

- `createAPU`
- `updateAPU`
- `reviewAPU`
- `calculateAPU`
- `generateAPU`
- `optimizeAPU`

## Insumos

- `searchInsumos`
- `addInsumo`
- `replaceInsumo`
- `updatePrecio`

## Metrados

- `createTakeoff`
- `reviewTakeoff`
- `importTakeoff`

## Cronograma

- `createSchedule`
- `updateTask`
- `linkPredecessor`
- `moveTask`
- `calculateCriticalPath`

## Reportes

- `exportPDF`
- `exportExcel`
- `exportS10`
- `dashboard`

## Boundary con servicios existentes

Regla principal: la herramienta no contiene reglas de negocio de fondo. Solo:

- valida input
- traduce al servicio correcto
- adapta el resultado al contrato agentico

Ejemplos:

- `reviewAPU` puede apoyarse en servicios AI ya existentes
- `calculateBudget` debe delegar al servicio de calculo real
- `updatePrecio` debe usar servicios de catalogo o recursos, no mutar Prisma directo

## Flujo de ejecucion recomendado

1. Usuario envia objetivo
2. Route `POST /api/ai/agent` autentica y valida
3. Orchestrator carga contexto ensamblado
4. Planner propone plan inicial
5. Se crea `AgentExecution`
6. Adapter Vercel AI SDK consulta al modelo con tools habilitadas
7. El modelo solicita una tool
8. Tool Executor valida registry + Zod + policy
9. Si requiere aprobacion, se persiste pausa y responde a UI
10. Si esta permitido, la herramienta ejecuta service
11. El resultado vuelve al loop como `tool message`
12. El modelo produce mas tool calls o respuesta final
13. Response Builder consolida resumen
14. Auditoria y usage quedan persistidos

## Integracion con el gateway existente

La seleccion de proveedor y modelo sigue ocurriendo en `lib/ai/gateway/*`.

Opciones:

- `Vercel AI SDK` usa providers configurados por el gateway
- o el adapter consulta primero el gateway para resolver modelo final antes de llamar al SDK

La segunda opcion es mas consistente con la arquitectura actual porque preserva:

- fallback
- usage tracking
- health
- reglas por provider

## Contexto y memoria

El loop agentico debe reutilizar `assembled-context`.

Secciones minimas del prompt de sistema:

- contexto del proyecto
- historial reciente
- memoria del proyecto
- evidencia consultada
- instrucciones de seguridad
- herramientas disponibles
- objetivo actual

El modelo nunca debe inferir que puede omitir tools cuando una accion requiere mutacion verificable.

## Auditoria

La auditoria debe registrar:

- mensaje del usuario
- provider/model
- prompt hash o snapshot de contexto referencial
- plan inicial
- tool calls
- argumentos validados
- tiempos
- usage/tokens
- aprobaciones
- rollback
- resultado final

La auditoria agentica no reemplaza historial conversacional existente; lo complementa.

## APIs propuestas

## `POST /api/ai/agent`

Inicia o continua una ejecucion.

Body recomendado:

```json
{
  "message": "Crea un presupuesto para un hospital de 4 pisos",
  "projectId": "project_123",
  "mode": "goal"
}
```

Respuesta recomendada:

```json
{
  "executionId": "exec_123",
  "state": "PENDING_APPROVAL",
  "summary": "Se preparo un plan de 5 pasos y se requiere aprobacion antes de crear el presupuesto draft.",
  "plan": [],
  "pendingApproval": {
    "approvalId": "approval_123",
    "reason": "La accion createBudget generara una nueva entidad en el proyecto."
  }
}
```

## `GET /api/ai/executions`

Lista ejecuciones del usuario o proyecto.

## `GET /api/ai/executions/[executionId]`

Devuelve detalle, steps, tool invocations y approvals.

## `POST /api/ai/approvals`

Aprueba o rechaza:

```json
{
  "approvalId": "approval_123",
  "decision": "approve",
  "reason": "Continuar con creacion draft"
}
```

## `GET /api/ai/workflows`

Lista plantillas disponibles para flujos recurrentes.

## UI propuesta

## Layout

Tres paneles:

- izquierda: chat + objetivo
- centro: execution plan
- derecha: approvals + actividad + herramientas

## Panel de plan

Debe mostrar:

- steps numerados
- dependencias
- estado
- herramienta asociada
- badge de aprobacion

## Panel de actividad

Debe mostrar:

- tool actual
- latencia
- resumen del resultado
- errores o warnings

## Panel de aprobaciones

Debe mostrar:

- que se quiere hacer
- por que requiere aprobacion
- impacto esperado
- acciones aprobar/rechazar

## Estado vacio

Debe sugerir prompts orientados a objetivos:

- crear presupuesto base
- revisar partidas faltantes
- generar cronograma preliminar
- comparar presupuestos

## Estrategia de rollout

## Fase 0

Integrar adapter Vercel AI SDK y contracts sin habilitar UI nueva por defecto.

## Fase 1

Habilitar ledger, tool registry y policy engine para tools de lectura.

## Fase 2

Agregar aprobaciones y primeras tools de escritura seguras.

## Fase 3

Exponer workspace UI agentica bajo feature flag.

## Fase 4

Agregar specialist bundles y workflow templates.

## Riesgos

## Riesgo 1: loops infinitos o sobre-ejecucion

Mitigacion:

- max tool calls
- max replans
- max retries
- finish reasons explicitos

## Riesgo 2: herramientas demasiado poderosas

Mitigacion:

- registry estricto
- Zod en cada tool
- policy engine obligatorio
- aprobaciones para escritura

## Riesgo 3: duplicacion con la infraestructura AI actual

Mitigacion:

- adapter sobre gateway existente
- reutilizar context, history, usage y feedback
- no crear providers paralelos

## Riesgo 4: UI demasiado compleja

Mitigacion:

- empezar con plan + approvals + actividad
- no exponer telemetria de bajo nivel en primera iteracion
- mantener lenguaje visual tecnico y compacto

## Decisiones tomadas

- Vercel AI SDK se adopta como capa estandar de loop de modelo y herramientas
- El gateway actual sigue siendo la frontera de proveedores
- Toda mutacion pasa por Tool Registry y services
- Las aprobaciones son first-class, no un parche de UI
- El ledger de ejecucion es persistente y reanudable
- Los agentes especialistas iniciales son configuraciones sobre el mismo orchestrator, no procesos independientes

## Resultado esperado

Khipu deja de operar como un chat mejorado y pasa a funcionar como un sistema operacional de asistencia tecnica: entiende objetivos, arma planes, ejecuta acciones seguras, pide aprobacion cuando corresponde, deja trazabilidad completa y sigue apoyandose en la arquitectura y reglas de negocio ya construidas en MC Presupuestos.
