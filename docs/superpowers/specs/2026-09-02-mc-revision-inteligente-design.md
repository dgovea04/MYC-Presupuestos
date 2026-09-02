# MC Revisión Inteligente V0 — Diseño

**Fecha:** 2026-09-02  
**Estado:** Aprobado en conversación para planificación  
**Producto:** MC Presupuestos

## Objetivo

Entregar un vertical slice persistido que permita cargar documentos PDF/XLSX asociados a un proyecto, extraer evidencia disponible, relacionarla con partidas de un presupuesto, ejecutar cinco verificaciones determinísticas y registrar decisiones humanas sin modificar automáticamente el presupuesto.

## Alcance de esta entrega

Incluye:

- dominio Prisma versionado para documentos, evidencias, vínculos, ejecuciones, hallazgos y decisiones;
- servicios de dominio separados para documentos, extracción, matching, validación, revisión y jobs;
- extracción mediante adaptadores: XLSX con el patrón existente de ExcelJS y PDF reutilizando utilidades compatibles de `lib/pdf-import`;
- runner local reanudable con etapas y checkpoints persistidos;
- cinco tipos de hallazgo del PRD: diferencia de metrado, unidad potencialmente inconsistente, especificación técnica potencialmente incompatible, partida sin documentación con confianza suficiente y APU potencialmente incompleto;
- APIs protegidas, paginadas y aisladas por empresa/proyecto;
- interfaz dentro del contexto del presupuesto: documentos, configuración, progreso, resumen, bandeja y detalle de evidencia;
- decisiones humanas auditables y control de concurrencia;
- contratos preparados para consultas contextuales de Khipu sobre resultados persistidos.

No incluye en esta entrega OCR productivo, almacenamiento externo, workers distribuidos, interpretación de planos, exportación de reportes ni mutaciones automáticas del presupuesto.

## Principios y guardrails

1. Todo hallazgo publicado debe tener evidencia primaria accesible.
2. `humanReviewRequired` es verdadero para todos los hallazgos.
3. `automaticBudgetMutation` es falso sin excepción.
4. IA puede interpretar o explicar; código determinístico calcula y prioriza.
5. Los valores financieros usan `Decimal`; no se usan operaciones binarias para importes.
6. La ausencia de vínculo se expresa como falta de cobertura detectable, nunca como inexistencia documental.
7. Las entradas de documentos se tratan como datos no confiables; no ejecutan instrucciones, macros, scripts ni enlaces activos.
8. Empresa, proyecto, usuario y permisos se resuelven en servidor.
9. Versiones, reglas, configuración, fuentes y decisiones históricas son inmutables o auditables.

## Arquitectura

```text
PDF/XLSX
  -> DocumentService / DocumentVersion
  -> ExtractionAdapter
  -> EvidenceService / Evidence
  -> MatchingEngine / EntityLink
  -> DeterministicValidationEngine
  -> ReviewEngine / Finding
  -> ReviewQueue UI
  -> FindingDecision + ReviewAuditEvent
```

Los servicios se diseñan con interfaces pequeñas y dependencias inyectables. El orquestador local implementa la misma interfaz que usará un worker futuro, de modo que el API no conozca detalles del procesamiento. Cada etapa registra estado, advertencias, conteo y correlación.

## Modelo de datos

Se añadirán modelos relacionados con `Project` y `Budget`:

- `ProjectDocument`: identidad lógica, tenant, categoría, estado y versión actual.
- `DocumentVersion`: archivo/versionado, hash SHA-256, metadatos de páginas/hojas y estado de extracción.
- `ReviewEvidence`: contenido original/normalizado, ubicación, valor/unidad, método, confianza y hash de fuente.
- `EntityLink`: relación entre `BudgetItem` y evidencia, señales, score, confianza y validación humana.
- `ReviewRun`: presupuesto y versiones analizadas, configuración, versión de reglas, progreso, estado y advertencias.
- `ReviewFinding`: tipo, partida, evidencia, comparación estructurada, severidad, prioridad, score, impacto y regla.
- `FindingDecision`: evento inmutable de resolución humana.
- `ReviewAuditEvent`: cambios de ciclo de vida y correlación técnica.

Los estados y tipos seguirán los valores del PRD. Las configuraciones y comparaciones JSON tendrán esquemas Zod explícitos. Se crearán índices por tenant, proyecto, presupuesto, ejecución, estado y fecha.

## Procesamiento

