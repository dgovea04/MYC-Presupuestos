# MCP Project Package Design

## Context

MC Presupuestos ya tiene varias capacidades parciales de exportacion e importacion:

- exportacion centralizada por modulo en `app/api/exports/route.ts`, `lib/exports/definitions.ts` y `lib/exports/centralized.ts`
- exportaciones especificas de metrados, riesgo, reportes PDF y Excel
- importadores de S10 y Delphin Express en `app/api/imports/s10/*`, `app/api/imports/delphin/*`, `lib/s10/*` y `lib/delphin/dprj-import.ts`
- duplicacion de proyectos y snapshots tecnicos en otras partes del dominio

Lo que falta es un formato nativo de MC Presupuestos para mover un proyecto completo entre entornos, respaldarlo, restaurarlo y abrir la puerta a integraciones con software externo.

El usuario quiere un archivo unico, similar al `.dprj` de Delphin Express, pero con formato propio y vocacion interoperable.

## Goal

Definir un sistema de exportacion/importacion de proyecto completo basado en un archivo `.mcp` que:

- exporte un snapshot semantico completo del proyecto
- permita restaurar o clonar ese proyecto dentro de MC Presupuestos
- sea legible y versionable para integraciones externas
- preserve precision financiera y tecnica
- reuse la arquitectura existente de export/import en lugar de crear un flujo aislado

## Non-Goals

- No convertir `.mcp` en un dump crudo de tablas Prisma
- No incluir credenciales, sesiones, API keys ni secretos del sistema
- No soportar merge automatico complejo en V1
- No resolver en V1 sincronizacion bidireccional en tiempo real con software externo
- No prometer compatibilidad inmediata con todos los modulos futuros de MC

## Decision Summary

La decision aprobada es:

- `.mcp` sera un contenedor ZIP con extension propia `.mcp`
- el interior sera abierto, legible y modular
- el paquete tendra `manifest.json` y multiples JSON por dominio
- el formato representara un snapshot semantico del proyecto, no una copia literal de la base de datos
- el importador soportara restauracion como proyecto nuevo y analisis previo de compatibilidad
- el formato tendra un perfil interoperable estable y un espacio de extensiones propietarias

## Why This Format

Frente a un binario cerrado o a un JSON monolitico, el contenedor ZIP modular ofrece el mejor balance para MC Presupuestos:

- facilita debug y soporte cuando un archivo falla
- permite checksums por archivo y por paquete
- hace viables migraciones de formato por modulo
- simplifica interoperabilidad con terceros
- evita acoplar el formato a la estructura interna exacta de Prisma
- puede aprovechar la logica ZIP ya existente en `lib/exports/centralized.ts`

## User Experience

## Export

Desde proyecto o desde el panel centralizado de exportacion, el usuario podra ejecutar:

- `Exportar proyecto (.mcp)`

Comportamiento esperado:

1. El sistema valida acceso al proyecto y entitlements aplicables.
2. Recolecta un snapshot consistente del proyecto completo.
3. Genera un `.mcp` descargable con nombre predecible.
4. El archivo incluye manifest, data semantica por modulo, adjuntos y checksums.

La exportacion no guarda historial binario persistente en V1, igual que el panel actual, salvo que mas adelante se agregue auditoria explicita.

## Import

El sistema agregara un flujo especifico de importacion `.mcp` con dos fases:

1. `Analizar archivo`
2. `Importar proyecto`

Comportamiento esperado:

1. El usuario sube un `.mcp`.
2. El backend valida extension, tamano, estructura ZIP, `manifest.json` y checksums.
3. El sistema muestra preview:
   - nombre del proyecto
   - version del formato
   - modulos detectados
   - warnings
   - compatibilidad
4. El usuario elige empresa destino y modo de importacion.
5. El backend importa el snapshot.
6. El sistema revalida dashboard, proyectos, presupuestos y paginas relacionadas.

## Import Modes

V1 debe soportar:

- `restore_as_new_project`
  - crea un proyecto nuevo con IDs nuevos
  - es el modo recomendado
- `preview_only`
  - solo analiza y muestra compatibilidad

V1 no debe soportar aun:

- merge fino contra un proyecto existente
- overwrite destructivo de un proyecto en sitio

## Scope Of Data

El `.mcp` V1 debe incluir, como snapshot semantico:

