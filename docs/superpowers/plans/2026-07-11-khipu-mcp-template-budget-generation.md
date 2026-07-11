# Plan: Khipu MCP Template Budget Generation

> **Fecha:** 2026-07-11
> **Objetivo:** Definir el flujo y las especificaciones para que Khipu use paquetes `.mcp` como base tecnica y plantilla de generacion de proyectos/presupuestos, con foco inicial en subpresupuestos y partidas.
> **Spec:** `docs/specs/2026-07-11-khipu-mcp-template-budget-generation-spec.md`

---

## 1. Vision

Khipu debe poder recibir una solicitud como:

```text
Genera un presupuesto para una vivienda de 2 pisos y 120 m2.
```

Y responder con un presupuesto estructurado usando una plantilla `.mcp` de vivienda como memoria tecnica. El `.mcp` no debe copiarse ciegamente: debe servir como guia para identificar subpresupuestos, capitulos, partidas, APUs y patrones de metrados, mientras el catalogo de MC Presupuestos actua como fuente preferente para partidas y recursos vigentes.

El flujo recomendado es:

```text
Prompt del usuario
  -> interpretacion tecnica
  -> busqueda de plantilla .mcp
  -> extraccion de blueprint
  -> matching contra catalogo
  -> generacion de subpresupuestos y partidas
  -> recalculo y trazabilidad
  -> fases posteriores: pie, GG, formula, cronograma
```

---

## 2. Estado Actual Verificado

### Capacidades existentes

| Area | Estado | Ubicacion |
|---|---:|---|
| Crear presupuesto general y subpresupuestos | Existe | `lib/ai/agent/tools/budgets.ts` |
| Generar presupuesto preliminar | Existe parcialmente | `generateBudgetTool` |
| Buscar proyectos similares | Existe | `lib/ai/budget-generation/project-similarity.ts` |
| Aplicar plantilla a subpresupuesto | Existe | `lib/ai/budget-generation/template-applicator.ts` |
| Estimar cantidades desde descripcion | Existe | `lib/ai/budget-generation/quantity-estimator.ts` |
| Exportar proyecto completo `.mcp` | Existe | `lib/mcp/export-snapshot.ts` |
| Importar proyecto completo `.mcp` | Existe | `lib/mcp/import-persistence.ts` |
| Generar cronograma inteligente | Existe | `createScheduleTool` en `lib/ai/agent/tools/index.ts` |
| Modelo Prisma para paquetes `.mcp` | Existe | `StoredProjectPackage` en `prisma/schema.prisma` |
| Repositorio local `.mcp` | Existe parcialmente | `lib/data/stored-project-packages.ts` |

### Brechas actuales

1. El repositorio `.mcp` activo usa filesystem local (`.mcp-repo`) e indice JSON, aunque ya existe modelo Prisma.
2. `searchSimilarProjects` puede incluir paquetes `.mcp` como candidatos, pero no usa todavia el contenido del `.mcp` para generar estructura.
3. Falta un extractor formal `.mcp -> BudgetBlueprint`.
4. Falta matching trazable entre partidas del `.mcp` y partidas del catalogo.
5. Falta un modo preview/aprobacion para generacion masiva desde plantilla.
6. Falta una decision productiva de storage: DB, webapp o object storage.

---

## 3. Decision de Arquitectura: Ubicacion de los `.mcp`

### Recomendacion

Usar almacenamiento hibrido:

1. **DB para metadata e indice.**
2. **Object storage para el archivo `.mcp` binario.**
3. **Filesystem local solo para desarrollo, fixtures y seeds.**

### Por que no guardarlos en el webapp

Guardar `.mcp` dentro del webapp o filesystem de runtime es fragil porque:

- no sobrevive necesariamente a redeploys;
- no escala bien con multiples instancias;
- complica backups y auditoria;
- no es confiable en entornos serverless;
- mezcla codigo de aplicacion con datos de usuario/empresa.

### Si hay que elegir solo entre webapp y DB

Elegir DB. Es mas simple de respaldar, consultar, auditar y asociar a empresa/usuario. Para paquetes pequenos puede bastar con `mcpContent`, pero para produccion conviene mover el binario a object storage y dejar en DB solo metadata, checksums y `storageKey`.

### Modelo recomendado

```prisma
model StoredProjectPackage {
  id              String   @id @default(cuid())
  companyId       String
  userId          String
  sourceProjectId String?
  projectName     String
  projectType     String   @default("")
  description     String   @default("")
  tags            String[] @default([])
  formatVersion   String
  checksumSha256  String
  sizeBytes       Int
  storageProvider String   @default("database") // database, s3, r2, local
  storageKey      String?
  mcpContent      String?  // base64 solo para modo database
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Nota: el schema actual ya tiene `mcpContent` obligatorio. La primera fase puede usarlo como base64 para cerrar funcionalidad rapido. La migracion a `storageKey` puede venir despues.

---

## 4. Concepto Central: BudgetBlueprint

El `.mcp` debe convertirse a un blueprint intermedio antes de escribir en la base.

```ts
export type McpBudgetBlueprint = {
  sourcePackageId: string;
  sourceProjectName: string;
  projectType: string | null;
  confidence: number;
  assumptions: string[];
  subBudgets: McpSubBudgetBlueprint[];
};

