# Spec: Khipu Agent Prompt, Tool and Budget Generation Optimization

> **Fecha:** 2026-07-12
> **Estado:** Draft
> **Plan relacionado:** `docs/superpowers/plans/2026-07-12-khipu-agent-prompt-tool-budget-optimization.md`

---

## 1. Objetivo

Implementar mejoras en Khipu Agente para:

- clasificar intenciones del usuario antes de invocar el LLM;
- modularizar prompts del agente;
- reducir herramientas disponibles por turno;
- mejorar el flujo de preview/confirmacion/generacion de presupuesto;
- definir criterios deterministicos para MCP, plantillas de proyecto y catalogo;
- evitar duplicados de presupuesto general/subpresupuestos;
- aumentar trazabilidad y testabilidad.

---

## 2. Componentes Afectados

| Componente | Cambio |
|---|---|
| `app/api/ai/agent/stream/route.ts` | Usar intent router y prompt builder |
| `lib/ai/agent/workflows.ts` | Agregar MCP tools a bundles |
| `lib/ai/agent/planner.ts` | Agregar reglas para presupuesto/MCP |
| `lib/ai/agent/tool-registry.ts` | Soportar filtro por intent si aplica |
| `lib/ai/agent/tools/budgets.ts` | Mejorar preview/generate y estructura base |
| `lib/ai/agent/tools/mcp-budget.ts` | Ajustar contratos de preview/apply si aplica |
| `lib/ai/budget-generation/generation-intent.ts` | Reutilizar y extender extraccion |
| `lib/ai/budget-generation/source-selector.ts` | Nuevo selector de fuente |
| `lib/ai/agent/intent-router.ts` | Nuevo clasificador |
| `lib/ai/agent/prompt-builder.ts` | Nuevo builder modular |

---

## 3. Tipos Nuevos

### 3.1 Agent Intent

Archivo:

```text
lib/ai/agent/intent-router.ts
```

Contrato:

```ts
export type AgentIntentType =
  | "general_chat"
  | "create_project"
  | "select_existing_project"
  | "create_general_budget"
  | "create_sub_budget"
  | "preview_budget_generation"
  | "apply_budget_generation"
  | "search_mcp_template"
  | "preview_mcp_template"
  | "apply_mcp_template"
  | "review_apu"
  | "optimize_apu"
  | "export_report";

export type AgentIntentConfidence = "high" | "medium" | "low";

export type AgentIntent = {
  type: AgentIntentType;
  confidence: AgentIntentConfidence;
  reason: string;
  requiredFields: AgentIntentRequiredField[];
  extracted: {
    projectId?: string;
    projectName?: string;
    budgetId?: string;
    parentBudgetId?: string;
    subBudgetName?: string;
    description?: string;
    projectType?: string;
    templateSource?: "auto" | "mcp" | "project" | "catalog";
    mcpPackageId?: string;
    reportFormat?: "pdf" | "excel" | "s10";
  };
  suggestedTools: string[];
};

export type AgentIntentRequiredField = {
  field:
    | "projectId"
    | "projectName"
    | "budgetId"
    | "parentBudgetId"
    | "subBudgetName"
    | "description"
    | "mcpPackageId"
    | "reportFormat";
  question: string;
};
```

Funcion principal:

```ts
export function detectAgentIntent(input: {
  message: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  mode?: "chat" | "goal" | "workflow";
  workflowId?: string;
  projectId?: string;
  workspaceId?: string;
  pendingAction?: AgentPendingAction | null;
}): AgentIntent;
```

### 3.2 Pending Action

Debe permitir que una confirmacion simple ejecute la accion anterior sin repreguntar.

```ts
export type AgentPendingAction =
  | {
      type: "apply_budget_generation";
      projectId: string;
      description: string;
      templateSource: "auto" | "mcp" | "project" | "catalog";
      mcpPackageId?: string;
      previewId?: string;
    }
  | {
      type: "apply_mcp_template";
      projectId: string;
      packageId: string;
      description: string;
      mode: "auto" | "review_required";
      previewId?: string;
    };
```

MVP: el pending action puede inferirse del historial de mensajes o mantenerse en UI. Fase posterior: persistirlo en DB por execution/session.

---

## 4. Prompt Builder

Archivo:

```text
lib/ai/agent/prompt-builder.ts
```

Contrato:

