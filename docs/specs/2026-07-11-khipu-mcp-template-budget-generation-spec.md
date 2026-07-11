# Spec: Khipu MCP Template Budget Generation

> **Fecha:** 2026-07-11
> **Estado:** Draft
> **Plan relacionado:** `docs/superpowers/plans/2026-07-11-khipu-mcp-template-budget-generation.md`

---

## 1. Objetivo

Implementar una capacidad para que Khipu genere presupuestos de obra usando paquetes `.mcp` como plantillas tecnicas. La primera etapa debe cubrir subpresupuestos, capitulos, partidas, APUs cuando existan, matching contra catalogo, cantidades estimadas y recalculo de totales.

La especificacion cubre:

- almacenamiento productivo de paquetes `.mcp`;
- busqueda y seleccion de plantillas;
- extraccion de blueprint desde `.mcp`;
- preview de generacion;
- aplicacion transaccional al proyecto;
- trazabilidad;
- integracion con herramientas de agente.

Quedan fuera del MVP:

- formula polinomica generada desde `.mcp`;
- gastos generales detallados;
- pie de presupuesto;
- cronograma basado en precedencias del `.mcp`;
- metrados avanzados.

---

## 2. Principios

1. El `.mcp` es una guia tecnica, no una copia ciega.
2. El catalogo de MC Presupuestos es la fuente preferente para partidas y recursos vigentes.
3. Toda escritura financiera debe ser transaccional y trazable.
4. Los calculos monetarios y cantidades sensibles deben usar servicios existentes o decimal-safe math.
5. La IA no debe sobrescribir presupuestos existentes sin aprobacion explicita.
6. Los resultados generados deben poder explicarse por fuente, score y supuestos.

---

## 3. Storage de Paquetes `.mcp`

### 3.1 Decision

Usar DB para metadata e indice. Para el MVP, guardar el contenido del `.mcp` en DB como base64 usando `mcpContent`. En una fase posterior, mover binarios a object storage y mantener en DB `storageProvider`, `storageKey`, `checksumSha256` y metadata.

### 3.2 Modelo Prisma MVP

El modelo existente `StoredProjectPackage` debe ser la fuente productiva. El servicio `lib/data/stored-project-packages.ts` debe dejar de depender de `.mcp-repo/index.json` para comportamiento funcional.

Campos minimos requeridos:

