# Smart Merge: re-aplicación de plantillas .mcp

## Problema

Cuando `generateBudget` ejecuta `applyBudgetFromMcpTemplate` sobre un proyecto que **ya tiene sub-presupuestos** de una ejecución anterior, pueden ocurrir dos problemas:

1. **Items duplicados**: si solo se agregan items nuevos sin limpiar los viejos, cada re-run duplica niveles y deja residuos.
2. **Items del usuario borrados**: si se borra todo y se re-crea desde cero, se pierden las partidas que el usuario agregó manualmente.

El **smart merge** resuelve ambos: limpia solo lo que vino del .mcp y preserva lo manual.

## Arquitectura

El flujo completo está en `lib/ai/budget-generation/mcp-budget-applicator.ts`. Se compone de tres funciones exportadas:

| Función | Rol |
|---------|-----|
| `cleanMcpSourcedContent` | Borra items MCP-sourced y niveles huérfanos |
| `createSubBudgetContent` | Crea/reutiliza niveles y crea items desde el blueprint |
| `applyMcpBudgetBlueprintToProject` | Orquesta todo: extrae blueprint, matchea catálogo, escala cantidades, aplica smart merge en transacción |

## Flujo paso a paso

### 1. `applyMcpBudgetBlueprintToProject` (orquestador)

```
Para cada sub-budget del blueprint:
  ├── ¿El sub-budget ya existe?
  │   ├── SÍ → cleanMcpSourcedContent()  ← borra lo MCP, preserva lo manual
  │   └── NO → crear sub-budget vacío
  └── createSubBudgetContent()  ← crea niveles + items frescos
```

### 2. `cleanMcpSourcedContent` (limpieza quirúrgica)

```
1. Buscar BudgetItemGenerationSource con:
   - sourceType = "MCP_TEMPLATE"
   - sourcePackageId = este paquete .mcp
   → obtiene los budgetItemId de TODOS los items que vinieron del .mcp

2. Borrar esos BudgetItems
   → cascade delete: Apu → ApuResource, BudgetItemGenerationSource, etc.

3. Detectar niveles huérfanos (sin items Y sin hijos):
   a. groupBy levelId: ¿cuántos items quedan en cada nivel afectado?
   b. findMany parentId: ¿qué niveles tienen hijos?
   c. Borrar solo los que: items=0 AND hijos=0

   ⚠️ Protección de cascada: si un nivel padre está vacío pero tiene
      un nivel hijo con items manuales, NO se borra. Esto evita que
      el cascade de Prisma (onDelete: Cascade en BudgetLevel.parent)
      destruya items del usuario.
```

### 3. `createSubBudgetContent` (creación inteligente)

```
1. Niveles (dedup por code):
   - Pre-cargar niveles existentes → Map<code, id>
   - Para cada nivel del blueprint:
     ├── ¿code ya existe? → reutilizar ID, continuar
     └── ¿code no existe? → crear nivel nuevo

2. Items:
   - Para cada item del blueprint:
     ├── ¿match catálogo? → usar datos del catálogo
     └── ¿sin match?     → usar datos originales del .mcp
   - Crear BudgetItem + BudgetItemGenerationSource (sourceType: "MCP_TEMPLATE")
   - Si tiene APU → crear Apu + ApuResource[]
```

## Tablas involucradas

| Tabla | Rol en smart merge |
|-------|-------------------|
| `BudgetItemGenerationSource` | **Clave del merge**: rastrea qué items vinieron del .mcp (`sourceType: "MCP_TEMPLATE"`, `sourcePackageId`) |
| `BudgetItem` | Se borran los MCP-sourced, se preservan los manuales (sin generation source) |
| `BudgetLevel` | Se borran solo los huérfanos (sin items ni hijos post-cleanup) |
| `Apu` / `ApuResource` | Cascade delete desde BudgetItem |

## Comportamiento por escenario

| Escenario | Items MCP previos | Items manuales | Niveles |
|-----------|-------------------|----------------|---------|
| **Primer run** | No hay → se crean todos | No hay | Se crean todos |
| **Re-run sin cambios manuales** | Se borran y re-crean | No hay | Se reutilizan por code |
| **Re-run con items manuales** | Se borran y re-crean | **Sobreviven** | Niveles con items manuales **sobreviven** |
| **Re-run con items manuales en sub-nivel** | Se borran | **Sobreviven** | Nivel padre no se borra (protección de cascada) |

## Ejemplo concreto

```
Proyecto "Santa Monica" — se ejecuta generateBudget por segunda vez:

ANTES del re-run:
  Sub-budget "Estructuras"
    ├── 01 Obras Preliminares (nivel MCP)
    │   ├── 01.01 Limpieza de terreno (MCP_TEMPLATE, pkg-1)
    │   └── 01.02 Trazo y replanteo (MCP_TEMPLATE, pkg-1)
    └── MANUAL-01 Refuerzo adicional (manual, sin generation source)

DURANTE cleanMcpSourcedContent:
  1. Encuentra BudgetItemGenerationSource para 01.01 y 01.02
  2. Borra BudgetItems 01.01 y 01.02
  3. Nivel "01" ahora tiene 1 item (MANUAL-01) → NO se borra

DURANTE createSubBudgetContent:
  1. Nivel "01" ya existe → reutiliza
  2. Crea 01.01 y 01.02 frescos con nuevos IDs

DESPUÉS del re-run:
  Sub-budget "Estructuras"
    ├── 01 Obras Preliminares (nivel reutilizado)
    │   ├── 01.01 Limpieza de terreno (MCP_TEMPLATE, pkg-1) ← NUEVO ID
    │   ├── 01.02 Trazo y replanteo (MCP_TEMPLATE, pkg-1)    ← NUEVO ID
    │   └── MANUAL-01 Refuerzo adicional (manual)              ← SOBREVIVE
```

## Tests

| Archivo | Qué cubre |
|---------|-----------|
| `mcp-budget-applicator.test.ts` | 3 tests de dedup de niveles + 1 test de integración del re-run completo |
| `mcp-catalog-matcher.integration.test.ts` | 97.4% exact match .mcp ↔ catálogo con datos reales |

### Test del re-run (`preserves manual items and replaces MCP items on re-apply`)

```
PASO 1: createSubBudgetContent → 1 nivel + 1 item MCP creados
PASO 2: budgetItem.create → 1 item manual sin generation source
PASO 3: cleanMcpSourcedContent → 1 item borrado (el MCP), manual NO en deletedIds
PASO 4: createSubBudgetContent → nivel reutilizado, 1 item nuevo con ID ≠ original
```

## Archivos clave

```
lib/ai/budget-generation/
├── mcp-budget-applicator.ts        ← Smart merge (cleanMcpSourcedContent + createSubBudgetContent)
├── mcp-budget-applicator.test.ts   ← Tests unitarios + integración del re-run
├── mcp-template-extractor.ts       ← Extrae blueprint del .mcp almacenado
├── mcp-catalog-matcher.ts          ← Matchea items del .mcp contra catálogo
├── mcp-quantity-scaler.ts          ← Escala cantidades según descripción de obra
└── mcp-catalog-matcher.integration.test.ts  ← Valida matching contra DB real

lib/ai/agent/tools/
├── mcp-budget.ts                   ← Agent tools: search, preview, apply
└── budgets.ts                      ← generateBudgetTool (orquesta niveles 1-3)
```
