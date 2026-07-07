# Realtime Collaboration Design

**Fecha:** 2026-07-07

**PRD fuente:** `prd/prd-realtime-collaboration.md`

## Objetivo

Implementar una primera versión de colaboración en tiempo real para MC Presupuestos que permita presencia de usuarios, comentarios contextuales, auditoría de cambios, diff visual y versionado básico sobre presupuestos y sus entidades operativas, sin romper la arquitectura actual ni comprometer la precisión financiera.

## Alcance

Este diseño cubre:

- Presencia en tiempo real dentro del presupuesto activo
- Soft locking informativo por entidad editable
- Comentarios contextuales por presupuesto, partida, APU, insumo y metrado
- Auditoría estructurada de cambios con diff por campo
- Snapshots de versión manuales y automáticos para presupuesto
- Transporte en tiempo real para presencia y eventos de colaboración
- Integración visual inicial en presupuesto, APU, metrados y cronograma

Este diseño no cubre:

- Cursores colaborativos tipo Figma
- Edición offline
- Chat general entre usuarios
- Videollamadas
- Resolución automática de conflictos complejos tipo CRDT
- Edición concurrente avanzada a nivel carácter o celda con merge semántico

## Estado actual

La base actual del producto ya tiene piezas aprovechables:

- Multiempresa por `Company`, `Project`, `Budget` y ownership validado en servicios/route handlers
- `NoteTask` y `NotesDrawer` como antecedente de comentarios contextuales y pendientes operativos
- `ActivityEvent` como antecedente de trazabilidad ligera
- `budget-editor.tsx`, `apu-editor-sheet.tsx`, `MetradosDashboard.tsx` y `work-schedule-page-content.tsx` como superficies primarias de edición
- Prisma + PostgreSQL como sistema de persistencia central
- SSE ya utilizado en IA (`/api/ai/chat/stream`) y patrones de streaming reutilizables

Limitaciones actuales:

- `NoteTask` no soporta hilos, menciones, resolución colaborativa ni tiempo real
- `ActivityEvent` es demasiado resumido para auditoría detallada por campo
- No existe presencia por presupuesto ni sesiones de edición efímeras
- No hay versionado formal de snapshots de presupuesto
- La edición concurrente hoy depende del último guardado y no comunica intención de edición

## Enfoque recomendado

Se recomienda una arquitectura de colaboración en cuatro capas:

1. **Persistencia canónica**
   Nuevos modelos Prisma para comentarios, presencia, sesiones de edición, auditoría detallada y versiones.

2. **Servicios de dominio**
   Un dominio `lib/collaboration` encapsula reglas, autorización por empresa/proyecto/presupuesto, serialización decimal-safe y publicación de eventos.

3. **Transporte realtime**
   V1 debe usar SSE + heartbeat persistido porque ya existe un patrón similar en el repo, no exige agregar una plataforma externa y encaja mejor con el stack actual que introducir Socket.io en toda la app.

4. **Integración de UI**
   Barras de presencia, indicadores de edición, panel de comentarios, historial de cambios y versiones integrados a las vistas actuales sin convertir páginas server en client-heavy sin necesidad.

## Decisión de transporte realtime

El PRD original menciona Supabase Realtime o Socket.io. Para esta implementación se recomienda **SSE sobre route handlers + polling defensivo** por estas razones:

- Ya existe experiencia previa con streaming SSE en la app
- Reduce complejidad operativa frente a Socket.io en App Router
- Evita acoplar la colaboración a un proveedor externo en la primera entrega
- Mantiene a PostgreSQL como fuente de verdad única

La arquitectura debe dejar un adaptador de publicación/suscripción para que una futura migración a Supabase Realtime o WebSockets no rompa contratos del dominio.

## Modelo de datos propuesto

### 1. Presencia efímera

Agregar una tabla `CollaborationPresence`:

- `id`
- `companyId`
- `projectId`
- `budgetId`
- `userId`
- `route`
- `module`
- `status` (`ACTIVE`, `IDLE`)
- `lastSeenAt`
- `expiresAt`

Uso:

- Se refresca con heartbeat cada 15 segundos mientras la vista siga abierta
- Un usuario se considera conectado si `expiresAt > now()`
- No almacena historial; solo estado operativo actual

### 2. Sesión de edición

Agregar `CollaborationEditSession`:

- `id`
- `companyId`
- `projectId`
- `budgetId`
- `userId`
- `entityType`
- `entityId`
- `field`
- `startedAt`
- `lastHeartbeatAt`
- `expiresAt`

Uso:

- Inicia cuando el usuario entra a editar una fila/celda/campo relevante
- Expira automáticamente si no hay heartbeat
- No bloquea escritura; solo informa "Ana está editando esta partida"

### 3. Comentarios colaborativos

Agregar `CollaborationComment`:

- `id`
- `companyId`
- `projectId`
- `budgetId`
- `entityType`
- `entityId`
- `parentCommentId`
- `body`
- `mentions`
- `createdById`
- `resolvedAt`
- `resolvedById`
- `createdAt`
- `updatedAt`

