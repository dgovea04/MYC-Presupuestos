# Especificación: Gobernanza y administración de workspaces

**Fecha:** 2026-08-21  
**Estado:** Propuesta lista para implementación  
**Producto:** MC Presupuestos

## 1. Contexto y objetivo

La aplicación ya dispone de selección de workspace mediante cookie, plan por workspace, membresías con roles `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`, invitaciones por email, suspensión/reactivación, remoción y entitlements por plan. Esta iniciativa completa el ciclo de administración de una organización sin duplicar esos mecanismos.

### Objetivos

- Evitar workspaces sin responsable cuando el propietario abandona la empresa.
- Permitir que los administradores mantengan identidad, datos fiscales y ciclo de vida del workspace.
- Hacer trazables las acciones administrativas.
- Facilitar incorporación de equipos grandes.
- Enforcear límites comerciales de asientos.
- Preparar permisos finos y acceso por proyecto sin romper el modelo actual.
- Exponer suscripción y uso por workspace con una fuente de verdad única.

### No objetivos iniciales

- Reemplazar `CompanyMembership`.
- Convertir `ActivityEvent` en auditoría forense: el modelo actual es de usuario y resumen; la auditoría administrativa requiere actor, workspace, objetivo, resultado y metadata estructurada.
- Crear un proveedor externo nuevo para email, almacenamiento de logos o billing.
- Cambiar la selección de workspace o los contratos existentes de entitlements.

## 2. Principios de arquitectura

1. **Workspace como tenant:** toda lectura/escritura administrativa debe resolver el workspace activo y verificar membresía en el servidor.
2. **Autorización centralizada:** las reglas viven en servicios reutilizables, no en componentes UI ni únicamente en middleware.
3. **Transacciones para invariantes:** transferencia de ownership, eliminación, remoción y consumo de asientos se ejecutan dentro de una transacción.
4. **Auditoría separada:** `ActivityEvent` puede recibir un resumen opcional para dashboard, pero no será el registro normativo.
5. **Fail closed:** ausencia de permiso, membresía o entitlement rechaza la operación.
6. **Compatibilidad:** `CompanyMembership` sigue siendo la fuente de roles; los nuevos roles/permisos se agregan de forma aditiva.
7. **Privacidad:** tokens y datos sensibles nunca se almacenan en claro ni se muestran después de crearse.

## 3. Priorización y entregables

| Fase | Iniciativas | Resultado |
|---|---|---|
| 0 | Fundaciones comunes | autorización, auditoría, límites, navegación y contratos |
| 1 | 1 Ownership, 2 Configuración, 3 Auditoría | control organizacional completo |
| 2 | 7 Asientos, 4 Enlaces, 5 Invitación masiva | onboarding controlado |
| 3 | 6 Última actividad, 10 Billing/admin | operación y visibilidad comercial |
| 4 | 8 Roles por módulo | permisos finos |
| 5 | 9 Compartir proyectos | aislamiento de acceso a nivel proyecto |

El orden evita construir permisos finos antes de tener ownership, tenant boundary y auditoría confiables.

## 4. Matriz de permisos base

| Acción | OWNER | ADMIN | EDITOR | VIEWER |
|---|---:|---:|---:|---:|
| Ver configuración | Sí | Sí | No | No |
| Editar nombre/RUC/logo | Sí | Sí | No | No |
| Eliminar workspace | Sí | No | No | No |
| Transferir ownership | Sí | No | No | No |
| Invitar miembros | Sí | Sí | No | No |
| Cambiar roles (excepto OWNER) | Sí | Sí* | No | No |
| Suspender/remover miembros | Sí | Sí* | No | No |
| Ver auditoría | Sí | Sí | No | No |
| Ver billing/uso | Sí | Sí** | No | No |

`*` ADMIN no puede modificar OWNER, ADMIN equivalente si la política final lo restringe, ni quitar el último administrador. `**` La visibilidad financiera puede limitarse a OWNER según la cuenta Stripe y política comercial.

