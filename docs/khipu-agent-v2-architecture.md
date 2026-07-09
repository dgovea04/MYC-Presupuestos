# Khipu Agent Platform V2 — Arquitectura

> **Fecha:** Julio 2026
> **Estado:** Fase 0-2 completada. Fase 3 (Planner + Orchestrator) pendiente.

---

## Resumen Ejecutivo

La **Khipu Agent Platform V2** transforma el chat de MC Presupuestos de un modo conversacional simple a un sistema agéntico con herramientas. El LLM ya no solo responde texto — ahora puede **buscar partidas, crear insumos, calcular APUs, generar cronogramas, y modificar presupuestos**, todo bajo un sistema de políticas de seguridad y aprobación.

---

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Chat Khipu)                         │
│  POST /api/ai/chat  { provider: "agent", message, context, projectId }  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        GATEWAY (execute.ts)                             │
│                                                                         │
│  1. buildKhipuAssembledContext  →  system prompt + user messages        │
│  2. resolveAiProvider("agent")  →  "agent"                              │
│  3. enrichProviderRequest       →  OpenRouter API key + model           │
│  4. executeAgentProvider(request)                                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AGENT PROVIDER (agent-provider.ts)                    │
│                                                                         │
│  1. createOpenRouter(apiKey)  →  LanguageModel (Vercel AI SDK)          │
│  2. createToolRegistry()      →  registra 13 domain tools               │
│  3. createPolicyEngine()      →  evalúa riesgo por tool                 │
│  4. createToolExecutor()      →  valida (Zod) + política + ejecuta      │
│  5. createVercelSdkAdapter()  →  wrapper de generateText()              │
│                                                                         │
│  ┌─── LOOP AGÉNTICO (máx 5 iteraciones) ────────────────────────────┐  │
│  │                                                                   │  │
│  │  ┌─────────────────────┐                                          │  │
│  │  │ VercelSdkAdapter    │  model + messages + tools → LLM          │  │
│  │  │ .runLoop()          │  ← text + toolCalls + usage              │  │
│  │  └────────┬────────────┘                                          │  │
│  │           │                                                       │  │
│  │     ¿finishReason = "error"?  ──SÍ──→  error response             │  │
│  │           │                                                       │  │
│  │     ¿toolCalls.length = 0?    ──SÍ──→  final answer               │  │
│  │           │                                                       │  │
│  │           ▼                                                       │  │
│  │  ┌─────────────────────────────────────────────┐                  │  │
│  │  │ ToolExecutor.execute() × N tool calls        │                  │  │
│  │  │  1. Busca tool en ToolRegistry               │                  │  │
│  │  │  2. Valida input con Zod                     │                  │  │
│  │  │  3. Consulta PolicyEngine (read/write/...)   │                  │  │
│  │  │  4. ¿Requiere aprobación? → pausa loop       │                  │  │
│  │  │  5. Ejecuta tool.execute()                   │                  │  │
│  │  │  6. Retorna summary + output                 │                  │  │
│  │  └─────────────────────────────────────────────┘                  │  │
│  │           │                                                       │  │
│  │     tool results → user message → loop continúa                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  6. Retorna AiProviderResult { answer, provider: "agent", warnings }    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Capas y Componentes

### 1. Gateway (`lib/ai/gateway/`)

| Archivo | Responsabilidad |
|---------|----------------|
| `execute.ts` | Entrada única para todas las tareas de IA. Resuelve proveedor, enriquece con API keys, ejecuta el provider via fallback chain. |
| `types.ts` | `AiProviderId`, `KhipuAiTask`, `AiProviderRequest`, `AiProviderResult`. El provider `"agent"` se registró como un `AiProviderId` más. |
| `router.ts` | `resolveAiProvider` y `getProviderFallbackChain`. Para `"agent"`, retorna `["agent"]` sin fallback. |
| `providers/agent-provider.ts` | Implementación concreta del loop agéntico (ver sección 2). |
| `providers/openrouter-provider.ts` | Provider base que usa `createOpenRouter` + `generateText`. |