Decisiones:

- `mentions` se guarda como arreglo de user ids ya resueltos, no solo texto crudo
- `body` conserva el texto original
- `parentCommentId` permite hilos simples de una profundidad razonable
- Resolver un comentario no borra respuestas ni historial

### 4. Auditoría estructurada

Agregar `BudgetChangeEvent`:

- `id`
- `companyId`
- `projectId`
- `budgetId`
- `entityType`
- `entityId`
- `action`
- `field`
- `oldValue`
- `newValue`
- `diffSummary`
- `source` (`USER`, `SYSTEM`, `KHIPU`)
- `userId`
- `requestId`
- `createdAt`

Regla crítica:

- Todos los valores monetarios o cantidades sensibles deben serializarse como strings normalizados para no perder precisión decimal en JSON.

### 5. Versiones del presupuesto

Agregar `BudgetVersionSnapshot`:

- `id`
- `budgetId`
- `projectId`
- `companyId`
- `versionNumber`
- `label`
- `reason`
- `snapshot`
- `createdById`
- `createdAt`

Decisiones:

- `snapshot` debe representar el presupuesto completo necesario para restauración funcional
- Restaurar genera una nueva versión; nunca reescribe una versión histórica
- Los snapshots automáticos se limitan a eventos de alto impacto para evitar crecimiento explosivo

## Entidades soportadas en V1

V1 debe soportar comentarios, presencia contextual y auditoría para:

- `budget`
- `budget_item`
- `apu`
- `apu_resource`
- `metrado_sheet`
- `metrado_row`
- `work_schedule_item`

No se recomienda arrancar con todas las superficies al mismo tiempo a nivel UI. La primera ola debe priorizar:

1. presupuesto
2. APU
3. metrados
4. cronograma

## Servicios de dominio propuestos

Crear un dominio `lib/collaboration` con módulos separados:

- `authorization.ts` para validar acceso por empresa/proyecto/presupuesto
- `presence.ts` para heartbeat, listado de usuarios activos y expiración
- `edit-sessions.ts` para soft locks
- `comments.ts` para CRUD, hilos y resolución
- `audit.ts` para registrar eventos por campo
- `versions.ts` para crear/listar/restaurar snapshots
- `events.ts` para publicación SSE y fan-out local
- `serializers.ts` para convertir `Decimal` a strings seguros en auditoría y snapshots

Esto evita mezclar reglas colaborativas con componentes UI o handlers de presupuesto existentes.

## Integración con el flujo de guardado actual

La colaboración no debe crear un segundo canal de escritura paralelo al dominio real.

Regla:

- Las escrituras siguen ocurriendo en los route handlers y servicios actuales de presupuesto/APU/metrados
- Después de una mutación exitosa, el mismo flujo registra auditoría y publica un evento realtime
- Si la auditoría falla, la mutación principal no debe quedar corrupta; pero sí debe registrar warning y métricas de error

## API propuesta

### Presencia

- `POST /api/budgets/[id]/collaboration/presence`
- `DELETE /api/budgets/[id]/collaboration/presence`
- `GET /api/budgets/[id]/collaboration/presence`

### Sesiones de edición

- `POST /api/budgets/[id]/collaboration/edit-sessions`
- `PATCH /api/budgets/[id]/collaboration/edit-sessions/[sessionId]`
- `DELETE /api/budgets/[id]/collaboration/edit-sessions/[sessionId]`

### Comentarios

- `GET /api/budgets/[id]/collaboration/comments`
- `POST /api/budgets/[id]/collaboration/comments`
- `PATCH /api/budgets/[id]/collaboration/comments/[commentId]`

### Auditoría

- `GET /api/budgets/[id]/collaboration/history`

### Versiones

- `GET /api/budgets/[id]/collaboration/versions`
- `POST /api/budgets/[id]/collaboration/versions`
- `POST /api/budgets/[id]/collaboration/versions/[versionId]/restore`

### Stream realtime

- `GET /api/budgets/[id]/collaboration/stream`

El stream emite eventos:

- `presence.updated`
- `edit-session.started`
- `edit-session.heartbeat`
- `edit-session.finished`
- `comment.created`
- `comment.updated`
- `change.created`
- `version.created`
- `version.restored`

## Payloads y contratos

Todos los contratos deben ser tipados y validados con Zod.

Ejemplos mínimos:

- `CollaborationEntityRef`
- `CollaborationPresenceRecord`
- `CollaborationEditSessionRecord`
- `CollaborationCommentRecord`
- `BudgetChangeRecord`
- `BudgetVersionRecord`
- `CollaborationStreamEvent`

Los payloads deben usar nombres estables y no depender de labels visibles de UI.

## UX propuesta

### 1. Barra de presencia en presupuesto

Agregar un bloque compacto en el header del presupuesto:

- avatares o iniciales
- estado activo/ausente
- tooltip con nombre y entidad actual

Debe sentirse cercano a Linear/Notion, no a un panel de chat.

