# Comentarios, integraciones controladas y aprendizaje privado por empresa

## Contexto

La primera etapa de Review Intelligence V1 cubre extracción de metrados, unidades, especificaciones, APU, rendimientos, matching, reglas, métricas de cobertura y revisión humana. El siguiente tramo habilita colaboración operativa, intercambio controlado con formatos existentes y reutilización privada de decisiones confirmadas.

El repositorio ya contiene una base que debe reutilizarse: `CollaborationComment`, `CollaborationPresence`, `CollaborationEditSession`, `BudgetChangeEvent`, `BudgetVersionSnapshot`, historial de revisión, importadores/exportadores existentes y feedback de IA por proyecto/usuario.

## Objetivo

Entregar tres capacidades independientes y desplegables por separado:

1. comentarios y colaboración segura sobre presupuestos, metrados, APU y hallazgos;
2. integraciones import/export con staging, preview, confirmación, idempotencia y rollback;
3. aprendizaje privado por empresa derivado únicamente de vínculos y decisiones confirmadas.

## No objetivos

- entrenamiento de un modelo global con datos de empresas;
- sincronización bidireccional en tiempo real con sistemas externos;
- nuevos conectores externos fuera de los importadores/exportadores existentes;
- edición simultánea tipo CRDT;
- mutación automática del presupuesto por una sugerencia, comentario, integración o ejemplo aprendido;
- publicación de ejemplos privados en métricas globales o en otra empresa.

## Principios y límites globales

- `companyId`, `projectId` y permisos se derivan de la sesión y de la autorización servidor; nunca se confían desde el cuerpo del cliente.
- Todo acceso debe validar pertenencia al workspace/proyecto y permiso sobre el presupuesto.
- Las operaciones mutantes deben ser idempotentes por `requestId` o clave de operación.
- Los cambios presupuestarios conservan precisión Decimal-safe y generan auditoría.
- Las interfaces públicas son TypeScript estricto; no se usa `any`.
- Los datos privados se aíslan siempre por `companyId` y no se envían a proveedores externos sin configuración explícita.
- Todas las acciones humanas que puedan afectar datos requieren confirmación explícita y control de concurrencia optimista.

## Arquitectura

### Módulo A: colaboración

`CollaborationComment` será la fuente de comentarios anclados a entidades `BUDGET`, `BUDGET_ITEM`, `APU`, `METRADO` y `REVIEW_FINDING`. Las respuestas usarán `parentCommentId`; las menciones se validarán contra miembros autorizados.

`CollaborationPresence` y `CollaborationEditSession` continuarán siendo leases con heartbeat y expiración. Una sesión expirada no bloqueará una edición nueva. `BudgetChangeEvent` registrará actor, campo, valores, origen y `requestId`; `BudgetVersionSnapshot` permitirá restauración explícita y auditable.

Las notificaciones internas serán derivadas de eventos idempotentes para menciones, respuestas, resolución/reapertura, conflictos y restauraciones.

### Módulo B: integraciones controladas

Los importadores/exportadores existentes se envolverán mediante adaptadores. Ningún adaptador escribirá directamente en el presupuesto: primero producirá datos de staging y conflictos.

El flujo será:

`DRAFT → STAGED → VALIDATED → PREVIEW_READY → CONFIRMED → APPLIED`

Con salidas `FAILED` o `ROLLED_BACK` desde las etapas aplicables.

Cada sesión conservará compañía, proyecto, presupuesto, usuario, adaptador, versión del contrato, hash del archivo o payload, conteos, conflictos, mapeos, `requestId`, snapshot previo y resultado. La aplicación será idempotente; la confirmación será explícita; el rollback restaurará el snapshot asociado o revertirá únicamente los cambios de la sesión.

La primera versión soportará los flujos existentes de XLSX/CSV y S10. La arquitectura permitirá añadir adaptadores posteriores sin cambiar el flujo de confirmación.

### Módulo C: aprendizaje privado

El aprendizaje privado será recuperación contextual de ejemplos, no entrenamiento global. Un ejemplo nace de un vínculo de evidencia confirmado, un hallazgo resuelto, un mapeo de integración confirmado o una corrección explícita de código, unidad, descripción, especificación o componente APU.

Cada ejemplo tendrá compañía, origen, tipo de señal, entrada normalizada, resultado confirmado, hash, versión de esquema, actor, timestamps, estado de retención y referencia al evento de origen. Solo los ejemplos `ACTIVE` de la misma empresa podrán participar en recuperación. La respuesta mostrará provenance, confianza y ejemplo aplicado; el presupuesto no se modifica automáticamente.

## Contratos principales

### Comentarios

