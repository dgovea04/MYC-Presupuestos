# Khipu Agent Platform V2 + Vercel AI SDK Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` when implementing this plan. Keep checkbox tracking and verify each phase before moving forward.

**Fecha:** 2026-07-09

**PRD fuente:** `prd/PRD-Khipu-Agent-Platform-V2-VercelSDK.md`

**Goal:** Convertir Khipu desde un asistente conversacional hacia una plataforma de agentes con ejecucion controlada, herramientas seguras, aprobaciones, auditoria completa y UI operacional, reutilizando la infraestructura AI ya existente y estandarizando el loop de modelo/tool-calling con Vercel AI SDK.

**Architecture:** La implementacion sera aditiva. `Vercel AI SDK` se incorpora como capa de mensajeria estructurada, streaming y tool-calling sobre el gateway actual. La logica de negocio permanece en `lib/ai`, los servicios de aplicacion siguen siendo la unica via a Prisma, y el nuevo `Agent Orchestrator` coordina planner, policy, execution state, approvals y response builder. Ningun flujo nuevo permite acceso directo del modelo a la base de datos.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma/PostgreSQL, Zod, Vercel AI SDK, Vitest, existente `lib/ai/gateway/*`, `lib/ai/context/*`, historial, feedback y memoria de proyecto.

---

## Current Baseline

Ya existen piezas importantes que deben reutilizarse, no reemplazarse:

- `app/api/ai/execute/route.ts` como endpoint canonico no streaming
- `app/api/ai/chat/stream/route.ts` para streaming SSE
- `lib/ai/gateway/*` con providers, routing y ejecucion
- `lib/ai/context/assembled-context.ts` y `project-memory.ts`
- `lib/ai/project-history.ts` y `project-history-route.ts`
- `lib/ai/suggestion-feedback.ts`
- `components/ai/AIWorkspace.tsx`, widget global y paneles relacionados
- `prisma/schema.prisma` con memoria AI, feedback, historial y colaboracion

Lo que falta para cumplir este PRD es la capa agentica: planificacion, herramientas tipadas de dominio, policy engine, aprobaciones, ledger de ejecucion, rollback, workflow UI y surface operacional.

---

## Scope And Sequencing

Implementar en siete releases pequenos:

1. **V2.A Agent Contracts + Execution Ledger**
2. **V2.B Vercel AI SDK Adapter Layer**
3. **V2.C Tool Registry + Policy Engine**
4. **V2.D Planner + Agent State Machine**
5. **V2.E Approval Engine + Rollback**
6. **V2.F Agent Workspace UI**
7. **V2.G Specialist Agents + Workflow Templates**

No incluir en esta iteracion:

- Ejecucion autonoma multi-agent paralela
- Acceso directo del modelo a archivos, SQL o Prisma
- Automatizacion UI tipo browser agent
- Simulaciones financieras inventadas fuera de servicios existentes

---

## File Structure

**Create**

- `lib/ai/agent/types.ts`
- `lib/ai/agent/contracts.ts`
- `lib/ai/agent/state-machine.ts`
- `lib/ai/agent/policy-engine.ts`
- `lib/ai/agent/planner.ts`
- `lib/ai/agent/orchestrator.ts`
- `lib/ai/agent/response-builder.ts`
- `lib/ai/agent/tool-executor.ts`
- `lib/ai/agent/tool-registry.ts`
- `lib/ai/agent/tool-registry.test.ts`
- `lib/ai/agent/planner.test.ts`
- `lib/ai/agent/policy-engine.test.ts`
- `lib/ai/agent/orchestrator.test.ts`
- `lib/ai/agent/approval-service.ts`
- `lib/ai/agent/rollback-service.ts`
- `lib/ai/agent/vercel-sdk-adapter.ts`
- `lib/ai/agent/vercel-sdk-adapter.test.ts`
- `lib/ai/agent/tools/budgets.ts`
- `lib/ai/agent/tools/chapters.ts`
- `lib/ai/agent/tools/partidas.ts`
- `lib/ai/agent/tools/apu.ts`
- `lib/ai/agent/tools/insumos.ts`
- `lib/ai/agent/tools/takeoffs.ts`
- `lib/ai/agent/tools/schedule.ts`
- `lib/ai/agent/tools/reports.ts`
- `app/api/ai/agent/route.ts`
- `app/api/ai/agent/route.test.ts`
- `app/api/ai/approvals/route.ts`
- `app/api/ai/approvals/[approvalId]/route.ts`
- `app/api/ai/executions/route.ts`
- `app/api/ai/executions/[executionId]/route.ts`
- `app/api/ai/workflows/route.ts`
- `app/api/ai/workflows/[workflowId]/route.ts`
- `components/ai/agent/khipu-agent-workspace.tsx`
- `components/ai/agent/execution-plan-panel.tsx`
- `components/ai/agent/approval-queue-panel.tsx`
- `components/ai/agent/tool-activity-panel.tsx`
- `components/ai/agent/execution-timeline.tsx`
- `components/ai/agent/khipu-agent-workspace.test.tsx`

