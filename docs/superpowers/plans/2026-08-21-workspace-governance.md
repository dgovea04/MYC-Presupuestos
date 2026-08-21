# Plan de implementación: gobernanza de workspaces

> Documento de ejecución. Cada fase debe conservar los contratos actuales de selección de workspace, membresías, entitlements y billing.

## Convenciones de trabajo

- TypeScript strict; no usar `any`.
- Server Components por defecto; mutaciones en route handlers/servicios server-side.
- Toda operación recibe `companyId` y `actorUserId` después de resolver sesión.
- Usar Prisma y Zod ya instalados; no añadir dependencias sin justificación.
- Mantener cálculos de uso y seats en servicios testeables.
- Antes de cada migración revisar el esquema vigente y generar migración Prisma revisable.

## Fase 0 — Fundaciones

- [ ] Inventariar todas las mutaciones existentes de miembros, selección de workspace y billing.
- [ ] Crear `lib/workspace/authorization.ts` y consolidar las comprobaciones de tenant/rol.
- [ ] Crear `lib/workspace/audit.ts` con escritura transaccional y consulta paginada.
- [ ] Añadir enums/modelo `WorkspaceAuditEvent` y migración aditiva.
- [ ] Añadir tests de autorización, aislamiento entre workspaces y auditoría.
- [ ] Definir flags de rollout y contratos de error.

**Criterio de salida:** todas las mutaciones administrativas nuevas pueden reutilizar autorización y auditoría sin depender de UI.

## Fase 1 — Control organizacional

### 1. Transferencia de ownership

- [ ] Añadir schema Zod para destinatario y confirmación.
- [ ] Implementar servicio transaccional con invariantes de OWNER único.
- [ ] Registrar evento `OWNERSHIP_TRANSFERRED` con actor y destinatario.
- [ ] Crear route handler y tests de permisos, atomicidad y concurrencia.
- [ ] Añadir sección UI de zona peligrosa y actualización de contexto activo.
- [ ] Añadir E2E para transferencia exitosa y rechazos.

### 2. Configuración y ciclo de vida

- [ ] Crear schemas de nombre, RUC, logo y confirmación de eliminación.
- [ ] Implementar `PATCH` de configuración reutilizando almacenamiento de logo existente.
- [ ] Añadir `deletedAt` solamente si se aprueba soft-delete; backfill y filtros tenant-safe.
- [ ] Implementar eliminación protegida, idempotente y auditada.
- [ ] Crear pestaña General/Peligro con estados loading/error/empty.
- [ ] Añadir tests de validación, permisos, billing lock y auditoría.

### 3. Auditoría

- [ ] Crear consulta cursor-based con filtros actor/acción/fecha/objetivo.
- [ ] Crear tabla responsive con fecha relativa y absoluta accesible.
- [ ] Añadir detalle de metadata allowlisted, sin secretos.
- [ ] Instrumentar mutaciones actuales de miembros para que registren eventos.
- [ ] Añadir tests de paginación, filtros y aislamiento.

**Criterio de salida:** OWNER puede delegar responsabilidad, configurar/eliminar según política y revisar todas las acciones administrativas relevantes.

## Fase 2 — Incorporación y capacidad

### 7. Límite de asientos

- [ ] Añadir `seatLimit` a `MembershipPlan` y poblar starter/pro/empresa con valores aprobados.
- [ ] Crear `lib/workspace/seats.ts` con conteo por estado y chequeo transaccional.
- [ ] Integrar creación de invitación, aceptación, reactivación y bulk invites.
- [ ] Definir comportamiento ante carreras/concurrencia y cubrirlo con integración.
- [ ] Mostrar uso/límite y CTA de upgrade en Members.

### 4. Enlaces reutilizables

- [ ] Crear modelos `WorkspaceInviteLink`/`WorkspaceInviteLinkUse` y migración.
- [ ] Implementar hash de token, expiración, revocación, máximo de usos e idempotencia.
- [ ] Crear endpoints de creación/listado/revocación/aceptación.
- [ ] Reusar reglas de roles, seats y membresías existentes.
- [ ] Añadir UI para crear/copiar una vez/listar/revocar.
- [ ] Añadir rate limiting y tests de token expirado, revocado, agotado y cross-tenant.