### 2. Indicador de edición

Sobre la fila o panel activo:

- "Ana está editando esta partida"
- estado visual sutil
- no impedir guardar

Si dos usuarios intentan editar el mismo campo:

- mostrar advertencia contextual
- conservar la escritura permitida
- dejar trazabilidad del último cambio

### 3. Comentarios contextuales

Reutilizar patrones del `NotesDrawer`, pero sin acoplar V1 a `NoteTask`.

UI sugerida:

- `CommentsSheet` lateral o `Sheet` contextual
- agrupación por entidad activa
- creación, respuesta, resolver, reabrir
- contador visible por partida o panel

### 4. Historial de cambios

Agregar un panel lateral o modal con:

- actor
- timestamp
- entidad
- campo
- antes/después
- origen del cambio

Debe poder mostrar diffs simples sin requerir salir del presupuesto.

### 5. Versiones

Agregar una sección de versiones en el presupuesto:

- guardar versión manual
- ver historial
- restaurar con confirmación fuerte

Las restauraciones deben explicar que crean una nueva versión y no borran el historial.

## Integración con notas y actividad existentes

### Notas

`NoteTask` no debe eliminarse. Debe mantenerse para pendientes personales/operativos del usuario.

`CollaborationComment` será un sistema distinto para discusión compartida y resolución entre miembros del equipo.

### ActivityEvent

`ActivityEvent` puede seguir existiendo como resumen liviano para dashboard.

Los eventos de colaboración relevantes pueden opcionalmente proyectarse a `ActivityEvent` con títulos compactos como:

- `Comentario resuelto en presupuesto`
- `Version de presupuesto guardada`
- `Cambio relevante en partida`

Pero la fuente real de auditoría debe ser `BudgetChangeEvent`.

## Integración con Khipu

V1 solo necesita integración limitada:

- permitir que Khipu aparezca como `source = KHIPU` en auditoría cuando una sugerencia aplicada modifique datos
- permitir comentarios tipo sugerencia técnica generada por IA en una segunda ola controlada

No se recomienda mezclar la primera entrega de colaboración con automatizaciones pesadas de IA.

## Seguridad y aislamiento

Toda consulta y mutación de colaboración debe validar:

- sesión autenticada
- pertenencia del usuario a la empresa dueña del proyecto/presupuesto
- relación consistente entre `budgetId`, `projectId` y `companyId`

Ningún endpoint debe aceptar `companyId` como fuente de verdad desde cliente.

La cadena confiable debe resolverse desde el presupuesto/proyecto real en base de datos.

## Performance

Objetivos operativos V1:

- presencia visible en menos de 2 segundos
- reflejo de cambios colaborativos en menos de 1 segundo en red local razonable
- apertura de comentarios e historial en menos de 500 ms con paginación
- soporte inicial para 20 a 50 usuarios concurrentes por presupuesto sin degradación severa

Medidas:

- paginación en historial y comentarios
- snapshots solo en eventos clave
- expiración agresiva de presencia y edit sessions
- eventos SSE compactos, con payload resumido y refresco bajo demanda del detalle

## Riesgos

### Riesgo 1: crecimiento excesivo de snapshots

Mitigación:

- snapshots automáticos solo en importación, restauración, cambios masivos y publicación
- límite configurable y archivado futuro

### Riesgo 2: pérdida de precisión en auditoría

Mitigación:

- serializar `Decimal` a string
- agregar tests específicos para cantidades, precios, parciales, IGV y totales

### Riesgo 3: ruido visual en el editor

Mitigación:

- indicadores sutiles
- prioridad a header, sheet lateral y avisos inline pequeños
- no introducir overlays pesados ni cursores en V1

### Riesgo 4: transporte realtime frágil

Mitigación:

- SSE con reconexión cliente
- polling defensivo para comentarios/presencia si el stream cae
- abstracción del broker en `lib/collaboration/events.ts`

## Rollout recomendado

### Fase 1

- esquema Prisma
- servicios de comentarios
- auditoría de cambios
- snapshots manuales
- historial básico sin realtime

### Fase 2

- presencia
- sesiones de edición
- stream SSE por presupuesto
- actualización visual en presupuesto

### Fase 3

- integración en APU, metrados y cronograma
- menciones
- snapshots automáticos
- proyección resumida a dashboard/activity

## Decisiones tomadas

- V1 usará SSE + polling defensivo, no Socket.io
- `NoteTask` se mantiene como sistema separado de pendientes personales
- La auditoría usará un modelo nuevo orientado a diff, no `ActivityEvent`
- Los soft locks serán informativos, no restrictivos
- La restauración de versiones siempre crea una nueva versión
- La primera superficie prioritaria será el presupuesto

## Resultado esperado

El usuario podrá trabajar en un mismo presupuesto con otros miembros de su empresa viendo presencia activa, contexto de edición, comentarios técnicos compartidos, cambios auditables y versiones restaurables, todo sin sacrificar la trazabilidad ni la precisión financiera que exige MC Presupuestos.
