# Importador desde base de datos SQLite de Delphin Express

## Motivación

Actualmente MC Presupuestos importa desde Delphin Express a través de archivos `.dprj` (BinaryFormatter de .NET). Sin embargo, Delphin Express almacena sus datos principalmente en bases SQLite (`SQLDelphin_maestro.sqlite` y `SQLDelphin_basica.sqlite`), lo que abre la posibilidad de una importación directa desde la base de datos, similar al flujo existente para S10 con SQL Server local.

Esta integración permitiría a los usuarios:

1. Apuntar directamente al archivo `.sqlite` de Delphin Express sin necesidad de exportar `.dprj`.
2. Seleccionar un proyecto de entre los disponibles en la base.
3. Previsualizar e importar a MC con el mismo pipeline de draft + import existente.

## Arquitectura general

El flujo replica el patrón S10 SQL Server local:

```
[UI: File picker / path input]
       │
       ▼
GET /api/imports/delphin/sqlite/projects?path=C:\...\SQLDelphin_maestro.sqlite
       │  → Lista proyectos disponibles en la base SQLite
       ▼
POST /api/imports/delphin/sqlite/export
       │  Body: { path, projectId, companyId }
       │  → Lee tablas del proyecto, genera S10ExportSnapshot
       ▼
POST /api/imports/delphin/draft   ← REUTILIZADO (ya existe)
       │  → Preview con partidas, APUs, insumos
       ▼
POST /api/imports/delphin/import  ← REUTILIZADO (ya existe)
       │  → Persiste en MYC
       ▼
[Dashboard / Proyecto importado]
```

### Diferencias clave con S10 SQL Server

| Aspecto | S10 SQL Server | Delphin SQLite |
|---------|---------------|----------------|
| Motor | `mssql` (tedious) | `better-sqlite3` (síncrono, nativo) |
| Conexión | Servidor + usuario + contraseña | Ruta de archivo (sin auth) |
| Listado | `listLocalS10Databases` → `listLocalS10Budgets` | `listDelphinSqliteProjects` (un solo paso: archivo → proyectos) |
| Export | `exportLocalS10Snapshot` | `exportDelphinSqliteProject` |
| Gate | `isLocalServerRuntimeEnabled()` | `isLocalServerRuntimeEnabled()` (mismo gate) |

### Por qué solo local

SQLite es un motor de archivo. Para leerlo desde el servidor, el archivo debe estar en el sistema de archivos del servidor. Esto limita la funcionalidad a:

- **Desarrollo local** (`NODE_ENV === "development"`)
- **Entornos con `MYC_ENABLE_LOCAL_SERVICES=true`** (desktop shell futuro)

En producción en Vercel, esta funcionalidad no estará disponible (no hay acceso al filesystem del cliente).

## Dependencia nueva

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

`better-sqlite3` es síncrono, lo que simplifica el código y evita problemas de conexión asíncrona. Ya aparece como dependencia transitiva en `package-lock.json` (usado por Prisma para pruebas).

**Importante:** `better-sqlite3` es un módulo nativo con binarios precompilados. Debe cargarse con `import()` dinámico dentro de handlers con `runtime: "nodejs"` (mismo patrón que `mssql` en `sqlserver-local.ts`), para evitar que Next.js intente empaquetarlo para edge runtime.

## Exploración del schema de Delphin Express

### Archivos

Delphin Express BIM 360 r106 mantiene dos bases SQLite en `App64/Database/`:

| Archivo | Tamaño | Contenido probable |
|---------|--------|--------------------|
| `SQLDelphin_basica.sqlite` | ~3 MB | Librerías, catálogos, unidades, insumos de referencia |
| `SQLDelphin_maestro.sqlite` | ~37 MB | Proyectos, presupuestos, costos unitarios, análisis |

### Tablas esperadas (maestro)

Basado en los nombres de campo del decoder `.dprj` existente y la estructura de Delphin:

```
Proyecto         → id_proyecto, nombre_proyecto
Presupuesto      → id_presupuesto, nombre_presupuesto, id_proyecto,
                   costo_directo, porcentaje_gasto, porcentaje_utilidad,
                   porcentaje_igv, total_presupuesto, ...
CostoUnitario    → id_costounitario, id_presupuesto, numeracion_costo,
                   descripcion_costo, id_unidad, productividad,
                   costo_unitario, cantidad, parcial_costo,
                   id_analisiscosto, id_costopadre, ...
AnalisisCosto    → id_analisiscosto, productividad, ...
Composicion      → id_composicion, id_analisiscosto, id_tipocosto,
                   codigo_crepco, id_listaprecio, id_unidad,
                   cantidad_composicion, costo_composicion,
                   parcial_composicion, descripcion_composicion, ...
Unidad           → id_unidad, descripcion_unidad, abreviatura_unidad
TipoCosto        → id_tipocosto, nombre_tipocosto
```

**Nota:** Los nombres reales de tablas y columnas deben verificarse abriendo las bases con DB Browser for SQLite. El plan contempla una fase inicial de exploración para mapear el schema exacto.

## Módulo de lectura SQLite: `lib/delphin/sqlite-reader.ts`

```typescript
// lib/delphin/sqlite-reader.ts
import Database from "better-sqlite3";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

export type DelphinSqliteProject = {
  id: string;
  name: string;
  budgetCount: number;
};

/**
 * Abre una base SQLite de Delphin en modo solo lectura
 * y lista los proyectos disponibles.
 */
export function listDelphinSqliteProjects(filePath: string): DelphinSqliteProject[];

/**
 * Lee un proyecto completo de la base SQLite de Delphin
 * y lo convierte al formato S10ExportSnapshot compatible
 * con el pipeline de importación existente.
 */
export function exportDelphinSqliteProject(
  filePath: string,
  projectId: string,
): S10ExportSnapshot;
```

### Estrategia de mapeo

El módulo `sqlite-reader.ts`:

1. Abre la base con `better-sqlite3(filePath, { readonly: true })`.
2. Ejecuta queries SQL para extraer: proyecto → presupuestos → costos unitarios → análisis → composiciones.
3. Convierte los resultados al mismo `DelphinDecodedProject` que produce el decoder `.dprj`.
4. Reutiliza **`parseDelphinDprjToS10Snapshot`** (ya existe en `lib/delphin/dprj-import.ts`) para transformar a `S10ExportSnapshot`.

De esta forma, el 100% de la lógica de mapeo de jerarquía, APUs, porcentajes y pie de presupuesto se reutiliza sin duplicación.

### Refactor necesario

Para reutilizar `parseDelphinDprjToS10Snapshot`, hay que exponer la función que convierte `DelphinDecodedProject → S10ExportSnapshot` sin el paso de decodificación BinaryFormatter/PowerShell. Se propone extraer:

```typescript
// lib/delphin/dprj-import.ts (existente, se agrega export)
export function convertDelphinProjectToS10Snapshot(
  decoded: DelphinDecodedProject,
  fileName?: string
): S10ExportSnapshot;
```

Actualmente `parseDelphinDprjToS10Snapshot` recibe `{ buffer, fileName }` internamente llama a `decodeDelphinDprj(buffer)` y luego construye el snapshot. Basta con un refactor ligero: extraer la parte de mapeo puro.

## API Routes (nuevas)

Todas bajo `app/api/imports/delphin/sqlite/`. Siguen el mismo patrón que `app/api/imports/s10/sqlserver/`.

### `GET /api/imports/delphin/sqlite/projects`

```typescript
// Query params: ?path=C:\...\SQLDelphin_maestro.sqlite
// Response: { projects: DelphinSqliteProject[] }
```

- Autenticación: sesión requerida.
- Gate: `isLocalServerRuntimeEnabled()`.
- Validación: `path` es un string, el archivo existe, es un SQLite válido.
- Carga dinámica: `const { listDelphinSqliteProjects } = await import("@/lib/delphin/sqlite-reader")`.

### `POST /api/imports/delphin/sqlite/export`

