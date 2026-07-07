# Platform Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir MC Presupuestos en una plataforma web-first y workspace-first, con membresías multiempresa, licencias por workspace, feature flags centralizados y base preparada para PWA/Desktop wrapper sin duplicar lógica.

**Architecture:** Mantener `Company` como entidad persistente y convertirlo funcionalmente en `Workspace` mediante una nueva capa `lib/workspace/*`. La migración es aditiva: primero se crean membresías, contexto de workspace y entitlements centralizados; después se endurecen rutas y UI; finalmente se habilitan adaptadores de plataforma para PWA/Tauri.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, PostgreSQL, NextAuth/Auth.js, Zod, Vitest, Tailwind, shadcn/ui, Tauri (fase posterior)

---

## File Structure

**Create**

- `types/workspace.ts`
- `lib/workspace/types.ts`
- `lib/workspace/access.ts`
- `lib/workspace/context.ts`
- `lib/workspace/memberships.ts`
- `lib/workspace/active-workspace.ts`
- `lib/workspace/feature-registry.ts`
- `lib/workspace/entitlements.ts`
- `lib/platform/runtime.ts`
- `lib/platform/platform-capabilities.ts`
- `lib/validations/workspace.ts`
- `lib/validations/workspace.test.ts`
- `lib/workspace/access.test.ts`
- `lib/workspace/context.test.ts`
- `lib/workspace/entitlements.test.ts`
- `app/api/workspaces/route.ts`
- `app/api/workspaces/active/route.ts`
- `app/api/workspaces/[id]/members/route.ts`
- `app/api/workspaces/route.test.ts`
- `app/api/workspaces/active/route.test.ts`
- `components/layout/workspace-switcher.tsx`
- `components/layout/workspace-switcher.test.tsx`
- `public/pwa/manifest.webmanifest`

**Modify**

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `lib/auth/options.ts`
- `lib/auth/session.ts`
- `lib/auth/registration.ts`
- `types/next-auth.d.ts`
- `lib/billing/entitlements.ts`
- `components/billing/feature-gate.tsx`
- `components/layout/app-shell.tsx`
- `components/layout/app-sidebar-client.tsx`
- `components/layout/sidebar-user-card.tsx`
- `lib/data/projects.ts`
- `app/projects/new/page.tsx`
- `components/projects/project-form.tsx`
- `app/api/projects/route.ts`
- `app/api/resources/route.ts`
- `app/api/imports/s10/import/route.ts`
- `app/api/imports/rw7/import/route.ts`
- `app/api/imports/delphin/import/route.ts`
- `app/layout.tsx`

## Task 1: Preparar el modelo workspace-first en Prisma

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Create: `types/workspace.ts`
- Create: `lib/workspace/types.ts`
- Create: `lib/validations/workspace.ts`
- Create: `lib/validations/workspace.test.ts`

- [ ] **Step 1: Escribir tests de contratos workspace**

Agregar en `lib/validations/workspace.test.ts` casos para:

```ts
import { describe, expect, it } from "vitest";
import {
  workspaceMembershipSchema,
  activeWorkspaceSelectionSchema,
  workspaceRoleSchema,
} from "@/lib/validations/workspace";

describe("workspace validation", () => {
  it("accepts owner membership payloads", () => {
    expect(
      workspaceMembershipSchema.parse({
        companyId: "company-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      }),
    ).toMatchObject({ role: "OWNER", status: "ACTIVE" });
  });

  it("rejects unknown roles", () => {
    expect(() => workspaceRoleSchema.parse("GUEST")).toThrow();
  });

  it("accepts active workspace selection", () => {
    expect(activeWorkspaceSelectionSchema.parse({ companyId: "company-1" })).toEqual({
      companyId: "company-1",
    });
  });
});
```

- [ ] **Step 2: Extender Prisma con membresías y suscripciones por workspace**

Agregar en `prisma/schema.prisma` los enums y modelos base:

```prisma
enum CompanyMembershipRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

enum CompanyMembershipStatus {
  ACTIVE
  INVITED
  SUSPENDED
}

model CompanyMembership {
  id          String                  @id @default(cuid())
  companyId   String
  userId      String
  role        CompanyMembershipRole
  status      CompanyMembershipStatus @default(ACTIVE)
  invitedById String?
  joinedAt    DateTime                @default(now())
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
}
```

Y agregar el esqueleto de suscripción:

```prisma
model CompanySubscription {
  id                     String   @id @default(cuid())
  companyId              String   @unique
  membershipPlanId       String
  provider               BillingProvider
  status                 BillingSubscriptionStatus
  currentPeriodStart     DateTime?
  currentPeriodEnd       DateTime?
  pastDueStartedAt       DateTime?
  externalCustomerId     String?
  externalSubscriptionId String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

- [ ] **Step 3: Agregar tipos compartidos de workspace**

Crear `types/workspace.ts` con:

```ts
export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  logoUrl: string | null;
};

