# Plan: Generación de Presupuestos V2 — Arquitectura Multinivel

> **Fecha:** 2026-07-10
> **Contexto:** Reemplazo del `generateBudgetTool` actual (token-simple) por un sistema que busca proyectos similares, aplica plantillas de sub-presupuestos y usa el catálogo como respaldo.

---

## 1. Estado Actual (V1 — Lo que tenemos hoy)

### `generateBudgetTool.execute` en `lib/ai/agent/tools/budgets.ts`
```
1. Descripción del usuario → tokenizar → buscar en catálogo
2. Asignar por keywords a sub-presupuestos
3. Crear items con quantity=1
```

**Problemas:**
- ❌ Solo tokeniza la descripción textual — no considera otros proyectos similares
- ❌ No usa el sistema de plantillas (`BudgetTemplate`) que ya existe
- ❌ No aprovecha proyectos completos exportados como `.mcp`
- ❌ Asignación por keywords es frágil
- ❌ Quantity siempre = 1 (no estima desde la descripción)

### Infraestructura existente que SÍ tenemos:

| Componente | Ubicación | Estado |
|---|---|---|
| `searchCatalogPartidas()` | `lib/ai/catalog-search.ts` | ✅ Token + similitud semántica |
| `searchSimilarPartidas()` | `lib/partida-generation/similarity.ts` | ✅ Scoring avanzado con variables técnicas |
| `BudgetTemplate` + snapshot | `lib/templates/budget-template-snapshot.ts` | ✅ Captura y aplicación de plantillas |
| `applyUserBudgetTemplateToProject()` | `lib/data/budget-templates.ts` | ✅ Aplica plantilla completa con APUs, niveles, recursos |
| `buildProjectPackageSnapshot()` | `lib/mcp/export-snapshot.ts` | ✅ Exporta proyecto completo a .mcp |
| `importProjectPackageToMyc()` | `lib/mcp/import-persistence.ts` | ✅ Importa proyecto completo desde .mcp |
| `searchProjectsTool` | `lib/ai/agent/tools/projects.ts` | ✅ Nuevo — busca proyectos por nombre |
| `getProjectsByUser()` | `lib/data/projects.ts` | ✅ Obtiene proyectos del usuario con presupuestos |

---

## 2. Arquitectura Propuesta (V2) — Tres Niveles de Matching

```
                    ┌─────────────────────────────────────┐
                    │     Descripción del usuario          │
                    │  "casa 2 pisos, 120m2, concreto"     │
                    └──────────────┬──────────────────────┘
                                   │
                   ┌───────────────▼───────────────┐
                   │    NIVEL 1: PROYECTOS         │
                   │   Buscar proyectos similares   │
                   │  en BD + repositorio .mcp     │
                   └───────────────┬───────────────┘
                                   │
                  Encontrado? ────►│◄──── No ──────────────────┐
                   │ Sí            │                           │
                   ▼               │                           │
         ┌──────────────────┐      │                           │
         │ NIVEL 2:         │      │                           │
         │ PLANTILLAS       │      │                           │
         │ Aplicar plantilla│      │                           │
         │ de sub-presup.   │      │                           │
         │ más similar      │      │                           │
         └────────┬─────────┘      │                           │
                  │                │                           │
                  ▼                ▼                           ▼
         ┌──────────────────────────────────────────────────────┐
         │           NIVEL 3: CATÁLOGO (fallback)               │
         │   Buscar partidas individuales por similitud         │
         │   (lo que hace V1 actual, mejorado)                  │
         └──────────────────────────────────────────────────────┘
```

### Nivel 1: Búsqueda de Proyectos Similares

**Objetivo:** Encontrar proyectos existentes (en la BD del usuario + repositorio .mcp) que sean similares a la obra descrita.

**Fuentes de datos:**
- **BD interna**: Proyectos del usuario en su workspace (vía `getProjectsByUser` o `getProjectsListByUser`)
- **Repositorio .mcp**: Proyectos exportados como paquetes `.mcp` guardados en un bucket S3 / sistema de archivos / tabla `StoredProjectPackage`

**Algoritmo de similitud:**

```
Para cada proyecto candidato:
  1. Extraer keywords: nombre, tipo, ubicación, descripción
  2. Calcular score contra la descripción del usuario usando:
     - Coincidencia de tipo de obra (vivienda, hospital, carretera, etc.)
     - Coincidencia de área/metros cuadrados
     - Coincidencia estructural (concreto armado, acero, etc.)
     - Jaccard similarity de tokens
  3. Top 3 proyectos más similares
```

**Componentes nuevos:**

| Componente | Descripción |
|---|---|
| `ProjectSimilarityService` | Servicio que calcula similitud entre descripciones y proyectos |
| `projectSimilarityIndex` | Índice en memoria de proyectos con sus embeddings/keywords |
| `StoredProjectPackage` | Modelo/tabla para guardar proyectos .mcp importables como referencia |

