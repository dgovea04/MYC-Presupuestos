# Commercial Beta Access — Functional And Technical Specification

**Status:** Draft for implementation  
**Date:** 2026-08-15  
**Product:** MC Presupuestos  
**Scope:** Beta comercial con acceso temporal a funcionalidades Pro, asignación automática/administrativa y medición de conversión.

---

## 1. Purpose

MC Presupuestos necesita ofrecer acceso gratuito y controlado a funcionalidades Pro durante periodos definidos, inicialmente de 60 o 90 días. El sistema debe permitir experimentar con campañas comerciales sin contaminar la facturación, mantener el control administrativo y medir si la beta produce usuarios activos y suscripciones pagadas.

La beta es una **concesión temporal de entitlements**, no una suscripción, no un cambio permanente de plan y no una modificación de los datos del usuario.

---

## 2. Scope

### Included

- Campañas beta configurables.
- Duraciones de 60 y 90 días.
- Asignación individual, masiva, automática y por código.
- Reglas de elegibilidad.
- Acceso temporal al plan Pro.
- Expiración automática por fecha.
- Revocación y extensión controladas.
- Auditoría administrativa.
- Recordatorios de vencimiento.
- Eventos internos y GA4.
- Dashboard de cohortes y conversión.
- Compatibilidad con planes Starter, Pro, Empresa y Stripe.

### Not included in MVP

- Facturación recurrente de la beta.
- Cobro automático al finalizar la beta sin consentimiento explícito.
- Soporte completo de grants por empresa/workspace.
- Motor externo de marketing automation.
- Importación ilimitada de usuarios.
- Segmentación basada únicamente en IP o fingerprint.
- Eliminación de datos al vencer la beta.

---

## 3. Terminology

### Campaign

Configuración comercial que define duración, ventana de operación, límites y elegibilidad.

### Grant

Asignación concreta de acceso temporal a un usuario. Un usuario puede tener historial de grants, pero no debe tener grants activos incompatibles simultáneamente.

### Beta Pro

Presentación comercial del plan Pro concedido por un grant vigente. No representa una suscripción de Stripe.

### Activation

Primera acción de valor posterior a la asignación, por ejemplo crear un proyecto, crear/importar un presupuesto, crear un APU, usar una fórmula, utilizar Khipu o completar una exportación.

### Conversion

Creación de una suscripción pagada Pro o Empresa atribuida a una cohorte beta dentro de la ventana definida.

---

## 4. Business Rules

### 4.1 Duration

- Una campaña debe usar `durationDays = 60` o `durationDays = 90`.
- La duración se calcula desde `startsAt`.
- `expiresAt` es exclusivo: el acceso es válido mientras `now < expiresAt`.
- Todas las fechas se almacenan en UTC.

### 4.2 Eligibility

Una campaña puede exigir:

- correo verificado.
- usuario nuevo.
- fuente UTM específica.
- campaña UTM específica.
- dominio de correo permitido.
- código promocional.
- ausencia de suscripción pagada.
- ausencia de un beta grant anterior.

La elegibilidad debe evaluarse en backend. La UI solo puede previsualizar el resultado; nunca conceder acceso por confiar en datos del cliente.

### 4.3 Assignment

- Una asignación debe ser idempotente.
- Un retry HTTP no debe consumir un cupo adicional.
- El límite de campaña debe aplicarse dentro de una transacción.
- El usuario debe recibir como máximo un grant activo de la misma campaña.
- Las extensiones deben crear un registro de auditoría con valor anterior y nuevo.
- El grant no debe modificar `User.membershipPlanId`.
- El grant no debe crear un `BillingSubscription`.

### 4.4 Access precedence

La licencia efectiva se resuelve así:

1. Usuario suspendido o membership de workspace inválida: no hay acceso.
2. Suscripción pagada Empresa o Pro vigente: conserva su plan pagado.
3. Grant beta vigente: acceso Pro temporal.
4. Suscripción de empresa vigente aplicable al workspace.
5. Plan personal permanente.
6. Starter.

Una beta nunca debe degradar un plan pagado. Una beta vencida tampoco debe eliminar el plan permanente del usuario.

### 4.5 Expiration

La autorización debe consultar las fechas directamente. El job de reconciliación solo mantiene estados, envía recordatorios y genera métricas.

Al vencer:

- `BetaGrant.status` puede pasar a `EXPIRED`.
- El usuario retorna a su licencia anterior.
- No se borran datos.
- Se bloquean únicamente features que requieran Pro.
- Se muestra CTA de upgrade.

