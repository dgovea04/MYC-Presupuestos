# Importador de archivos `.db` - Especificacion de diseno

**Fecha:** 2026-09-03  
**Estado:** Implementado y verificado con pruebas enfocadas; la suite global conserva fallos preexistentes no relacionados.  
**Producto:** MC Presupuestos

## Objetivo

Agregar en **Importaciones** una entrada para archivos de presupuesto con extension `.db`. El flujo debe ofrecer dos origenes:

1. **Subir archivo:** el usuario selecciona un `.db` desde el navegador y lo envia al servidor para lectura temporal.
2. **Buscar base local:** el usuario indica una ruta accesible por el proceso Node que ejecuta MC Presupuestos y el servidor lee la base directamente en modo solo lectura.

Ambos origenes deben producir el mismo draft, las mismas validaciones y la misma persistencia final. El usuario debe poder revisar presupuestos, partidas, recursos y APUs antes de crear un nuevo proyecto en MC.

## Alcance

### Incluido en V1

1. Nueva entrada `Importaciones > Archivo .db`.
2. Seleccion de empresa destino.
3. Modo **Subir archivo** mediante `input type="file"` con extensiones `.db`, `.sqlite` y `.sqlite3` aceptadas, mostrando `.db` como formato principal.
4. Modo **Buscar base local** mediante ruta de archivo, siguiendo el patron usado por el importador Delphin Express.
5. Lectura de SQLite con `better-sqlite3` en runtime Node.js y modo `readonly`.
6. Validacion de firma SQLite y deteccion del schema compatible antes de exportar datos.
7. Descubrimiento de proyectos contenidos en la base.
8. Seleccion de proyecto y, si existe, de subpresupuesto.
9. Conversion a `S10ExportSnapshot` para reutilizar el pipeline existente.
10. Preview con presupuestos, niveles, partidas, APUs, insumos, metrados, precios y advertencias.
11. Importacion transaccional a MC despues de la confirmacion del usuario.
12. Tests unitarios, tests de rutas, tests de UI y prueba de paridad con la base fixture disponible.

### Fuera de alcance en V1

- Modificar la base `.db` de origen.
- Sincronizacion continua entre MC y la base externa.
- Importar calendario, valorizaciones, formula polinomica, documentos o adjuntos que no esten representados en el schema analizado.
- Buscar archivos en todo el disco del cliente desde un navegador web.
- Soportar cualquier schema SQLite arbitrario sin un adaptador identificado.
- Sobrescribir proyectos existentes en MC.

## Contexto del repositorio

El repositorio ya contiene patrones reutilizables:

- `components/imports/delphin-tabbed-importer.tsx` para presentar modos de importacion.
- `components/imports/delphin-sqlite-importer.tsx` para lectura de una base local, seleccion de proyecto y preview.
- `lib/delphin/sqlite-reader.ts` para abrir SQLite con `better-sqlite3` y cerrar siempre la conexion.
- `lib/delphin/dprj-import.ts` y `convertDelphinProjectToS10Snapshot()` para converger a un snapshot comun.
- `lib/s10/import-preview.ts` para validar y construir el draft.
- `lib/s10/import-persistence.ts` para persistir proyecto, presupuestos, partidas, APUs e insumos.
- `ImportProgressPanel`, `ImportWarningSummary` e `ImportBudgetFooterPreview` para la experiencia de preview.
- `lib/runtime/local-capabilities.ts` para bloquear lectura de recursos locales en despliegues no locales.

La nueva implementacion debe seguir este patron y evitar duplicar la persistencia S10.

## Evidencia del formato de origen

El repositorio incluye la base:

```text
presupuesto-ejemplo/db/PAVIMENTADO RIGIDO DE LA CALLE _28 DE JULIO_.db
```

Su cabecera es `SQLite format 3` y el schema observado incluye las siguientes tablas:

```text
proyectos
sub_presupuestos
partidas
recursos
acu_items
biblioteca_cu
biblioteca_acu_items
configuracion
```

El schema de esta base no es el mismo schema de Delphin Express. Por eso la implementacion debe tener un lector propio, aunque comparta el contrato intermedio y el pipeline de MC.

## Flujo de usuario

1. El usuario abre `Importaciones > Archivo .db`.
2. Selecciona una empresa destino.
3. Selecciona el origen:
   - **Subir archivo** para enviar el `.db` desde el navegador.
   - **Buscar base local** para leer una ruta del equipo donde corre el servidor local.
