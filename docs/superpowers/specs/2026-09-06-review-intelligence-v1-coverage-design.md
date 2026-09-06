# Revisión Inteligente V1 — Cobertura ampliada de metrados, especificaciones y APU

## Contexto

El V0 compara partidas persistidas de un presupuesto con evidencia extraída de PDF, XLSX y CSV. Ya persiste `ReviewEvidence`, `EntityLink`, `ReviewFinding`, decisiones humanas, provenance y cobertura de extracción. El primer vertical de V1 debe mejorar la calidad y granularidad de la evidencia para metrados, especificaciones técnicas y componentes APU sin romper los contratos V0 ni modificar presupuestos automáticamente.

## Objetivo

Ampliar la cobertura verificable de metrados, especificaciones y APU desde la extracción hasta el dashboard de revisión, con señales normalizadas, matching explicable, reglas deterministas y métricas de cobertura por categoría.

## No objetivos

- Interpretar planos PDF o entidades BIM; queda para V2/V3.
- Ejecutar fórmulas, macros, enlaces o scripts de documentos.
- Mutar `BudgetItem`, APU o recursos automáticamente.
- Entrenar modelos globales o aplicar aprendizaje privado; queda para el quinto vertical de V1.
- Crear un almacenamiento paralelo de evidencia.

## Diseño funcional

### Modelo de evidencia

Se conservan los tipos de evidencia V0 y se agregan categorías explícitas sólo si el esquema actual no permite representarlas sin ambigüedad. La categoría se determina con prioridad `QUANTITY`/`METRADO`, `TECHNICAL_SPECIFICATION`, `APU_COMPONENT`, `UNIT` y `OTHER`, sin perder la metadata completa de la fila o línea.

Cada ítem normalizado puede contener:

- `code`, `description`, `discipline`, `section` y `hierarchy`;
- `quantity`, `unit` y `yield` como valores decimales textuales, nunca números flotantes para cálculo;
- `technicalSpecification` y atributos normalizados;
- componentes APU con nombre, tipo, unidad, cantidad y rendimiento cuando la fuente lo permita;
- provenance verificable (`page`, `sheet`, `range`, fila/columna y hash de origen);
- método y confianza de extracción.

La compatibilidad con evidencia V0 se mantiene mediante aliases de campos al leer `metadataJson` (`spec`, `technicalSpec`, `technicalSpecification`, `apuComponents`).

### Extracción

Se crea un normalizador compartido para PDF/XLSX/CSV. Los extractores existentes siguen siendo responsables de obtener texto/celdas y ubicación; el normalizador transforma encabezados, unidades, números y etiquetas técnicas a un contrato común.

Para XLSX/CSV se reconocen encabezados alternativos para código, partida, descripción, cantidad/metrado, unidad, especificación, disciplina, rendimiento, recurso/componente, tipo y cantidad de componente. Para PDF se amplían patrones delimitados para especificación, rendimiento y componentes sin depender de OCR adicional.

Las fórmulas se almacenan como texto `[FORMULA:...]`, no se evalúan. Las filas sin suficientes señales se conservan como evidencia `OTHER` sólo si tienen provenance y contenido no vacío; no habilitan reglas específicas.

### Matching

El score existente se conserva y se incorporan señales opcionales, cada una explicada en `signalsJson`:

- especificación compatible;
- componentes APU compatibles;
- rendimiento compatible;
- sección/jerarquía compatible;
- alias de unidad normalizado.

Un conflicto explícito de código mantiene el vínculo como no elegible para hallazgos, aunque la descripción coincida. Un vínculo de confianza baja no habilita reglas. Los umbrales siguen siendo configurables y validados.

### Reglas

Se agregan reglas deterministas y opt-in mediante `findingTypes` para:

- diferencia de rendimiento entre presupuesto/evidencia;
- componente APU faltante o no compatible;
- especificación técnica faltante, incompatible o incompleta;
- metrado sin unidad compatible o con cobertura insuficiente.

Cada hallazgo incluye `ruleKey`, `comparisonJson`, evidencia/provenance y `humanReviewRequired=true`. Los cálculos usan `decimal.js`, con tolerancias explícitas y sin redondear antes de comparar.

### Cobertura y UI

El progreso de la corrida expone conteos por categoría: partidas analizadas, metrados, unidades, especificaciones, componentes APU, rendimientos, vínculos elegibles y fuentes parcialmente cubiertas. El dashboard muestra estos conteos y advertencias sin ocultar la métrica V0 de cobertura general.

El detalle de hallazgo conserva la vista existente y muestra los campos enriquecidos sólo cuando existen, incluyendo provenance y explicación de matching. No se crea un flujo de edición automática.

## Flujo de datos

```text
documento/version
  -> extractor existente (texto/celdas + provenance)
  -> normalizador común
  -> ReviewEvidence deduplicada
  -> matching con señales V0 + V1
  -> reglas V0 + V1
  -> hallazgos auditables + métricas de cobertura
  -> dashboard/detalle
```

La persistencia sigue siendo tenant-aware por `companyId` y `projectId`. Los reintentos y reprocesamientos selectivos deben seguir siendo idempotentes y no duplicar evidencia.

## Persistencia y migraciones

Primero se inspeccionará si los campos existentes (`metadataJson`, `value`, `unit`, `signalsJson`, `comparisonJson`) cubren el contrato. Sólo se agregará una migración si un dato necesario no puede persistirse de forma auditable con esos campos. Cualquier campo nuevo tendrá índice únicamente si una consulta real del dashboard o pipeline lo requiere.

## Errores y seguridad

- Datos numéricos inválidos generan advertencia de extracción, no valores inventados.
- Provenance incompleta impide publicar evidencia primaria para una regla.
- Cada consulta y mutación verifica empresa, proyecto, presupuesto y permisos existentes.
- No se ejecuta contenido activo de XLSX ni se accede a URLs de documentos.
- Una corrida `STALE` conserva resultados, pero no permite resolver hallazgos sin la confirmación exigida por V0.

## Pruebas y aceptación

La implementación se acepta cuando:

1. Los extractores reconocen al menos un fixture de metrado, uno de especificación y uno de APU en XLSX y PDF, con ubicación verificable.
2. Las unidades, cantidades, rendimientos y tolerancias se comparan con `Decimal` y pruebas de borde.
3. El matching explica las señales nuevas, rechaza conflictos de código y conserva los umbrales V0.
4. Las reglas nuevas producen hallazgos persistibles con evidencia y nunca mutan presupuesto.
5. El pipeline expone métricas de cobertura por categoría y el dashboard las renderiza.
6. Las pruebas existentes de revisión, exportación, cancelación, stale y decisiones siguen pasando.
7. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run prisma:generate`, `node ./node_modules/prisma/build/index.js validate` y `git diff --check` terminan correctamente.

## Decisiones abiertas resueltas

- Se reutiliza `ReviewEvidence`; no se crea una tabla paralela.
- La cobertura ampliada se implementa como primer vertical independiente; comentarios, integraciones y aprendizaje privado quedan fuera de este cambio.
- La UI muestra sugerencias y hallazgos, pero toda modificación del presupuesto sigue requiriendo una acción humana explícita.