**Modify**

- `prisma/schema.prisma`
- `lib/ai/gateway/types.ts`
- `lib/ai/gateway/execute.ts`
- `lib/ai/prompts.ts`
- `lib/ai/project-history.ts`
- `lib/ai/project-history-route.ts`
- `lib/ai/runtime.ts`
- `lib/ai/usage.ts`
- `lib/ai/validation.ts`
- `components/ai/AIWorkspace.tsx`
- `components/ai/use-ai-assistant-controller.ts`

---

## Task 1: Definir contratos agenticos y ledger de ejecucion

**Files:**

- Create: `lib/ai/agent/types.ts`
- Create: `lib/ai/agent/contracts.ts`
- Modify: `prisma/schema.prisma`
- Create: `lib/ai/agent/state-machine.ts`
- Create: `lib/ai/agent/state-machine.test.ts`

- [ ] **Step 1: Normalizar enums y contratos**

Definir tipos canonicos:

```ts
export type AgentExecutionState =
  | "READ"
  | "PLAN"
  | "PROPOSE"
  | "SIMULATE"
  | "PENDING_APPROVAL"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED"
  | "ROLLED_BACK";
```

Tambien:

- `AgentExecutionMode = "chat" | "goal" | "workflow"`
- `AgentToolRisk = "read" | "write" | "financial" | "export"`
- `ApprovalRequirement = "none" | "pre_execute" | "per_step"`

- [ ] **Step 2: Extender Prisma con ledger**

Agregar modelos:

- `AgentExecution`
- `AgentExecutionStep`
- `AgentToolInvocation`
- `AgentApproval`
- `AgentWorkflow`
- `AgentRollback`

Reglas:

- cada `AgentExecution` pertenece a `projectId` nullable
- cada step guarda `status`, `plannedInput`, `validatedInput`, `outputSummary`
- `AgentToolInvocation` guarda `toolName`, `argumentsJson`, `resultJson`, `latencyMs`
- `AgentApproval` guarda `decision`, `reason`, `decidedByUserId`, `decidedAt`
- `AgentRollback` referencia el step o execution origen y el resultado del rollback

- [ ] **Step 3: Implementar state machine**

Las transiciones validas deben ser explicitas y testeadas:

- `READ -> PLAN`
- `PLAN -> PROPOSE`
- `PROPOSE -> SIMULATE`
- `SIMULATE -> PENDING_APPROVAL | EXECUTING`
- `PENDING_APPROVAL -> EXECUTING | FAILED`
- `EXECUTING -> EXECUTED | FAILED | ROLLED_BACK`

- [ ] **Step 4: Ejecutar tests**

Run:

```bash
npm run test -- lib/ai/agent/state-machine.test.ts
```

Expected:

- PASS con transiciones invalidas rechazadas

---

## Task 2: Integrar Vercel AI SDK sin romper el gateway actual

**Files:**

- Create: `lib/ai/agent/vercel-sdk-adapter.ts`
- Create: `lib/ai/agent/vercel-sdk-adapter.test.ts`
- Modify: `lib/ai/gateway/types.ts`
- Modify: `lib/ai/gateway/execute.ts`