export type McpSubBudgetBlueprint = {
  sourceBudgetId: string;
  name: string;
  normalizedName: string;
  levels: McpBudgetLevelBlueprint[];
  items: McpBudgetItemBlueprint[];
};

export type McpBudgetItemBlueprint = {
  sourceItemId: string;
  sourceCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  levelSourceId: string | null;
  apu: McpApuBlueprint | null;
  origin: "mcp_template";
};
```

El blueprint permite:

- mostrar preview al usuario;
- hacer matching antes de persistir;
- recalcular cantidades;
- guardar trazabilidad;
- reutilizar el mismo flujo para `.mcp`, proyectos internos o plantillas.

---

## 5. Flow Funcional

### 5.1 Entrada del usuario

Khipu debe extraer:

- tipo de obra: vivienda, edificio, colegio, hospital, carretera, industrial;
- area aproximada;
- numero de pisos;
- ubicacion;
- moneda;
- nivel de detalle deseado;
- si debe crear proyecto nuevo o usar proyecto existente.

Ejemplo:

```ts
type BudgetGenerationIntent = {
  projectId?: string;
  companyId: string;
  description: string;
  projectType: "vivienda" | "edificio" | "colegio" | "hospital" | "carretera" | "industrial" | "otro";
  areaM2?: number;
  floors?: number;
  location?: string;
  currency: "PEN" | "USD";
};
```

### 5.2 Seleccion de plantilla

Orden de preferencia:

1. Paquetes `.mcp` de la empresa con `projectType` compatible.
2. Paquetes `.mcp` globales/seed aprobados por MC.
3. Proyectos internos similares del usuario.
4. `BudgetTemplate` guardadas.
5. Catalogo de partidas como fallback.

Scoring recomendado:

| Factor | Peso |
|---|---:|
| Tipo de obra | 35% |
| Similitud textual | 25% |
| Subpresupuestos compatibles | 15% |
| Area/pisos compatibles | 10% |
| Ubicacion/zona | 5% |
| Calidad de paquete | 10% |

### 5.3 Extraccion `.mcp`

El extractor debe leer:

- `manifest.json`
- `project.json`
- `budgets/budget-tree.json`
- `budgets/budget-items.json`
- `budgets/apus.json`

Opcionales para fases posteriores:

- `budgets/general-expenses.json`
- `budgets/footer.json`
- `polynomial-formula/formula.json`
- `schedule/work-schedule.json`
- `takeoffs/sheets.json`

### 5.4 Matching contra catalogo

Por cada partida del blueprint:

1. Intentar match exacto por codigo si existe.
2. Intentar match por descripcion normalizada + unidad.
3. Usar `searchSimilarPartidas` si no hay match fuerte.
4. Si no hay match aceptable:
   - crear partida candidata desde `.mcp`, o
   - marcar como pendiente de revision segun modo de ejecucion.

Thresholds sugeridos:

```ts
const MATCH_EXACT = 0.95;
const MATCH_STRONG = 0.80;
const MATCH_REVIEW = 0.60;
```

Regla:

- `>= 0.80`: se puede aplicar automaticamente.
- `0.60 - 0.79`: se incluye en preview como requiere revision.
- `< 0.60`: no se aplica automaticamente salvo confirmacion explicita.

### 5.5 Ajuste de cantidades

Orden recomendado:

1. Si el usuario dio cantidades especificas, respetarlas.
2. Si hay area del usuario y area fuente del `.mcp`, escalar por ratio.
3. Si hay pisos, aplicar reglas de inferencia por unidad.
4. Usar `estimateQuantity`.
5. Si no hay dato confiable, conservar cantidad fuente y marcar assumption.

Ejemplo:

```ts
scaledQuantity = sourceQuantity * (targetAreaM2 / sourceAreaM2)
```

Las cantidades y montos deben calcularse con `decimal.js` o servicios existentes de calculo, no con floats en logica financiera final.

### 5.6 Escritura

La escritura debe ejecutarse en transaccion:

1. Crear o localizar presupuesto general.
2. Crear subpresupuestos del blueprint si no existen.
3. Crear niveles/capitulos.
4. Crear partidas.
5. Crear o reutilizar APUs.
6. Crear o reutilizar recursos.
7. Recalcular subpresupuestos.
8. Recalcular presupuesto general.
9. Registrar trazabilidad.

---

## 6. Fases de Implementacion

### Fase 1: Repositorio `.mcp` productivo

Objetivo: eliminar dependencia funcional de `.mcp-repo` local.

Tareas:

- Migrar `lib/data/stored-project-packages.ts` a Prisma.
- Guardar `mcpContent` como base64 en DB en primera version.
- Mantener una interfaz de almacenamiento para poder mover a S3/R2 despues.
- Actualizar `createProjectPackageExport` para registrar `StoredProjectPackage`.
- Agregar tests de store/list/search/get/delete.

Criterios de aceptacion:

- Exportar `.mcp` guarda una copia consultable en DB.
- `searchStoredPackages` ya no depende de `.mcp-repo/index.json`.
- Los paquetes quedan asociados a `companyId` y `userId`.

### Fase 2: Extractor `.mcp -> BudgetBlueprint`

Objetivo: convertir un paquete `.mcp` en estructura usable por Khipu.

Nuevo archivo:

```text
lib/ai/budget-generation/mcp-template-extractor.ts
```

Funciones:

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

Criterios de aceptacion:

- Extrae subpresupuestos con nombres originales.
- Extrae niveles y partidas por subpresupuesto.
- Extrae APUs si existen.
- Falla de forma controlada si faltan modulos obligatorios.

### Fase 3: Preview de generacion

Objetivo: que Khipu muestre lo que va a crear antes de escribir.

Nuevo servicio:

```text
lib/ai/budget-generation/mcp-budget-preview.ts
```

Salida:

```ts
export type McpBudgetGenerationPreview = {
  packageId: string;
  sourceProjectName: string;
  targetProjectId: string;
  subBudgets: Array<{
    name: string;
    itemCount: number;
    matchedCatalogItems: number;
    reviewItems: number;
    estimatedDirectCost: string;
  }>;
  warnings: string[];
  assumptions: string[];
};
```

Criterios de aceptacion:

- Preview lista subpresupuestos, partidas y advertencias.
- Preview identifica partidas automaticas vs revision.
- No escribe en DB.

### Fase 4: Aplicacion de blueprint a proyecto

Objetivo: crear subpresupuestos y partidas desde el blueprint.

Nuevo servicio:

```text
lib/ai/budget-generation/mcp-budget-applicator.ts
```

Funcion:

```ts
export async function applyMcpBudgetBlueprintToProject(input: {
  userId: string;
  projectId: string;
  blueprint: McpBudgetBlueprint;
  mode: "auto" | "review_required";
}): Promise<McpBudgetGenerationResult>;
```

Criterios de aceptacion:

- Crea subpresupuestos faltantes.
- No duplica subpresupuestos existentes con el mismo nombre normalizado.
- Crea niveles y partidas.
- Recalcula totales.
- Devuelve resumen por subpresupuesto.

### Fase 5: Integracion con `generateBudgetTool`

Objetivo: hacer que Khipu use `.mcp` automaticamente.

Cambios:

- Extender `generateBudgetInput` con:

```ts
templateSource?: "auto" | "mcp" | "project" | "catalog";
previewOnly?: boolean;
```

- Flujo:

```text
generateBudget
  -> detectar intent
  -> buscar .mcp
  -> si match fuerte: preview/apply desde .mcp
  -> si no: flujo actual de proyectos similares
  -> si no: catalogo