### 4.6 Revocation

La revocación manual requiere:

- permiso `beta.revoke`.
- motivo obligatorio.
- usuario actor.
- timestamp.
- invalidación de caché.
- evento de analytics.

La revocación no elimina el grant; agrega `revokedAt`, `revokedById` y estado `REVOKED`.

---

## 5. Domain Model

### 5.1 `BetaCampaign`

Campos requeridos:

```text
id                 String, cuid, primary key
name               String
code               String?, unique when present
planSlug           String, default "pro"
durationDays       Int, allowed values 60 or 90
status             DRAFT | ACTIVE | PAUSED | FINISHED
assignmentMode     AUTOMATIC | ADMIN | CODE | MIXED
startsAt           DateTime
endsAt             DateTime?
maxAssignments     Int?
eligibilityRules   Json
createdById         String
createdAt          DateTime
updatedAt          DateTime
```

Invariantes:

- `planSlug` solo puede ser `pro` en el MVP.
- `startsAt < endsAt` cuando `endsAt` existe.
- `maxAssignments` es nulo o positivo.
- Una campaña `FINISHED` no puede volver a `ACTIVE` sin una operación explícita y auditada; se recomienda no permitirlo.

### 5.2 `BetaGrant`

Campos requeridos:

```text
id                 String, cuid, primary key
campaignId         String
userId             String
companyId          String?, future workspace scope
planSlug           String, default "pro"
status             SCHEDULED | ACTIVE | EXPIRED | REVOKED
source             AUTOMATIC | ADMIN | CODE | IMPORT
startsAt           DateTime
expiresAt          DateTime
assignedById       String?
revokedAt          DateTime?
revokedById        String?
metadata           Json?
createdAt          DateTime
updatedAt          DateTime
```

Restricciones e índices:

```text
unique(campaignId, userId)
index(userId, status, expiresAt)
index(campaignId, status)
index(expiresAt, status)
index(companyId, status) when company grants are enabled
```

Relaciones a `User` deben usar nombres explícitos cuando haya más de una relación desde el mismo modelo, por ejemplo creador, asignador y revocador.

### 5.3 Stored status vs. effective status

El estado almacenado facilita reportes y reconciliación, pero no es la fuente definitiva de autorización. La autorización se calcula con:

```text
status != REVOKED
revokedAt IS NULL
startsAt <= now
expiresAt > now
```

---

## 6. Typed Service Contracts

### 6.1 Resolve active beta

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

`daysRemaining` debe calcularse con una política consistente, preferiblemente días calendario UTC restantes, y debe tener pruebas para las fechas límite.

### 6.2 Evaluate eligibility

```ts
export type BetaEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  existingActiveGrantId: string | null;
  hasPaidSubscription: boolean;
};

export async function evaluateBetaEligibility(options: {
  campaignId: string;
  userId: string;
  code?: string | null;
  now?: Date;
}): Promise<BetaEligibilityResult>;
```

### 6.3 Assign grant

```ts
export type AssignBetaGrantInput = {
  campaignId: string;
  userId: string;
  source: "AUTOMATIC" | "ADMIN" | "CODE" | "IMPORT";
  assignedById?: string | null;
  reason?: string | null;
  startsAt?: Date;
};

export type AssignBetaGrantResult = {
  grantId: string;
  created: boolean;
  startsAt: Date;
  expiresAt: Date;
};

export async function assignBetaGrant(
  input: AssignBetaGrantInput,
): Promise<AssignBetaGrantResult>;
```

`created = false` indica que la solicitud fue un retry idempotente y se reutilizó el grant existente.

### 6.4 Revoke grant

```ts
export async function revokeBetaGrant(options: {
  grantId: string;
  actorUserId: string;
  reason: string;
}): Promise<void>;
```

### 6.5 Effective license additions

La respuesta de `getEffectiveWorkspaceLicense` debe mantener compatibilidad con sus consumidores actuales y añadir campos opcionales:

```ts
{
  accessSource?: "PLAN" | "COMPANY_SUBSCRIPTION" | "BETA" | "STRIPE";
  betaGrantId?: string | null;
  betaCampaignName?: string | null;
  betaExpiresAt?: string | null;
}
```

---

## 7. API Contracts

### `POST /api/admin/beta/campaigns`

Crea una campaña. Requiere `beta.manage`.

