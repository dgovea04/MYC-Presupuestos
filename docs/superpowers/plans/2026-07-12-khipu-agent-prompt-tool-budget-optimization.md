# Plan: Khipu Agent Prompt, Tool and Budget Generation Optimization

> **Fecha:** 2026-07-12
> **Objetivo:** Mejorar Khipu Agente para que interactue con el usuario con prompts mas precisos, use herramientas con criterio determinista, y genere presupuestos/subpresupuestos con mejor flujo de preview, MCP, plantillas y aprobacion.
> **Spec:** `docs/specs/2026-07-12-khipu-agent-prompt-tool-budget-optimization-spec.md`

---

## 1. Vision

Khipu Agente debe comportarse como un copiloto tecnico de presupuestos que entiende la intencion del usuario, ejecuta herramientas solo cuando aportan valor y evita conversaciones repetitivas. Para flujos de creacion de presupuesto debe operar con un proceso claro:

```text
Solicitud del usuario
  -> clasificacion de intencion
  -> resolucion de proyecto/workspace
  -> seleccion de fuente: MCP, plantilla de proyecto o catalogo
  -> preview de generacion
  -> confirmacion/aprobacion
  -> aplicacion transaccional
  -> recalculo y resumen trazable
```

El objetivo no es hacer prompts mas largos, sino prompts mas pequenos, especializados y respaldados por servicios testeables.

---

## 2. Estado Actual Verificado

### Capacidades existentes

| Area | Estado | Ubicacion |
|---|---:|---|
| UI unificada Khipu / Asistente / Agente | Existe | `components/ai/KhipuWorkspace.tsx` |
| Chat streaming del agente | Existe | `app/api/ai/agent/stream/route.ts` |
| Orquestador plan/policy/tool/adapter | Existe | `lib/ai/agent/orchestrator.ts` |
| Planner por keywords | Existe | `lib/ai/agent/planner.ts` |
| Bundles especialistas | Existe | `lib/ai/agent/workflows.ts` |
| Registry y executor de tools | Existe | `lib/ai/agent/tool-registry.ts`, `tool-executor.ts` |
| Preview de generacion de presupuesto | Existe | `previewBudgetGenerationTool` |
| Generacion de presupuesto | Existe | `generateBudgetTool` |
| Creacion de Presupuesto General | Existe | `createBudgetGeneralTool` |
| Creacion de Subpresupuesto | Existe | `createSubBudgetTool` |
| Tools MCP explicitas | Existe | `lib/ai/agent/tools/mcp-budget.ts` |
| Matching y aplicacion MCP | Existe | `lib/ai/budget-generation/*mcp*` |

### Brechas principales

1. El prompt de `agent/stream/route.ts` concentra demasiadas reglas de conversacion, proyecto, presupuesto, confirmacion y tools.
2. Hay dos rutas de ejecucion parcialmente solapadas: agente streaming y agente orquestado.
3. El planner actual depende de keywords y no cubre suficientemente `previewBudgetGeneration`, MCP, `createBudgetGeneral` ni `createSubBudget`.
4. Los tools MCP existen, pero el bundle `budget-agent` no los expone explicitamente.
5. La generacion de presupuesto puede fallar si el proyecto no tiene Presupuesto General/subpresupuestos, en vez de crear o proponer la estructura base.
6. La confirmacion post-preview depende demasiado del modelo y del texto del prompt.
7. Falta un contrato estructurado para decidir si usar MCP, plantilla de proyecto, plantilla guardada o catalogo.

---

## 3. Principios de Mejora

1. **Intencion antes que tool.** Primero clasificar que quiere hacer el usuario; luego decidir herramientas.
2. **Preview antes de escritura financiera.** Cualquier generacion masiva debe mostrar preview.
3. **Una sola pregunta obligatoria por turno.** No pedir datos opcionales si no bloquean la accion.
4. **Tools con presupuesto de llamadas.** Evitar bucles y llamadas repetidas.
5. **MCP como fuente preferente cuando el match es fuerte.**
6. **Catalogo como fuente vigente de costos/partidas cuando no hay plantilla confiable.**
7. **Trazabilidad en cada resultado.** Mostrar fuente, score, supuestos y omisiones.
8. **Prompts modulares y testeables.** Evitar reglas duplicadas dispersas en strings largos.

---

## 4. Alcance del MVP

### Incluye

- Router de intenciones para Khipu Agente.
- Prompt builder modular para el streaming agent.
- Reglas de planner para presupuesto, subpresupuesto y MCP.
- Exponer tools MCP en bundles de presupuesto.
- Servicio selector de fuente de generacion.
- Contrato mejorado de preview con `recommendedAction`.
- Flujo canonico preview -> confirmacion -> aplicacion.
- Tests de unidad y tests conversacionales de flujos criticos.