Crear un servicio `lib/workspace/authorization.ts` con funciones tipadas como `requireWorkspaceAccess`, `requireWorkspaceRole`, `requireWorkspaceCapability` y `assertTargetMembershipChangeAllowed`. No confiar en `role` enviado por el cliente.

## 5. Modelo de datos propuesto

### 5.1 Auditoría administrativa

Agregar un modelo nuevo, por ejemplo `WorkspaceAuditEvent`:

- `id: String @id @default(cuid())`
- `companyId: String`
- `actorUserId: String?` — nullable para acciones sistémicas
- `action: WorkspaceAuditAction` — enum extensible
- `targetType: WorkspaceAuditTargetType`
- `targetId: String?`
- `targetLabel: String?` — snapshot no sensible para mostrar
- `metadata: Json @default("{}")`
- `ipHash: String?` y `userAgent: String?` solo si la política de privacidad lo aprueba
- `createdAt: DateTime @default(now())`

Índices: `(companyId, createdAt DESC)`, `(companyId, action, createdAt DESC)`, `(actorUserId, createdAt DESC)`.

Acciones iniciales: `WORKSPACE_UPDATED`, `WORKSPACE_DELETED`, `OWNERSHIP_TRANSFERRED`, `MEMBER_INVITED`, `MEMBER_INVITE_REVOKED`, `MEMBER_ROLE_CHANGED`, `MEMBER_SUSPENDED`, `MEMBER_REACTIVATED`, `MEMBER_REMOVED`, `INVITE_LINK_CREATED`, `BULK_INVITE_CREATED`, `SEAT_LIMIT_REACHED`, `BILLING_VIEWED`.

### 5.2 Invitaciones reutilizables

Agregar `WorkspaceInviteLink`:

- `id`, `companyId`, `createdById`
- `tokenHash` único; nunca guardar el token crudo
- `role` con default `VIEWER`
- `expiresAt`, `maxUses`, `useCount`, `revokedAt`
- `createdAt`, `updatedAt`

Agregar `WorkspaceInviteLinkUse` para impedir ambigüedad y permitir idempotencia:

- `id`, `inviteLinkId`, `userId?`, `email`, `membershipId?`, `createdAt`
- unique recomendado sobre `(inviteLinkId, email)`.

### 5.3 Última actividad

No añadir un campo derivado si puede calcularse de forma segura: `CompanyMembership.updatedAt` no representa actividad de login. Agregar a `User` o a una tabla de sesiones solo si ya existe un punto confiable de login. Primera versión: `lastActiveAt` nullable en `CompanyMembership`, actualizado por una función server-side con throttling; nunca desde el cliente.

### 5.4 Roles y proyectos

Para fase 4, agregar `WorkspaceRole`, `WorkspacePermission` y una tabla de asignación de permisos. Para fase 5, agregar `ProjectMembership` con `companyId`, `projectId`, `userId`, rol/acceso y restricciones de integridad que garanticen que proyecto, miembro y workspace pertenecen al mismo tenant. No implementar ambos hasta cerrar la matriz de producto.

## 6. Especificaciones funcionales

### 6.1 Transferencia de ownership

- Solo el OWNER actual puede iniciar.
- El destinatario debe ser miembro `ACTIVE` y no puede ser el mismo actor.
- Requiere confirmación explícita y contraseña/reautenticación si el sistema ya la soporta.
- Transacción: verificar OWNER único, cambiar rol anterior a `ADMIN` y destinatario a `OWNER`, registrar auditoría.
- No permitir que el último OWNER sea suspendido/removido.
- Invalidar/revalidar caches y refrescar workspace activo.
- UI: sección peligrosa separada, explicación del impacto, selector de miembros activos y confirmación con nombre del workspace.

### 6.2 Configuración del workspace

- OWNER/ADMIN puede editar nombre, RUC y logo.
- Validar nombre no vacío y límites de tamaño; RUC peruano debe usar la validación existente o una nueva especificación explícita, sin aceptar formato ambiguo.
- Logo: reutilizar almacenamiento existente; validar MIME/tamaño y eliminar/reemplazar de forma segura.
- Eliminación: solo OWNER, confirmación escribiendo el nombre, soft-delete recomendado (`deletedAt`) y período de recuperación definido antes de activar destrucción física.
- Bloquear eliminación si existen obligaciones legales/billing activas hasta resolver la política.
- Toda modificación genera auditoría con diff permitido, excluyendo secretos.