```prisma
model StoredProjectPackage {
  id              String   @id @default(cuid())
  companyId       String
  userId          String
  sourceProjectId String?
  projectName     String
  projectType     String   @default("")
  description     String   @default("")
  mcpContent      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Campos recomendados para migracion posterior:

```prisma
tags            String[] @default([])
formatVersion   String?
checksumSha256  String?
sizeBytes       Int?
storageProvider String  @default("database")
storageKey      String?
```

### 3.3 API interna de storage

Archivo:

```text
lib/data/stored-project-packages.ts
```

Contratos:

```ts
export type StoredProjectPackageRecord = {
  id: string;
  companyId: string;
  userId: string;
  sourceProjectId: string | null;
  projectName: string;
  projectType: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPackageSearchResult = StoredProjectPackageRecord & {
  score: number;
  matchedKeywords: string[];
};

export async function storeProjectPackage(input: {
  companyId: string;
  userId: string;
  sourceProjectId?: string | null;
  projectName: string;
  projectType?: string | null;
  description?: string;
  content: Buffer;
}): Promise<StoredProjectPackageRecord>;

export async function getStoredPackageContent(input: {
  packageId: string;
  userId: string;
}): Promise<Buffer>;

export async function searchStoredPackages(input: {
  userId: string;
  companyId: string;
  query: string;
  projectType?: string;
  limit?: number;
}): Promise<StoredPackageSearchResult[]>;
```

### 3.4 Permisos

`getStoredPackageContent` y `searchStoredPackages` deben validar que:

- el usuario pertenece a la empresa del paquete;
- el paquete pertenece a la misma empresa, o es un template global/seed cuando exista esa categoria;
- el usuario tiene al menos rol `VIEWER` para leer y `EDITOR` para aplicar.

---

## 4. Intent de Generacion

Khipu debe convertir la solicitud del usuario en un intent normalizado.

```ts
export type BudgetGenerationIntent = {
  projectId?: string;
  companyId: string;
  description: string;
  projectType: BudgetGenerationProjectType;
  areaM2: number | null;
  floors: number | null;
  location: string | null;
  currency: "PEN" | "USD";
  templateSource: "auto" | "mcp" | "project" | "catalog";
  previewOnly: boolean;
};

export type BudgetGenerationProjectType =
  | "vivienda"
  | "edificio"
  | "colegio"
  | "hospital"
  | "carretera"
  | "industrial"
  | "otro";
```

La extraccion puede vivir inicialmente dentro de `generateBudgetTool`, pero debe moverse a un helper testable:

```text
lib/ai/budget-generation/generation-intent.ts
```

---

## 5. Seleccion de Plantilla

Archivo:

```text
lib/ai/budget-generation/mcp-template-search.ts
```

Contrato:

```ts
export type McpTemplateCandidate = {
  packageId: string;
  projectName: string;
  projectType: string | null;
  description: string;
  score: number;
  matchedKeywords: string[];
  reasons: string[];
};

export async function searchMcpTemplateCandidates(input: {
  userId: string;
  companyId: string;
  description: string;
  projectType?: string;
  areaM2?: number | null;
  floors?: number | null;
  limit?: number;
}): Promise<McpTemplateCandidate[]>;
```

Scoring:

| Factor | Peso |
|---|---:|
| Tipo de obra compatible | 0.35 |
| Similitud textual | 0.25 |
| Keywords tecnicas | 0.15 |
| Area/pisos compatibles | 0.10 |
| Ubicacion | 0.05 |
| Calidad/completitud del paquete | 0.10 |

Umbrales:

```ts
const MCP_TEMPLATE_STRONG_MATCH = 0.70;
const MCP_TEMPLATE_REVIEW_MATCH = 0.45;
```

Reglas:

- `>= 0.70`: candidato aplicable automaticamente con preview.
- `0.45 - 0.69`: candidato sugerido, requiere confirmacion.
- `< 0.45`: no se usa salvo seleccion explicita.

---

## 6. Blueprint

El blueprint es la estructura intermedia y estable que separa lectura `.mcp` de persistencia.

Archivo:

```text
lib/ai/budget-generation/mcp-blueprint.ts
```

Tipos:

```ts
export type McpBudgetBlueprint = {
  sourcePackageId: string;
  sourceProjectName: string;
  sourceFormatVersion: string;
  projectType: string | null;
  confidence: number;
  assumptions: string[];
  warnings: string[];
  subBudgets: McpSubBudgetBlueprint[];
};

export type McpSubBudgetBlueprint = {
  sourceBudgetId: string;
  name: string;
  normalizedName: string;
  currency: "PEN" | "USD";
  igvRate: string;
  generalExpensesRate: string;
  utilityRate: string;
  levels: McpBudgetLevelBlueprint[];
  items: McpBudgetItemBlueprint[];
};

export type McpBudgetLevelBlueprint = {
  sourceLevelId: string;
  parentSourceLevelId: string | null;
  type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
  code: string;
  name: string;
  sortOrder: number;
};

export type McpBudgetItemBlueprint = {
  sourceItemId: string;
  sourceCode: string;
  description: string;
  normalizedDescription: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  sortOrder: number;
  levelSourceId: string | null;
  apu: McpApuBlueprint | null;
};

export type McpApuBlueprint = {
  name: string;
  unit: string;
  performance: string;
  totalUnitCost: string;
  resources: McpApuResourceBlueprint[];
};

export type McpApuResourceBlueprint = {
  resourceType: string;
  crew: string | null;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  resourceDescription: string | null;
};
```

Decimal values must remain strings in the blueprint to preserve precision.

---

## 7. Extractor `.mcp -> Blueprint`

Archivo:

```text
lib/ai/budget-generation/mcp-template-extractor.ts
```

Contratos:

```ts
export async function extractBudgetBlueprintFromStoredPackage(input: {
  packageId: string;
  userId: string;
}): Promise<McpBudgetBlueprint>;

export function extractBudgetBlueprintFromMcpModules(input: {
  packageId: string;
  manifest: McpManifest;
  readModule: (path: string) => unknown;
}): McpBudgetBlueprint;
```

Modulos requeridos:

- `manifest.json`
- `project.json`
- `budgets/budget-tree.json`
- `budgets/budget-items.json`

Modulos opcionales MVP:

- `budgets/apus.json`

Validaciones:

- manifest valido;
- checksums validos;
- existe presupuesto general;
- existe al menos un subpresupuesto;
- cada item pertenece a un subpresupuesto existente;
- unidades no vacias;
- cantidades, precios y parciales parseables como Decimal.

Errores deben ser claros y accionables.

---

## 8. Matching Blueprint-Catalogo

Archivo:

```text
lib/ai/budget-generation/mcp-catalog-matcher.ts
```

Tipos:

```ts
export type CatalogMatchStatus =
  | "matched"
  | "review_required"
  | "unmatched";

export type McpCatalogItemMatch = {
  sourceItemId: string;
  status: CatalogMatchStatus;
  catalogPartidaId: string | null;
  matchScore: number;
  reason: string;
  selectedDescription: string;
  selectedUnit: string;
  selectedUnitPrice: string;
};

export async function matchBlueprintItemsToCatalog(input: {
  companyId: string;
  blueprint: McpBudgetBlueprint;
}): Promise<McpCatalogItemMatch[]>;
```

Thresholds:

```ts
const MATCH_EXACT = 0.95;
const MATCH_STRONG = 0.80;
const MATCH_REVIEW = 0.60;
```

Reglas:

- `>= 0.80`: `matched`;
- `0.60 - 0.79`: `review_required`;
- `< 0.60`: `unmatched`.

El matching debe considerar:

- codigo, cuando exista;
- descripcion normalizada;
- unidad;
- categoria/capitulo si esta disponible;
- `searchSimilarPartidas`.

---

## 9. Cantidades y Escalamiento

Archivo:

```text
lib/ai/budget-generation/mcp-quantity-scaler.ts
```

Contrato:

```ts
export type QuantityScaleResult = {
  sourceItemId: string;
  quantity: string;
  confidence: "exact" | "scaled" | "inferred" | "template" | "default";
  reason: string;
};

export function scaleBlueprintQuantities(input: {
  blueprint: McpBudgetBlueprint;
  description: string;
  targetAreaM2?: number | null;
  targetFloors?: number | null;
}): QuantityScaleResult[];
```

Reglas:

1. Si el usuario proporciona cantidad especifica para una partida, usarla.
2. Si existe area fuente y area destino, escalar por ratio.
3. Si existe numero de pisos y unidad compatible, ajustar por pisos.
4. Usar `estimateQuantity`.
5. Mantener cantidad del template si no hay mejor dato.

Todas las salidas numericas deben ser strings decimal-safe.

---

## 10. Preview

Archivo:

```text
lib/ai/budget-generation/mcp-budget-preview.ts
```

Tipos:

```ts
export type McpBudgetGenerationPreview = {
  packageId: string;
  sourceProjectName: string;
  targetProjectId: string;
  templateScore: number;
  subBudgets: McpBudgetGenerationPreviewSubBudget[];
  totals: {
    estimatedDirectCost: string;
    matchedItems: number;
    reviewRequiredItems: number;
    unmatchedItems: number;
  };
  warnings: string[];
  assumptions: string[];
};

export type McpBudgetGenerationPreviewSubBudget = {
  name: string;
  itemCount: number;
  matchedCatalogItems: number;
  reviewRequiredItems: number;
  unmatchedItems: number;
  estimatedDirectCost: string;
};

export async function previewBudgetFromMcpTemplate(input: {
  userId: string;
  companyId: string;
  projectId: string;
  packageId: string;
  description: string;
}): Promise<McpBudgetGenerationPreview>;
```

Preview must not write to DB.

---

## 11. Applicator

Archivo:

```text
lib/ai/budget-generation/mcp-budget-applicator.ts
```

Tipos:

```ts
export type McpBudgetApplyMode = "auto" | "review_required";

export type McpBudgetGenerationResult = {
  projectId: string;
  generalBudgetId: string;
  packageId: string;
  sourceProjectName: string;
  subBudgets: Array<{
    budgetId: string;
    name: string;
    levelsCreated: number;
    itemsCreated: number;
    apusCreated: number;
    directCost: string;
  }>;
  skippedItems: Array<{
    sourceItemId: string;
    description: string;
    reason: string;
  }>;
  warnings: string[];
};

export async function applyMcpBudgetBlueprintToProject(input: {
  userId: string;
  companyId: string;
  projectId: string;
  packageId: string;
  description: string;
  mode: McpBudgetApplyMode;
}): Promise<McpBudgetGenerationResult>;
```

### 11.1 Escritura transaccional

La transaccion debe:

1. Validar acceso al proyecto.
2. Obtener o crear presupuesto general.
3. Crear subpresupuestos faltantes por `normalizedName`.
4. Crear niveles respetando jerarquia.
5. Crear partidas.
6. Crear APUs cuando existan y sean seguros.
7. Crear/reutilizar recursos cuando exista informacion suficiente.
8. Registrar trazabilidad.
9. Recalcular totales por subpresupuesto.
10. Recalcular presupuesto general.

### 11.2 Modo `auto`

Aplica items `matched`. Puede aplicar `review_required` solo si el usuario confirmo explicitamente en el flujo de agente.

### 11.3 Modo `review_required`

Aplica solo `matched`; los demas se devuelven como `skippedItems`.

---

## 12. Trazabilidad

Modelo recomendado:

```prisma
model BudgetItemGenerationSource {
  id               String   @id @default(cuid())
  budgetItemId     String
  sourceType       String
  sourcePackageId  String?
  sourceProjectId  String?
  sourceItemId     String?
  catalogPartidaId String?
  matchScore       Decimal? @db.Decimal(5, 4)
  assumptions      Json?
  createdAt        DateTime @default(now())
}
```

Valores `sourceType`:

- `catalog`
- `mcp_template`
- `similar_project`
- `ai_generated`

Si no se agrega la tabla en MVP, el applicator debe devolver suficiente trazabilidad en su resultado para agregarla despues sin cambiar contratos publicos.

---

## 13. Herramientas Agenticas

### 13.1 `searchMcpTemplates`

Riesgo: `read`.

```ts
const searchMcpTemplatesInput = z.object({
  query: z.string().min(1),
  projectType: z.string().optional(),
  companyId: z.string().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});
```

### 13.2 `previewBudgetFromMcpTemplate`

Riesgo: `read`.

```ts
const previewBudgetFromMcpTemplateInput = z.object({
  projectId: z.string().min(1),
  packageId: z.string().min(1),
  description: z.string().min(10),
});
```

### 13.3 `applyBudgetFromMcpTemplate`

Riesgo: `financial`.

```ts
const applyBudgetFromMcpTemplateInput = z.object({
  projectId: z.string().min(1),
  packageId: z.string().min(1),
  description: z.string().min(10),
  mode: z.enum(["auto", "review_required"]).default("review_required"),
});
```

### 13.4 `generateBudget`

Actualizar input:

```ts
templateSource: z.enum(["auto", "mcp", "project", "catalog"]).default("auto"),
previewOnly: z.boolean().default(false),
```

Orquestacion:

```text
generateBudget
  -> parse intent
  -> if templateSource != catalog: searchMcpTemplateCandidates
  -> if strong match and previewOnly: return preview
  -> if strong match and approved: applyBudgetFromMcpTemplate
  -> else existing project/template/catalog fallback
```

---

## 14. Validaciones y Seguridad

Obligatorias:

- validar membership de empresa;
- validar acceso al proyecto;
- validar checksums del `.mcp`;
- rechazar paquetes mayores al limite configurado;
- no leer secretos ni credenciales desde el paquete;
- no sobrescribir presupuesto con items existentes sin confirmacion;
- deduplicar subpresupuestos por nombre normalizado;
- deduplicar partidas por descripcion/unidad/capitulo cuando aplique;
- registrar warnings si hay unidades incompatibles;
- conservar coeficientes polinomicos fuera del MVP.

---

## 15. Criterios de Aceptacion MVP

1. Exportar un proyecto `.mcp` guarda un `StoredProjectPackage` en DB.
2. Khipu puede buscar paquetes `.mcp` por descripcion y tipo de obra.
3. El extractor genera un blueprint con subpresupuestos, niveles y partidas.
4. El preview muestra subpresupuestos, conteo de partidas y advertencias.
5. La aplicacion crea subpresupuestos faltantes sin duplicar los existentes.
6. Las partidas `matched` se crean usando catalogo cuando hay match fuerte.
7. Las partidas sin match fuerte se omiten o quedan marcadas para revision.
8. Los totales se recalculan por subpresupuesto y presupuesto general.
9. El flujo conserva trazabilidad de origen y scores.
10. Si no hay `.mcp` compatible, `generateBudget` cae al flujo actual.

---

## 16. Tests

Archivos sugeridos:

```text
lib/data/stored-project-packages.test.ts
lib/ai/budget-generation/mcp-template-search.test.ts
lib/ai/budget-generation/mcp-template-extractor.test.ts
lib/ai/budget-generation/mcp-catalog-matcher.test.ts
lib/ai/budget-generation/mcp-quantity-scaler.test.ts
lib/ai/budget-generation/mcp-budget-preview.test.ts
lib/ai/budget-generation/mcp-budget-applicator.test.ts
lib/ai/agent/tools/mcp-budget-generation.test.ts
```

Casos:

- encuentra paquete `vivienda` para "casa de 2 pisos";
- rechaza paquete de otra empresa;
- extrae subpresupuestos del `.mcp`;
- preserva cantidades y montos como strings;
- matchea partidas por descripcion/unidad;
- marca score bajo como `review_required`;
- aplica solo partidas `matched` en modo `review_required`;
- no duplica subpresupuestos;
- recalcula totales;
- fallback a catalogo si no hay paquete compatible.