```json
{
  "name": "Piloto 60 días",
  "code": "PILOTO60",
  "durationDays": 60,
  "assignmentMode": "MIXED",
  "startsAt": "2026-09-01T00:00:00.000Z",
  "endsAt": "2026-12-01T00:00:00.000Z",
  "maxAssignments": 50,
  "eligibilityRules": {
    "requireVerifiedEmail": true,
    "excludePaidSubscribers": true,
    "excludePreviousBetaUsers": true
  }
}
```

### `GET /api/admin/beta/campaigns`

Devuelve campañas paginadas con:

- estado.
- duración.
- asignados.
- activos.
- vencidos.
- conversiones.
- cupos restantes.

### `POST /api/admin/beta/campaigns/:id/assign`

Acepta asignación individual o masiva y soporta `dryRun`.

```json
{
  "userIds": ["user-1", "user-2"],
  "source": "ADMIN",
  "dryRun": true,
  "reason": "Piloto de constructoras"
}
```

Respuesta de `dryRun`:

```json
{
  "eligible": ["user-1"],
  "excluded": [
    {
      "userId": "user-2",
      "reasons": ["PAID_SUBSCRIPTION"]
    }
  ],
  "remainingAssignments": 48
}
```

### `PATCH /api/admin/beta/grants/:id`

Operaciones permitidas:

```json
{
  "action": "REVOKE",
  "reason": "Solicitud de soporte"
}
```

o:

```json
{
  "action": "EXTEND",
  "newExpiresAt": "2026-12-15T00:00:00.000Z",
  "reason": "Piloto ampliado"
}
```

### `POST /api/beta/redeem`

Opcional para el MVP. Requiere usuario autenticado.

```json
{
  "code": "PILOTO60"
}
```

No debe revelar si un correo o usuario específico existe fuera de la sesión autenticada.

---

## 8. Admin UX Requirements

### Campaign list

Debe permitir:

- filtrar por `DRAFT`, `ACTIVE`, `PAUSED`, `FINISHED`.
- ver duración y ventana.
- ver cupos usados/restantes.
- abrir detalle.
- pausar o finalizar con confirmación.

### Campaign detail

Debe incluir:

- resumen de elegibilidad.
- preview de asignación.
- asignación individual/masiva.
- grants activos, vencidos y revocados.
- activación y conversión.
- exportación según `beta.export`.

### User account

Cuando exista beta activa:

```text
Plan: Pro Beta
Origen: Beta comercial
Facturación: Sin cargo durante la beta
Válido hasta: 15 nov 2026
Días restantes: 42
```

A 14 días o menos debe aparecer un CTA de upgrade, sin bloquear las funcionalidades antes del vencimiento.

---

## 9. Automation Requirements

### Automatic assignment

El flujo de registro debe:

1. Crear el usuario normalmente.
2. Evaluar campañas automáticas activas.
3. Asignar el primer campaign grant elegible.
4. Emitir `beta_assigned`.
5. Continuar aunque la asignación falle; el fallo debe ser observable y reconciliable.

El callback de Google y los reintentos de registro deben usar la misma operación idempotente.

### Scheduler/reconciliation

El proceso periódico debe:

- marcar grants vencidos.
- emitir recordatorios una sola vez por hito.
- detectar campañas agotadas.
- reconciliar asignaciones creadas parcialmente.
- producir un resumen operativo.

Hitos:

- 14 días antes.
- 7 días antes.
- 1 día antes.
- vencimiento.
- 7 días después para seguimiento de conversión.

La resolución de entitlements no debe depender de este proceso.

---

## 10. Analytics Specification

### Event names

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

### Allowed parameters

```text
campaign
campaign_type
duration_days
grant_source
target_plan
days_remaining
feature
conversion_window
```

Los parámetros deben agregarse a las listas de seguridad de `lib/analytics/events.ts` y `lib/analytics/store.ts` solo después de validarlos.

### Internal identity

`MarketingEvent.userId` puede asociar el evento internamente. GA4 no debe recibir correo, nombre, IDs de proyecto, IDs internos como dimensión pública ni contenido de presupuestos.

### Funnel

```text
eligible
→ assigned
→ activated
→ Pro feature used
→ retained W1/W4/W8
→ upgrade clicked
→ checkout started
→ paid subscription created
```

### Conversion window

La métrica debe separar:

- conversión durante la beta.
- conversión entre 0 y 7 días después.
- conversión entre 8 y 14 días después.
- no conversión observada.

Para una beta de 90 días, el reporte debe observar al menos 120 días desde el inicio de la cohorte. Se recomienda soportar 180 días para análisis posterior.