### 2. Agent Provider (`lib/ai/gateway/providers/agent-provider.ts`)

Orquesta el loop agéntico completo:

```
executeAgentProvider(request: AiProviderRequest) → AiProviderResult
```

1. **Resuelve `LanguageModel`** via `createOpenRouter(apiKey).chat(model)` (Vercel AI SDK)
2. **Inicializa machinery**: ToolRegistry + PolicyEngine + ToolExecutor + VercelSdkAdapter
3. **Extrae `systemPrompt`** y `conversationMessages` del request
4. **Loop** (máx 5 iteraciones):
   - `adapter.runLoop(system, messages, tools, model)` → `{ messages, toolCalls, finishReason, usage }`
   - Si `finishReason = "error"` → respuesta de error
   - Si `toolCalls.length = 0` → respuesta final
   - Por cada tool call: `toolExecutor.execute(...)` → valida, evalúa política, ejecuta
   - Si alguna requiere aprobación → pausa con mensaje
   - Tool results → user message → siguiente iteración
5. **Retorna** `AiProviderResult` con answer, provider="agent", warnings, latencyMs

### 3. Vercel AI SDK Adapter (`lib/ai/agent/vercel-sdk-adapter.ts`)

Wrapper sobre `generateText` del Vercel AI SDK v6:

```ts
class VercelSdkAdapter implements AgentVercelSdkAdapter {
  async runLoop(input: AgentVercelSdkLoopInput): Promise<AgentVercelSdkLoopOutput>
}
```

- **`buildModelMessages`**: Convierte `AgentLoopMessage[]` → `ModelMessage[]`
- **`buildSdkTools`**: Convierte `AgentSdkToolDefinition[]` → formato SDK con `inputSchema`
- **`computeMaxSteps`**: Determina `maxSteps` según `stopWhen` (final_text=5, tool_limit=8, approval_boundary=4)
- **`determineFinishReason`**: Prioridad: error > approval_boundary > tool_limit > sdkFinishReason
- **`extractToolCalls`**: Extrae de `result.toolCalls` y `result.steps[]` con deduplicación
- El `LanguageModel` se pasa como `resolvedModel: unknown` (cast a `LanguageModel`)

### 4. Tool Registry (`lib/ai/agent/tool-registry.ts`)

```ts
class ToolRegistry implements AgentToolRegistry {
  register(tool)       // Registra con nombre único
  get(name)            // Busca por nombre
  list()               // Todas las tools
  toSdkDefinitions()   // Convierte a formato Vercel AI SDK
  listByRisk(risk)     // Filtra por riesgo
  listRequiringProject() // Tools que necesitan projectId
}
```

Registra **13 herramientas** desde `lib/ai/agent/tools/index.ts` (`allTools`).

### 5. Policy Engine (`lib/ai/agent/policy-engine.ts`)

```ts
class PolicyEngine implements AgentPolicyEngine {
  evaluate({ toolName, toolRisk, executionMode }) → PolicyOutput
}
```

| Riesgo | Modo chat | Modo goal/workflow |
|--------|-----------|-------------------|
| `read` | ✅ Permitido | ✅ Permitido |
| `write` | 🔒 Aprobación requerida | 🔒 Aprobación requerida |
| `financial` | 🔒 Aprobación requerida | 🔒 Aprobación requerida |
| `export` | ✅ Permitido (con auditoría) | 🔒 Aprobación requerida |

### 6. Tool Executor (`lib/ai/agent/tool-executor.ts`)

```ts
class ToolExecutor implements AgentToolExecutor {
  constructor(registry, policyEngine)
  async execute({ toolCall, userId, projectId, executionId, mode }) → ToolExecutorOutput
}
```

Flujo de ejecución:
1. Busca tool en registry → error si no existe
2. Valida input con Zod (`tool.inputSchema.safeParse`) → error si falla
3. Verifica `requiresProjectId` → error si falta
4. Consulta `policyEngine.evaluate()` → bloquea si `allowed=false`
5. Si `approvalRequirement !== "none"` → retorna `approvalRequired` (el loop pausa)
6. Ejecuta `tool.execute(validatedInput, context)` → captura errores
7. Retorna `{ toolResult, success, latencyMs, summary }`