```ts
export type AgentPromptContext = {
  intent: AgentIntent;
  workspace?: {
    id: string;
    name: string;
  } | null;
  recentProjects: Array<{
    id: string;
    name: string;
    clientName?: string | null;
    location?: string | null;
  }>;
  workflow?: {
    id: string;
    name: string;
    bundleSlug: string;
    bundleName: string;
    bundleDescription: string;
    systemPrompt: string;
    initialGoal: string;
  } | null;
  provider?: "openrouter" | "google" | "ollama" | "unknown";
  pendingAction?: AgentPendingAction | null;
};

export function buildAgentSystemPrompt(context: AgentPromptContext): string;
```

### 4.1 Secciones obligatorias

El prompt generado debe incluir, en este orden:

1. Identidad Khipu.
2. Workspace activo.
3. Proyectos recientes.
4. Especialidad/workflow activo.
5. Intencion detectada.
6. Reglas de herramientas para esa intencion.
7. Reglas de confirmacion/pending action.
8. Reglas de seguridad/aprobacion.
9. Reglas de respuesta.

### 4.2 Reglas por intencion

#### `preview_budget_generation`

```text
Objetivo: generar vista previa. Tool preferida: previewBudgetGeneration.
No llames generateBudget en este turno.
Despues del preview, resume fuente, score, conteos y advertencias.
Pregunta si desea proceder solo si el preview es accionable.
```

#### `apply_budget_generation`

```text
El usuario ya confirmo un preview.
Llama generateBudget inmediatamente con los mismos parametros.
No repreguntes confirmacion.
```

#### `create_general_budget`

```text
Verifica proyecto. Si falta proyecto, pregunta solo por proyecto.
Si tienes projectId, llama createBudgetGeneral.
No crees partidas en este paso.
```

#### `create_sub_budget`

```text
Requiere parentBudgetId, projectId y name.
Si falta nombre, pregunta solo el nombre del subpresupuesto.
No dupliques si ya existe.
```

#### `apply_mcp_template`

```text
Debe existir preview o eleccion explicita del packageId.
Usa applyBudgetFromMcpTemplate.
Si score es medio, usar mode=review_required.
```

---

## 5. Tool Filtering

Archivo propuesto:

```text
lib/ai/agent/tool-use-policy.ts
```

Contrato:

```ts
export function getAllowedToolsForIntent(input: {
  intent: AgentIntent;
  workflowId?: string;
  bundleToolNames: string[];
  allToolNames: string[];
}): string[];
```

### 5.1 Mapeo MVP

```ts
const INTENT_TOOL_ALLOWLIST: Record<AgentIntentType, string[]> = {
  general_chat: [],
  create_project: ["createProject"],
  select_existing_project: ["searchProjects"],
  create_general_budget: ["createBudgetGeneral", "searchProjects"],
  create_sub_budget: ["createSubBudget", "searchBudgets"],
  preview_budget_generation: [
    "previewBudgetGeneration",
    "createBudgetGeneral",
    "searchProjects",
  ],
  apply_budget_generation: ["generateBudget"],
  search_mcp_template: ["searchMcpTemplates"],
  preview_mcp_template: ["previewBudgetFromMcpTemplate"],
  apply_mcp_template: ["applyBudgetFromMcpTemplate"],
  review_apu: ["reviewAPU", "calculateAPU", "searchPartidas"],
  optimize_apu: ["optimizeAPU", "reviewAPU", "calculateAPU", "searchInsumos"],
  export_report: ["calculateBudget", "exportPDF", "exportExcel", "exportS10"],
};
```

Regla: si la lista es vacia, permitir solo tools de lectura seguras o ninguna tool, segun modo.

---

## 6. Cambios en Bundles

Archivo:

```text
lib/ai/agent/workflows.ts
```

Agregar a `khipu-agent`:

```text
previewBudgetGeneration
searchMcpTemplates
previewBudgetFromMcpTemplate
applyBudgetFromMcpTemplate
```

Agregar a `budget-agent`:

```text
previewBudgetGeneration
searchMcpTemplates
previewBudgetFromMcpTemplate
applyBudgetFromMcpTemplate
```

Actualizar `systemPrompt` de `budget-agent` para indicar:

- primero preview;
- MCP fuerte como fuente preferente;
- MCP medio con `review_required`;
- catalogo como fallback;
- no duplicar Presupuesto General ni subpresupuestos.

---

## 7. Cambios en Planner

Archivo:

```text
lib/ai/agent/planner.ts
```