### No incluye

- Reescribir completamente el orchestrator.
- Sustituir el modelo LLM por un planner 100% LLM.
- Generar formula polinomica completa desde MCP.
- Generar cronograma desde MCP en esta fase.
- Cambios de storage MCP ya cubiertos por el plan del 2026-07-11.

---

## 5. Arquitectura Propuesta

### 5.1 Nuevos servicios

```text
lib/ai/agent/intent-router.ts
lib/ai/agent/prompt-builder.ts
lib/ai/agent/tool-use-policy.ts
lib/ai/budget-generation/source-selector.ts
```

### 5.2 Flujo propuesto

```text
AgentWorkspace
  -> /api/ai/agent/stream
  -> buildAgentIntent(input)
  -> buildAgentSystemPrompt(intent, context, workflow)
  -> modelo con tools filtradas por intent/bundle
  -> tool executor
  -> stream UI
```

### 5.3 Intenciones iniciales

| Intent | Tools preferidas | Pregunta si falta |
|---|---|---|
| `create_project` | `createProject` | nombre del proyecto |
| `select_existing_project` | lista reciente o `searchProjects` | nombre del proyecto |
| `create_general_budget` | `createBudgetGeneral` | proyecto |
| `create_sub_budget` | `createSubBudget` | padre/proyecto/nombre |
| `preview_budget_generation` | `previewBudgetGeneration` | proyecto o descripcion |
| `apply_budget_generation` | `generateBudget` | preview previo valido |
| `search_mcp_template` | `searchMcpTemplates` | descripcion |
| `preview_mcp_template` | `previewBudgetFromMcpTemplate` | proyecto/package |
| `apply_mcp_template` | `applyBudgetFromMcpTemplate` | aprobacion |
| `review_apu` | `reviewAPU`, `calculateAPU` | APU/partida |
| `optimize_apu` | `optimizeAPU` | APU/partida |
| `export_report` | `calculateBudget`, `exportPDF/Excel/S10` | presupuesto/formato |

---

## 6. Mejoras de Prompt

### 6.1 Dividir el prompt actual

Reemplazar el bloque largo de `app/api/ai/agent/stream/route.ts` por secciones generadas:

```ts
buildBaseKhipuPrompt()
buildWorkspacePrompt(workspace)
buildRecentProjectsPrompt(projects)
buildWorkflowPrompt(workflow)
buildIntentPrompt(intent)
buildToolRulesPrompt(toolPolicy)
buildConfirmationPrompt(conversationState)
```

### 6.2 Reglas conversacionales

- Si falta un dato obligatorio, preguntar solo ese dato.
- Si el usuario confirma despues de un preview, no volver a preguntar.
- Si el proyecto esta en la lista reciente, usar su ID directamente.
- Si una tool falla por input invalido, pedir el campo faltante o corregir con contexto.
- No llamar `searchProjects` sin `query`.
- No llamar `searchCompanies` cuando hay `workspaceId`.
- No llamar mas de dos veces la misma tool para la misma intencion.

---

## 7. Mejoras de Tools

### 7.1 Bundles

Agregar al `budget-agent` y `khipu-agent`:

```text
searchMcpTemplates
previewBudgetFromMcpTemplate
applyBudgetFromMcpTemplate
previewBudgetGeneration
```

Agregar al planner keywords para:

```text
preview presupuesto, vista previa, generar presupuesto,
crear presupuesto general, crear subpresupuesto,
usar mcp, plantilla mcp, buscar plantilla,
aplicar plantilla, vivienda template
```

### 7.2 Filtro de tools por intencion

Aunque el bundle tenga muchas tools, cada turno debe exponer solo un subset razonable:

- Presupuesto preview: `previewBudgetGeneration`, `searchProjects`, `createBudgetGeneral`.
- Confirmacion preview: `generateBudget`.
- MCP explicito: `searchMcpTemplates`, `previewBudgetFromMcpTemplate`, `applyBudgetFromMcpTemplate`.
- APU: `reviewAPU`, `calculateAPU`, `optimizeAPU`, `searchPartidas`, `searchInsumos`.

Esto reduce errores del modelo y costo de tokens.

---

## 8. Generacion de Presupuesto y Subpresupuesto

### 8.1 Flujo canonico