### 7. Domain Tools (`lib/ai/agent/tools/`)

**13 herramientas en 8 dominios:**

| Archivo | Tools | Riesgo | Estado |
|---------|-------|--------|--------|
| `budgets.ts` | `searchBudgets`, `calculateBudget` | read | `calculateBudget` conectado a `getBudgetById` |
| `partidas.ts` | `searchPartidas`, `suggestPartidas`, `addPartida` | read ×2, write | `searchPartidas` usa `getCatalogPartidas`; `addPartida` conectado a `saveCatalogPartidasPatch` |
| `apu.ts` | `reviewAPU`, `calculateAPU` | read | `calculateAPU` con cálculo real de costos |
| `insumos.ts` | `searchInsumos`, `addInsumo` | read, write | `searchInsumos` usa `getResourcesByUser`; `addInsumo` conectado a `createResourceForUser` |
| `index.ts` | `reviewTakeoff`, `createSchedule`, `exportReport`, `createChapter` | read, write, export, write | `createSchedule` → `generateWorkScheduleBase`; `createChapter` → `saveBudgetPatch` |

### 8. State Machine (`lib/ai/agent/state-machine.ts`)

Define el ciclo de vida de una ejecución agéntica (Fase 0, para uso futuro del Orchestrator):

```
READ → PLAN → PROPOSE → SIMULATE → PENDING_APPROVAL → EXECUTING → EXECUTED
  │       │         │           │                      │            │
  └───────┴─────────┴───────────┴──────────────────────┴────────────┘
                                FAILED    ←    ROLLED_BACK
```

Estados terminales: `FAILED`, `ROLLED_BACK`, `EXECUTED` (solo puede transicionar a `ROLLED_BACK`).

### 9. Base de Datos (Prisma Schema)

6 modelos para el ledger de ejecución:

| Modelo | Propósito |
|--------|-----------|
| `AgentExecution` | Registro de ejecución (executionId, userId, projectId, state, mode) |
| `AgentExecutionStep` | Paso individual dentro de una ejecución |
| `AgentToolInvocation` | Invocación de una tool específica |
| `AgentApproval` | Registro de aprobaciones humanas |
| `AgentRollback` | Registro de rollbacks |
| `AgentWorkflow` | Definición de workflows reutilizables |

---

## Tipos y Contratos

| Archivo | Contenido |
|---------|-----------|
| `types.ts` | `AgentExecutionState` (9 estados), `AgentExecutionMode` (chat/goal/workflow), `AgentToolRisk` (read/write/financial/export), `AgentToolDefinition`, `PlannedStep`, `RunAgentRequest`, `AGENT_LIMITS` (maxToolCalls=8, maxReplans=3, maxRetriesPerTool=2) |
| `contracts.ts` | Interfaces: `AgentOrchestrator`, `AgentPlanner`, `AgentPolicyEngine`, `AgentToolRegistry`, `AgentToolExecutor`, `AgentApprovalService`, `AgentRollbackService`, `AgentVercelSdkAdapter`, `AgentResponseBuilder` |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| AI SDK | `ai@6.0.206` (Vercel AI SDK) |
| Model backend | `@openrouter/ai-sdk-provider@2.9.1` → OpenRouter API |
| Validación | `zod@^4.4.3` para schemas de input/output de herramientas |
| BD | Prisma + PostgreSQL (6 modelos agénticos) |
| Testing | Vitest (166 tests agénticos + gateway) |
| Runtime | Next.js App Router (API routes) |

---

## Flujo de una Solicitud Típica

### Ejemplo: "Busca partidas de concreto y calcula el presupuesto"

