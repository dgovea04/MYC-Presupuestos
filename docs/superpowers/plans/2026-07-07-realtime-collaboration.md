# Realtime Collaboration Implementation Plan

**Goal:** Implementar la V1 de colaboración en tiempo real para presupuestos en MC Presupuestos con comentarios contextuales, auditoría de cambios, presencia, soft locking y versiones restaurables.

**Spec:** `docs/superpowers/specs/2026-07-07-realtime-collaboration-design.md`

**PRD:** `prd/prd-realtime-collaboration.md`

**Architecture:** Crear un dominio `lib/collaboration` respaldado por Prisma/PostgreSQL, exponer APIs tipadas por presupuesto para comentarios/presencia/historial/versiones y conectar la UI del presupuesto a un stream SSE con fallback de refresco. Mantener las escrituras en los servicios actuales y colgar auditoría/publicación de eventos después de mutaciones exitosas.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Prisma, PostgreSQL, Zod, Vitest, Tailwind, componentes UI existentes

---

## File Structure

**Create**

- `lib/collaboration/types.ts`
- `lib/collaboration/serializers.ts`
- `lib/collaboration/authorization.ts`
- `lib/collaboration/comments.ts`
- `lib/collaboration/presence.ts`
- `lib/collaboration/edit-sessions.ts`
- `lib/collaboration/audit.ts`
- `lib/collaboration/versions.ts`
- `lib/collaboration/events.ts`
- `lib/validations/collaboration.ts`
- `types/collaboration.ts`
- `app/api/budgets/[id]/collaboration/comments/route.ts`
- `app/api/budgets/[id]/collaboration/comments/[commentId]/route.ts`
- `app/api/budgets/[id]/collaboration/presence/route.ts`
- `app/api/budgets/[id]/collaboration/edit-sessions/route.ts`
- `app/api/budgets/[id]/collaboration/edit-sessions/[sessionId]/route.ts`
- `app/api/budgets/[id]/collaboration/history/route.ts`
- `app/api/budgets/[id]/collaboration/versions/route.ts`
- `app/api/budgets/[id]/collaboration/versions/[versionId]/restore/route.ts`
- `app/api/budgets/[id]/collaboration/stream/route.ts`
- `components/budget/budget-collaboration-bar.tsx`
- `components/budget/budget-comments-sheet.tsx`
- `components/budget/budget-change-history-sheet.tsx`
- `components/budget/budget-version-history-sheet.tsx`
- `hooks/use-budget-collaboration-stream.ts`
- `hooks/use-budget-presence-heartbeat.ts`
- `hooks/use-edit-session.ts`
- `lib/collaboration/comments.test.ts`
- `lib/collaboration/presence.test.ts`
- `lib/collaboration/audit.test.ts`
- `lib/collaboration/versions.test.ts`
- `lib/validations/collaboration.test.ts`
- `app/api/budgets/[id]/collaboration/comments/route.test.ts`
- `app/api/budgets/[id]/collaboration/presence/route.test.ts`
- `app/api/budgets/[id]/collaboration/history/route.test.ts`
- `app/api/budgets/[id]/collaboration/versions/route.test.ts`
- `components/budget/budget-collaboration-bar.test.tsx`
- `components/budget/budget-comments-sheet.test.tsx`

**Modify**

- `prisma/schema.prisma`
- `lib/data/budgets.ts`
- `lib/data/notes.ts`
- `lib/data/activity-events.ts`
- `components/budget/budget-editor.tsx`
- `components/apu/apu-editor-sheet.tsx`
- `components/metrados/MetradosDashboard.tsx`
- `components/budget/work-schedule-page-content.tsx`
- `app/budgets/[id]/page.tsx`
- `components/projects/project-activity-history.tsx`

---

## Task 1: Definir esquema Prisma y contratos tipados

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `types/collaboration.ts`
- Create: `lib/collaboration/types.ts`
- Create: `lib/collaboration/serializers.ts`
- Create: `lib/validations/collaboration.ts`
- Create: `lib/validations/collaboration.test.ts`

- [ ] **Step 1: Agregar tests de validación y serialización**

Cubrir:

- comentarios con `entityType`, `entityId` y `parentCommentId`
- sesiones de edición con expiración
- presencia con estados `ACTIVE` e `IDLE`
- cambio auditado con valores decimales serializados como string
- versión con `label` y `reason` opcionales pero saneados

- [ ] **Step 2: Extender Prisma con modelos de colaboración**

Agregar modelos:

- `CollaborationPresence`
- `CollaborationEditSession`
- `CollaborationComment`
- `BudgetChangeEvent`
- `BudgetVersionSnapshot`

Agregar enums:

- `CollaborationEntityType`
- `CollaborationPresenceStatus`
- `CollaborationChangeSource`

Crear índices por:

- `budgetId`
- `projectId`
- `companyId`
- `expiresAt`
- `createdAt desc`

- [ ] **Step 3: Crear contratos canónicos**

Definir tipos compartidos para:

- referencias de entidad
- comentarios
- presencia
- sesiones de edición
- cambios auditados
- versiones
- eventos de stream

- [ ] **Step 4: Implementar serialización decimal-safe**

Crear helpers para:

- convertir `Prisma.Decimal` a string
- convertir objetos anidados sin perder precisión
- generar diffs antes/después seguros para auditoría

- [ ] **Step 5: Ejecutar validaciones iniciales**

Run: `npm run test -- lib/validations/collaboration.test.ts`

Expected:

- PASS con contratos tipados y serialización segura

---

## Task 2: Implementar servicios de dominio para comentarios, presencia, auditoría y versiones

**Files:**

- Create: `lib/collaboration/authorization.ts`
- Create: `lib/collaboration/comments.ts`
- Create: `lib/collaboration/presence.ts`
- Create: `lib/collaboration/edit-sessions.ts`
- Create: `lib/collaboration/audit.ts`
- Create: `lib/collaboration/versions.ts`
- Create: `lib/collaboration/comments.test.ts`
- Create: `lib/collaboration/presence.test.ts`
- Create: `lib/collaboration/audit.test.ts`
- Create: `lib/collaboration/versions.test.ts`
- Modify: `lib/data/budgets.ts`

- [ ] **Step 1: Escribir tests de servicios con ownership y aislamiento**

Cubrir:

- un usuario de otra empresa no puede leer ni escribir comentarios
- presencia solo devuelve usuarios del presupuesto activo
- auditoría registra `oldValue` y `newValue` con strings precisos
- restaurar una versión crea una nueva versión y no borra historial

- [ ] **Step 2: Implementar autorización por presupuesto**

Crear helper reutilizable que:

- reciba `budgetId` y `userId`
- resuelva `projectId` y `companyId`
- falle si el usuario no pertenece a la empresa correcta

Ese helper debe ser la puerta obligatoria para todos los endpoints de colaboración.

- [ ] **Step 3: Implementar comentarios**

Servicios mínimos:

- `listCommentsForEntity`
- `createComment`
- `replyToComment`
- `resolveComment`
- `reopenComment`

Reglas:

- comentarios siempre asociados a `budgetId`
- soporte de hilos simples
- `mentions` resueltas a user ids

- [ ] **Step 4: Implementar presencia y soft locking**

Servicios mínimos:

- `upsertPresenceHeartbeat`
- `removePresence`
- `listActivePresence`
- `startEditSession`
- `heartbeatEditSession`
- `finishEditSession`
- `expireStaleSessions`

- [ ] **Step 5: Implementar auditoría y snapshots**

Servicios mínimos:

- `recordBudgetChangeEvent`
- `listBudgetChangeEvents`
- `createBudgetVersionSnapshot`
- `listBudgetVersionSnapshots`
- `restoreBudgetVersionSnapshot`

La restauración debe reutilizar la composición de presupuesto existente, no reescribir SQL a mano.

- [ ] **Step 6: Ejecutar tests del dominio**

Run: `npm run test -- lib/collaboration/comments.test.ts lib/collaboration/presence.test.ts lib/collaboration/audit.test.ts lib/collaboration/versions.test.ts`

Expected:

- PASS con reglas de negocio y aislamiento multiempresa

---

## Task 3: Exponer APIs REST y stream SSE por presupuesto

**Files:**

