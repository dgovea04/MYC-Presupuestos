# Commercial Beta Access Implementation Plan

> **For agentic workers:** Use this document with `superpowers:executing-plans` or `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema controlado de beta comercial que permita asignar acceso temporal a las funcionalidades Pro durante 60 o 90 días, con reglas automáticas, controles administrativos, expiración segura, auditoría y medición de conversión.

**Architecture:** Crear una capa de acceso promocional temporal mediante `BetaCampaign` y `BetaGrant`, separada de `MembershipPlan` y `BillingSubscription`. Integrar la resolución de grants en `lib/workspace/entitlements.ts`, mantener la suscripción pagada como fuente de mayor prioridad y reutilizar el almacenamiento de `MarketingEvent` y la integración actual con Google Analytics 4.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma 7, PostgreSQL, NextAuth, Zod, Vitest, Tailwind, componentes UI existentes y Google Analytics 4 ya integrado.

---

## Product Defaults

- La duración estándar de la beta es de **60 días**.
- Los **90 días** quedan reservados para campañas específicas, pilotos o referidos.
- La beta no exige tarjeta ni crea una suscripción pagada.
- Una suscripción pagada siempre tiene prioridad sobre una beta.
- Al vencer la beta, el usuario vuelve a Starter sin perder proyectos, presupuestos ni datos.
- La primera versión opera a nivel de usuario; el soporte de grants por empresa/workspace queda preparado, pero no es requisito del MVP.
- La primera campaña debe limitarse a 20–50 usuarios para medir activación, coste de IA y conversión antes de ampliar el volumen.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- No mutar `User.membershipPlanId` para representar una beta temporal.
- No crear `BillingSubscription` manual `ACTIVE` para una beta.
- Toda asignación y revocación debe ser auditable.
- La verificación de acceso debe depender de fechas UTC y ser segura aun si el job de expiración no se ejecuta.
- No enviar PII ni IDs internos como parámetros públicos de GA4.
- Reutilizar `getEffectiveWorkspaceLicense` y `MarketingEvent` en lugar de crear otra capa paralela.
- No introducir dependencias nuevas.
- Mantener la lógica de elegibilidad, acceso, expiración y métricas fuera de componentes UI.
- Las pruebas deben cubrir las reglas de precedencia y las fechas límite.

---

## Existing Integration Points

La implementación debe aprovechar estos componentes existentes:

- `prisma/schema.prisma`
  - `MembershipPlan`
  - `BillingSubscription`
  - `CompanySubscription`
  - `AdminAuditLog`
  - `MarketingEvent`
- `lib/workspace/entitlements.ts`
  - resolución actual de licencia efectiva y caché de entitlements.
- `lib/data/admin-users.ts`
  - acciones administrativas, asignación de membresía actual y auditoría.
- `app/api/admin/users/[id]/route.ts`
  - API actual para cambios de acceso individual.
- `app/api/admin/users/bulk/route.ts`
  - API actual para acciones masivas.
- `lib/analytics/events.ts` y `lib/analytics/store.ts`
  - eventos internos y envío opcional a GA4 Measurement Protocol.
- `lib/data/admin-marketing-analytics.ts`
  - adquisición, activación, cohortes y monetización.
- `lib/data/admin-marketing-monetization.ts`
  - métricas de suscripciones y MRR.
- `components/admin/*`
  - patrones visuales y de permisos para el panel administrativo.

---

## Target File Structure

### Create

- `lib/beta/types.ts`
  - tipos de campaña, grant, estados y reglas tipadas.
- `lib/beta/validation.ts`
  - esquemas Zod para campañas, elegibilidad y asignaciones.
- `lib/beta/access.ts`
  - resolución de grants activos y cálculo de días restantes.
- `lib/beta/access.test.ts`
  - pruebas unitarias de precedencia, fechas, revocación y expiración.
- `lib/beta/campaigns.ts`
  - creación, actualización, pausa y finalización de campañas.
- `lib/beta/campaigns.test.ts`
  - pruebas de límites, códigos e idempotencia.
- `lib/beta/assignments.ts`
  - asignación individual, masiva, automática y revocación.
- `lib/beta/assignments.test.ts`
  - pruebas de elegibilidad, duplicados, límites y auditoría.
- `lib/beta/reconciliation.ts`
  - reconciliación de estados y generación de eventos de vencimiento.
- `lib/beta/reconciliation.test.ts`
  - pruebas de vencimiento y recordatorios.
- `app/api/admin/beta/campaigns/route.ts`
- `app/api/admin/beta/campaigns/[id]/route.ts`
- `app/api/admin/beta/campaigns/[id]/assign/route.ts`
- `app/api/admin/beta/grants/[id]/route.ts`
- `app/api/beta/redeem/route.ts`
  - endpoint opcional para códigos promocionales.
- `components/admin/admin-beta-campaigns.tsx`
- `components/admin/admin-beta-campaign-detail.tsx`
- `components/admin/admin-beta-grants.tsx`
- `lib/data/admin-beta-analytics.ts`
- `components/admin/admin-beta-analytics.tsx`
- `prisma/migrations/<timestamp>_add_commercial_beta_access/migration.sql`

### Modify

- `prisma/schema.prisma`
  - enums, modelos y relaciones de beta.
- `lib/workspace/entitlements.ts`
  - incluir beta vigente en la licencia efectiva.
- `lib/analytics/events.ts`
  - eventos beta y parámetros permitidos.
- `lib/analytics/store.ts`
  - persistencia segura de parámetros beta.
- `lib/data/admin-marketing-analytics.ts`
  - cohortes y ventana de retención beta.
- `app/admin/page.tsx`
  - nueva sección o pestaña Beta Comercial.
- `components/admin/admin-page-tabs.tsx`
  - navegación del área beta.
- `components/account/account-page-content.tsx`
  - mostrar origen y fecha de vencimiento del Pro Beta.
- `lib/auth/registration.ts` o el flujo de registro vigente
  - punto de asignación automática después de crear el usuario.
- `app/api/register/route.ts` y/o callback Google
  - activar la campaña automática si corresponde.
- `vercel.json` o el mecanismo de scheduler del entorno, solo si existe un cron operativo compatible.

---

## Task 1: Define Domain Types And Validation

**Files:**

- Create: `lib/beta/types.ts`
- Create: `lib/beta/validation.ts`
- Create: `lib/beta/validation.test.ts`

- [ ] **Step 1: Define states and sources**

Definir tipos equivalentes a:

```ts
export type BetaCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";
export type BetaGrantStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "REVOKED";
export type BetaGrantSource = "AUTOMATIC" | "ADMIN" | "CODE" | "IMPORT";
```

La duración debe validarse como unión literal `60 | 90`, salvo que una futura decisión de producto requiera duraciones configurables.

- [ ] **Step 2: Define typed eligibility rules**

Las reglas no deben exponerse como `Record<string, unknown>` sin validación. Crear un esquema Zod que permita, como mínimo:

- `requireVerifiedEmail`.
- `newUsersOnly`.
- `allowedUtmSources`.
- `allowedUtmCampaigns`.
- `allowedEmailDomains`.
- `requiresCode`.
- `excludePaidSubscribers`.
- `excludePreviousBetaUsers`.

- [ ] **Step 3: Write validation tests**

Cubrir:

- Campaña de 60 días válida.
- Campaña de 90 días válida.
- Duración distinta a 60/90 rechazada.
- Fecha de fin anterior al inicio rechazada.
- `maxAssignments` positivo.
- Código normalizado en minúsculas y sin espacios.
- Reglas desconocidas rechazadas.

- [ ] **Step 4: Run tests**

```bash
npm run test -- lib/beta/validation.test.ts
```

Expected: PASS.

---

## Task 2: Add Prisma Models And Migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_commercial_beta_access/migration.sql`

- [ ] **Step 1: Add enums**

Agregar enums para estado de campaña, estado del grant y origen de asignación. Mantenerlos separados de `BillingSubscriptionStatus` porque un grant beta no es una suscripción.

- [ ] **Step 2: Add `BetaCampaign`**

El modelo debe contener al menos:

- nombre y código opcional.
- `planSlug`, inicialmente `pro`.
- `durationDays`.
- estado.
- ventana de vigencia de la campaña.
- límite de asignaciones opcional.
- modo de asignación.
- reglas de elegibilidad en JSON validado por Zod.
- usuario creador.
- timestamps.

El código debe tener índice/único adecuado para que los códigos promocionales sean idempotentes.

- [ ] **Step 3: Add `BetaGrant`**

El modelo debe contener al menos:

- `campaignId`.
- `userId` obligatorio para el MVP.
- `companyId` opcional para la futura modalidad workspace.
- plan concedido.
- estado.
- origen.
- `startsAt` y `expiresAt`.
- `revokedAt` y `revokedById` opcionales.
- `assignedById` opcional.
- metadatos mínimos para trazabilidad.
- timestamps.

Agregar una restricción única por `campaignId` y `userId` para impedir asignaciones duplicadas dentro de una campaña e índices por usuario, estado y vencimiento.

- [ ] **Step 4: Add explicit User relations**

Agregar relaciones con nombres explícitos cuando un usuario sea creador, asignador o revocador, para evitar ambigüedad en Prisma. Verificar que no se rompan las relaciones existentes de `User`.

- [ ] **Step 5: Write migration SQL**

La migración debe ser aditiva. No modificar ni eliminar datos de `MembershipPlan` o `BillingSubscription`.

- [ ] **Step 6: Generate and verify Prisma client**

```bash
npm run prisma:generate
```

Expected: PASS.

---

## Task 3: Implement Grant Access Resolution

**Files:**

- Create: `lib/beta/access.ts`
- Create: `lib/beta/access.test.ts`
- Modify: `lib/workspace/entitlements.ts`
- Modify: `lib/workspace/entitlements.test.ts`

- [ ] **Step 1: Define service contract**

Implementar una interfaz equivalente a:

```ts
export type ActiveBetaAccess = {
  grantId: string;
  campaignId: string;
  campaignName: string;
  planSlug: "pro";
  startsAt: Date;
  expiresAt: Date;
  daysRemaining: number;
};

export async function getActiveBetaAccess(options: {
  userId: string;
  companyId?: string | null;
  now?: Date;
}): Promise<ActiveBetaAccess | null>;
```

- [ ] **Step 2: Implement time-safe access checks**

Un grant es vigente únicamente cuando:

```text
startsAt <= now
expiresAt > now
revokedAt IS NULL
```

Usar UTC y no depender del estado almacenado para decidir acceso. El estado se puede reconciliar posteriormente.

- [ ] **Step 3: Define precedence**

Actualizar `getEffectiveWorkspaceLicense` con esta regla:

1. Membresía/workspace no válido: sin licencia.
2. Suscripción pagada activa o en prueba: conservar su plan.
3. Grant beta vigente: conceder Pro temporal.
4. Suscripción de empresa vigente.
5. Plan personal permanente.
6. Starter.

Si el plan pagado es Empresa, nunca degradarlo a Pro Beta.

- [ ] **Step 4: Expose access metadata**

La licencia efectiva debe devolver `accessSource`, `betaGrantId`, `betaCampaignName` y `betaExpiresAt` cuando el origen sea beta.

- [ ] **Step 5: Handle cache invalidation**

Cuando se cree, revoque o modifique un grant, invalidar la etiqueta de caché del usuario/workspace. La expiración temporal debe funcionar aunque la caché permanezca unos minutos.

- [ ] **Step 6: Write tests**

Cubrir:

- Starter sin beta.
- Starter con beta activa.
- Beta aún no iniciada.
- Beta exactamente vencida.
- Beta revocada.
- Stripe Pro y beta simultáneos.
- Empresa Pro y beta simultáneos.
- Dos grants activos: elegir el de mayor `expiresAt` solo si la política de campaña permite coexistencia; de lo contrario, rechazar el segundo.

- [ ] **Step 7: Run tests**

```bash
npm run test -- lib/beta/access.test.ts lib/workspace/entitlements.test.ts
```

Expected: PASS.

---

## Task 4: Implement Campaign And Assignment Services

**Files:**

- Create: `lib/beta/campaigns.ts`
- Create: `lib/beta/campaigns.test.ts`
- Create: `lib/beta/assignments.ts`
- Create: `lib/beta/assignments.test.ts`
- Reuse: `lib/data/admin-audit.ts`

- [ ] **Step 1: Implement campaign lifecycle**

Implementar operaciones para:

- Crear campaña.
- Editar campaña en `DRAFT`.
- Activar campaña.
- Pausar campaña.
- Finalizar campaña.
- Consultar resumen de asignaciones.

Una campaña `FINISHED` no debe aceptar nuevas asignaciones.

- [ ] **Step 2: Implement eligibility preview**

Antes de una asignación masiva, devolver:

- total elegibles.
- total excluidos.
- razones de exclusión.
- cantidad restante del límite.
- usuarios que ya tienen una beta.
- usuarios con suscripción pagada.

- [ ] **Step 3: Implement idempotent assignment**

La asignación debe ejecutarse dentro de una transacción y ser segura ante reintentos. No crear grants duplicados por doble click, retry HTTP o job repetido.

- [ ] **Step 4: Implement individual and bulk assignment**

Soportar:

- Usuario individual.
- Lista de usuarios limitada a 50 por solicitud inicial.
- Importación futura controlada.
- Código promocional.
- Asignación automática en registro.

- [ ] **Step 5: Implement revoke and extend**

Toda revocación o extensión requiere:

- actor administrativo o regla explícita.
- motivo.
- auditoría.
- invalidación de caché.

La extensión nunca debe modificar silenciosamente el historial; debe registrar el valor anterior y el nuevo vencimiento.

- [ ] **Step 6: Record audit events**

Usar `AdminAuditLog` con acciones como:

- `BETA_CAMPAIGN_CREATED`.
- `BETA_CAMPAIGN_ACTIVATED`.
- `BETA_CAMPAIGN_PAUSED`.
- `BETA_GRANT_ASSIGNED`.
- `BETA_GRANTS_ASSIGNED_BULK`.
- `BETA_GRANT_REVOKED`.
- `BETA_GRANT_EXTENDED`.

- [ ] **Step 7: Run tests**

```bash
npm run test -- lib/beta/campaigns.test.ts lib/beta/assignments.test.ts
```

Expected: PASS.

---

## Task 5: Add Admin APIs And Permissions

**Files:**

- Create: `app/api/admin/beta/campaigns/route.ts`
- Create: `app/api/admin/beta/campaigns/[id]/route.ts`
- Create: `app/api/admin/beta/campaigns/[id]/assign/route.ts`
- Create: `app/api/admin/beta/grants/[id]/route.ts`
- Create tests next to each route.
- Modify: permission registry used by `requireAdminSession`.

- [ ] **Step 1: Add read and management capabilities**

Definir capacidades separadas:

```text
beta.read
beta.manage
beta.assign
beta.revoke
beta.export
```

`BILLING_ADMIN` puede gestionar campañas y asignaciones; `AUDITOR` solo puede consultar y exportar según la matriz de permisos existente.

- [ ] **Step 2: Implement campaign endpoints**

`GET /api/admin/beta/campaigns`

- lista paginada.
- filtros por estado.
- resumen de asignaciones.

`POST /api/admin/beta/campaigns`

- valida payload con Zod.
- registra auditoría.

`PATCH /api/admin/beta/campaigns/:id`

- controla transiciones de estado.
- impide cambios peligrosos en campañas activas.

- [ ] **Step 3: Implement assignment endpoint**

`POST /api/admin/beta/campaigns/:id/assign`

Payload inicial:

```ts
{
  userIds: string[];
  source: "ADMIN" | "IMPORT";
  dryRun?: boolean;
  reason?: string;
}
```

Debe soportar `dryRun` para previsualizar el resultado antes de confirmar.

- [ ] **Step 4: Implement grant lifecycle endpoint**

`PATCH /api/admin/beta/grants/:id`

Operaciones:

- revocar.
- extender.
- consultar historial.

Requerir motivo para revocación y extensión.

- [ ] **Step 5: Run route tests**

```bash
npm run test -- app/api/admin/beta
```

Si Vitest no acepta el directorio directamente, ejecutar los archivos de ruta encontrados.

---

## Task 6: Add Automatic Registration And Code Assignment

**Files:**

- Create or modify the existing registration service.
- Create: `app/api/beta/redeem/route.ts` if code redemption is included in MVP.
- Add targeted tests.

- [ ] **Step 1: Implement automatic eligibility check**

Después de crear un usuario, consultar campañas `ACTIVE` con modo automático. No bloquear el registro si la asignación falla; registrar el error para reconciliación.

Reglas predeterminadas:

- correo verificado o verificación completada, según el flujo de registro.
- usuario sin suscripción pagada.
- usuario sin beta previa si la campaña lo exige.
- campaña dentro de su ventana de vigencia.
- límite de asignaciones no superado.

- [ ] **Step 2: Keep registration idempotent**

Un retry del callback de registro no debe crear grants duplicados ni consumir dos cupos.

- [ ] **Step 3: Add code redemption**

Si se habilita en MVP:

- normalizar código.
- validar campaña activa.
- validar elegibilidad.
- crear un solo grant por usuario/campaña.
- devolver fecha de expiración.

- [ ] **Step 4: Add tests**

Cubrir registro nuevo, callback repetido, usuario pagado, código inválido, código agotado y campaña pausada.

---

## Task 7: Add Expiration Reconciliation And Notifications

**Files:**

- Create: `lib/beta/reconciliation.ts`
- Create: `lib/beta/reconciliation.test.ts`
- Create protected scheduler route if the deployment already supports scheduled routes.
- Reuse the existing email/notification infrastructure if available.

- [ ] **Step 1: Implement reconciliation**

El proceso debe:

- marcar como `EXPIRED` grants cuyo `expiresAt <= now`.
- no reactivar grants revocados.
- detectar campañas agotadas.
- identificar grants que requieren recordatorio.
- producir eventos de analytics una sola vez por hito.

- [ ] **Step 2: Make expiry independent from the job**

La función de entitlements debe negar acceso por fecha aunque el job no se ejecute.

- [ ] **Step 3: Add reminder milestones**

Recordatorios recomendados:

- 14 días.
- 7 días.
- 1 día.
- vencimiento.
- seguimiento de conversión 7 días después.

Si no existe un proveedor de correo configurado, registrar los hitos y dejar el envío detrás de un adaptador existente, sin añadir una dependencia por esta tarea.

- [ ] **Step 4: Add tests**

Cubrir idempotencia, zona horaria UTC, grants revocados y repetición del scheduler.

---

## Task 8: Add Analytics Events And Beta Dashboard

**Files:**

- Modify: `lib/analytics/events.ts`
- Modify: `lib/analytics/store.ts`
- Create: `lib/data/admin-beta-analytics.ts`
- Create: `lib/data/admin-beta-analytics.test.ts`
- Create: `components/admin/admin-beta-analytics.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `components/admin/admin-page-tabs.tsx`

- [ ] **Step 1: Add typed beta event names**

Agregar:

```text
beta_eligible
beta_assigned
beta_started
beta_feature_used
beta_expiring_14d
beta_expiring_7d
beta_expiring_1d
beta_expired
beta_upgrade_clicked
beta_checkout_started
beta_converted
beta_revoked
```

- [ ] **Step 2: Add safe parameters**

Permitir únicamente parámetros agregados/no sensibles:

- `campaign`.
- `duration_days`.
- `grant_source`.
- `target_plan`.
- `days_remaining`.
- `feature`.
- `conversion_window`.

No enviar correo, nombre, ID interno ni contenido de presupuesto.

- [ ] **Step 3: Implement beta metrics**

Por campaña y duración calcular:

- elegibles.
- asignados.
- activados en 7 días.
- uso de funcionalidades Pro.
- retención en semanas 1, 4 y 8.
- upgrades vistos.
- checkouts iniciados.
- conversiones pagadas.
- conversiones antes y después de vencer.
- costo/uso de IA cuando la métrica esté disponible.

- [ ] **Step 4: Extend retention window**

El analytics actual soporta un rango de hasta 90 días y cohortes de 7/28/56 días. Añadir una vista beta con ventana de observación de 120–180 días para medir una beta de 90 días y su conversión posterior.

- [ ] **Step 5: Add dashboard UI**

Crear una vista administrativa coherente con los componentes actuales:

- selector de campaña.
- selector 60/90 días.
- embudo.
- tabla por campaña.
- cohortes.
- alertas de baja activación o alta expiración sin conversión.
- exportación si el patrón actual de analytics lo permite.

- [ ] **Step 6: Run analytics tests**

```bash
npm run test -- lib/analytics/events.test.ts lib/analytics/store.test.ts lib/data/admin-beta-analytics.test.ts
```

---

## Task 9: Add User-Facing Beta Status

**Files:**

- Modify: `components/account/account-page-content.tsx`
- Modify: `app/account/page.tsx` if the data contract requires it.
- Modify the shared shell/banner only after inspecting the existing layout.
- Add component tests.

- [ ] **Step 1: Show beta access metadata**

Mostrar:

- `Pro Beta`.
- fecha de vencimiento.
- días restantes.
- aviso de que no existe cobro durante la beta.
- CTA de upgrade cuando corresponda.

- [ ] **Step 2: Keep billing separate**

No mostrar `BillingSubscription` como activa para un beta grant. La tarjeta de cuenta debe distinguir:

```text
Origen: Beta comercial
Facturación: Sin cargo durante la beta
```

- [ ] **Step 3: Add expiry CTA**

Mostrar un CTA de upgrade cuando queden 14 días o menos, sin bloquear el uso mientras la beta siga vigente.

- [ ] **Step 4: Add tests**

Cubrir beta activa, beta próxima a vencer, beta vencida, Stripe Pro y Starter normal.

---

## Task 10: Full Verification And Pilot Readiness

- [ ] **Step 1: Run targeted tests**

```bash
npm run test -- lib/beta app/api/admin/beta lib/data/admin-beta-analytics.test.ts
```

- [ ] **Step 2: Run existing billing and entitlement tests**

```bash
npm run test -- lib/workspace/entitlements.test.ts lib/billing app/api/billing components/account
```

Ajustar los paths si algún patrón no existe en el repositorio.

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Manual QA**

1. Crear campaña de 60 días.
2. Activarla con límite de 2 usuarios.
3. Ejecutar preview de elegibilidad.
4. Asignar un usuario.
5. Confirmar que recibe features Pro.
6. Confirmar que aparece `Pro Beta` y fecha de vencimiento.
7. Simular vencimiento con un reloj controlado en pruebas o datos de staging.
8. Confirmar retorno a Starter.
9. Asignar un usuario con Stripe Pro y verificar que no se degrada.
10. Revocar un grant y verificar invalidación de caché.
11. Revisar auditoría y eventos de analytics.

- [ ] **Step 5: Pilot checklist**

- Campaña limitada a 20–50 usuarios.
- Límite de tokens/IA monitorizado.
- Dashboard de activación funcionando.
- Recordatorios verificados.
- Procedimiento de revocación documentado.
- Política de soporte definida.

---

## Rollout Strategy

### Phase A — Internal validation

- Crear una campaña interna de 60 días.
- Asignar cuentas de prueba.
- Validar precedencia, expiración y auditoría.

### Phase B — Controlled beta

- 20–50 usuarios.
- Una campaña de 60 días.
- Un grupo pequeño de 90 días para comparación.
- Revisión semanal de activación, soporte y consumo de IA.

### Phase C — Commercial experiments

- Códigos de referidos.
- Campañas por fuente UTM.
- Pilotos por empresa.
- Pruebas de mensajes y CTA.

### Phase D — Paid conversion optimization

- Comparar 60 vs. 90 días.
- Medir conversión antes y después del vencimiento.
- Ajustar límites y criterios de elegibilidad.
- Decidir si se habilita beta por workspace.

---

## Success Criteria

- Un usuario puede recibir Pro temporal durante exactamente 60 o 90 días.
- El acceso beta no crea ni falsifica una suscripción pagada.
- Un grant vencido no permite funciones Pro aunque el scheduler falle.
- Stripe Pro y Empresa conservan prioridad.
- Las asignaciones son idempotentes y auditables.
- El administrador puede crear campañas, previsualizar elegibles, asignar, extender y revocar.
- El registro automático no falla si la asignación beta falla.
- Analytics distingue campaña, duración, activación, vencimiento y conversión.
- El dashboard permite comparar campañas de 60 y 90 días.
- `npm run lint`, `npm run typecheck` y las pruebas relevantes pasan.