4. El usuario carga o indica la base.
5. MC valida firma, schema y tablas requeridas.
6. MC muestra las bases/proyectos encontrados o el proyecto contenido en el archivo.
7. El usuario selecciona un proyecto y, si corresponde, un subpresupuesto.
8. MC genera el snapshot normalizado y solicita un draft.
9. El usuario revisa resumen, arbol, partidas, APUs, recursos, importes y advertencias.
10. El usuario confirma **Importar a MC**.
11. MC persiste una copia nueva del proyecto y muestra enlaces al proyecto y presupuesto.

## Restriccion de filesystem del navegador

Un navegador web no puede entregar a un servidor remoto la ruta absoluta de un archivo seleccionado. El `File` obtenido por `input type="file"` contiene nombre y bytes, no una ruta utilizable por Node.

Por tanto:

- **Subir archivo** siempre debe enviar los bytes mediante `multipart/form-data`.
- **Buscar base local** solo puede leer una ruta si el servidor Node corre en el mismo equipo o tiene acceso a esa ruta, por ejemplo una ruta local de Windows o una ruta UNC compartida.
- Un boton de exploracion nativo del navegador no debe enviar la ruta del cliente esperando que el servidor remoto la abra.
- Si en el futuro se incorpora un desktop shell, podra implementarse un bridge seguro que entregue un handle o copie el archivo al proceso local. No es parte de V1.

La UI debe mostrar esta diferencia de forma explicita y no prometer lectura local en Vercel.

## Arquitectura

```text
[UI /imports/db]
       │
       ├── Subir archivo
       │      └── POST /api/imports/db/draft (multipart)
       │
       └── Buscar base local
              ├── GET  /api/imports/db/local/projects?path=...
              └── POST /api/imports/db/local/export

[db-reader / db-import]
       │  valida SQLite + schema + extrae entidades
       ▼
S10ExportSnapshot validado
       │
       ├── POST /api/imports/s10/draft
       └── POST /api/imports/s10/import
```

### Decisiones de arquitectura

- `lib/db-import` sera el dominio del formato `.db`.
- La lectura de SQLite debe estar aislada de React y de los route handlers.
- La salida del lector debe ser un contrato interno propio y despues convertirse a `S10ExportSnapshot`.
- La persistencia no debe crear tablas nuevas ni duplicar `importS10SnapshotToMyc`.
- Las rutas locales deben declarar `runtime = "nodejs"` y usar import dinamico para el modulo nativo.
- Las operaciones sobre SQLite deben usar consultas parametrizadas y cerrar la base en `finally`.
- Los calculos monetarios y de parciales deben utilizar `decimal.js` en el dominio de importacion o en los calculadores existentes.

## Contrato interno normalizado

El lector no debe acoplarse directamente a los nombres finales de S10. Debe generar un modelo de origen normalizado:

```typescript
type DbImportedProject = {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  currency: string | null;
  generalExpensesRate: string | null;
  utilityRate: string | null;
  taxRate: string | null;
  subBudgets: DbImportedSubBudget[];
};

type DbImportedSubBudget = {
  id: string;
  name: string;
  order: number;
  items: DbImportedBudgetItem[];
};

type DbImportedBudgetItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  level: number;
  isTitle: boolean;
  order: number;
  productivity: string | null;
  apuRows: DbImportedApuRow[];
};

type DbImportedApuRow = {
  id: string;
  resourceId: string;
  code: string;
  description: string;
  type: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  crew: string | null;
};
```

Los valores numericos se mantendran como strings en contratos de API y se convertiran a `Decimal` al calcular. No se debe usar `number` como representacion financiera en el boundary del lector si puede perder precision.

## Mapeo del schema `.db`

### Proyecto

```text
proyectos.id                 -> project.id
proyectos.nombre             -> project.name
proyectos.cliente            -> project.client
proyectos.ubicacion          -> project.location
proyectos.moneda             -> project.currency
proyectos.gf_pct             -> generalExpensesRate
proyectos.utilidad_pct       -> utilityRate
proyectos.igv_pct             -> taxRate
```

Si la base contiene mas de un proyecto, se listan todos. El usuario debe seleccionar uno antes de exportar.

### Subpresupuesto

```text
sub_presupuestos.id          -> subBudget.id
sub_presupuestos.proyecto_id -> project.id
sub_presupuestos.nombre      -> subBudget.name
sub_presupuestos.orden       -> subBudget.order
```

Si una partida tiene `sub_presupuesto_id` nulo, se asigna a un subpresupuesto sintetico `GENERAL`, con warning no bloqueante. No se debe perder una partida por no tener relacion.

### Partida y niveles