```ts
// lib/ai/budget-generation/project-similarity.ts
type ProjectCandidate = {
  projectId: string;
  projectName: string;
  projectType: string | null;
  location: string | null;
  source: "internal" | "mcp_repo";
  score: number;
  budgetCount: number;
  totalAmount: number;
  templateIds: string[]; // IDs de plantillas creadas desde este proyecto
};
```

### Nivel 2: Aplicación de Plantillas de Sub-presupuestos

**Objetivo:** En lugar de crear partida por partida, aplicar plantillas enteras de sub-presupuestos.

**Flujo:**
```
Para cada proyecto similar del Nivel 1:
  1. Buscar plantillas guardadas asociadas a ese proyecto
     (vía listUserBudgetTemplates o buscar por sourceProjectId)
  2. Para cada sub-presupuesto del proyecto similar:
     - Si existe plantilla guardada del sub-presupuesto
       → applyUserBudgetTemplateToProject(templateId, projectId)
     - Si no existe plantilla, crearla on-the-fly:
       1. Cargar el proyecto (vía getProjectById)
       2. buildBudgetTemplateSnapshot(budget) para cada sub-budget
       3. applyUserBudgetTemplateToProject
```

**Ya existe y se reutiliza:**
- ✅ `buildBudgetTemplateSnapshot()` — captura estado completo de un presupuesto como plantilla
- ✅ `applyUserBudgetTemplateToProject()` — aplica plantilla a proyecto destino (crea niveles, items, APUs, recursos)
- ✅ `listUserBudgetTemplates()` — lista plantillas guardadas del usuario
- ✅ `createUserBudgetTemplateFromBudget()` — crea plantilla desde un presupuesto existente

**Mejora necesaria:** `applyUserBudgetTemplateToProject` actualmente solo soporta modo "crear presupuesto independiente". Necesita un modo "fusionar en presupuesto existente" que:
1. Agregue niveles/items al Presupuesto General existente en vez de crear uno nuevo
2. Asigne los items al sub-budget correspondiente (Estructuras, Arquitectura, etc.)

### Nivel 3: Catálogo (Fallback)

**Objetivo:** Cuando no hay proyectos similares ni plantillas, caer en la búsqueda por catálogo.

**Mejoras sobre V1 actual:**
- Usar `searchSimilarPartidas()` (`lib/partida-generation/similarity.ts`) que tiene mejor scoring con variables técnicas (elemento, material, resistencia)
- Inferir cantidades desde la descripción (ej: "120m2" → cantidad sugerida)
- Agrupar partidas por capítulos usando los niveles del catálogo

---

## 3. Componentes Nuevos a Implementar

### 3.1 `lib/ai/budget-generation/project-similarity.ts`
Servicio de similitud de proyectos.

```ts
export type ProjectSimilarityInput = {
  description: string;
  projectType?: string;
  location?: string;
  estimatedArea?: number;
  userId: string;
};

export type ProjectMatch = {
  projectId: string;
  projectName: string;
  score: number;
  matchedKeywords: string[];
  budgetTemplates: TemplateLibraryItem[];
};

export function searchSimilarProjects(
  input: ProjectSimilarityInput,
): Promise<ProjectMatch[]>;
```

### 3.2 `lib/ai/budget-generation/template-applicator.ts`
Aplica plantillas de sub-presupuestos fusionándolas en un presupuesto existente.

```ts
export type ApplyTemplateToExistingBudgetInput = {
  templateId: string;
  projectId: string;
  targetSubBudgetId: string; // ej: "Estructuras" dentro del proyecto destino
  userId: string;
};

export function applyTemplateToSubBudget(
  input: ApplyTemplateToExistingBudgetInput,
): Promise<AppliedUserBudgetTemplate>;
```

### 3.3 `lib/ai/budget-generation/quantity-estimator.ts`
Infiera cantidades desde la descripción del usuario.

```ts
export function estimateQuantity(
  description: string,
  partidaUnit: string,
): number | null;
// Ej: "120m2 de losa" + unit="m2" → 120
// Ej: "casa de 2 pisos" + unit="m2" → estimar 120m2 de losa
```

### 3.4 `lib/data/stored-project-packages.ts`
Gestión de repositorio de proyectos .mcp.

```ts
export type StoredProjectPackage = {
  id: string;
  projectName: string;
  projectType: string;
  description: string;
  filePath: string; // ruta al .mcp en disco/S3
  createdAt: Date;
  importedFrom: string; // userId que lo importó
};

export function storeProjectPackageFromExport(
  projectId: string,
  userId: string,
): Promise<StoredProjectPackage>;

export function searchStoredPackages(
  query: string,
  limit?: number,
): Promise<StoredProjectPackage[]>;
```

### 3.5 Actualización de `generateBudgetTool.execute`
El tool del agente se actualiza para orquestar los 3 niveles:

```ts
execute: async (input, context) => {
  // 1. Buscar proyectos similares (Nivel 1)
  // 2. Si hay match fuerte → aplicar plantillas (Nivel 2)
  // 3. Si no hay suficientes partidas → buscar en catálogo (Nivel 3)
  // 4. Combinar resultados, actualizar totales
}
```