- [ ] **Step 1: Leer docs locales y fijar boundary**

Antes de implementar routes o streaming nuevos, revisar la guia aplicable en `node_modules/next/dist/docs/`.

La regla de arquitectura es:

- `Vercel AI SDK` maneja `messages`, `tools`, `streaming`, `tool results`
- `gateway/*` sigue resolviendo proveedor, modelo, usage y fallback
- `orchestrator` nunca llama SDK directo sin pasar por adapter propio

- [ ] **Step 2: Crear adapter propio**

Crear una interfaz estable:

```ts
export type AgentModelLoopInput = {
  system: string;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  tools: AgentSdkToolDefinition[];
  stopWhen?: "final_text" | "tool_limit" | "approval_boundary";
};
```

El adapter debe devolver:

- mensajes del modelo
- tool calls solicitadas
- finish reason
- provider/model reales
- usage y warnings

- [ ] **Step 3: Mantener compatibilidad con rutas actuales**

`/api/ai/execute` y `chat/stream` no se eliminan. El adapter se usa primero solo en el nuevo loop agentico.

- [ ] **Step 4: Testear tool-calling deterministico**

Casos minimos:

- mensaje sin tool calls retorna respuesta final
- tool call valida retorna `tool` message al loop
- tool desconocida falla antes de ejecucion
- limite de herramientas corta loops

Run:

```bash
npm run test -- lib/ai/agent/vercel-sdk-adapter.test.ts
```

---

## Task 3: Construir Tool Registry y Policy Engine

**Files:**

- Create: `lib/ai/agent/tool-registry.ts`
- Create: `lib/ai/agent/tool-executor.ts`
- Create: `lib/ai/agent/policy-engine.ts`
- Create: `lib/ai/agent/tools/*.ts`
- Create: `lib/ai/agent/tool-registry.test.ts`
- Create: `lib/ai/agent/policy-engine.test.ts`

- [ ] **Step 1: Definir contrato de herramienta**

```ts
export type AgentToolDefinition<TInput, TResult> = {
  name: string;
  description: string;
  risk: AgentToolRisk;
  requiresProjectId: boolean;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: AgentToolContext) => Promise<TResult>;
  summarizeResult?: (result: TResult) => string;
};
```

- [ ] **Step 2: Registrar herramientas del PRD por dominio**

Primera ola:

- presupuestos
- capitulos
- partidas
- APU
- insumos
- metrados
- cronograma
- reportes

Cada herramienta debe delegar a servicios existentes cuando ya existan. Si un servicio aun no existe, crear stub explicito y no logica improvisada en la route.

- [ ] **Step 3: Crear Policy Engine**

Decisiones minimas:

- lectura simple: ejecucion directa
- escritura draft no destructiva: requiere aprobacion por bloque
- cambios financieros o archivado: requiere aprobacion explicita
- exportaciones: permitidas con auditoria, segun contexto

El engine debe devolver:

```ts
{
  allowed: boolean;
  approvalRequirement: "none" | "pre_execute" | "per_step";
  policyReason: string;
}
```

- [ ] **Step 4: Testear riesgo y permisos**

Casos:

- `searchPartidas` no requiere aprobacion
- `createBudget` puede requerir aprobacion segun modo
- `archiveBudget` siempre requiere aprobacion
- herramienta fuera de registry se rechaza

Run:

```bash
npm run test -- lib/ai/agent/tool-registry.test.ts lib/ai/agent/policy-engine.test.ts
```

---

## Task 4: Implementar Planner y Orchestrator

**Files:**

- Create: `lib/ai/agent/planner.ts`
- Create: `lib/ai/agent/orchestrator.ts`
- Create: `lib/ai/agent/response-builder.ts`
- Create: `lib/ai/agent/planner.test.ts`
- Create: `lib/ai/agent/orchestrator.test.ts`

- [ ] **Step 1: Separar plan de ejecucion de respuesta conversacional**

`planner.ts` convierte objetivo en steps estructurados:

```ts
type PlannedStep = {
  id: string;
  title: string;
  toolName?: string;
  objective: string;
  dependsOn: string[];
  approvalBoundary: boolean;
};
```