```text
partidas.id                  -> item.id
partidas.item                -> item.code
partidas.descripcion         -> item.description
partidas.unidad              -> item.unit
partidas.metrado             -> item.quantity
partidas.precio_unitario     -> item.unitPrice
partidas.nivel               -> item.level
partidas.es_titulo           -> item.isTitle
partidas.rendimiento         -> item.productivity
partidas.sub_presupuesto_id  -> subBudget.id
```

Reglas:

- `es_titulo = 1` representa un nivel y no una partida importable.
- Una fila no marcada como titulo con cantidad, unidad o precio se trata como partida.
- Las filas con `nivel` deben conservar el orden y la jerarquia visible.
- La jerarquia se debe reconstruir por `nivel` y orden de lectura; no se deben convertir titulos en `BudgetItem`.
- Si `partidas.grupo` contiene informacion de categoria, conservarla como metadata del draft aunque no exista un campo permanente equivalente.

### Recursos y APUs

La fuente primaria para APU de una partida es `acu_items`:

```text
acu_items.partida_id       -> item.id
acu_items.recurso_id       -> resource.id
acu_items.cuadrilla        -> apu.crew
acu_items.cantidad         -> apu.quantity
acu_items.precio           -> apu.unitPrice, si existe
```

El recurso se obtiene de `recursos`:

```text
recursos.id                -> resource.id
recursos.codigo            -> resource.code
recursos.descripcion       -> resource.description
recursos.tipo              -> resource.type
recursos.unidad            -> resource.unit
recursos.precio            -> resource.unitPrice
recursos.indice_inei       -> resource.unifiedIndexCode
recursos.categoria         -> resource.category
```

Reglas para valores:

1. Si `acu_items.precio` existe, usarlo como precio de la fila APU.
2. Si `acu_items.precio` es nulo, usar `recursos.precio`.
3. `partial` se calcula como `cantidad * precio`, salvo que el schema de una futura variante agregue un parcial explicito.
4. `cuadrilla` se conserva para que el APU pueda mostrar el rendimiento de origen.
5. El tipo de recurso se normaliza a las categorias aceptadas por MC: material, mano de obra, equipo, herramienta o subcontrato.
6. Si no existe recurso relacionado, crear warning y no inventar descripcion, unidad o precio.

### Biblioteca de APUs

`biblioteca_cu` y `biblioteca_acu_items` representan una biblioteca de costos unitarios, no necesariamente APUs utilizados en el presupuesto:

```text
biblioteca_cu.id            -> libraryApu.id
biblioteca_cu.descripcion    -> libraryApu.description
biblioteca_cu.unidad         -> libraryApu.unit
biblioteca_cu.rendimiento    -> libraryApu.productivity
biblioteca_cu.costo_unitario -> libraryApu.unitPrice
biblioteca_acu_items.cu_id  -> libraryApu.id
biblioteca_acu_items.recurso_id -> resource.id
```

V1 debe leer la biblioteca solo si se demuestra que la base fixture la utiliza para completar partidas del proyecto. Si no existe una relacion confiable con `partidas`, se conserva como una fuente opcional y no se importa como partidas del presupuesto para evitar duplicados.

## Conversion a snapshot

Crear `convertDbProjectToS10Snapshot(project)` en `lib/db-import/snapshot-mapper.ts`. La conversion genera un contrato versionado con `adapter: "db"`.

El mapper debe producir como minimo:

- un `S10PresupuestoRow` general;
- un `S10SubpresupuestoRow` por subpresupuesto;
- `S10BudgetLevelRow` para titulos;
- `S10SubpresupuestoDetalleRow` para partidas;
- `S10ApuDetalleRow` para cada fila APU;
- filas de pie cuando existan tasas de gastos generales, utilidad e IGV.

Las reglas de pie deben seguir la implementacion Delphin existente:

```text
01 COSTO DIRECTO
02 GASTOS GENERALES
03 UTILIDAD
04 SUBTOTAL
05 IGV
06 TOTAL PRESUPUESTO
```

Cuando la base no guarde totales por subpresupuesto, calcularlos con `decimal.js` desde los parciales de las partidas y generar warning de total reconstruido. Nunca reemplazar silenciosamente un total existente con uno calculado sin conservar la diferencia en metadata/warnings.

El mapper debe usar un codigo de fuente estable, por ejemplo `DB`, y conservar el nombre de archivo en metadata de preview. El codigo no debe colisionar con snapshots S10 o Delphin en el proceso de importacion.

## Modos y endpoints

### Upload

#### `POST /api/imports/db/draft`

Request: `multipart/form-data`

```text
file: File (.db/.sqlite/.sqlite3)
companyId: string opcional para preview
projectId: string opcional
subBudgetId: string opcional
```