### 3.6 `searchBudgetsTool` — Dejar de ser stub
Actualmente retorna `budgets: []`. Implementar búsqueda real por nombre de presupuesto/ proyecto.

---

## 4. Data Flow Completo

```
Usuario: "Genera presupuesto para casa de 2 pisos, 120m2"
                    │
                    ▼
      ┌─────────────────────────────┐
      │  searchProjects("Santa      │
      │  Monica") → projectId       │
      └─────────────┬───────────────┘
                    │
                    ▼
      ┌─────────────────────────────────────────────┐
      │  generateBudget({ projectId, description })  │
      └─────────────┬───────────────────────────────┘
                    │
                    ▼
      ┌─────────────────────────────────────────────┐
      │  Nivel 1: searchSimilarProjects(desc)        │
      │  → Buscar en BD proyectos del usuario        │
      │  → Buscar en repositorio .mcp                │
      │  → Top 3 matches con score                   │
      └─────────────┬───────────────────────────────┘
                    │
              ┌─────┴─────┐
              │            │
          Score > 0.5    Score < 0.5
              │            │
              ▼            ▼
      ┌──────────────┐   ┌──────────────────┐
      │ Nivel 2:      │   │ Nivel 3: Catálogo│
      │ applyTemplate │   │ searchPartidas   │
      │ toSubBudget   │   │ + estimateQtty   │
      └──────┬───────┘   └────────┬─────────┘
             │                    │
             └──────┬─────────────┘
                    ▼
      ┌─────────────────────────────────────────────┐
      │  Merge + Recalcular totales                 │
      │  → prisma.$transaction                      │
      │  → Actualizar sub-budgets + general         │
      └─────────────────────────────────────────────┘
```

---

## 5. Plan de Implementación (Fases)

### Fase 1 — Búsqueda de proyectos similares (Nivel 1)
- [ ] Crear `lib/ai/budget-generation/project-similarity.ts`
- [ ] Indexar proyectos del usuario con keywords
- [ ] Buscar por tipo de obra, estructura, área
- [ ] Integrar con `generateBudgetTool`

### Fase 2 — Aplicación de plantillas (Nivel 2)
- [ ] Extender `applyUserBudgetTemplateToProject` para modo "fusionar"
- [ ] Crear `lib/ai/budget-generation/template-applicator.ts`
- [ ] Auto-generar plantilla desde proyecto similar si no existe
- [ ] Asignar items al sub-budget correcto

### Fase 3 — Repositorio .mcp
- [ ] Crear `lib/data/stored-project-packages.ts`
- [ ] Al exportar un proyecto como .mcp, guardar copia en repositorio
- [ ] Buscar en repositorio al hacer `searchSimilarProjects`

### Fase 4 — Mejora de catálogo (Nivel 3 mejorado)
- [ ] Usar `searchSimilarPartidas` en vez de `searchCatalogPartidas`
- [ ] Implementar `quantity-estimator.ts`
- [ ] Agrupar por capítulos usando niveles del catálogo

### Fase 5 — Arreglar stubs existentes
- [ ] Implementar `searchBudgetsTool` real (ya no devuelve arrays vacíos)
- [ ] Implementar `cloneBudgetTool` real

---

## 6. Resumen de lo que YA existe y se reutiliza

| Pieza | Dónde está | Para qué sirve en V2 |
|---|---|---|
| `searchCatalogPartidas()` | `lib/ai/catalog-search.ts` | Nivel 3 (fallback) |
| `searchSimilarPartidas()` | `lib/partida-generation/similarity.ts` | Nivel 3 mejorado |
| `buildBudgetTemplateSnapshot()` | `lib/templates/budget-template-snapshot.ts` | Crear plantilla desde proyecto similar |
| `applyUserBudgetTemplateToProject()` | `lib/data/budget-templates.ts` | Aplicar plantilla al proyecto destino |
| `listUserBudgetTemplates()` | `lib/data/budget-templates.ts` | Buscar plantillas existentes |
| `buildProjectPackageSnapshot()` | `lib/mcp/export-snapshot.ts` | Exportar a .mcp para repositorio |
| `importProjectPackageToMyc()` | `lib/mcp/import-persistence.ts` | Importar desde .mcp |
| `searchProjectsTool` | `lib/ai/agent/tools/projects.ts` | Buscar proyecto por nombre |
| `getProjectsByUser()` | `lib/data/projects.ts` | Obtener proyectos del usuario |
| `createBudgetGeneralTool` | `lib/ai/agent/tools/budgets.ts` | Crear estructura de presupuesto |
| `createSubBudgetTool` | `lib/ai/agent/tools/budgets.ts` | Crear sub-presupuestos |

---

## 7. Métricas de Éxito

- ✅ Reducción de partidas con quantity=1 (ideal: < 20% del total)
- ✅ Cobertura de partidas desde proyectos similares > 60%
- ✅ Tiempo de generación < 15 segundos
- ✅ El usuario puede identificar de qué proyecto/plantilla vino cada partida