- proyecto
- presupuesto general
- sub presupuestos
- jerarquia de niveles y partidas
- APUs y recursos APU
- resumen de insumos relevantes del proyecto
- gastos generales
- pie de presupuesto
- formula polinomica
- indices usados por la formula cuando sean necesarios para portabilidad
- metrados avanzados
- cronograma de obra
- analisis de riesgo Monte Carlo persistido
- memoria de proyecto y contexto AI solo si se decide como modulo opcional de negocio
- adjuntos del proyecto estrictamente necesarios o visibles para reportes

V1 no debe exportar:

- usuarios, sesiones o membresias
- API keys o secretos
- estado interno de proveedores AI
- jobs temporales
- caches derivadas recreables
- telemetria operativa interna

## Semantic Snapshot Rule

La regla principal del formato es:

> El `.mcp` describe el proyecto tal como MC lo entiende funcionalmente, no tal como Prisma lo almacena fisicamente.

Eso implica:

- no exportar columnas irrelevantes solo porque existen en DB
- representar relaciones y entidades de forma estable
- evitar depender de IDs internos para interoperabilidad
- incluir suficientes claves externas, referencias y metadatos para reconstruir el proyecto

## Container Layout

Estructura base recomendada:

```text
proyecto-ejemplo.mcp
|- manifest.json
|- project.json
|- budgets/
|  |- budget-tree.json
|  |- budget-items.json
|  |- apus.json
|  |- project-resources.json
|  |- general-expenses.json
|  `- footer.json
|- polynomial-formula/
|  |- formula.json
|  `- indices.json
|- takeoffs/
|  `- sheets.json
|- schedule/
|  `- work-schedule.json
|- risk/
|  `- risk-analysis.json
|- ai/
|  `- project-context.json
|- attachments/
|  |- company-logo.png
|  `- project-files/
`- checksums/
   `- sha256.json