- [ ] **Step 2: Crear orchestrator con boundaries claros**

Responsabilidades:

- cargar contexto ensamblado
- pedir plan inicial
- validar tools candidatas contra registry
- consultar policy engine
- crear `AgentExecution`
- detenerse en aprobaciones
- continuar tras aprobacion
- construir respuesta final y resumen operacional

- [ ] **Step 3: Limitar loops**

Agregar limites:

- max 8 tool calls por ejecucion
- max 3 repropuestas consecutivas del plan
- max 2 reintentos por tool

- [ ] **Step 4: Testear escenarios end-to-end en memoria**

Casos:

- objetivo solo lectura completa un execution
- objetivo de escritura queda en `PENDING_APPROVAL`
- tool falla y se registra error sin perder auditoria
- proveedor responde texto final sin herramientas y se registra plan vacio

Run:

```bash
npm run test -- lib/ai/agent/planner.test.ts lib/ai/agent/orchestrator.test.ts
```

---

## Task 5: Approval Engine y Rollback

**Files:**

- Create: `lib/ai/agent/approval-service.ts`
- Create: `lib/ai/agent/rollback-service.ts`
- Create: `app/api/ai/approvals/route.ts`
- Create: `app/api/ai/approvals/[approvalId]/route.ts`

- [ ] **Step 1: Diseñar aprobaciones reanudables**

La aprobacion debe poder:

- aprobar toda la ejecucion pendiente
- rechazar con motivo
- aprobar solo el siguiente bloque si el modo es `per_step`

- [ ] **Step 2: Persistir snapshot previo cuando aplique**

Para herramientas de escritura criticas, almacenar un snapshot minimo o referencia suficiente para rollback. No duplicar toda la entidad si ya existe versionado o historial reutilizable.

- [ ] **Step 3: Crear rollback service**

Reglas:

- rollback solo para tools marcadas `supportsRollback`
- rollback fallido tambien se audita
- nunca se oculta un fallo original por un fallo de rollback

- [ ] **Step 4: Testear aprobacion y rechazo**

Run:

```bash
npm run test -- app/api/ai/approvals/route.test.ts
```

Expected:

- aprobar reanuda la ejecucion
- rechazar deja estado final consistente

---

## Task 6: Exponer APIs agenticas y surface operacional

**Files:**

- Create: `app/api/ai/agent/route.ts`
- Create: `app/api/ai/executions/route.ts`
- Create: `app/api/ai/executions/[executionId]/route.ts`
- Create: `app/api/ai/workflows/route.ts`
- Create: `app/api/ai/workflows/[workflowId]/route.ts`
- Modify: `lib/ai/validation.ts`

- [ ] **Step 1: Crear request schema canonico**

```ts
{
  message: string;
  projectId?: string;
  mode?: "chat" | "goal" | "workflow";
  workflowId?: string;
  executionId?: string;
}
```

- [ ] **Step 2: Crear rutas**

- `POST /api/ai/agent` inicia o continua ejecucion
- `GET /api/ai/executions` lista ejecuciones
- `GET /api/ai/executions/[executionId]` devuelve timeline y steps
- `GET /api/ai/workflows` lista plantillas de workflow

- [ ] **Step 3: Reusar auth y historial**

Las rutas usan `withAiRoute` y registran:

- usuario
- proyecto
- provider/model
- plan
- tool invocations
- approvals
- rollback

- [ ] **Step 4: Tests de contrato**

Run:

```bash
npm run test -- app/api/ai/agent/route.test.ts app/api/ai/execute/route.test.ts
```

---

## Task 7: Construir la UI Khipu Agent

**Files:**

- Create: `components/ai/agent/*`
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: `components/ai/use-ai-assistant-controller.ts`

- [ ] **Step 1: Agregar workspace operacional**

La nueva pantalla debe tener tres zonas:

- izquierda: conversacion y objetivo actual
- centro: execution plan y estado por step
- derecha: approvals, herramientas, actividad y auditoria compacta

- [ ] **Step 2: Mantener lenguaje visual MYC**

Reglas UI:

- densidad tecnica
- tablas claras
- sin paneles de marketing
- badges de riesgo y estado
- timeline legible y exportable despues

- [ ] **Step 3: Compatibilidad**

La UI actual de `AIWorkspace` puede convivir durante la migracion. El `agent workspace` entra detras de feature flag o ruta nueva antes de reemplazar interacciones existentes.

- [ ] **Step 4: Testear render y estados**

Casos:

- muestra plan pendiente
- muestra aprobacion requerida
- muestra ejecucion completada con resultados resumidos
- muestra error con step fallido

Run:

```bash
npm run test -- components/ai/agent/khipu-agent-workspace.test.tsx
```

---

## Task 8: Specialist Agents y workflow templates

**Files:**

- Create: `lib/ai/agent/workflows.ts`
- Modify: `lib/ai/agent/planner.ts`
- Modify: `lib/ai/agent/tool-registry.ts`

- [ ] **Step 1: Definir bundles de especialidad**

Inicialmente:

- `budget-agent`
- `apu-agent`
- `planning-agent`
- `review-agent`
- `reporting-agent`

Estos no son procesos paralelos; son configuraciones de herramientas, prompts y constraints sobre el mismo orchestrator.

- [ ] **Step 2: Crear plantillas de workflow**

Ejemplos:

- crear presupuesto base desde plantilla
- revisar presupuesto y detectar vacios
- generar cronograma preliminar
- exportar paquete de reportes

- [ ] **Step 3: Testear resolucion por workflow**

El planner debe poder arrancar desde template sin romper el modo chat libre.

---

## Verification Commands

Por fase:

```bash
npm run test -- lib/ai/agent/state-machine.test.ts
npm run test -- lib/ai/agent/vercel-sdk-adapter.test.ts
npm run test -- lib/ai/agent/tool-registry.test.ts lib/ai/agent/policy-engine.test.ts
npm run test -- lib/ai/agent/planner.test.ts lib/ai/agent/orchestrator.test.ts
npm run test -- app/api/ai/agent/route.test.ts
npm run test -- components/ai/agent/khipu-agent-workspace.test.tsx
```

Antes de cerrar cada release:

```bash
npm run test
npm run lint
```

Si hay cambios en route handlers o streaming, revisar primero la documentacion aplicable en:

```text
node_modules/next/dist/docs/
```

---

## Release Acceptance Criteria

**V2.A**

- existen modelos Prisma y contratos agenticos canonicos
- el estado de ejecucion es trazable y auditable

**V2.B**

- Vercel AI SDK opera como adapter sin duplicar gateway/provider logic
- el loop agentico soporta tool-calling y streaming estructurado

**V2.C**

- toda herramienta agente pasa por registry + Zod + policy engine
- ninguna tool ejecuta Prisma directo desde route

**V2.D**

- el orchestrator puede planear, ejecutar, pausar y resumir
- los loops tienen limites y errores auditables

**V2.E**

- operaciones de escritura pueden quedar pendientes de aprobacion
- rollback queda soportado para operaciones compatibles

**V2.F**

- existe una UI de ejecucion con plan, approvals y actividad
- la experiencia sigue siendo tecnica, clara y compacta

**V2.G**

- existen bundles iniciales de agentes especialistas
- workflows reutilizables aceleran casos de uso frecuentes

---

## Open Decisions

- Si `AgentExecution` debe relacionarse con `AiProjectHistoryEntry` o mantenerse como ledger paralelo con links opcionales
- Que herramientas entran en la primera ola como `write-enabled` y cuales quedan en `simulate-only`
- Si los exports se ejecutan dentro del execution flow o se delegan a jobs asincronos en una fase posterior
- Si el primer lanzamiento expone una ruta separada `/ai/agent` o integra el workspace en la UI global actual

---

## Self-Review

- El PRD queda aterrizado como migracion aditiva, no rewrite
- Vercel AI SDK entra como infraestructura de modelo, no como sustituto de reglas de negocio
- Las operaciones criticas mantienen validacion, permisos, aprobaciones y auditoria
- El conocimiento sigue viviendo en la plataforma y sus servicios, no en prompts sueltos