export type WorkspaceContextEnvelope = {
  workspace: WorkspaceSummary;
  featureFlags: string[];
  planSlug: "starter" | "pro" | "empresa";
};
```

- [ ] **Step 4: Backfill en seed para mantener compatibilidad**

Actualizar `prisma/seed.ts` para que cada empresa semilla cree su membresía owner:

```ts
await prisma.companyMembership.upsert({
  where: { companyId_userId: { companyId: company.id, userId: user.id } },
  update: { role: "OWNER", status: "ACTIVE" },
  create: { companyId: company.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
});
```

- [ ] **Step 5: Ejecutar tests de validación**

Run: `npm run test -- lib/validations/workspace.test.ts`

Expected:

- PASS con contratos base de workspace

## Task 2: Crear la capa de acceso y contexto de workspace

**Files:**

- Create: `lib/workspace/access.ts`
- Create: `lib/workspace/context.ts`
- Create: `lib/workspace/memberships.ts`
- Create: `lib/workspace/active-workspace.ts`
- Create: `lib/workspace/access.test.ts`
- Create: `lib/workspace/context.test.ts`
- Modify: `lib/data/projects.ts`

- [ ] **Step 1: Escribir tests de acceso y pertenencia**

Agregar en `lib/workspace/access.test.ts` casos para:

```ts
it("allows active memberships", async () => {
  await expect(assertWorkspaceMembership({ userId: "user-1", companyId: "company-1" })).resolves.toMatchObject({
    companyId: "company-1",
  });
});

it("rejects users outside the workspace", async () => {
  await expect(assertWorkspaceMembership({ userId: "user-2", companyId: "company-1" })).rejects.toThrow(
    "Workspace no disponible",
  );
});
```

- [ ] **Step 2: Implementar helpers de acceso reutilizable**

Crear `lib/workspace/access.ts` con firmas mínimas:

```ts
export async function assertWorkspaceMembership(options: {
  userId: string;
  companyId: string;
  minimumRole?: WorkspaceRole;
}) {}

export async function assertProjectInWorkspace(options: {
  companyId: string;
  projectId: string;
}) {}

export async function assertBudgetInWorkspace(options: {
  companyId: string;
  budgetId: string;
}) {}
```

- [ ] **Step 3: Implementar resolución del workspace activo**

Crear `lib/workspace/active-workspace.ts` con:

```ts
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {}

export async function setActiveWorkspaceId(userId: string, companyId: string): Promise<void> {}
```

Usar cookie segura como primer storage y dejar la interfaz lista para mover preferencia a base de datos si hiciera falta.

- [ ] **Step 4: Implementar el envelope de contexto**

Crear `lib/workspace/context.ts` con:

```ts
export async function getWorkspaceContextForUser(userId: string) {
  return {
    workspace: { id: "company-1", name: "Empresa demo", role: "OWNER", logoUrl: null },
    featureFlags: [],
    planSlug: "starter",
  } as const;
}
```

La implementación real debe componer:

- workspace activo
- rol de membresía
- plan del workspace
- features disponibles
- límites y uso

- [ ] **Step 5: Migrar lecturas básicas de companies a memberships**

Adaptar `lib/data/projects.ts` para que `getUserCompanies` lea empresas desde `CompanyMembership` activo en vez de solo desde `Company.userId`.

- [ ] **Step 6: Ejecutar tests de la capa workspace**

Run: `npm run test -- lib/workspace/access.test.ts lib/workspace/context.test.ts`

Expected:

- PASS con ownership workspace-first

## Task 3: Migrar Auth.js y sesión hacia workspace activo seleccionable

**Files:**

- Modify: `lib/auth/options.ts`
- Modify: `lib/auth/session.ts`
- Modify: `lib/auth/registration.ts`
- Modify: `types/next-auth.d.ts`
- Create: `app/api/workspaces/route.ts`
- Create: `app/api/workspaces/active/route.ts`
- Create: `app/api/workspaces/route.test.ts`
- Create: `app/api/workspaces/active/route.test.ts`

- [ ] **Step 1: Escribir tests de sesión con workspace activo**

Agregar o extender tests para validar:

```ts
expect(token.activeCompanyId).toBe("company-1");
expect(session.user.activeCompanyId).toBe("company-1");
expect(session.user.workspaces).toEqual(
  expect.arrayContaining([expect.objectContaining({ id: "company-1" })]),
);
```

- [ ] **Step 2: Ajustar registro inicial para crear membership owner**

Actualizar `lib/auth/registration.ts` para crear:

```ts
await tx.companyMembership.create({
  data: {
    companyId: company.id,
    userId: user.id,
    role: "OWNER",
    status: "ACTIVE",
  },
});
```

- [ ] **Step 3: Reemplazar `token.companyId` por `activeCompanyId`**

En `lib/auth/options.ts`, cambiar la hidratación del JWT:

```ts
token.activeCompanyId = await getActiveWorkspaceId(userId);
token.workspaces = await listUserWorkspaces(userId);
```

Y en sesión:

```ts
session.user.activeCompanyId = token.activeCompanyId ?? null;
session.user.workspaces = Array.isArray(token.workspaces) ? token.workspaces : [];
```

- [ ] **Step 4: Implementar APIs de workspace**

Crear:

```ts
// app/api/workspaces/route.ts
export async function GET() {}

// app/api/workspaces/active/route.ts
export async function GET() {}
export async function POST(request: Request) {}
```

`POST` debe validar:

- sesión autenticada
- que el usuario pertenece al workspace solicitado
- persistencia del workspace activo

- [ ] **Step 5: Ejecutar tests de auth y APIs**

Run: `npm run test -- lib/auth/options.test.ts app/api/workspaces/route.test.ts app/api/workspaces/active/route.test.ts`

Expected:

- PASS con cambio de workspace sin re-login

## Task 4: Centralizar entitlements y feature flags por workspace

**Files:**

- Create: `lib/workspace/feature-registry.ts`
- Create: `lib/workspace/entitlements.ts`
- Create: `lib/workspace/entitlements.test.ts`
- Modify: `lib/billing/entitlements.ts`
- Modify: `components/billing/feature-gate.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/layout/app-sidebar-client.tsx`

- [ ] **Step 1: Escribir tests para acceso por workspace**

Agregar en `lib/workspace/entitlements.test.ts` casos para:

```ts
it("grants Pro features from workspace subscription", async () => {
  const license = await getEffectiveWorkspaceLicense({ userId: "user-1", companyId: "company-1" });
  expect(license.availableFeatures).toContain("risk_analysis");
});

it("hides Pro features for starter workspaces", async () => {
  const license = await getEffectiveWorkspaceLicense({ userId: "user-1", companyId: "company-1" });
  expect(license.availableFeatures).not.toContain("collaboration.realtime");
});
```

- [ ] **Step 2: Crear un registro explícito de features**

Crear `lib/workspace/feature-registry.ts`:

```ts
export const WORKSPACE_FEATURES = [
  { key: "ai.local", minimumPlan: "pro" },
  { key: "risk_analysis", minimumPlan: "pro" },
  { key: "collaboration.realtime", minimumPlan: "pro" },
  { key: "exports.basic", minimumPlan: "starter" },
] as const;
```

- [ ] **Step 3: Implementar licencia efectiva por workspace**

Crear `lib/workspace/entitlements.ts` con:

```ts
export async function getEffectiveWorkspaceLicense(options: {
  userId: string;
  companyId: string;
}) {}

export async function assertWorkspaceFeatureAccess(options: {
  userId: string;
  companyId: string;
  feature: string;
}) {}
```

Mantener `lib/billing/entitlements.ts` como wrapper transicional para no romper imports masivos en una sola iteración.

- [ ] **Step 4: Hacer que AppShell cargue un único envelope**

En `components/layout/app-shell.tsx`, reemplazar:

```ts
userId ? getEffectiveUserLicense({ userId }) : Promise.resolve(null)
```

por:

```ts
userId && activeCompanyId
  ? getEffectiveWorkspaceLicense({ userId, companyId: activeCompanyId })
  : Promise.resolve(null)
```

- [ ] **Step 5: Ejecutar tests del shell y entitlements**

Run: `npm run test -- lib/workspace/entitlements.test.ts components/layout/app-shell.test.tsx`

Expected:

- PASS con features derivadas del workspace activo

## Task 5: Integrar workspace switcher y UI shell multiworkspace

**Files:**

- Create: `components/layout/workspace-switcher.tsx`
- Create: `components/layout/workspace-switcher.test.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/layout/sidebar-user-card.tsx`
- Modify: `app/projects/new/page.tsx`
- Modify: `components/projects/project-form.tsx`

- [ ] **Step 1: Escribir tests del selector de workspace**

Agregar en `components/layout/workspace-switcher.test.tsx`:

```tsx
it("renders the active workspace and available alternatives", () => {
  render(
    <WorkspaceSwitcher
      activeWorkspaceId="company-1"
      workspaces={[
        { id: "company-1", name: "Empresa A", role: "OWNER", logoUrl: null },
        { id: "company-2", name: "Empresa B", role: "EDITOR", logoUrl: null },
      ]}
    />,
  );
});
```

- [ ] **Step 2: Crear el componente `WorkspaceSwitcher`**

Implementar una superficie compacta con:

```tsx
<Select value={activeWorkspaceId} onValueChange={handleWorkspaceChange}>
  {workspaces.map((workspace) => (
    <option key={workspace.id} value={workspace.id}>
      {workspace.name}
    </option>
  ))}
</Select>
```

- [ ] **Step 3: Integrar el switcher en `AppShell`**

Insertar el selector junto al header actual para que el contexto empresarial esté visible en toda la app.

- [ ] **Step 4: Reducir dependencia de `companyId` elegido manualmente**

En `app/projects/new/page.tsx` y `components/projects/project-form.tsx`:

- usar el workspace activo como default real
- mantener selector solo cuando el usuario tenga más de un workspace y permisos para crear en otro

- [ ] **Step 5: Ejecutar tests de UI shell**

Run: `npm run test -- components/layout/workspace-switcher.test.tsx components/layout/app-shell.test.tsx`

Expected:

- PASS con navegación workspace-first

## Task 6: Endurecer ownership en APIs clave y preparar la base PWA/Desktop

**Files:**

- Modify: `app/api/projects/route.ts`
- Modify: `app/api/resources/route.ts`
- Modify: `app/api/imports/s10/import/route.ts`
- Modify: `app/api/imports/rw7/import/route.ts`
- Modify: `app/api/imports/delphin/import/route.ts`
- Create: `lib/platform/runtime.ts`
- Create: `lib/platform/platform-capabilities.ts`
- Modify: `app/layout.tsx`
- Create: `public/pwa/manifest.webmanifest`

- [ ] **Step 1: Escribir tests de ownership de APIs**

Agregar o extender tests para validar:

```ts
expect(response.status).toBe(403);
expect(body.error).toContain("Workspace");
```

cuando `companyId` del cliente no pertenece al usuario o no coincide con el workspace activo permitido.

- [ ] **Step 2: Migrar rutas críticas a validación por workspace**

En cada route handler, aplicar patrón:

```ts
const session = await getAuthSession();
const companyId = await requireActiveWorkspace(session);
await assertWorkspaceMembership({ userId: session.user.id, companyId });
```

Si el endpoint aún recibe `companyId` por payload, verificar que coincida con un workspace accesible antes de persistir.

- [ ] **Step 3: Crear la capa de runtime de plataforma**

Crear `lib/platform/runtime.ts`:

```ts
export function getPlatformRuntime(): "web" | "desktop" {
  return process.env.NEXT_PUBLIC_PLATFORM_RUNTIME === "desktop" ? "desktop" : "web";
}
```

Y `lib/platform/platform-capabilities.ts`:

```ts
export function getPlatformCapabilities() {
  const runtime = getPlatformRuntime();
  return {
    runtime,
    supportsNativeNotifications: runtime === "desktop",
    supportsLocalFileOpen: runtime === "desktop",
    supportsLargeFileBridge: runtime === "desktop",
  } as const;
}
```

- [ ] **Step 4: Agregar base PWA mínima**

Crear `public/pwa/manifest.webmanifest`:

```json
{
  "name": "MC Presupuestos",
  "short_name": "MC Presupuestos",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#0F172A"
}
```

Y exponer metadata asociada desde `app/layout.tsx`.

- [ ] **Step 5: Ejecutar verificación amplia**

Run: `npm run test`

Expected:

- PASS de la suite completa con ownership workspace-first intacto

Run: `npm run lint`

Expected:

- PASS sin `any`, sin imports muertos y sin warnings evitables de hooks o tipos

## Rollout recomendado

- Release 1: membresías, workspace activo y sesión multiworkspace
- Release 2: entitlements y feature flags por workspace
- Release 3: ownership duro en APIs de proyectos, recursos e importaciones
- Release 4: base PWA instalable
- Release 5: wrapper Tauri usando la WebApp como fuente única

## Self-Review

### Cobertura del PRD

- aplicación única web-first: cubierta por Task 2, 3 y 6
- workspace multiempresa real: cubierta por Task 1, 2, 3 y 5
- licencias por empresa: cubierta por Task 1 y 4
- feature flags centralizados: cubierta por Task 4
- cambio de workspace sin relogin: cubierto por Task 3 y 5
- preparación PWA/Desktop wrapper: cubierta por Task 6

### Control de alcance

- no se renombra físicamente `Company` a `Workspace` en esta fase
- no se reescriben módulos financieros existentes
- no se introduce lógica de negocio dentro de Desktop
- no se promete offline complejo ni sync local conflictivo

### Riesgos a vigilar durante ejecución

- coexistencia temporal entre plan por usuario y plan por workspace
- endpoints heredados que aceptan `companyId` desde cliente
- caches que asumen una sola empresa por usuario
- tests frágiles alrededor de sesión y sidebar al introducir workspaces múltiples