1. La carga valida extensión, MIME, tamaño y límites de la ejecución.
2. Cada reemplazo crea una nueva `DocumentVersion`; las versiones usadas por ejecuciones históricas se conservan.
3. La extracción produce registros normalizados y evidencias; nunca crea hallazgos directamente.
4. El matching combina código, descripción, unidad, disciplina, atributos técnicos, jerarquía y proximidad tabular. La confianza baja sólo ofrece candidatos.
5. El motor determinístico normaliza unidades seguras (`m²`, `M2`, `m2`), aplica tolerancias configurables y calcula diferencia, porcentaje e impacto con `Decimal`.
6. El motor de revisión genera sólo hallazgos con evidencia primaria y vínculo con confianza suficiente, salvo el caso de cobertura insuficiente que debe conservar advertencias de procesamiento.
7. La prioridad usa factores versionados de evidencia, vínculo, severidad técnica e impacto; nunca depende libremente del texto de IA.
8. Reintentos son idempotentes por hash/versiones/configuración/reglas y no duplican evidencias ni hallazgos.

## API

Las rutas seguirán los patrones existentes de `app/api` y las sesiones actuales:

- `POST/GET /api/projects/:projectId/review-documents`
- `PATCH /api/review-documents/:documentId/classification`
- `POST /api/budgets/:budgetId/review-runs`
- `GET /api/review-runs/:reviewRunId`
- `POST /api/review-runs/:reviewRunId/cancel`
- `GET /api/review-runs/:reviewRunId/findings`
- `GET /api/review-findings/:findingId`
- `POST /api/review-findings/:findingId/decisions`
- `POST /api/review-links/:linkId/validate`
- `GET /api/review-evidence/:evidenceId/view`

Los nombres finales pueden ajustarse a las convenciones existentes, pero los contratos deberán conservar estas responsabilidades. Las listas serán paginadas; los filtros se validarán con Zod; las respuestas no expondrán secretos ni URLs permanentes.

## Interfaz

La navegación se ubicará dentro del presupuesto. La pantalla comprende:

- estado vacío con formatos, límites y revisión humana;
- gestor de documentos con categoría, versión, estado y advertencias;
- configuración de presupuesto, fuentes, tipos de hallazgo y tolerancia;
- progreso por etapas persistidas;
- dashboard de cobertura y elementos que requieren revisión;
- bandeja con filtros por tipo, prioridad, confianza, estado y documento;
- detalle de dos paneles: datos MC, evidencia, comparación, fórmula, confianza, impacto, historial y acciones.

La comparación se apila en móvil. Los colores no serán la única señal de severidad y todas las acciones tendrán etiquetas accesibles. “Corregir” abrirá el flujo normal del editor y no actualizará el presupuesto desde el hallazgo.

## Errores y estados

Los estados de documentos y ejecuciones siguen el PRD. Los fallos parciales generan `COMPLETED_WITH_WARNINGS`, enumeran páginas/hojas afectadas y deshabilitan conclusiones de ausencia en áreas no cubiertas. Cambios posteriores en partida, APU, documento, regla o tolerancia marcan la ejecución como `STALE`; sus resultados permanecen disponibles.

Resolver un hallazgo requiere usuario, timestamp y versión esperada. Si la ejecución está obsoleta o la versión no coincide, la API rechaza la decisión y exige reconfirmación. Las decisiones previas nunca se sobrescriben.

## Khipu

Khipu podrá consultar resumen, listar hallazgos, obtener detalle/evidencia, buscar evidencia y calcular el impacto ya definido. Cada herramienta validará tenant, proyecto, usuario y permisos. Khipu no tendrá acceso directo a Prisma, no escribirá presupuesto y no cerrará hallazgos sin una acción explícita del usuario.

## Pruebas y verificación

Se seguirá TDD para cada servicio nuevo: prueba fallida, ejecución RED, implementación mínima, ejecución GREEN y refactor conservando verde. La cobertura mínima incluye unidades/decimales, matching, cinco reglas, scoring, estados, obsolescencia, idempotencia, permisos y decisiones. También se agregarán pruebas de rutas y componentes para el flujo principal.

La verificación final ejecutará `npm run test`, `npm run typecheck`, `npm run lint` y `npm run build`, además de revisar el diff y el aislamiento tenant en pruebas dedicadas.

## Criterios de aceptación

- Un usuario autorizado carga PDF/XLSX válidos y ve estado/versiones/advertencias.
- Una ejecución conserva presupuesto, documentos, configuración y reglas exactos.
- El flujo genera los cinco tipos aprobados con evidencia accesible.
- Las diferencias, porcentajes, impactos y prioridades son reproducibles por código.
- La bandeja permite filtrar, ordenar y resolver con auditoría.
- No se modifica automáticamente ningún presupuesto.
- Un usuario no puede consultar datos de otra empresa.
- Los cambios posteriores marcan la ejecución obsoleta.
- Los resultados persistidos siguen consultables sin proveedor de IA.