```typescript
// Body: { path: string, projectId: string, companyId?: string }
// Response: { snapshot: S10SnapshotContract }
```

- Autenticación + gate + validación de path y projectId.
- Carga dinámica: `const { exportDelphinSqliteProject } = await import("@/lib/delphin/sqlite-reader")`.
- Llama a `exportDelphinSqliteProject` → obtiene `S10ExportSnapshot` → pasa por `parseS10SnapshotJson` → retorna el contrato validado.

### Reutilización de rutas existentes

Las rutas `POST /api/imports/delphin/draft` y `POST /api/imports/delphin/import` ya soportan recibir un `S10SnapshotContract` en el body (vía JSON, no solo FormData/file). Verificar que acepten `{ snapshot: contract, companyId, budgetCode }` — si no, agregar ese modo.

## UI: Página de importación Delphin

### Opción recomendada: extender la página existente

La página actual `/imports/delphin` usa `Rw7ImporterPageContent` (un componente genérico de upload de archivo). Se propone:

1. **Renombrar** la página actual como solapa "Archivo .dprj".
2. **Agregar** una segunda solapa "Base de datos SQLite" (solo visible cuando `isLocalServerRuntimeEnabled()`).
3. La solapa SQLite contiene:
   - Input de ruta del archivo `.sqlite` (con file picker).
   - Botón "Buscar proyectos".
   - Selector de proyecto (dropdown).
   - Botón "Exportar y previsualizar".
   - El resto del flujo (draft preview + import) se reutiliza del componente existente.

Alternativa más simple: una página separada `/imports/delphin/database` que herede el layout pero reemplace el file upload por el selector de base de datos.

### Componente nuevo: `DelphinSqliteImporter`

```typescript
// components/imports/delphin-sqlite-importer.tsx
"use client";

// Estados:
// - sqlitePath: string (ruta del archivo .sqlite)
// - projects: DelphinSqliteProject[]
// - selectedProjectId: string
// - exportState: RequestState
// - exportError: string
// - localSnapshot: S10SnapshotContract | null
// - Luego reusa el mismo draft preview + import del Rw7ImporterPageContent

// Flujo:
// 1. Usuario ingresa ruta o selecciona archivo .sqlite
// 2. Click "Buscar proyectos" → GET /api/imports/delphin/sqlite/projects
// 3. Selecciona proyecto del dropdown
// 4. Click "Exportar y previsualizar" → POST /api/imports/delphin/sqlite/export
// 5. El snapshot resultante se pasa al mismo pipeline de draft + import
```

## Plan de implementación

### Fase 0: Exploración del schema (1-2h)

1. Abrir `SQLDelphin_maestro.sqlite` con DB Browser for SQLite.
2. Documentar nombres reales de tablas y columnas.
3. Escribir queries de prueba para extraer un proyecto con sus presupuestos, costos y análisis.
4. Validar que los datos extraídos coinciden con lo que produce el decoder `.dprj` para el mismo proyecto.

### Fase 1: Dependencia y módulo lector (2-3h)

1. `npm install better-sqlite3 @types/better-sqlite3`
2. Crear `lib/delphin/sqlite-reader.ts` con:
   - `listDelphinSqliteProjects(filePath)`
   - `exportDelphinSqliteProject(filePath, projectId)`
3. Refactor ligero en `lib/delphin/dprj-import.ts`: exponer `convertDelphinProjectToS10Snapshot`.
4. Tests unitarios para `sqlite-reader.test.ts` con un SQLite de prueba (creado en memoria con `better-sqlite3`).

### Fase 2: API routes (2-3h)

1. `app/api/imports/delphin/sqlite/projects/route.ts` + tests.
2. `app/api/imports/delphin/sqlite/export/route.ts` + tests.
3. Verificar/adaptar `POST /api/imports/delphin/draft` para aceptar snapshot por JSON.
4. Gate `isLocalServerRuntimeEnabled()` en ambas rutas.
5. Carga dinámica con `await import()` para `better-sqlite3`.

### Fase 3: UI (3-4h)