### 7.1 Keywords nuevas

Agregar entradas a `KEYWORD_TOOLS`:

```ts
{
  keywords: ["preview presupuesto", "vista previa", "previsualiza", "previsualizar presupuesto"],
  toolName: "previewBudgetGeneration",
  title: "Previsualizar generacion de presupuesto",
  isWrite: false,
  approvalBoundary: false,
}

{
  keywords: ["generar presupuesto", "crear presupuesto con partidas", "presupuesto automatico"],
  toolName: "previewBudgetGeneration",
  title: "Previsualizar generacion antes de escribir",
  isWrite: false,
  approvalBoundary: false,
}

{
  keywords: ["confirmado", "proceder", "dale", "si confirmado", "aplicar generacion"],
  toolName: "generateBudget",
  title: "Aplicar generacion de presupuesto",
  isWrite: true,
  approvalBoundary: true,
}

{
  keywords: ["presupuesto general"],
  toolName: "createBudgetGeneral",
  title: "Crear presupuesto general",
  isWrite: true,
  approvalBoundary: true,
}

{
  keywords: ["subpresupuesto", "sub presupuesto", "crear especialidad"],
  toolName: "createSubBudget",
  title: "Crear subpresupuesto",
  isWrite: true,
  approvalBoundary: true,
}

{
  keywords: ["mcp", "plantilla mcp", ".mcp", "buscar plantilla"],
  toolName: "searchMcpTemplates",
  title: "Buscar plantilla MCP",
  isWrite: false,
  approvalBoundary: false,
}
```

### 7.2 Regla especial

Si el goal contiene "generar presupuesto" y no contiene confirmacion explicita, el plan debe usar `previewBudgetGeneration`, no `generateBudget`.

---

## 8. Source Selector

Archivo:

```text
lib/ai/budget-generation/source-selector.ts
```

Contrato:

```ts
export type BudgetGenerationSourceKind =
  | "mcp_strong"
  | "mcp_review"
  | "project_template"
  | "user_template"
  | "catalog"
  | "insufficient_data";

export type BudgetGenerationSourceDecision = {
  kind: BudgetGenerationSourceKind;
  confidence: "high" | "medium" | "low";
  recommendedAction:
    | "preview_mcp"
    | "apply_mcp_after_confirmation"
    | "preview_project_template"
    | "use_catalog"
    | "ask_user";
  reason: string;
  selectedMcpPackage?: {
    packageId: string;
    projectName: string;
    score: number;
    reasons: string[];
  };
  warnings: string[];
};

export async function selectBudgetGenerationSource(input: {
  userId: string;
  companyId: string;
  projectId?: string;
  description: string;
  projectType?: string;
  templateSource: "auto" | "mcp" | "project" | "catalog";
}): Promise<BudgetGenerationSourceDecision>;
```

### 8.1 Reglas

| Condicion | Decision |
|---|---|
| `templateSource = catalog` | `catalog` |
| MCP score `>= 0.50` | `mcp_strong` |
| MCP score `>= 0.35 && < 0.50` | `mcp_review` |
| proyecto similar score `>= 0.50` con plantilla | `project_template` |
| plantilla de usuario relevante | `user_template` |
| catalogo tiene resultados | `catalog` |
| nada suficiente | `insufficient_data` |

---

## 9. Preview Budget Generation

Archivo:

```text
lib/ai/agent/tools/budgets.ts
```

### 9.1 Resultado nuevo

`previewBudgetGenerationTool` debe devolver:

```ts
export type BudgetGenerationPreviewResult = {
  projectId: string;
  description: string;
  sourceDecision: BudgetGenerationSourceDecision;
  recommendedAction: BudgetGenerationSourceDecision["recommendedAction"];
  requiresConfirmation: boolean;
  canApply: boolean;
  pendingAction?: AgentPendingAction;
  mcpPreview?: {
    packageId: string;
    sourceProjectName: string;
    templateScore: number;
    subBudgets: Array<{
      name: string;
      itemCount: number;
      matchedCatalogItems: number;
      reviewRequiredItems: number;
      unmatchedItems: number;
      estimatedDirectCost: number;
    }>;
    totals: {
      estimatedDirectCost: number;
      matchedItems: number;
      reviewRequiredItems: number;
      unmatchedItems: number;
    };
  };
  projectTemplatePreview?: {
    templateNames: string[];
    estimatedItems: number;
  };
  catalogPreview?: {
    candidateItems: number;
  };
  warnings: string[];
  assumptions: string[];
};
```