- Create: `app/api/budgets/[id]/collaboration/comments/route.ts`
- Create: `app/api/budgets/[id]/collaboration/comments/[commentId]/route.ts`
- Create: `app/api/budgets/[id]/collaboration/presence/route.ts`
- Create: `app/api/budgets/[id]/collaboration/edit-sessions/route.ts`
- Create: `app/api/budgets/[id]/collaboration/edit-sessions/[sessionId]/route.ts`
- Create: `app/api/budgets/[id]/collaboration/history/route.ts`
- Create: `app/api/budgets/[id]/collaboration/versions/route.ts`
- Create: `app/api/budgets/[id]/collaboration/versions/[versionId]/restore/route.ts`
- Create: `app/api/budgets/[id]/collaboration/stream/route.ts`
- Create: `lib/collaboration/events.ts`
- Create: `app/api/budgets/[id]/collaboration/comments/route.test.ts`
- Create: `app/api/budgets/[id]/collaboration/presence/route.test.ts`
- Create: `app/api/budgets/[id]/collaboration/history/route.test.ts`
- Create: `app/api/budgets/[id]/collaboration/versions/route.test.ts`

- [ ] **Step 1: Probar primero comentarios e historial**

Cubrir:

- listar comentarios por entidad
- crear comentario
- resolver y reabrir
- listar historial paginado
- crear snapshot manual

- [ ] **Step 2: Implementar route handlers**

Aplicar el patrón actual del repo:

- validar sesión
- parsear payload con Zod
- resolver ownership desde `budgetId`
- llamar servicio de dominio
- responder JSON tipado

- [ ] **Step 3: Implementar broker SSE básico**

Crear en `lib/collaboration/events.ts`:

- registro en memoria por presupuesto para subscribers activos
- `publishBudgetEvent`
- `subscribeBudgetEvents`

Regla:

- el broker en memoria es suficiente para desarrollo y despliegues simples
- los endpoints deben tolerar que no exista subscriber y seguir funcionando

- [ ] **Step 4: Crear endpoint de stream**

`GET /api/budgets/[id]/collaboration/stream` debe:

- validar acceso
- abrir `ReadableStream`
- emitir `ping` periódico
- emitir eventos publicados por servicios o handlers
- cerrar limpio al abortar la request

- [ ] **Step 5: Ejecutar tests de API**

Run: `npm run test -- app/api/budgets/[id]/collaboration/comments/route.test.ts app/api/budgets/[id]/collaboration/presence/route.test.ts app/api/budgets/[id]/collaboration/history/route.test.ts app/api/budgets/[id]/collaboration/versions/route.test.ts`

Expected:

- PASS con contratos y autorización correctos

---

## Task 4: Integrar presencia, comentarios y stream en la UI del presupuesto

**Files:**

- Create: `components/budget/budget-collaboration-bar.tsx`
- Create: `components/budget/budget-comments-sheet.tsx`
- Create: `hooks/use-budget-collaboration-stream.ts`
- Create: `hooks/use-budget-presence-heartbeat.ts`
- Create: `hooks/use-edit-session.ts`
- Create: `components/budget/budget-collaboration-bar.test.tsx`
- Create: `components/budget/budget-comments-sheet.test.tsx`
- Modify: `components/budget/budget-editor.tsx`
- Modify: `app/budgets/[id]/page.tsx`

- [ ] **Step 1: Escribir tests de UI para presencia y comentarios**

Cubrir:

- render de usuarios activos
- badge de cantidad de comentarios
- apertura del panel de comentarios
- aviso "usuario editando"

- [ ] **Step 2: Crear barra de colaboración**

Mostrar:

- usuarios activos
- estado de conexión
- botón de comentarios
- botón de historial
- botón de versiones

La barra debe respetar el lenguaje visual del header del presupuesto actual.

- [ ] **Step 3: Conectar heartbeat y stream**

Desde la vista del presupuesto:

- enviar heartbeat al abrir
- renovar heartbeat en intervalo fijo
- suscribirse al stream SSE
- refrescar presencia/comentarios cuando llegue evento relevante

- [ ] **Step 4: Conectar soft locking al editor**

Al entrar a editar una fila o campo relevante:

- iniciar `editSession`
- refrescar mientras el foco siga activo
- finalizar al blur, guardar o desmontar

En la UI:

- aviso inline sutil
- no bloqueo duro

- [ ] **Step 5: Ejecutar tests focalizados**