```
1. Cliente → POST /api/ai/chat { provider: "agent", message: "Busca partidas...", projectId }
2. executeAiTask({ provider: "agent", task: "chat", ... })
3. enrichProviderRequest → OpenRouter API key + "deepseek/deepseek-chat-v3-0324:free"
4. executeAgentProvider(request)
   ├─ createOpenRouter(apiKey).chat(model) → LanguageModel
   ├─ ToolRegistry ← allTools (13 tools registradas)
   ├─ PolicyEngine + ToolExecutor + VercelSdkAdapter
   │
   ├─ Iteración 1:
   │   adapter.runLoop("Eres un asistente...", [user:"Busca..."], tools, model)
   │   → toolCalls: [{ name: "searchPartidas", args: { query: "concreto" } }]
   │   → finishReason: "approval_boundary"
   │   ├─ toolExecutor.execute(searchPartidas, { query: "concreto" })
   │   │   ├─ registry.get("searchPartidas") ✓
   │   │   ├─ Zod validation ✓
   │   │   ├─ policyEngine: risk=read, chat → allowed ✓
   │   │   └─ getCatalogPartidas() → 3 partidas encontradas
   │   └─ toolResults → user message
   │
   ├─ Iteración 2:
   │   adapter.runLoop(..., msgs + tool_results, ...)
   │   → toolCalls: [{ name: "calculateBudget", args: { budgetId: "b-1" } }]
   │   └─ toolExecutor.execute(calculateBudget, { budgetId: "b-1" })
   │       └─ getBudgetById("b-1") → totalAmount: 125000
   │
   ├─ Iteración 3:
   │   adapter.runLoop(..., msgs + tool_results, ...)
   │   → toolCalls: [] (modelo decidió que ya tiene suficiente)
   │   → finishReason: "stop"
   │   └─ Respuesta: "Encontré 3 partidas de concreto. El presupuesto total es S/ 125,000."
   │
   └─ AiProviderResult { answer: "...", provider: "agent", warnings: [], latencyMs: 2450 }
5. attachProjectHistoryEntry → persiste en BD
6. Respuesta al cliente
```

### Ejemplo: Herramienta bloqueada por política

```
"Iteração 1: adapter.runLoop → toolCalls: [{ name: "addPartida", args: {...} }]
  ├─ toolExecutor.execute(addPartida, ...)
  │   ├─ policyEngine: risk=write, chat → approvalRequirement: "pre_execute"
  │   └─ toolExecutor retorna: { success: false, approvalRequired: { ... } }
  └─ agent loop DETENIDO → respuesta:
     "⚠️ Se requiere tu aprobación para ejecutar 'addPartida': Escritura en modo chat..."
```

---

## Cobertura de Tests

| Suite | Archivos | Tests |
|-------|---------|-------|
| State Machine | `state-machine.test.ts` | 40 |
| Vercel SDK Adapter | `vercel-sdk-adapter.test.ts` | 34 |
| Tool Registry | `tool-registry.test.ts` | 16 |
| Policy Engine | `policy-engine.test.ts` | 18 |
| Tool Executor | `tool-executor.test.ts` | 15 |
| Agent Provider | `agent-provider.test.ts` | 13 |
| Gateway (execute) | `execute.test.ts` | 2 |
| Gateway (router) | `router.test.ts` | 4 |
| Provider (openai) | `openai-provider.test.ts` | 3 |
| Provider (gemini) | `gemini-provider.test.ts` | 21 |
| **Total** | **10 archivos** | **166** |

---

## Pendiente (Fase 3+)

- [ ] **Planner**: convertir objetivos conversacionales en `PlannedStep[]`
- [ ] **Orchestrator**: unir state machine + planner + policy engine + tool registry + adapter en ejecución completa con seguimiento de estados
- [ ] **Approval Service**: persistir y gestionar aprobaciones humanas (UI + BD)
- [ ] **Rollback Service**: revertir ejecuciones que modificaron datos
- [ ] **Workflows**: ejecuciones predefinidas (ej. "revisar presupuesto completo")
- [ ] **Streaming**: soporte para streaming de respuestas del agente
- [ ] **Frontend**: añadir provider "Agent" al selector del chat