```

La carpeta `ai/` sera opcional y puede quedar fuera de V1 si se decide reducir alcance.

## Manifest Contract

`manifest.json` es la fuente de verdad del paquete.

Campos minimos recomendados:

```json
{
  "format": "MC_PROJECT_PACKAGE",
  "formatVersion": "1.0.0",
  "schemaVersion": 1,
  "exportedAt": "2026-07-10T15:30:00.000Z",
  "source": {
    "app": "MC Presupuestos",
    "appVersion": "0.1.0",
    "environment": "production"
  },
  "package": {
    "fileExtension": ".mcp",
    "compression": "zip-store",
    "checksumAlgorithm": "sha256"
  },
  "project": {
    "slug": "hospital-norte",
    "name": "Hospital Norte",
    "currency": "PEN"
  },
  "modules": [
    { "id": "project", "path": "project.json", "required": true },
    { "id": "budgets", "path": "budgets/budget-tree.json", "required": true },
    { "id": "budget_items", "path": "budgets/budget-items.json", "required": true },
    { "id": "apus", "path": "budgets/apus.json", "required": true },
    { "id": "general_expenses", "path": "budgets/general-expenses.json", "required": false },
    { "id": "budget_footer", "path": "budgets/footer.json", "required": false },
    { "id": "polynomial_formula", "path": "polynomial-formula/formula.json", "required": false },
    { "id": "takeoffs", "path": "takeoffs/sheets.json", "required": false },
    { "id": "work_schedule", "path": "schedule/work-schedule.json", "required": false },
    { "id": "risk_analysis", "path": "risk/risk-analysis.json", "required": false }
  ],
  "capabilities": {
    "restoreAsNewProject": true,
    "preview": true,
    "merge": false
  },
  "namespaces": ["core", "mc"],
  "extensions": []
}
```

## File Semantics

## `project.json`

Debe incluir:

- identidad funcional del proyecto
- datos de cliente y ubicacion
- moneda y parametros generales relevantes
- metadatos de origen del snapshot

No debe incluir:

- IDs internos usados solo por Prisma como dependencia dura del importador

## `budgets/budget-tree.json`

Debe describir:

- presupuesto general
- sub presupuestos
- relaciones padre/hijo
- orden
- metadata esencial del arbol

## `budgets/budget-items.json`

Debe describir:

- niveles jerarquicos
- partidas
- orden
- metrado, unidad, precio unitario, parcial
- referencias estables a presupuesto y nivel

## `budgets/apus.json`

Debe describir:

- APU por partida
- rendimiento
- costo unitario
- recursos y subpartidas APU
- referencias estables a partida y recurso

## `budgets/project-resources.json`

Debe incluir el catalogo minimo necesario para que el snapshot sea portable:

- codigo
- descripcion
- unidad
- categoria
- moneda
- precio
- IU cuando aplique

## `budgets/general-expenses.json`

Debe reflejar:

- grupos
- titulos
- items
- subtotales y montos manuales cuando existan

## `budgets/footer.json`

Debe reflejar:

- variables
- formulas
- valores manuales
- IU
- resaltados

## `polynomial-formula/formula.json`

Debe reflejar:

- formula activa o formulas relevantes
- monomios
- coeficientes
- indices base y de reajuste
- componentes

Los coeficientes deben serializarse con 3 decimales exactos.

## `takeoffs/sheets.json`

Debe incluir:

- hojas
- filas
- formulas
- validaciones
- enlaces con partidas cuando existan

## `schedule/work-schedule.json`

Debe incluir:

- lineas del cronograma
- fechas
- duraciones
- predecesores
- distribuciones mensuales persistidas si son parte del modelo

## `risk/risk-analysis.json`

Debe incluir:

- variables
- distribuciones
- correlaciones si existen
- resumenes persistidos
- resultados guardados relevantes

## `attachments/*`

Debe incluir solo archivos necesarios para:

- logo/branding de reportes
- adjuntos visibles del proyecto
- futuras integraciones documentales

No debe incluir archivos temporales o caches de preview.

## Decimal And Precision Rules

Dado que MC Presupuestos exige precision financiera y tecnica:

- montos, cantidades, rendimientos y porcentajes sensibles deben serializarse como `string`
- nunca como `float` ambiguo de JSON
- coeficientes de formula polinomica se exportan con 3 decimales
- porcentajes deben representarse en forma univoca, por ejemplo `0.180000` para 18% si esa es la convencion del dominio

Ejemplo:

```json
{
  "quantity": "125.5000",
  "unitPrice": "89.3600",
  "partial": "11215.6800",
  "coefficient": "0.347"
}
```

El importador debe parsear estos campos con `decimal.js` o utilidades equivalentes del proyecto.

## Identity And References

Para interoperabilidad, el formato no debe depender solo de IDs internos UUID.

Cada entidad exportada debe poder incluir:

- `id`: identificador del snapshot
- `sourceId`: ID interno original cuando sirva para trazabilidad
- `externalKey`: clave estable interoperable cuando aplique
- referencias por `ref`

Ejemplo:

```json
{
  "id": "item-000124",
  "sourceId": "clx123...",
  "externalKey": "BUDGET:ESTRUCTURAS:01.02.003",
  "budgetRef": "budget-estructuras",
  "levelRef": "level-01-02"
}
```

La importacion a MC siempre creara IDs nuevos persistidos; las referencias del paquete se usan para reconstruir relaciones.

## Compatibility Rules

El formato necesita compatibilidad explicita:

- `formatVersion` sigue semver
- cambios compatibles agregan campos o modulos opcionales
- cambios incompatibles elevan `major`
- el importador debe fallar con mensaje claro si el `major` no es soportado

Estados de compatibilidad:

- `supported`
- `supported_with_warnings`
- `unsupported`

## Integrity Rules

V1 debe validar:

- archivo con extension `.mcp`
- contenedor ZIP valido
- presencia de `manifest.json`
- existencia de todos los modulos `required`
- checksums SHA-256 por archivo
- tamano maximo configurable

La carpeta `checksums/sha256.json` debe mapear path -> hash.

## Interoperability Profile

El formato debe distinguir entre:

- `core`
  - campos que todo integrador debe entender
- `mc`
  - campos propios del dominio MC
- `vendor namespaces`
  - extensiones externas sin romper el core

Regla:

- un tercero puede ignorar namespaces desconocidos
- MC no debe rechazar un archivo solo por tener extensiones extra, salvo conflicto estructural o seguridad

## Import Validation Flow

El flujo recomendado del importador es:

1. validar archivo
2. abrir ZIP
3. parsear `manifest.json`
4. validar version
5. verificar checksums
6. parsear modulos requeridos
7. construir preview semantico
8. ejecutar validaciones de negocio
9. devolver preview al frontend
10. importar solo despues de confirmacion del usuario

## Business Validation Rules

Ejemplos minimos:

- debe existir `project.json`
- debe existir al menos un presupuesto
- las referencias entre partidas y APUs deben resolver
- la formula polinomica no puede apuntar a componentes inexistentes
- el cronograma no puede referenciar partidas ausentes
- los decimales invalidos deben cortar importacion en modulos criticos

Warnings validos:

- modulo opcional faltante
- adjunto no importable
- namespace externo no reconocido

Errores fatales:

- manifest invalido
- checksums inconsistentes
- presupuesto sin estructura minima
- referencias rotas en modulos core

## Backend Architecture

La arquitectura recomendada debe apoyarse en las piezas existentes:

- extender `lib/exports/definitions.ts` y `components/exports/export-panel.tsx` para soportar target de proyecto `.mcp`
- agregar una capa nueva `lib/mcp/*` para snapshot, serializacion, empaquetado y validacion
- reutilizar `buildStoredZip` de `lib/exports/centralized.ts` o moverlo a una utilidad compartida
- crear routes `app/api/imports/mcp/analyze/route.ts` y `app/api/imports/mcp/import/route.ts`
- aislar la persistencia en un servicio similar a `lib/s10/import-persistence.ts`

## Recommended Module Layer

La capa nueva `lib/mcp` deberia separarse asi:

- `types.ts`
- `manifest.ts`
- `schema.ts`
- `archive.ts`
- `checksums.ts`
- `export-snapshot.ts`
- `import-preview.ts`
- `import-persistence.ts`
- `serializers/*`
- `validators/*`

Esto mantiene el calculo y la traduccion de datos fuera de la UI y fuera de las routes.

## UI Strategy

V1 puede integrarse en dos surfaces:

- panel de exportacion centralizado para descargar `.mcp`
- nueva pantalla o drawer de importacion `.mcp`, paralela a S10/Delphin

La importacion debe mostrar:

- nombre del archivo
- version del formato
- proyecto detectado
- modulos incluidos
- warnings y errores
- CTA claro para importar como proyecto nuevo

## Entitlements

Recomendacion inicial:

- exportacion `.mcp`: `exports.advanced`
- importacion `.mcp`: feature propia o `imports.advanced` si luego se introduce ese entitlement

Esto debe quedar desacoplado para no atar el formato a una regla comercial dura en el dominio tecnico.

## Error Handling

Mensajes recomendados:

- "El archivo .mcp no contiene un manifest valido."
- "La version 2.x del formato .mcp aun no es compatible con esta instancia."
- "Falta el modulo obligatorio budgets/budget-tree.json."
- "La partida `01.02.003` referencia un APU inexistente."
- "El checksum de `project.json` no coincide con el manifest."

Los errores deben ser accionables y mencionar archivo o modulo.

## Security

Reglas:

- no ejecutar nada embebido en el archivo
- no confiar en nombres de path con traversal
- no sobreescribir archivos locales arbitrarios
- validar MIME y extension, pero confiar en parseo real
- limitar tamano de upload
- ignorar metadata desconocida sensible

## Testing Strategy

Cobertura minima:

- generacion de manifest
- empaquetado ZIP `.mcp`
- checksum generation/validation
- serializacion decimal-safe
- preview de importacion exitosa
- rechazo por manifest invalido
- rechazo por modulo obligatorio faltante
- roundtrip export -> import para proyecto realista
- compatibilidad con snapshots parciales

Adicionalmente:

- fixture `.mcp` estable en tests
- pruebas de regresion sobre formula polinomica, APU y cronograma

## Rollout

Fase recomendada:

1. exportador `.mcp` de proyecto
2. analizador de importacion `.mcp`
3. importacion `restore_as_new_project`
4. adjuntos y modulos opcionales
5. esquema publico para terceros

## Success Criteria

El trabajo esta bien hecho cuando:

- un proyecto completo se puede exportar como un solo `.mcp`
- el archivo es legible, versionado y con checksums
- otro entorno MC puede importarlo como proyecto nuevo
- la precision financiera y de formula polinomica se preserva
- integradores externos pueden leer el core sin depender de Prisma ni de MC internamente

## Open Decisions

- si `ai/project-context.json` entra en V1 o V2
- si adjuntos binarios se incluyen todos o solo logo/documentos clave
- si el exportador se expone via `app/api/exports` o por route especifica de proyecto usando la misma infraestructura
- si `risk/risk-analysis.json` entra completo en V1 o solo resumen persistido