```text
1. Resolver proyecto.
2. Verificar Presupuesto General.
3. Si no existe:
   - proponer/crear `createBudgetGeneral`.
4. Verificar subpresupuestos.
5. Ejecutar `previewBudgetGeneration`.
6. Mostrar:
   - fuente recomendada;
   - subpresupuestos afectados;
   - partidas estimadas;
   - match MCP/catalogo;
   - advertencias.
7. Esperar confirmacion.
8. Ejecutar `generateBudget` o `applyBudgetFromMcpTemplate`.
9. Recalcular y resumir.
```

### 8.2 Criterio para crear subpresupuestos

- Si el proyecto no tiene Presupuesto General: crear/proponer `createBudgetGeneral`.
- Si hay General pero faltan subpresupuestos base: sugerir `createSubBudget` para los nombres configurados.
- Si MCP trae subpresupuestos que no existen: crear solo los faltantes.
- Si un subpresupuesto existe: no duplicarlo; agregar niveles/partidas con trazabilidad.

---

## 9. Criterios MCP y Plantillas

### 9.1 Orden de fuente

1. MCP fuerte.
2. MCP medio con revision.
3. Plantilla de proyecto similar.
4. Plantilla guardada del usuario.
5. Catalogo.

### 9.2 Umbrales

| Score | Decision |
|---:|---|
| `>= 0.50` | Usar MCP como fuente recomendada |
| `0.35 - 0.49` | Mostrar preview y pedir confirmacion explicita |
| `< 0.35` | No usar MCP automaticamente |

### 9.3 Regla de aplicacion

- `previewBudgetGeneration` puede seleccionar MCP automaticamente si el score es fuerte.
- `generateBudget` no debe aplicar MCP sin preview previo en la misma conversacion o sin `previewOnly=false` aprobado por policy.
- `applyBudgetFromMcpTemplate` debe usarse cuando el usuario eligio una plantilla MCP especifica.

---

## 10. Fases de Implementacion

### Fase 1: Alineacion rapida

- Agregar tools MCP a bundles.
- Agregar keywords faltantes al planner.
- Extraer prompt builder modular.
- Tests de snapshots para prompts.

### Fase 2: Intent router

- Crear `intent-router.ts`.
- Usarlo en `agent/stream/route.ts`.
- Filtrar tools por intencion.
- Tests de clasificacion.

### Fase 3: Selector de fuente

- Crear `source-selector.ts`.
- Integrarlo en `previewBudgetGeneration`.
- Devolver `recommendedAction`.
- Tests con MCP fuerte, medio y sin match.

### Fase 4: Flujo presupuesto robusto

- Verificar/crear Presupuesto General antes de generar.
- Normalizar creacion de subpresupuestos.
- Evitar duplicados.
- Tests de generacion completa.

### Fase 5: UX y telemetria

- Mostrar fuente y confianza en UI.
- Mostrar boton de accion recomendado.
- Log de tool calls, retries y fallos por intencion.

---

## 11. Criterios de Aceptacion

- Khipu no pregunta por empresa si ya tiene workspace activo.
- Khipu no llama `searchProjects` sin `query`.
- Para generar presupuesto siempre hace preview antes de escribir.
- Una confirmacion simple como "si", "dale" u "ok" ejecuta la accion pendiente sin repreguntar.
- Si no hay Presupuesto General, el flujo lo crea o lo propone antes de generar partidas.
- MCP fuerte se recomienda automaticamente en preview.
- MCP medio exige confirmacion explicita.
- Catalogo solo se usa como fallback o complemento.
- Los summaries muestran fuente, conteos, advertencias y partidas omitidas.
- Todas las tools financieras siguen requiriendo aprobacion/policy.

---

## 12. Riesgos

| Riesgo | Mitigacion |
|---|---|
| El modelo elige tool incorrecta | Filtrar tools por intencion |
| Prompt demasiado largo | Prompt builder modular |
| Duplicacion de subpresupuestos | Validacion por nombre normalizado y parent |
| MCP de baja calidad | Score, preview y modo `review_required` |
| Confirmaciones ambiguas | Estado conversacional de accion pendiente |
| Dos rutas de agente divergentes | Compartir prompt/intent services |

---

## 13. Entregables

1. `intent-router.ts` con tests.
2. `prompt-builder.ts` con tests.
3. `source-selector.ts` con tests.
4. `workflows.ts` actualizado con MCP tools.
5. `planner.ts` actualizado con reglas de presupuesto/MCP.
6. `previewBudgetGeneration` con `recommendedAction`.
7. Tests de flujo conversacional en `app/api/ai/agent/stream/route.test.ts`.
8. Documentacion actualizada de criterios MCP/plantillas.