Run: `npm run test -- components/budget/budget-collaboration-bar.test.tsx components/budget/budget-comments-sheet.test.tsx components/budget/budget-editor.test.tsx`

Expected:

- PASS con UX de colaboración básica funcional

---

## Task 5: Registrar auditoría real desde mutaciones de presupuesto y mostrar diff visual

**Files:**

- Create: `components/budget/budget-change-history-sheet.tsx`
- Modify: `components/budget/budget-editor.tsx`
- Modify: `lib/data/budgets.ts`
- Modify: `app/api/budgets/[id]/route.ts`

- [ ] **Step 1: Identificar mutaciones principales del presupuesto**

Cubrir al menos:

- edición de cantidad
- edición de precio unitario
- edición de descripción/unidad si aplica
- altas y bajas de partidas

- [ ] **Step 2: Encadenar auditoría después del guardado**

Después de cada mutación exitosa:

- calcular diff por campo
- registrar `BudgetChangeEvent`
- publicar `change.created`

No registrar cambios vacíos o equivalentes tras normalización decimal.

- [ ] **Step 3: Construir panel de historial con diff**

Mostrar:

- usuario
- fecha
- entidad
- campo
- valor anterior
- valor nuevo

Para campos de monto o cantidad, usar el formato decimal configurado del usuario cuando sea visual.

- [ ] **Step 4: Ejecutar regresiones del editor**

Run: `npm run test -- components/budget/budget-editor.test.tsx lib/collaboration/audit.test.ts app/api/budgets/[id]/collaboration/history/route.test.ts`

Expected:

- PASS sin romper guardados existentes

---

## Task 6: Agregar versiones restaurables y extender la colaboración a APU, metrados y cronograma

**Files:**

- Create: `components/budget/budget-version-history-sheet.tsx`
- Modify: `components/apu/apu-editor-sheet.tsx`
- Modify: `components/metrados/MetradosDashboard.tsx`
- Modify: `components/budget/work-schedule-page-content.tsx`
- Modify: `components/projects/project-activity-history.tsx`

- [ ] **Step 1: Implementar UI de versiones**

Mostrar:

- lista de versiones
- creador
- fecha
- razón/etiqueta
- acción de restaurar

- [ ] **Step 2: Crear snapshots manuales y automáticos**

Automáticos mínimos:

- importación masiva
- restauración
- operación masiva de presupuesto si ya existe hook adecuado

Manual:

- botón `Guardar versión`

- [ ] **Step 3: Añadir colaboración contextual en APU, metrados y cronograma**

Primera ola de integración:

- comentarios por entidad activa
- presencia contextual básica
- sesiones de edición en panel activo

No intentar replicar todo el editor colaborativo del presupuesto en una sola iteración.

- [ ] **Step 4: Proyectar eventos resumidos al historial de proyecto**

Agregar resumen liviano opcional en `ActivityEvent` para:

- comentario resuelto
- versión creada
- restauración realizada

- [ ] **Step 5: Ejecutar verificación amplia**

Run: `npm run test`

Expected:

- PASS de la suite completa

Run: `npm run lint`

Expected:

- PASS sin `any`, imports muertos ni errores de hooks

---

## Rollout recomendado

- Release 1: comentarios + auditoría + versiones manuales sin realtime
- Release 2: presencia + soft locking + stream SSE en presupuesto
- Release 3: extensión a APU, metrados y cronograma + menciones + snapshots automáticos

## Self-Review

### Cobertura del PRD

- presencia de usuarios: cubierta por Task 2, 3 y 4
- comentarios contextuales: cubierta por Task 2, 3 y 4
- historial y diff visual: cubierta por Task 2 y 5
- snapshots/versionado: cubierta por Task 2 y 6
- realtime básico: cubierto por Task 3 y 4
- integración futura con IA: preservada sin mezclar alcance en V1

### Control de alcance

- no se propone CRDT ni colaboración tipo cursor
- no se reemplaza `NoteTask`
- no se introduce una dependencia externa obligatoria para realtime en V1
- no se cambia la arquitectura financiera ni el motor de cálculos

### Riesgos a vigilar durante ejecución

- tamaño de snapshots
- precisión decimal en auditoría
- ruido visual en editores grandes
- robustez del stream SSE en navegación prolongada