1. Crear `components/imports/delphin-sqlite-importer.tsx`.
2. Extender `app/imports/delphin/page.tsx` con solapas (Archivo .dprj | Base de datos SQLite).
3. File picker para `.sqlite` + input de ruta manual.
4. Dropdown de proyectos con nombre y cantidad de presupuestos.
5. Reutilizar componentes de draft preview e import existentes.
6. Barra de progreso durante export + draft.

### Fase 4: Integración y pruebas (2-3h)

1. Probar con `SQLDelphin_maestro.sqlite` real.
2. Probar con `SQLDelphin_basica.sqlite` (si contiene datos de catálogo que puedan ser útiles).
3. Verificar que el snapshot generado es idéntico al que produciría un `.dprj` del mismo proyecto.
4. Tests de integración para el flujo completo.
5. Actualizar sidebar si se agrega una página nueva.

### Fase 5: Documentación (1h)

1. Actualizar `docs/importador-delphin.md` con la nueva funcionalidad.
2. Agregar entradas en `README.md` sobre importación desde SQLite.

## Consideraciones técnicas

### Sincrónico vs asíncrono

`better-sqlite3` es síncrono por diseño. Esto es aceptable porque:

- Las queries son locales y rápidas (milisegundos).
- Las rutas usan `runtime: "nodejs"`, no Edge.
- El patrón de carga dinámica (`await import()`) asegura que el módulo nativo no se cargue en el proceso principal de Next.js hasta que se necesita.

### Seguridad

- El path del archivo SQLite se recibe como string del cliente. Validar que:
  - No contenga `..` (path traversal).
  - El archivo exista y sea accesible.
  - Sea un SQLite válido (headers `SQLite format 3`).
- `better-sqlite3` se abre en modo `readonly: true` — nunca se modifica la base del usuario.

### Rendimiento

- Para proyectos grandes (37 MB de base _maestro), la lectura secuencial de todas las tablas puede tomar 1-3 segundos. Es aceptable.
- Mostrar barra de progreso durante la exportación (mismo patrón que S10 local).

### Compatibilidad con versiones de Delphin

- Probado con: Delphin Express BIM 360 r106.
- El schema puede variar entre versiones. Si se detecta un schema desconocido, mostrar un error descriptivo con los nombres de tabla esperados vs encontrados.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Schema diferente entre versiones de Delphin | Queries parametrizadas con nombres de tabla/columna documentados; error claro si no se encuentra una tabla esperada |
| `better-sqlite3` no compila en Windows | Usar `@aspect-build/rules_js` o prebuild binaries; en el peor caso, hacer que la feature requiera Node.js con native modules habilitado |
| La base _basica no tiene datos de proyecto | Documentar que solo se usa `_maestro`; si la básica tiene catálogos, considerarlos en futura iteración |
| Duplicación de lógica con decoder .dprj | Refactor para compartir `DelphinDecodedProject → S10ExportSnapshot` |

## Dependencias nuevas

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

## Archivos nuevos y modificados

### Nuevos

```
lib/delphin/sqlite-reader.ts
lib/delphin/sqlite-reader.test.ts
app/api/imports/delphin/sqlite/projects/route.ts
app/api/imports/delphin/sqlite/projects/route.test.ts
app/api/imports/delphin/sqlite/export/route.ts
app/api/imports/delphin/sqlite/export/route.test.ts
components/imports/delphin-sqlite-importer.tsx
```

### Modificados

```
lib/delphin/dprj-import.ts          — extraer convertDelphinProjectToS10Snapshot
app/imports/delphin/page.tsx        — agregar solapa "Base de datos SQLite"
app/api/imports/delphin/draft/route.ts — aceptar snapshot por JSON (si no lo hace ya)
docs/importador-delphin.md          — documentar nueva funcionalidad
```

### No modificar

- `lib/s10/import-mapper.ts`
- `lib/s10/import-preview.ts`
- `lib/s10/import-persistence.ts`
- `app/api/imports/delphin/import/route.ts`
- `app/api/imports/s10/*`