### Demo exclusion

Los eventos de proyectos demo deben conservar su marca `isDemo` y excluirse de activación comercial cuando se calcule activación real, igual que las métricas actuales de marketing.

---

## 11. Security And Abuse Controls

- Validar todas las asignaciones en backend.
- Aplicar rate limit al endpoint de redeem.
- No permitir que un usuario modifique su propio grant.
- Exigir MFA para operaciones administrativas sensibles si el permiso actual lo requiere.
- Auditar asignación, extensión, revocación y cambios de campañas.
- Mantener límites de tokens/IA monitoreados.
- Usar señales de duplicación como alertas, no como único criterio de bloqueo.
- No almacenar datos sensibles innecesarios en `metadata`.
- No usar el código promocional como autorización de administrador.
- Invalidar entitlements después de cambios de acceso.

---

## 12. Compatibility And Migration

La migración debe ser aditiva:

- No modificar grants existentes porque todavía no existen.
- No convertir `BillingSubscription` manuales actuales en beta automáticamente sin una decisión explícita.
- Mantener `MembershipPlan` para la licencia permanente.
- Mantener `BillingSubscription` para Stripe/manual pagado.
- Mantener los consumidores actuales de `getEffectiveWorkspaceLicense`.
- Añadir campos opcionales a la respuesta de licencia para evitar migración masiva de UI.
- Permitir que el panel actual siga administrando el plan permanente hasta que el módulo Beta Comercial esté disponible.

---

## 13. Acceptance Criteria

### Functional

- [ ] Se puede crear una campaña de 60 días.
- [ ] Se puede crear una campaña de 90 días.
- [ ] Se puede limitar la cantidad de asignaciones.
- [ ] Se puede asignar a un usuario elegible.
- [ ] La asignación es idempotente.
- [ ] Se puede asignar en lote con preview.
- [ ] Se puede revocar con motivo.
- [ ] Se puede extender con motivo.
- [ ] El acceso termina en `expiresAt` aunque no corra el scheduler.
- [ ] El usuario vuelve a Starter al vencer, si no tenía otra licencia superior.
- [ ] Un usuario con Stripe Pro no pierde acceso por recibir una beta.
- [ ] Un usuario no recibe cobro por la beta.
- [ ] El usuario ve claramente que su Pro proviene de beta.

### Operational

- [ ] Todas las operaciones administrativas quedan en `AdminAuditLog`.
- [ ] Existen permisos diferenciados para leer, administrar, asignar, revocar y exportar.
- [ ] Las asignaciones fallidas pueden ser detectadas y reconciliadas.
- [ ] Los recordatorios no se duplican.
- [ ] El consumo de IA de usuarios beta es observable.

### Analytics

- [ ] Se registra elegibilidad.
- [ ] Se registra asignación.
- [ ] Se registra activación.
- [ ] Se registra uso Pro.
- [ ] Se registra vencimiento.
- [ ] Se registra clic a upgrade y checkout.
- [ ] Se registra conversión pagada.
- [ ] El dashboard separa campañas de 60 y 90 días.
- [ ] La activación excluye acciones demo.

### Quality

- [ ] `npm run lint` pasa.
- [ ] `npm run typecheck` pasa.
- [ ] Las pruebas unitarias de beta pasan.
- [ ] Las pruebas existentes de billing y entitlements pasan.
- [ ] Se ejecuta QA manual con un piloto de staging.

---

## 14. Recommended Initial Campaign

```text
Nombre: Piloto Pro 60 días
Código: PILOTO60
Duración: 60 días
Modo: MIXED
Límite: 50 usuarios
Correo verificado: requerido
Suscripción pagada: excluida
Beta previa: excluida
Conversión observada: durante beta + 14 días
```

Crear una segunda campaña de 90 días únicamente para un segmento claramente identificado, para que la comparación tenga valor estadístico y comercial.

---

## 15. Open Decisions Before Implementation

Estas decisiones pueden usar los valores recomendados sin bloquear el diseño técnico:

1. Si la beta automática se asigna al completar registro o después de verificar correo.
2. Si los 90 días se reservan exclusivamente para campañas administradas.
3. Si el MVP incluye códigos promocionales o se deja para la segunda iteración.
4. Qué proveedor/canal de correo se usará para recordatorios, reutilizando la infraestructura existente.
5. Qué límites específicos de IA tendrá la beta para controlar coste y abuso.
6. Cuándo se habilitará el alcance por empresa/workspace.