Comportamiento:

- Requiere sesion.
- Valida extension, tamano maximo y firma SQLite.
- Guarda el archivo solo en temporal durante la request o en un almacenamiento temporal controlado si el procesamiento excede una request.
- Lee el proyecto seleccionado.
- Genera snapshot y preview.
- No persiste un proyecto MC.

#### `POST /api/imports/db/import`

Request: `multipart/form-data`

```text
file: File
companyId: string requerido
projectId: string opcional
subBudgetId: string opcional
```

Comportamiento:

- Requiere sesion y membresia `EDITOR` en la empresa.
- Repite la validacion del archivo en backend.
- Genera snapshot validado.
- Llama a `importS10SnapshotToMyc`.
- Revalida caches y registra `budget_imported` con `import_source = "db"` y `format = "sqlite-db"`.

La importacion no debe confiar en un snapshot enviado por el cliente como fuente unica. El backend debe validar nuevamente el archivo o recibir un snapshot firmado/validado dentro de la misma estrategia del importador S10.

### Local path

#### `GET /api/imports/db/local/projects?path=...`

Response:

```json
{
  "projects": [
    { "id": "1", "name": "...", "subBudgetCount": 3, "itemCount": 125 }
  ]
}
```

#### `POST /api/imports/db/local/export`

Request:

```json
{
  "path": "C:\\datos\\presupuesto.db",
  "projectId": "1",
  "subBudgetId": "2"
}
```

Response:

```json
{
  "snapshot": "S10SnapshotContract"
}
```

Las rutas locales deben:

- declarar `runtime = "nodejs"` y `dynamic = "force-dynamic"`;
- requerir sesion;
- requerir `isLocalServerRuntimeEnabled()`;
- validar ruta, extension, existencia, archivo regular y cabecera SQLite;
- abrir con `readonly: true`;
- rechazar `..` y rutas no permitidas por la politica definida;
- limitar el tamano del archivo y el tiempo de lectura;
- usar import dinamico de `better-sqlite3`;
- cerrar siempre la conexion;
- devolver errores accionables sin exponer secretos ni SQL interno.

La politica de rutas debe permitir rutas absolutas locales y UNC necesarias para el flujo de escritorio, pero debe evitar que un despliegue remoto se convierta en un lector arbitrario del filesystem del servidor.

## UI

### Pagina

Crear `app/imports/db/page.tsx` como Server Component:

- cargar sesion y empresas con el patron de `app/imports/delphin/page.tsx`;
- mostrar `PageHeaderCard` con el titulo `Importador .db`;
- mostrar el componente cliente dentro del layout y card existente;
- indicar cuando las capacidades locales no estan habilitadas.

Agregar la entrada en `components/layout/app-sidebar-client.tsx` debajo de Importaciones.

### Componente

Crear `components/imports/db-importer-page-content.tsx` o dividir en componentes pequenos si el flujo crece.

Estados requeridos:

- origen seleccionado;
- archivo seleccionado;
- ruta local;
- estado de deteccion;
- proyectos encontrados;
- proyecto/subpresupuesto seleccionado;
- estado de exportacion;
- snapshot local temporal;
- draft preview;
- estado de importacion;
- errores de validacion y warnings;
- resultado con enlaces.

Controles requeridos:

- tabs o segmented control: `Subir archivo` / `Buscar base local`;
- `input type="file"` con accept `.db,.sqlite,.sqlite3`;
- input de ruta local y boton `Buscar proyectos`;
- select de proyecto y subpresupuesto;
- select de empresa;
- boton `Exportar y previsualizar`;
- boton `Importar a MC`;
- `ImportProgressPanel`;
- `ImportWarningSummary`;
- preview de pie y tabla de partidas con busqueda.

La experiencia de preview debe reutilizar el lenguaje visual del importador Delphin y del modo S10. Las tablas APU deben conservar columnas, densidad, bordes, unidades y decimales configurados por la aplicacion.

## Validaciones y warnings

### Bloquean el flujo

- usuario no autenticado;
- empresa inexistente o sin membresia `EDITOR` al importar;
- archivo ausente;
- extension no permitida;
- archivo mayor al limite;
- firma no SQLite;
- schema no compatible;
- proyecto no encontrado;
- base sin proyectos ni partidas importables;
- partida sin identificador, descripcion, unidad y valores minimos cuando sea requerida;
- snapshot que no pasa `parseS10SnapshotJson`;
- error critico de integridad que impediria persistir el proyecto.

### No bloquean, pero deben mostrarse