### 6.3 Auditoría

- Pantalla `/settings/audit` o pestaña de settings.
- Filtros por actor, acción, intervalo y objetivo; paginación cursor-based.
- Mostrar actor, acción legible, objetivo, fecha absoluta y relativa, y detalle expandible de metadata permitida.
- Retención inicial propuesta: 24 meses, configurable; no borrar silenciosamente eventos recientes.
- La consulta siempre filtra `companyId` y exige permiso.
- Los eventos de membresía se escriben en la misma transacción que el cambio de estado.

### 6.4 Enlaces de invitación

- OWNER/ADMIN selecciona rol permitido, expiración y máximo de usos.
- Token aleatorio de alta entropía; URL solo con token crudo y no se persiste.
- Al aceptar: hash token, comprobar expiración/revocación/usos, workspace y límite de asientos, crear o resolver invitación/membresía de forma idempotente.
- Pantalla lista enlaces activos, usos, expiración y revocar; nunca muestra token después de salir de la confirmación.
- Rate limit y respuesta indistinguible para evitar enumeración de emails/workspaces.

### 6.5 Invitación masiva

- Entrada multilinea, separadores coma/punto y coma/nueva línea.
- Normalizar lowercase/trim, deduplicar y devolver resultado por email sin filtrar datos de usuarios ajenos.
- Límite de lote configurable; si excede asientos, procesar de forma determinista hasta el límite o rechazar todo: elegir y documentar una política transaccional. Recomendación: prevalidar y rechazar todo si no hay capacidad suficiente.
- Reusar servicio de invitación individual para reglas y auditoría, pero ejecutar el lote con una operación coordinada.

### 6.6 Asientos por plan

- Definir `seatLimit` en `MembershipPlan` (`null` = ilimitado para empresa, si esa es la regla comercial aprobada).
- Contar membresías `ACTIVE` e `INVITED`; no contar `SUSPENDED` salvo decisión comercial explícita.
- No permitir crear invitación, aceptar enlace o reactivar miembro sobre el límite.
- Mostrar `X / límite`, estado de capacidad y CTA de upgrade basado en entitlements existentes.
- Evitar TOCTOU: el chequeo y la creación/reactivación deben compartir transacción y constraint/estrategia de reintento.

### 6.7 Última actividad

- Mostrar `Nunca`, `Hoy`, `Ayer`, `Hace N días` y fecha exacta accesible.
- La UI no debe presentar actividad de navegación como presencia en tiempo real.
- Actualización throttled para no escribir en cada request; excluir endpoints de health/assets.

### 6.8 Billing y uso

- Pestaña `/settings/billing` scoped al workspace.
- Mostrar plan actual, estado, período, asientos usados/límite, features principales y estado de pago.
- Acciones de checkout/portal deben usar `CompanySubscription` y las integraciones Stripe existentes; no crear suscripciones por usuario.
- Webhook sigue siendo fuente de sincronización del estado; UI debe tolerar estados incompletos y mostrar “pendiente de sincronización”.
- Métricas iniciales: miembros, proyectos, presupuestos, almacenamiento si existe métrica confiable, consumo IA si ya tiene ledger. Cada métrica debe declarar ventana y fuente.

## 7. Rutas y servicios

Convención propuesta, ajustable a las rutas existentes:

- `GET/PATCH /api/workspaces/[companyId]`
- `POST /api/workspaces/[companyId]/transfer-ownership`
- `DELETE /api/workspaces/[companyId]`
- `GET /api/workspaces/[companyId]/audit`
- `POST/GET /api/workspaces/[companyId]/invite-links`
- `POST /api/workspace-invite-links/[token]/accept`
- `POST /api/workspaces/[companyId]/bulk-invites`
- `GET /api/workspaces/[companyId]/usage`

Servicios:

- `lib/workspace/authorization.ts`
- `lib/workspace/governance.ts`
- `lib/workspace/invitations.ts`
- `lib/workspace/seats.ts`
- `lib/workspace/audit.ts`
- `lib/workspace/usage.ts`

Los schemas Zod deben vivir en `lib/validations/workspace.ts` o archivos específicos si crecen. Todos los route handlers deben validar payload, sesión, workspace activo/objetivo y autorización.

## 8. UI y navegación

Extender settings con pestañas responsive:

1. General
2. Miembros
3. Invitaciones
4. Auditoría
5. Facturación
6. Peligro

- Mostrar tabs según capacidad, pero proteger igualmente en servidor.
- En móvil usar selector o tabs desplazables.
- Estados vacíos accionables, loading y errores accesibles.
- Confirmaciones para transferencia, revocación, suspensión, remoción y eliminación.
- No ocultar silenciosamente acciones no permitidas: mostrar explicación breve.

## 9. Seguridad, privacidad y confiabilidad

- Hash de tokens con SHA-256/HMAC según convención del proyecto; comparación constante si aplica.
- Protección CSRF mediante las convenciones actuales de mutaciones.
- Rate limit para aceptación y creación de enlaces.
- No loggear tokens, RUC completo innecesariamente ni metadata sensible.
- Auditoría resistente a fallos: una mutación administrativa no debe reportarse como exitosa si no pudo auditarse, salvo política explícita de degradación.
- Todas las operaciones destructivas deben ser idempotentes o devolver estado claro.

## 10. Pruebas de aceptación

### Unitarias

- Matriz de autorización por rol.
- Validación de RUC, nombre, expiración y lote de emails.
- Cálculo de asientos por estado y plan.
- Token: generación, hash, expiración, revocación y usos máximos.
- Formateo de última actividad.

### Integración/API

- Transferencia atómica y OWNER único.
- ADMIN no puede transferir/eliminar ni modificar OWNER.
- No hay cross-tenant reads/writes.
- Auditoría creada junto con cada mutación.
- Invitaciones bloqueadas al superar seats; aceptación concurrente no excede límite.
- Eliminación bloqueada según política de billing y soft-delete verificable.
- Billing devuelve únicamente la suscripción del workspace consultado.

### E2E

- OWNER transfiere ownership y ve roles actualizados.
- ADMIN edita configuración y consulta auditoría.
- Invitación por enlace se acepta una sola vez cuando corresponde.
- Lote con duplicados muestra resultados claros.
- Usuario en starter alcanza límite y recibe CTA de upgrade.
- Panel billing cambia correctamente de workspace.

## 11. Observabilidad y rollout

Feature flags por iniciativa: `workspace.governance`, `workspace.inviteLinks`, `workspace.bulkInvites`, `workspace.seatLimits`, `workspace.billingUi`, `workspace.customRoles`, `workspace.projectSharing`.

Métricas: transferencias exitosas/fallidas, errores de autorización, invitaciones enviadas/aceptadas, bloqueos por seats, latencia de auditoría, consultas billing fallidas y errores cross-tenant detectados.

Rollout:

1. Migración aditiva y backfill seguro.
2. Servicios y pruebas sin exponer UI.
3. Activar General/Auditoría para cuentas internas.
4. Activar seats antes de enlaces y bulk invites.
5. Activar billing UI en modo lectura.
6. Activar permisos avanzados y sharing únicamente tras validación de modelo.

## 12. Decisiones pendientes antes de codificar

- ¿El límite cuenta invitaciones pendientes y miembros suspendidos?
- ¿La eliminación será soft-delete con período de recuperación y cuánto durará?
- ¿Se requiere reautenticación para transferir/eliminar?
- ¿El ADMIN puede editar billing o solo leerlo?
- ¿Qué almacenamiento existente se usará para logos?
- ¿Qué retención y exportación legal requiere la auditoría?
- ¿Roles personalizados serán por workspace o por usuario/proyecto?

Estas decisiones deben cerrarse en una breve revisión de producto antes de ejecutar la fase correspondiente.