```

Criterios de aceptacion:

- Para "vivienda", si existe `.mcp` compatible, lo prioriza.
- Si no hay `.mcp`, el flujo actual sigue funcionando.
- La respuesta de Khipu indica fuentes y supuestos.

### Fase 6: Secciones avanzadas

Despues de subpresupuestos y partidas:

1. **Gastos generales**
   - leer `budgets/general-expenses.json`;
   - copiar estructura;
   - recalcular montos.

2. **Pie de presupuesto**
   - leer `budgets/footer.json`;
   - mapear variables;
   - recalcular formulas.

3. **Formula polinomica**
   - preferir regenerar desde APUs nuevos;
   - usar `.mcp` como referencia de familias IU;
   - mantener coeficientes con 3 decimales.

4. **Cronograma**
   - ejecutar `createSchedule`;
   - usar `schedule/work-schedule.json` como patron de duraciones/predecesores cuando exista.

5. **Metrados**
   - usar `takeoffs/sheets.json` como estructura base en una fase posterior.

---

## 7. Herramientas Agenticas Nuevas o Actualizadas

### Nueva: `searchMcpTemplates`

```ts
{
  name: "searchMcpTemplates",
  risk: "read",
  input: {
    query: string;
    projectType?: string;
    companyId?: string;
    limit?: number;
  }
}
```

### Nueva: `previewBudgetFromMcpTemplate`

```ts
{
  name: "previewBudgetFromMcpTemplate",
  risk: "read",
  input: {
    projectId: string;
    packageId: string;
    description: string;
  }
}
```

### Nueva: `applyBudgetFromMcpTemplate`

```ts
{
  name: "applyBudgetFromMcpTemplate",
  risk: "financial",
  input: {
    projectId: string;
    packageId: string;
    description: string;
    mode: "auto" | "review_required";
  }
}
```

### Actualizar: `generateBudget`

Debe orquestar el flujo completo, pero internamente apoyarse en servicios reutilizables.

---

## 8. Trazabilidad

Cada partida creada desde IA debe guardar origen.

Opciones:

1. Agregar campos a `BudgetItem`.
2. Crear tabla auxiliar `BudgetItemGenerationSource`.

Recomendacion: tabla auxiliar para no cargar el modelo principal.

```prisma
model BudgetItemGenerationSource {
  id              String   @id @default(cuid())
  budgetItemId    String
  sourceType      String   // catalog, mcp_template, similar_project, ai_generated
  sourcePackageId String?
  sourceProjectId String?
  sourceItemId    String?
  catalogPartidaId String?
  matchScore      Decimal? @db.Decimal(5, 4)
  assumptions     Json?
  createdAt       DateTime @default(now())
}
```

Esto permite explicar:

- de donde vino cada partida;
- por que se eligio;
- que partidas necesitan revision;
- que datos fueron inferidos.

---

## 9. Seguridad y Validaciones

Reglas:

- Validar permisos por `companyId` y `projectId`.
- No permitir que un usuario use paquetes de otra empresa salvo que sean globales/seed.
- Validar checksums del `.mcp` antes de extraer.
- Limitar tamano maximo del paquete.
- No importar credenciales ni secretos.
- No sobrescribir presupuestos existentes sin confirmacion.
- No duplicar partidas si el presupuesto ya tiene contenido similar.
- Marcar como `review_required` si el match de catalogo es debil.

---

## 10. Tests Recomendados

### Unitarios

- `stored-project-packages.test.ts`
- `mcp-template-extractor.test.ts`
- `mcp-budget-preview.test.ts`
- `mcp-budget-applicator.test.ts`
- `generateBudgetTool.mcp.test.ts`

### Casos clave

1. Encuentra `vivienda.mcp` para "casa de 2 pisos".
2. Extrae subpresupuestos esperados.
3. Matchea partidas por descripcion y unidad.
4. Escala cantidades por area.
5. No duplica subpresupuestos existentes.
6. Recalcula totales con decimal-safe math.
7. Fallback a catalogo cuando no hay `.mcp`.
8. Rechaza paquete sin permisos.
9. Marca partidas con score bajo como revision.
10. Genera cronograma en fase posterior usando `createSchedule`.

---

## 11. MVP Recomendado

El MVP debe limitarse a:

1. Guardar `.mcp` en DB.
2. Buscar `.mcp` por tipo de obra.
3. Extraer subpresupuestos y partidas.
4. Crear preview.
5. Aplicar subpresupuestos y partidas.
6. Recalcular totales.
7. Registrar trazabilidad basica.

No incluir en MVP:

- formula polinomica automatica desde `.mcp`;
- pie de presupuesto;
- gastos generales detallados;
- cronograma con precedencias desde `.mcp`;
- metrados avanzados.

Esas piezas deben entrar en fase 2 porque dependen de que la estructura base sea confiable.

---

## 12. Resultado Esperado

Para una solicitud como:

```text
Genera un presupuesto para vivienda unifamiliar de 2 pisos, 120 m2, en Lima.
```

Khipu deberia poder responder:

```text
Use la plantilla "Vivienda unifamiliar base" desde un paquete .mcp.
Prepare 4 subpresupuestos:
- Estructuras: 38 partidas
- Arquitectura: 42 partidas
- Instalaciones Sanitarias: 18 partidas
- Instalaciones Electricas: 22 partidas

96 partidas fueron vinculadas al catalogo.
24 partidas requieren revision por similitud baja o unidad distinta.
Las cantidades se escalaron usando 120 m2 como area objetivo.
```

Despues de aprobacion, Khipu crea la estructura en el proyecto y deja trazabilidad de fuentes.

---

## 13. Checklist de Implementacion

- [ ] Migrar `stored-project-packages.ts` a Prisma.
- [ ] Guardar `.mcp` exportados en `StoredProjectPackage`.
- [ ] Crear extractor `.mcp -> McpBudgetBlueprint`.
- [ ] Crear matcher blueprint/catalogo.
- [ ] Crear preview de generacion desde `.mcp`.
- [ ] Crear applicator transaccional.
- [ ] Agregar herramientas agenticas especificas.
- [ ] Integrar con `generateBudgetTool`.
- [ ] Agregar trazabilidad por partida.
- [ ] Agregar tests unitarios y de flujo.
- [ ] Documentar flujo en README o docs de Khipu.