### 9.2 Summary

`summarizeResult` debe incluir:

- fuente recomendada;
- confianza;
- si puede aplicar;
- numero de subpresupuestos;
- matched/review/unmatched;
- siguiente accion.

Ejemplo:

```text
Preview listo: fuente recomendada MCP (alta confianza), 4 subpresupuestos, 86 partidas; 70 OK, 12 requieren revision, 4 sin match. Siguiente accion: confirmar aplicacion.
```

---

## 10. Generate Budget

Archivo:

```text
lib/ai/agent/tools/budgets.ts
```

### 10.1 Precondiciones

Antes de generar:

1. Resolver `projectId`.
2. Verificar acceso del usuario.
3. Verificar Presupuesto General.
4. Verificar subpresupuestos.
5. Verificar descripcion.
6. Si `templateSource=auto`, llamar `selectBudgetGenerationSource`.

### 10.2 Regla de estructura base

Si no hay subpresupuestos:

- no fallar inmediatamente;
- crear/proponer `createBudgetGeneral` segun policy;
- en modo tool directo, devolver error accionable con `requiredAction=create_general_budget`;
- en modo flujo agente, el intent router debe planificar `createBudgetGeneral` antes de `generateBudget`.

Resultado recomendado para error accionable:

```ts
{
  errorCode: "MISSING_GENERAL_BUDGET",
  requiredAction: "create_general_budget",
  message: "El proyecto no tiene Presupuesto General. Crea uno antes de generar partidas."
}
```

### 10.3 Aplicacion MCP

- Si `mcpPackageId` esta presente: usar ese paquete.
- Si source decision es `mcp_strong`: aplicar MCP.
- Si source decision es `mcp_review`: usar modo `review_required` o pedir confirmacion explicita.
- Si MCP falla: registrar warning y fallback a proyecto/plantilla/catalogo solo si `templateSource=auto`.
- Si `templateSource=mcp` y no hay match: no hacer fallback silencioso.

---

## 11. Subpresupuestos

### 11.1 Normalizacion

Crear helper:

```text
lib/ai/budget-generation/sub-budget-names.ts
```

Contrato:

```ts
export function normalizeSubBudgetName(name: string): string;

export function isSameSubBudgetName(left: string, right: string): boolean;

export function mapMcpSubBudgetToExisting(input: {
  mcpName: string;
  existingNames: string[];
}): string | null;
```

Reglas:

- ignorar tildes;
- ignorar mayusculas/minusculas;
- tratar `inst. electricas` como `instalaciones electricas`;
- tratar `arquitectura` y `arquitectonico` como compatibles;
- no duplicar si score textual supera umbral.

### 11.2 Aplicacion

- `createSubBudget` debe heredar tasas del padre.
- MCP debe crear solo subpresupuestos faltantes.
- Si ya existe, agregar niveles/items al existente.
- Guardar trazabilidad de fuente cuando aplique.

---

## 12. Confirmacion

### 12.1 Detector

Archivo:

```text
lib/ai/agent/confirmation.ts
```

Contrato:

```ts
export type ConfirmationResult =
  | { kind: "affirmative"; confidence: "high" | "medium" }
  | { kind: "negative"; confidence: "high" | "medium" }
  | { kind: "modify"; confidence: "high" | "medium"; requestedChange: string }
  | { kind: "unclear"; confidence: "low" };

export function detectConfirmation(message: string): ConfirmationResult;
```

### 12.2 Frases afirmativas

Debe reconocer:

```text
si, sí, ok, okay, dale, procede, adelante, hazlo, correcto,
confirmado, de acuerdo, vamos, aplica, generar, genera,
yes, go ahead, proceed
```

### 12.3 Uso

Si hay `pendingAction` y `detectConfirmation` retorna `affirmative`, el intent debe ser `apply_budget_generation` o `apply_mcp_template`.

---

## 13. API Streaming

Archivo:

```text
app/api/ai/agent/stream/route.ts
```

### 13.1 Cambios

1. Detectar intent antes de construir prompt.
2. Construir prompt modular.
3. Filtrar tools por intent.
4. Incluir `pendingAction` cuando exista.
5. Emitir SSE adicional opcional:

```ts
type AgentStreamEvent =
  | { type: "intent"; intent: AgentIntent }
  | { type: "pending_action"; pendingAction: AgentPendingAction }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_result"; toolName: string; success: boolean; summary: string }
  | { type: "approval_required"; approvalId: string; toolName: string; reason: string }
  | { type: "delta"; text: string }
  | { type: "final"; text: string };
```

MVP: si no se cambia UI, mantener eventos actuales y agregar solo datos internos en final/warnings.

---

## 14. UI

Archivo:

```text
components/ai/AgentWorkspace.tsx
```

### 14.1 Preview Card

Cuando el resultado incluya preview de generacion, mostrar:

- fuente recomendada;
- confianza;
- subpresupuestos;
- partidas OK/revision/sin match;
- costo directo estimado;
- advertencias;
- boton primario: `Generar presupuesto`;
- boton secundario: `Cambiar fuente`;
- boton terciario: `Ver detalle`.

### 14.2 Tool Activity

La actividad debe agrupar tools por fase:

```text
Analisis
Preview
Aplicacion
Recalculo
```

---

## 15. Tests

### 15.1 Unit tests nuevos

```text
lib/ai/agent/intent-router.test.ts
lib/ai/agent/prompt-builder.test.ts
lib/ai/agent/tool-use-policy.test.ts
lib/ai/agent/confirmation.test.ts
lib/ai/budget-generation/source-selector.test.ts
lib/ai/budget-generation/sub-budget-names.test.ts
```

### 15.2 Tests existentes a actualizar

```text
lib/ai/agent/workflows.test.ts
lib/ai/agent/planner.test.ts
app/api/ai/agent/stream/route.test.ts
lib/ai/agent/tools/budgets.test.ts
lib/ai/agent/tools/mcp-budget.test.ts
```

### 15.3 Casos obligatorios

1. Usuario: "crea un presupuesto para vivienda de 120m2".
   - Intent: `preview_budget_generation`.
   - Tool: `previewBudgetGeneration`.
   - No debe llamar `generateBudget`.

2. Usuario confirma despues del preview: "si procede".
   - Intent: `apply_budget_generation`.
   - Tool: `generateBudget`.
   - No debe repreguntar.

3. Usuario: "usa una plantilla MCP de vivienda".
   - Intent: `search_mcp_template` o `preview_mcp_template`.
   - Tools MCP disponibles.

4. MCP score `>= 0.50`.
   - `sourceDecision.kind = "mcp_strong"`.
   - `recommendedAction = "apply_mcp_after_confirmation"`.

5. MCP score `0.35 - 0.49`.
   - `sourceDecision.kind = "mcp_review"`.
   - `requiresConfirmation = true`.

6. Proyecto sin Presupuesto General.
   - Flujo propone/planifica `createBudgetGeneral`.
   - `generateBudget` no falla de forma opaca.

7. Crear subpresupuesto con nombre duplicado normalizado.
   - No duplica.
   - Retorna mensaje accionable.

8. `searchProjects` nunca se llama sin `query`.

9. `searchCompanies` no se llama cuando hay `workspaceId`.

---

## 16. Migracion Incremental

### Paso 1

Actualizar `workflows.ts` y `planner.ts`. Esto desbloquea MCP tools sin cambiar UI.

### Paso 2

Introducir `confirmation.ts`, `intent-router.ts` y tests.

### Paso 3

Introducir `prompt-builder.ts` y reemplazar strings en `agent/stream/route.ts`.

### Paso 4

Introducir `source-selector.ts` y usarlo en `previewBudgetGeneration`.

### Paso 5

Actualizar UI para preview card y pending action.

---

## 17. Compatibilidad

- Mantener endpoints existentes.
- Mantener nombres de tools existentes.
- Mantener `previewBudgetGeneration` y `generateBudget` como entrypoints principales.
- No romper `/api/ai/agent/stream`.
- No remover orchestrator aunque el streaming use un camino propio.
- Mantener approvals para write/financial/export.

---

## 18. Criterios de Done

- Tests unitarios nuevos pasan.
- Tests de stream agent pasan.
- `budget-agent` puede buscar/previsualizar/aplicar MCP.
- Khipu genera preview antes de escribir.
- Khipu ejecuta generacion despues de confirmacion simple.
- Khipu no duplica Presupuesto General/subpresupuestos.
- Preview devuelve `recommendedAction`.
- Source selector esta cubierto por tests para MCP fuerte, MCP medio, project template y catalog.
- Documentacion de prompts y criterios MCP queda actualizada.