- partida sin subpresupuesto, asignada a `GENERAL`;
- partida titulo con datos numericos inconsistentes;
- recurso sin codigo;
- unidad vacia o normalizada;
- APU inexistente;
- recurso relacionado que no se encuentra;
- total reconstruido por ausencia de total de origen;
- diferencias entre parcial de origen y parcial calculado dentro de tolerancia;
- datos de biblioteca sin relacion con partidas.

Cada warning debe incluir contexto minimo: entidad, codigo/descripcion y regla que lo produjo.

## Seguridad y limites

- Tamano maximo inicial sugerido para upload: 80 MB, configurable y alineado con el importador Delphin.
- La base siempre se abre en solo lectura.
- El nombre del archivo no debe usarse para construir rutas sin normalizacion.
- No aceptar rutas con `..`.
- No escribir junto a la base fuente.
- No ejecutar SQL recibido del cliente.
- Usar queries estaticas y parametros para ids.
- No incluir contenido completo de la base en logs.
- No devolver credenciales, rutas sensibles del servidor ni stack traces.
- Limpiar archivos temporales aun cuando falle el parseo.
- Revisar limites de memoria para snapshots grandes antes de habilitar archivos mayores.

## Observabilidad

Registrar eventos de aplicacion:

- `db_import_draft_created` con formato, tamanos y conteos, sin datos sensibles;
- `db_import_imported` o `budget_imported` con `import_source = "db"`;
- `db_import_failed` con categoria de error.

Medir:

- tamano del archivo;
- duracion de lectura;
- proyectos detectados;
- subpresupuestos detectados;
- partidas detectadas;
- APUs y recursos detectados;
- warnings;
- modo `upload` o `local_path`;
- version/schema detectado.

## Pruebas

La implementacion incluye pruebas de lector, mapper, rutas upload/local, componente UI y la fixture real `presupuesto-ejemplo/db/PAVIMENTADO RIGIDO DE LA CALLE _28 DE JULIO_.db`. La guia operativa esta en `docs/db-import.md`.

### Unitarias

- deteccion de firma SQLite;
- deteccion de schema requerido;
- normalizacion de tipos de recurso y unidades;
- reconstruccion de niveles por `nivel` y `es_titulo`;
- mapeo de proyectos y subpresupuestos;
- mapeo de partidas y APUs;
- fallback de `acu_items.precio` a `recursos.precio`;
- calculo decimal-safe de parciales y totales;
- generacion de pie;
- warnings de relaciones faltantes;
- rechazo de schema incompatible.

### API

- upload sin autenticacion devuelve 401;
- upload con extension incorrecta devuelve 400;
- upload con archivo no SQLite devuelve 400;
- upload valido devuelve preview;
- local path esta bloqueado cuando local runtime esta deshabilitado;
- local path sin ruta devuelve 400;
- local path con traversal devuelve 400;
- export de proyecto inexistente devuelve 400;
- import requiere empresa y rol `EDITOR`;
- import devuelve resultado y revalida caches.

### UI

- no permite preview sin archivo;
- no permite preview local sin ruta/proyecto;
- cambia correctamente entre modos;
- muestra proyectos y subpresupuestos detectados;
- muestra warnings y resultados;
- deshabilita importar sin empresa;
- muestra enlaces al proyecto y presupuesto creados.

### Fixture

Usar como fixture de integracion:

```text
presupuesto-ejemplo/db/PAVIMENTADO RIGIDO DE LA CALLE _28 DE JULIO_.db
```

Los tests no deben depender de que el archivo del ejemplo sea mutado. Para unit tests, crear una base temporal en memoria o en `os.tmpdir()` con el schema minimo y eliminarla en `afterEach`.

## Criterios de aceptacion

1. El usuario ve `Archivo .db` dentro de Importaciones.
2. Puede seleccionar y subir un `.db` desde el navegador.
3. Puede indicar una ruta local cuando MC corre en el mismo equipo o tiene acceso a una ruta compartida.
4. El sistema distingue claramente upload de ruta local y no intenta abrir una ruta del cliente en un servidor remoto.
5. Una base SQLite compatible se valida antes de importar.
6. El usuario puede elegir proyecto y subpresupuesto cuando la base contiene varios.
7. El preview muestra partidas, niveles, APUs, recursos, metrados, precios y advertencias.
8. El snapshot resultante converge en el pipeline S10 existente.
9. La importacion final crea un proyecto nuevo solo despues de confirmacion.
10. Los parciales, APUs y pies se calculan con precision decimal-safe.
11. La base de origen nunca se modifica.
12. Los importadores S10, RW7, Delphin, MCP y PDF conservan su comportamiento.
13. El flujo esta cubierto por tests de dominio, API y UI.
