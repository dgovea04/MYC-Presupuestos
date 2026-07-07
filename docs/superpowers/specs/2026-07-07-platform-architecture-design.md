# Platform Architecture Design

**Fecha:** 2026-07-07

**PRD fuente:** `prd/PRD-arquitectura-de-plataforma.md`

## Objetivo

Definir una arquitectura objetivo para MC Presupuestos donde la WebApp sea el producto canónico, `Company` evolucione funcionalmente a `Workspace`, la autorización y los planes se resuelvan una sola vez por contexto activo, y Desktop/PWA se apoyen en la misma aplicación sin duplicar lógica de negocio.

## Alcance

Este diseño cubre:

- Modelo de workspace multiempresa sobre la base actual
- Membresías de usuarios por workspace
- Suscripciones, licencias y feature flags a nivel workspace
- Carga centralizada de contexto de sesión, permisos y navegación
- Endurecimiento de ownership para proyectos, presupuestos, recursos e importaciones
- Preparación del producto para PWA y wrapper Desktop con Tauri

Este diseño no cubre:

- Una app móvil nativa
- SSO empresarial completo
- Integraciones nativas avanzadas de Desktop
- Reescritura de módulos de presupuesto, APU, metrados, cronograma o riesgo
- Reemplazo total del modelo `Company` por un rename físico inmediato a `Workspace`

## Estado actual

La base actual ya está bastante cerca de una estrategia web-first:

- Toda la lógica de producto corre en Next.js App Router + Prisma + PostgreSQL
- La autenticación ya está centralizada en NextAuth/Auth.js con Email/Password y Google OAuth
- Los módulos principales ya viven en una sola WebApp
- El sidebar ya consume `unlockedFeatures` y oculta rutas según acceso
- Existen planes, billing y feature gates funcionales

Pero hay cuatro límites estructurales que impiden cumplir el PRD tal como está escrito:

### 1. `Company` es single-owner

Hoy `Company` tiene `userId` y funciona como empresa del usuario dueño. Eso permite ownership simple, pero no membresías reales multiusuario/multiworkspace.

### 2. La sesión resuelve un único `companyId`

`lib/auth/options.ts` hidrata `token.companyId` con la primera empresa encontrada del usuario. Eso bloquea el cambio de workspace sin re-login y convierte una preferencia operativa en un dato fijo de sesión.

### 3. Las licencias son user-centric

`lib/billing/entitlements.ts` calcula acceso efectivo desde `User.membershipPlanId` y `BillingSubscription.userId`. El PRD exige lo contrario: licencias, límites y features pertenecen al workspace.

### 4. El contexto de acceso sigue disperso

Aunque ya existe `AppShell` y `getEffectiveUserLicense`, todavía hay rutas y formularios que aceptan `companyId` desde cliente o derivan acceso desde `userId` en vez de desde un workspace activo resuelto en servidor.

## Decisiones principales

## 1. `Company` será el workspace canónico

No se recomienda renombrar físicamente `Company` en esta fase. La decisión es:

- Mantener `Company` como nombre de persistencia y relación Prisma
- Tratarlo como `Workspace` en UX, sesión, servicios y documentación
- Introducir una capa `lib/workspace/*` que encapsule esa traducción

Esto reduce riesgo y evita una migración masiva con bajo valor de negocio.

## 2. Membresías explícitas por workspace

Agregar un modelo `CompanyMembership` en vez de seguir usando `Company.userId` como única relación organizacional.

Campos mínimos:

- `id`
- `companyId`
- `userId`
- `role` (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`)
- `status` (`ACTIVE`, `INVITED`, `SUSPENDED`)
- `joinedAt`
- `invitedById`

Decisiones:

- Un usuario puede tener muchas membresías activas
- Un workspace puede tener muchos usuarios
- `Company.userId` se mantiene temporalmente como `legacyOwnerUserId` operativo hasta completar migración
- La fuente de verdad para permisos pasa a ser `CompanyMembership`

## 3. Suscripción y plan a nivel workspace

Mover la lógica de plan desde usuario hacia workspace.

Modelo recomendado:

- `CompanySubscription`
- `CompanyFeatureOverride`

`CompanySubscription` debe contener:

- `companyId`
- `membershipPlanId`
- `provider`
- `status`
- `currentPeriodStart`
- `currentPeriodEnd`
- `pastDueStartedAt`
- `externalCustomerId`
- `externalSubscriptionId`

Decisiones:

- `User.membershipPlanId` queda en modo legado/transicional
- `BillingSubscription` actual no debe seguir siendo la fuente final de autorización
- El acceso se resuelve por workspace activo, no por usuario global

## 4. Workspace context cargado una sola vez

El PRD pide que planes, permisos y features se carguen una única vez y no en validaciones dispersas de UI. La implementación recomendada es un `WorkspaceContextEnvelope` resuelto en servidor.

Contrato propuesto:

```ts
type WorkspaceContextEnvelope = {
  workspace: {
    id: string;
    name: string;
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  };
  membership: {
    planSlug: "starter" | "pro" | "empresa";
    planName: string;
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
  };
  featureFlags: WorkspaceFeatureFlag[];
  limits: {
    projects: { limit: number | null; usage: number };
    budgets: { limit: number | null; usage: number };
    aiTokens: { allowance: number; consumed: number; available: number };
  };
};
```

Uso:

- `AppShell` resuelve este envelope
- El sidebar, switches, páginas y gates leen del mismo contexto
- Los route handlers siguen validando acceso, pero ya no recalculan la navegación

## 5. Feature registry centralizado

Los feature flags actuales ya existen como `FeatureKey`, pero deben elevarse a un registro de plataforma más explícito.

Crear:

- `lib/workspace/feature-registry.ts`
- `lib/workspace/entitlements.ts`

El registro debe definir para cada feature:

- `key`
- `scope` (`workspace`)
- `defaultAvailability`
- `minimumPlan`
- `uiNavigationHints`

Ejemplos iniciales:

- `ai.local`
- `partidas.similarity`
- `work_schedule.intelligent`
- `polynomial_formula.adjustments`
- `risk_analysis`
- `exports.advanced`
- `collaboration.realtime`
- `desktop.native_bridge`

Decisión:

- La UI puede seguir usando `requiredFeature`
- La resolución ya no dependerá de listas hardcodeadas solo en billing

## 6. Sesión con workspace activo seleccionable

La sesión debe incluir el workspace activo, pero no quedar amarrada a la primera empresa del usuario.

Cambios recomendados:

- JWT/session incluyen `activeCompanyId`
- Persistencia del workspace activo en cookie segura o tabla de preferencia de usuario
- Endpoint de cambio de workspace:
  - `POST /api/workspaces/active`
- Lista de workspaces disponibles:
  - `GET /api/workspaces`

Regla:

- Cambiar de workspace no requiere nuevo login
- Toda página protegida resuelve datos desde `activeCompanyId`

## 7. Authorization por workspace en servicios

Crear un dominio `lib/workspace/access.ts` con helpers reutilizables:

- `requireActiveWorkspace(session)`
- `assertWorkspaceMembership({ userId, companyId, minimumRole? })`
- `assertProjectInWorkspace({ projectId, companyId })`
- `assertBudgetInWorkspace({ budgetId, companyId })`

Decisiones:

- Ningún endpoint nuevo debe aceptar `companyId` del cliente como verdad final
- En flows heredados que aún lo acepten, el servidor debe verificar pertenencia
- Los servicios de dominio deben recibir `companyId` ya resuelto por servidor o derivarlo de la entidad padre

## 8. Navegación y shell workspace-first

`AppShell` ya es un buen punto de centralización y debe evolucionar a:

- cargar `WorkspaceContextEnvelope`
- renderizar `WorkspaceSwitcher`
- pasar `featureFlags` y `role` a navegación
- mostrar branding del workspace activo

Esto convierte a la app en un único workspace empresarial compartido, como pide el PRD, sin reescribir cada módulo.

## 9. Desktop como adaptador, no como producto paralelo

No se recomienda introducir código exclusivo de Desktop en la lógica principal.

Crear una frontera de adaptadores:

- `lib/platform/platform-capabilities.ts`
- `lib/platform/runtime.ts`
- `types/platform.ts`

Contrato ejemplo:

```ts
type PlatformRuntime = "web" | "desktop";

type PlatformCapabilities = {
  runtime: PlatformRuntime;
  supportsNativeNotifications: boolean;
  supportsLocalFileOpen: boolean;
  supportsLargeFileBridge: boolean;
};
```

Decisiones:

- La WebApp siempre es la fuente de verdad
- Desktop solo agrega capacidades nativas optativas
- La ausencia de bridge nativo nunca debe romper el flujo web

## 10. Preparación PWA desde la WebApp

Aunque la PWA es fase futura, el diseño debe dejar preparado:

- manifest
- service worker strategy
- metadata e iconografía
- separación entre lectura local temporal y fuente de verdad remota

No se recomienda prometer edición offline de presupuestos en esta fase porque hay alto riesgo de conflicto y precisión financiera.

## Modelo de datos objetivo

### Nuevos modelos

- `CompanyMembership`
- `CompanySubscription`
- `CompanyFeatureOverride`

### Modelos existentes a adaptar

- `Company`
- `BillingSubscription`
- `User`
- `UserSettings`

### Relaciones objetivo

```text
User
  -> CompanyMembership[]
  -> Company
  -> Project
  -> Budget

Company
  -> CompanyMembership[]
  -> CompanySubscription?
  -> CompanyFeatureOverride[]
  -> Project[]
```

## API propuesta

### Workspace context

- `GET /api/workspaces`
- `GET /api/workspaces/active`
- `POST /api/workspaces/active`

### Workspace administration

- `GET /api/workspaces/[id]/members`
- `POST /api/workspaces/[id]/members`
- `PATCH /api/workspaces/[id]/members/[membershipId]`

### Workspace entitlements

- `GET /api/workspaces/[id]/entitlements`

Estas APIs deben alimentar UI, gates y futuras integraciones Desktop.

## Migración recomendada

## Fase 1: Compatibilidad estructural

- agregar membresías
- backfill del owner actual
- introducir workspace context
- mantener `Company.userId` y `User.membershipPlanId` como legado

## Fase 2: Entitlements centralizados

- mover plan y features a workspace
- adaptar sidebar, AppShell y guards
- migrar límites de proyecto/presupuesto

## Fase 3: Workspace switcher y ownership duro

- cambio de workspace activo
- endurecer importaciones, proyectos y recursos
- eliminar dependencia de primera empresa en sesión

## Fase 4: PWA foundation

- manifest
- iconos
- installability
- estrategia inicial de cache

## Fase 5: Desktop wrapper con Tauri

- shell que carga `app.mcpresupuestos.com`
- bridge nativo opcional
- notificaciones y archivos como adaptadores

## Riesgos

### Riesgo 1: romper ownership actual

Mitigación:

- migración aditiva, no destructiva
- `Company.userId` queda temporalmente como fallback
- helpers centrales de autorización con tests de regresión

### Riesgo 2: mezcla de plan por usuario y por workspace

Mitigación:

- declarar una fuente de verdad transicional clara
- usar flags de compatibilidad
- migrar primero lectura, luego escritura

### Riesgo 3: UI inconsistente al cambiar workspace

Mitigación:

- centralizar `activeCompanyId`
- revalidar caches por tag de workspace
- no leer empresas por “primera compañía del usuario”

### Riesgo 4: scope creep con Desktop

Mitigación:

- wrapper solo después de tener web SaaS estable
- no mover lógica a Tauri
- bridge nativo detrás de interfaces pequeñas

## Decisiones tomadas

- `Company` se conserva como nombre de persistencia y actúa como workspace
- La membresía real se modela con una tabla pivote nueva
- Licencias y features se mueven a nivel workspace
- `AppShell` pasa a ser el punto central de contexto de workspace
- El cambio de workspace se hace sin reautenticación
- Desktop se diseña como adaptador de capacidades, no como segunda app

## Resultado esperado

MC Presupuestos quedará alineado con el PRD sin un rewrite innecesario: una sola WebApp canónica, multiworkspace real, licenciamiento por empresa, permisos coherentes, navegación derivada de feature flags y una base limpia para PWA y Tauri en fases posteriores.