### 5. Invitación masiva

- [ ] Añadir parser normalizador deduplicante y schema de lote.
- [ ] Prevalidar permisos, emails, duplicados y capacidad antes de mutar.
- [ ] Reusar servicio individual y devolver resultado por email sin filtrar información privada.
- [ ] Añadir UI multilinea con resumen de éxito/error.
- [ ] Añadir tests de límites, duplicados, rollback/política de lote y auditoría.

**Criterio de salida:** los workspaces respetan capacidad comercial y pueden incorporar equipos sin saltarse las reglas existentes.

## Fase 3 — Operación y billing

### 6. Última actividad

- [ ] Confirmar fuente de actividad de login/request y política de privacidad.
- [ ] Añadir `lastActiveAt` a `CompanyMembership` solo si no existe señal equivalente confiable.
- [ ] Implementar actualización throttled server-side.
- [ ] Mostrar valor relativo con `datetime` absoluto accesible.
- [ ] Cubrir miembros nunca activos, zonas horarias y datos antiguos.

### 10. Suscripción y uso

- [ ] Crear servicio de lectura `lib/workspace/usage.ts` con métricas y ventanas declaradas.
- [ ] Crear endpoint y pestaña Billing scoped a `companyId`.
- [ ] Mostrar plan, estado, período, seats, features y uso IA desde fuentes existentes.
- [ ] Integrar acciones con la implementación Stripe existente, sin duplicar suscripciones.
- [ ] Manejar estados pending/past_due/canceled y sincronización retrasada.
- [ ] Añadir pruebas de aislamiento, estados de billing y cambio de workspace.

**Criterio de salida:** OWNER/roles autorizados entienden capacidad, plan y estado sin consultar herramientas externas.

## Fase 4 — Permisos avanzados

### 8. Roles personalizados por módulo

- [ ] Realizar workshop de matriz de permisos por feature.
- [ ] Crear modelos de roles/permisos versionables y seed de roles base.
- [ ] Extender autorización para capability checks, manteniendo fallback por rol actual.
- [ ] Añadir UI de creación/edición con prevención de escalamiento indebido.
- [ ] Migrar una sola superficie piloto (presupuestos) y medir errores.
- [ ] Expandir por módulo tras pruebas de regresión.

**Criterio de salida:** permisos finos no permiten acceso fuera del workspace ni rompen OWNER/ADMIN.

## Fase 5 — Acceso a proyectos

### 9. Compartir proyectos específicos

- [ ] Definir si el acceso por proyecto es allowlist, roles o ambos.
- [ ] Crear `ProjectMembership` con integridad `companyId/projectId/userId`.
- [ ] Introducir helper de autorización compuesto workspace + proyecto.
- [ ] Migrar lectura de proyectos a filtros explícitos y revisar APIs/exportaciones.
- [ ] Añadir UI de compartir y revocar acceso.
- [ ] Cubrir cross-tenant, acceso heredado por OWNER/ADMIN y eliminación de proyecto.

**Criterio de salida:** un miembro restringido solo ve proyectos compartidos y ningún endpoint filtra datos indirectamente.

## Checklist transversal por PR

- [ ] Zod schema y mensajes de error en español.
- [ ] Autorización server-side y prueba negativa.
- [ ] Auditoría de mutación con actor/tenant/objetivo.
- [ ] Migración reversible o estrategia de recuperación documentada.
- [ ] Tests unitarios y de integración relevantes.
- [ ] Accesibilidad de formularios, confirmaciones, focus y estados.
- [ ] `npm run typecheck`.
- [ ] `npm run test -- <tests relevantes>`.
- [ ] `npm run lint`.

## Orden recomendado de entregas

1. Fundaciones + ownership/configuración/auditoría.
2. Seats y después enlaces/bulk invites.
3. Última actividad y billing en modo lectura.
4. Roles personalizados piloto.
5. Compartir proyectos.

No comenzar las fases 4–5 hasta cerrar las decisiones pendientes de la especificación y validar los invariantes de tenant de las fases anteriores.