- `GET /api/budgets/:budgetId/collaboration/comments?entityType=&entityId=` lista comentarios y respuestas autorizadas.
- `POST /api/budgets/:budgetId/collaboration/comments` crea un comentario o respuesta después de validar entidad, membresía, límite y menciones.
- `PATCH /api/budgets/:budgetId/collaboration/comments/:commentId` edita dentro de la política de edición y con `expectedUpdatedAt`.
- `POST /api/budgets/:budgetId/collaboration/comments/:commentId/resolve` resuelve o reabre idempotentemente.

### Integraciones

- `POST /api/budgets/:budgetId/integrations/sessions` crea una sesión staging.
- `POST /api/budgets/:budgetId/integrations/sessions/:sessionId/validate` valida y genera conflictos.
- `GET /api/budgets/:budgetId/integrations/sessions/:sessionId/preview` devuelve altas, cambios, conflictos y descartes.
- `POST /api/budgets/:budgetId/integrations/sessions/:sessionId/confirm` aplica solo con token de confirmación y `expectedVersion`.
- `POST /api/budgets/:budgetId/integrations/sessions/:sessionId/rollback` revierte la sesión autorizada.

### Aprendizaje privado

- `GET /api/companies/:companyId/private-learning/examples` lista ejemplos propios con filtros y paginación.
- `POST /api/companies/:companyId/private-learning/examples/:exampleId/revoke` revoca un ejemplo.
- `GET /api/budgets/:budgetId/private-learning/suggestions` recupera sugerencias privadas con provenance.
- La captura de ejemplos se hará desde servicios internos de decisiones confirmadas, no mediante un endpoint cliente que acepte ejemplos arbitrarios.

## Seguridad, privacidad y retención

- Todas las queries privadas incluyen `companyId` y validan la relación compuesta cuando exista.
- Un ejemplo no contendrá secretos, tokens, archivos completos ni datos personales innecesarios.
- Los proveedores externos solo recibirán datos privados si la empresa habilita explícitamente el proveedor y el flujo lo requiere.
- Revocar un ejemplo lo excluye inmediatamente de recuperación; una tarea de retención eliminará datos expirados según la política empresarial.
- Auditoría registrará lecturas sensibles, creación, uso, revocación, integración aplicada y rollback.
- Rate limits y límites de tamaño aplicarán a comentarios, sesiones de integración y recuperación privada.

## Plan de entrega

### Etapa 1 — Colaboración segura

Completar endpoints, permisos, respuestas, menciones, resolución/reapertura, notificaciones, presencia, conflictos, auditoría y pruebas de aislamiento entre empresas/proyectos.

### Etapa 2 — Integraciones controladas

Crear contratos de adaptador, staging, validación, preview, mapeos, snapshots, aplicación idempotente, rollback y pruebas con XLSX/CSV/S10. Añadir métricas de sesiones, conflictos y reversión.

### Etapa 3 — Aprendizaje privado

Crear almacenamiento de ejemplos, normalización, deduplicación por hash, recuperación filtrada por empresa, provenance, revocación, retención y pruebas de no fuga entre empresas.

Cada etapa tendrá migración Prisma, endpoints, UI mínima, pruebas unitarias/API/E2E, documentación operativa y un flag de activación por empresa antes de habilitación general.

## Observabilidad y operación

Se medirán creación/resolución de comentarios, conflictos de edición, sesiones por estado, duración de integraciones, tasa de rollback, ejemplos privados activos/revocados, latencia de recuperación y sugerencias aceptadas/rechazadas. Los logs usarán IDs opacos y nunca cuerpos completos de comentarios, archivos o ejemplos privados.

## Criterios de aceptación

- Un usuario no puede leer, crear, resolver ni aplicar cambios fuera de su empresa/proyecto autorizado.
- Dos ediciones concurrentes no se pisan silenciosamente.
- Una integración inválida nunca modifica el presupuesto.
- Reintentar una confirmación no duplica cambios ni eventos.
- Rollback restaura el estado esperado y queda auditado.
- Un ejemplo confirmado de una empresa nunca aparece en consultas de otra empresa.
- Revocar un ejemplo evita su uso futuro.
- Los comentarios, integraciones y sugerencias privadas no realizan mutaciones presupuestarias automáticas.
- Las migraciones son reversibles operativamente y la documentación cubre activación, monitoreo y rollback.

## Decisiones fijadas para el plan

El plan de implementación deberá elegir los nombres finales de los modelos de sesión/ejemplo, definir las capacidades exactas de cada adaptador existente y fijar la política de retención configurable por empresa. Estas decisiones no cambian los límites de seguridad ni el orden de entrega de esta especificación.
