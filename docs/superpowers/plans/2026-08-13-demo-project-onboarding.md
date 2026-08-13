# Demo Project Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear automaticamente el proyecto `Edificio Multifamiliar - Demo` para usuarios nuevos, usando como base el paquete `.mcp` existente, y conectar ese demo con onboarding, analitica y una experiencia inicial sin pantalla vacia.

**Architecture:** La importacion del demo debe reutilizar el pipeline existente de paquetes `.mcp` (`analyzeProjectPackageBuffer` + `importProjectPackageToMyc`) mediante un servicio nuevo de onboarding. El registro debe crear usuario/empresa en una transaccion corta y luego intentar crear el demo fuera de esa transaccion, de forma idempotente y sin bloquear el registro si falla.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Vitest, paquete `.mcp` zip-store, decimal-safe math existente en importacion.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Financial calculations must use decimal-safe math.
- Keep calculation logic isolated from UI.
- Prefer reusable services.
- Use clean architecture.
- Server Components by default; Client Components only when necessary.
- Reuse existing `.mcp` import pipeline instead of reimplementing presupuesto/APU persistence.
- The demo import must be idempotent per company.
- Demo creation failure must not prevent account creation.
- The demo project name shown to users is `Edificio Multifamiliar - Demo` using ASCII hyphen in source code.
- Base template source is `presupuesto-ejemplo/mcp/test-completo-exportar.mcp`.
- Do not introduce new dependencies.

---

## Marketing And Product Spec

The 90-day marketing plan defines activation as more than signup. A new user should quickly create/import a budget or perform a technical action such as opening a budget, editing/creating APU, reviewing formula polinomica, using Khipu, or exporting.

The demo project exists to make the first session productive:

- Avoid an empty dashboard immediately after registration.
- Let the user inspect a realistic Peruvian construction budget.
- Demonstrate the first-layer promise: presupuesto + APU + Excel familiarity.
- Expose second-layer value: formula polinomica and eventual metrados/cronograma.
- Give marketing measurable activation events before paid acquisition scales.

Minimum demo content for Phase 1:

- Project: `Edificio Multifamiliar - Demo`.
- Currency: `PEN`.
- Project type: `Edificacion`.
- Client: `Cliente Demo`.
- Location: `Lima, Peru`.
- One general budget.
- Sub-budgets: `Estructuras`, `Arquitectura`, `Instalaciones Sanitarias`, `Instalaciones Electricas`.
- Budget items.
- APU records and APU resources.
- Budget footer rows.
- Polynomial formula.

Known template limitation:

- `test-completo-exportar.mcp` currently includes empty `takeoffs`, empty `work_schedule`, and empty `risk_analysis` modules. Phase 1 should import them as-is. Phase 3 may enrich the template.

---

## File Structure

- Create: `lib/onboarding/demo-project.ts`
  - Owns all demo-project orchestration: locating template, reading buffer, analyzing package, import callback, idempotency check, logging behavior, public `ensureDemoProjectForCompany` interface.
- Create: `lib/onboarding/demo-project.test.ts`
  - Unit tests for idempotency, successful import, failed import, and template-reader behavior.
- Modify: `lib/auth/registration.ts`
  - Keep `registerUserWithCompany` focused on user/company/membership creation.
  - Add wrapper `registerUserWithCompanyAndDemo`.
  - Keep `ensureUserHasCompany` behavior intact.
- Modify: `lib/auth/registration.test.ts`
  - Add tests for wrapper behavior and ensure existing tests still pass.
- Modify: `app/api/register/route.ts`
  - Use `registerUserWithCompanyAndDemo` for email/password registration.
  - Return demo metadata in the response for future redirect/UI use.
- Modify: `app/api/register/route.test.ts`
  - Update mocks and assertions for demo-aware registration response.
- Modify: `lib/auth/options.ts`
  - Use demo-aware registration for new Google users.
  - Ensure existing Google users with no company get a company and demo.
- Modify: `prisma/schema.prisma`
  - Add project demo metadata fields if accepted in Task 2.
- Create: `prisma/migrations/<timestamp>_add_project_demo_metadata/migration.sql`
  - Adds nullable/indexed demo fields.
- Modify: dashboard/projects UI after backend tasks are complete:
  - Candidate files: `components/projects/projects-table.tsx`, dashboard page components, and project overview components. Inspect before editing.
- Create or modify analytics helper:
  - Candidate files: existing analytics utility if present; otherwise create `lib/analytics/events.ts` as a typed no-op-safe event helper.

---

## Interfaces

### `ensureDemoProjectForCompany`

```ts
export type DemoProjectCreationStatus = "created" | "already_exists" | "skipped" | "failed";

export type DemoProjectCreationResult = {
  status: DemoProjectCreationStatus;
  projectId: string | null;
  generalBudgetId: string | null;
  warnings: string[];
};

export async function ensureDemoProjectForCompany(params: {
  userId: string;
  companyId: string;
  enabled?: boolean;
}): Promise<DemoProjectCreationResult>;
```

Rules:

- `enabled === false` returns `{ status: "skipped", projectId: null, generalBudgetId: null, warnings: [] }`.
- If an existing project has `demoKey = "edificio-multifamiliar"` or name `Edificio Multifamiliar - Demo`, return `already_exists`.
- On successful import, return `created`.
- On expected import/read failure, catch and return `failed` with one warning.
- Unexpected programmer errors may still be logged, but should not escape during registration paths.

### `registerUserWithCompanyAndDemo`

```ts
export type RegisteredUserWithDemo = RegisteredUser & {
  demoProject: DemoProjectCreationResult;
};

export async function registerUserWithCompanyAndDemo(params: {
  name: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  emailVerifiedAt?: Date;
  companyName?: string;
  ruc?: string;
  createDemoProject?: boolean;
}): Promise<RegisteredUserWithDemo>;
```

Rules:

- Calls `registerUserWithCompany`.
- Calls `ensureDemoProjectForCompany` after successful user/company creation.
- Does not roll back account creation if demo creation fails.

---

## Task 1: Demo Template Asset And Normalization Script

**Files:**
- Create: `scripts/prepare-demo-project-template.ts`
- Create: `data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp`
- Test manually with: `node ./node_modules/tsx/dist/cli.mjs scripts/prepare-demo-project-template.ts`

**Interfaces:**
- Produces: stable asset at `data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp`.
- Consumes: existing `presupuesto-ejemplo/mcp/test-completo-exportar.mcp`.

- [ ] **Step 1: Write the script**

Create `scripts/prepare-demo-project-template.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";

const sourcePath = join(process.cwd(), "presupuesto-ejemplo", "mcp", "test-completo-exportar.mcp");
const targetPath = join(process.cwd(), "data-for-seed", "demo-projects", "edificio-multifamiliar-demo.mcp");

const sourceBuffer = readFileSync(sourcePath);
const analysis = analyzeProjectPackageBuffer(sourceBuffer);

if (analysis.preview.compatibility === "unsupported") {
  throw new Error(`Demo MCP incompatible: ${analysis.preview.errors.join(", ")}`);
}

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, sourceBuffer);

console.log(`Demo MCP copied to ${targetPath}`);
console.log(`Source project: ${analysis.manifest.project.name}`);
console.log(`Modules: ${analysis.manifest.modules.map((module) => module.id).join(", ")}`);
```

- [ ] **Step 2: Run the script**

Run:

```bash
node ./node_modules/tsx/dist/cli.mjs scripts/prepare-demo-project-template.ts
```

Expected:

- Command exits 0.
- File exists at `data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp`.
- Console prints source project and modules.

- [ ] **Step 3: Decide whether metadata is normalized in asset or at import time**

Use import-time override in Task 3, not binary zip mutation, for Phase 1. This avoids writing a custom zip updater and keeps checksum validation intact.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-demo-project-template.ts data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp
git commit -m "chore: add demo project template asset"
```

---

## Task 2: Project Demo Metadata

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_project_demo_metadata/migration.sql`

**Interfaces:**
- Produces project fields:
  - `isDemo Boolean @default(false)`
  - `demoKey String?`
- Later tasks use `demoKey = "edificio-multifamiliar"`.

- [ ] **Step 1: Add fields to Prisma model**

Find `model Project` in `prisma/schema.prisma` and add:

```prisma
  isDemo                  Boolean                  @default(false)
  demoKey                 String?
```

Add indexes inside `model Project`:

```prisma
  @@index([companyId, isDemo])
  @@index([companyId, demoKey])
```

- [ ] **Step 2: Create migration SQL**

Create a migration folder named with the current timestamp, for example:

`prisma/migrations/20260813120000_add_project_demo_metadata/migration.sql`

Use SQL:

```sql
ALTER TABLE "Project" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "demoKey" TEXT;

CREATE INDEX "Project_companyId_isDemo_idx" ON "Project"("companyId", "isDemo");
CREATE INDEX "Project_companyId_demoKey_idx" ON "Project"("companyId", "demoKey");
```

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: command exits 0.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/*_add_project_demo_metadata/migration.sql
git commit -m "feat: add demo project metadata"
```

---

## Task 3: Allow MCP Import Project Overrides

**Files:**
- Modify: `lib/mcp/types.ts`
- Modify: `lib/mcp/import-persistence.ts`
- Modify: `lib/mcp/import-persistence.test.ts`

**Interfaces:**
- Extends `McpImportPersistenceOptions` with:

```ts
projectOverrides?: {
  name?: string;
  clientName?: string | null;
  location?: string | null;
  projectType?: string | null;
  isDemo?: boolean;
  demoKey?: string | null;
};
```

- [ ] **Step 1: Write failing test for project overrides**

In `lib/mcp/import-persistence.test.ts`, add:

```ts
it("applies project overrides during restore", async () => {
  const tx = makeTransactionClient();
  mocks.transaction.mockImplementation(async (callback) => callback(tx));

  await importProjectPackageToMyc("user-1", makeManifest(), makeModuleReader(fixtureModules), {
    companyId: "company-1",
    mode: "restore_as_new_project",
    projectOverrides: {
      name: "Edificio Multifamiliar - Demo",
      clientName: "Cliente Demo",
      location: "Lima, Peru",
      projectType: "Edificacion",
      isDemo: true,
      demoKey: "edificio-multifamiliar",
    },
  });

  expect(mocks.projectCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      companyId: "company-1",
      name: "Edificio Multifamiliar - Demo",
      clientName: "Cliente Demo",
      location: "Lima, Peru",
      projectType: "Edificacion",
      isDemo: true,
      demoKey: "edificio-multifamiliar",
    }),
  });
});
```

If the local test helper is named differently than `makeTransactionClient`, reuse the existing helper in this file and only add the assertion.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- lib/mcp/import-persistence.test.ts
```

Expected: FAIL because `projectOverrides` is not defined or ignored.

- [ ] **Step 3: Extend type**

In `lib/mcp/types.ts`, find `McpImportPersistenceOptions` and update it:

```ts
export type McpImportPersistenceOptions = {
  companyId: string;
  mode: "restore_as_new_project";
  projectOverrides?: {
    name?: string;
    clientName?: string | null;
    location?: string | null;
    projectType?: string | null;
    isDemo?: boolean;
    demoKey?: string | null;
  };
};
```

- [ ] **Step 4: Apply overrides in persistence**

In `lib/mcp/import-persistence.ts`, replace the `tx.project.create` data block with override-aware values:

```ts
    const projectOverrides = options.projectOverrides;

    const project = await tx.project.create({
      data: {
        companyId: options.companyId,
        name: projectOverrides?.name ?? projectData.name,
        clientName:
          projectOverrides && "clientName" in projectOverrides
            ? projectOverrides.clientName
            : projectData.clientName,
        location:
          projectOverrides && "location" in projectOverrides
            ? projectOverrides.location
            : projectData.location,
        projectType:
          projectOverrides && "projectType" in projectOverrides
            ? projectOverrides.projectType ?? "Importado .mcp"
            : projectData.projectType ?? "Importado .mcp",
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
        status: "PLANNING",
        isDemo: projectOverrides?.isDemo ?? false,
        demoKey: projectOverrides?.demoKey ?? null,
      },
    });
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- lib/mcp/import-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/mcp/types.ts lib/mcp/import-persistence.ts lib/mcp/import-persistence.test.ts
git commit -m "feat: support mcp project import overrides"
```

---

## Task 4: Demo Project Service

**Files:**
- Create: `lib/onboarding/demo-project.ts`
- Create: `lib/onboarding/demo-project.test.ts`

**Interfaces:**
- Produces `ensureDemoProjectForCompany`.
- Consumes `analyzeProjectPackageBuffer`, `importProjectPackageToMyc`, `prisma.project.findFirst`, and Node `readFile`.

- [ ] **Step 1: Write failing tests**

Create `lib/onboarding/demo-project.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  projectFindFirst: vi.fn(),
  analyzeProjectPackageBuffer: vi.fn(),
  importProjectPackageToMyc: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findFirst: mocks.projectFindFirst,
    },
  },
}));

vi.mock("@/lib/mcp/import-preview", () => ({
  analyzeProjectPackageBuffer: mocks.analyzeProjectPackageBuffer,
}));

vi.mock("@/lib/mcp/import-persistence", () => ({
  importProjectPackageToMyc: mocks.importProjectPackageToMyc,
}));

import { ensureDemoProjectForCompany } from "@/lib/onboarding/demo-project";

describe("ensureDemoProjectForCompany", () => {
  beforeEach(() => {
    mocks.readFile.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.analyzeProjectPackageBuffer.mockReset();
    mocks.importProjectPackageToMyc.mockReset();
  });

  it("skips when disabled", async () => {
    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1", enabled: false }),
    ).resolves.toEqual({
      status: "skipped",
      projectId: null,
      generalBudgetId: null,
      warnings: [],
    });
  });

  it("returns already_exists when company already has the demo", async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: "project-demo", budgets: [{ id: "budget-general" }] });

    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" }),
    ).resolves.toEqual({
      status: "already_exists",
      projectId: "project-demo",
      generalBudgetId: "budget-general",
      warnings: [],
    });

    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.importProjectPackageToMyc).not.toHaveBeenCalled();
  });

  it("imports the demo project from the mcp asset", async () => {
    const buffer = Buffer.from("mcp-data");
    const manifest = { project: { name: "Original" } };
    const fileContents = new Map<string, string>([
      ["project.json", JSON.stringify({ name: "Original" })],
    ]);

    mocks.projectFindFirst.mockResolvedValue(null);
    mocks.readFile.mockResolvedValue(buffer);
    mocks.analyzeProjectPackageBuffer.mockReturnValue({
      manifest,
      fileContents,
      preview: { compatibility: "supported", errors: [] },
    });
    mocks.importProjectPackageToMyc.mockResolvedValue({
      projectId: "project-created",
      generalBudgetId: "budget-created",
      warnings: ["formula warning"],
    });

    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" }),
    ).resolves.toEqual({
      status: "created",
      projectId: "project-created",
      generalBudgetId: "budget-created",
      warnings: ["formula warning"],
    });

    expect(mocks.importProjectPackageToMyc).toHaveBeenCalledWith(
      "user-1",
      manifest,
      expect.any(Function),
      {
        companyId: "company-1",
        mode: "restore_as_new_project",
        projectOverrides: {
          name: "Edificio Multifamiliar - Demo",
          clientName: "Cliente Demo",
          location: "Lima, Peru",
          projectType: "Edificacion",
          isDemo: true,
          demoKey: "edificio-multifamiliar",
        },
      },
    );
  });

  it("returns failed when the template cannot be imported", async () => {
    mocks.projectFindFirst.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("missing file"));

    const result = await ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" });

    expect(result.status).toBe("failed");
    expect(result.projectId).toBeNull();
    expect(result.generalBudgetId).toBeNull();
    expect(result.warnings[0]).toContain("No se pudo crear el proyecto demo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- lib/onboarding/demo-project.test.ts
```

Expected: FAIL because file does not exist.

- [ ] **Step 3: Implement service**

Create `lib/onboarding/demo-project.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db/prisma";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";
import { importProjectPackageToMyc } from "@/lib/mcp/import-persistence";

const demoProjectName = "Edificio Multifamiliar - Demo";
const demoProjectKey = "edificio-multifamiliar";
const demoTemplatePath = join(
  process.cwd(),
  "data-for-seed",
  "demo-projects",
  "edificio-multifamiliar-demo.mcp",
);

export type DemoProjectCreationStatus = "created" | "already_exists" | "skipped" | "failed";

export type DemoProjectCreationResult = {
  status: DemoProjectCreationStatus;
  projectId: string | null;
  generalBudgetId: string | null;
  warnings: string[];
};

export async function ensureDemoProjectForCompany(params: {
  userId: string;
  companyId: string;
  enabled?: boolean;
}): Promise<DemoProjectCreationResult> {
  if (params.enabled === false) {
    return { status: "skipped", projectId: null, generalBudgetId: null, warnings: [] };
  }

  const existingDemo = await prisma.project.findFirst({
    where: {
      companyId: params.companyId,
      OR: [{ demoKey: demoProjectKey }, { name: demoProjectName }],
    },
    select: {
      id: true,
      budgets: {
        where: { kind: "GENERAL" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existingDemo) {
    return {
      status: "already_exists",
      projectId: existingDemo.id,
      generalBudgetId: existingDemo.budgets[0]?.id ?? null,
      warnings: [],
    };
  }

  try {
    const buffer = await readFile(demoTemplatePath);
    const analysis = analyzeProjectPackageBuffer(buffer);

    if (analysis.preview.compatibility === "unsupported") {
      return {
        status: "failed",
        projectId: null,
        generalBudgetId: null,
        warnings: [`No se pudo crear el proyecto demo: ${analysis.preview.errors.join(", ")}`],
      };
    }

    const readModule = (path: string): unknown => {
      const content = analysis.fileContents.get(path);

      if (!content) {
        throw new Error(`Modulo no encontrado en el paquete demo: ${path}`);
      }

      return JSON.parse(content);
    };

    const result = await importProjectPackageToMyc(params.userId, analysis.manifest, readModule, {
      companyId: params.companyId,
      mode: "restore_as_new_project",
      projectOverrides: {
        name: demoProjectName,
        clientName: "Cliente Demo",
        location: "Lima, Peru",
        projectType: "Edificacion",
        isDemo: true,
        demoKey: demoProjectKey,
      },
    });

    return {
      status: "created",
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      warnings: result.warnings,
    };
  } catch (error) {
    console.error("Demo project creation failed", error);

    return {
      status: "failed",
      projectId: null,
      generalBudgetId: null,
      warnings: [
        `No se pudo crear el proyecto demo: ${
          error instanceof Error ? error.message : "error inesperado"
        }`,
      ],
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- lib/onboarding/demo-project.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/demo-project.ts lib/onboarding/demo-project.test.ts
git commit -m "feat: add onboarding demo project service"
```

---

## Task 5: Demo-Aware Registration

**Files:**
- Modify: `lib/auth/registration.ts`
- Modify: `lib/auth/registration.test.ts`

**Interfaces:**
- Produces `registerUserWithCompanyAndDemo`.
- Consumes `ensureDemoProjectForCompany`.

- [ ] **Step 1: Add failing tests**

In `lib/auth/registration.test.ts`, extend mocks:

```ts
  ensureDemoProjectForCompany: vi.fn(),
```

Add mock:

```ts
vi.mock("@/lib/onboarding/demo-project", () => ({
  ensureDemoProjectForCompany: mocks.ensureDemoProjectForCompany,
}));
```

Update import:

```ts
import {
  ensureUserHasCompany,
  registerUserWithCompany,
  registerUserWithCompanyAndDemo,
} from "@/lib/auth/registration";
```

Add tests:

```ts
describe("registerUserWithCompanyAndDemo", () => {
  beforeEach(() => {
    mocks.ensureDemoProjectForCompany.mockReset();
    mocks.transaction.mockReset();
  });

  it("creates user/company and then creates the onboarding demo", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", name: "Maria", email: "maria@example.com" }),
      },
      company: {
        create: vi.fn().mockResolvedValue({ id: "company-1" }),
      },
      companyMembership: {
        create: vi.fn().mockResolvedValue({ companyId: "company-1" }),
      },
    };
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    mocks.ensureDemoProjectForCompany.mockResolvedValue({
      status: "created",
      projectId: "project-demo",
      generalBudgetId: "budget-demo",
      warnings: [],
    });

    const result = await registerUserWithCompanyAndDemo({
      name: "Maria",
      email: "maria@example.com",
    });

    expect(result.demoProject.status).toBe("created");
    expect(mocks.ensureDemoProjectForCompany).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      enabled: true,
    });
  });

  it("can skip demo creation explicitly", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", name: "Maria", email: "maria@example.com" }),
      },
      company: {
        create: vi.fn().mockResolvedValue({ id: "company-1" }),
      },
      companyMembership: {
        create: vi.fn().mockResolvedValue({ companyId: "company-1" }),
      },
    };
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    mocks.ensureDemoProjectForCompany.mockResolvedValue({
      status: "skipped",
      projectId: null,
      generalBudgetId: null,
      warnings: [],
    });

    const result = await registerUserWithCompanyAndDemo({
      name: "Maria",
      email: "maria@example.com",
      createDemoProject: false,
    });

    expect(result.demoProject.status).toBe("skipped");
    expect(mocks.ensureDemoProjectForCompany).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      enabled: false,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- lib/auth/registration.test.ts
```

Expected: FAIL because wrapper is missing.

- [ ] **Step 3: Implement wrapper**

In `lib/auth/registration.ts`, add:

```ts
import {
  ensureDemoProjectForCompany,
  type DemoProjectCreationResult,
} from "@/lib/onboarding/demo-project";
```

Add after `RegisteredUser`:

```ts
export type RegisteredUserWithDemo = RegisteredUser & {
  demoProject: DemoProjectCreationResult;
};

export async function registerUserWithCompanyAndDemo(params: {
  name: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  emailVerifiedAt?: Date;
  companyName?: string;
  ruc?: string;
  createDemoProject?: boolean;
}): Promise<RegisteredUserWithDemo> {
  const registration = await registerUserWithCompany(params);
  const demoProject = await ensureDemoProjectForCompany({
    userId: registration.user.id,
    companyId: registration.company.id,
    enabled: params.createDemoProject ?? true,
  });

  return { ...registration, demoProject };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- lib/auth/registration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/registration.ts lib/auth/registration.test.ts
git commit -m "feat: create demo project during registration service"
```

---

## Task 6: API Registration Response

**Files:**
- Modify: `app/api/register/route.ts`
- Modify: `app/api/register/route.test.ts`

**Interfaces:**
- Consumes `registerUserWithCompanyAndDemo`.
- Response adds:

```ts
demoProject: {
  status: "created" | "already_exists" | "skipped" | "failed";
  projectId: string | null;
  generalBudgetId: string | null;
  warnings: string[];
}
```

- [ ] **Step 1: Update tests first**

In `app/api/register/route.test.ts`, rename mock `registerUserWithCompanyMock` to `registerUserWithCompanyAndDemoMock`, update module mock:

```ts
vi.mock("@/lib/auth/registration", () => ({
  registerUserWithCompanyAndDemo: mocks.registerUserWithCompanyAndDemoMock,
}));
```

Successful registration mock:

```ts
mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
  user: { id: "user-1" },
  company: { id: "company-1" },
  demoProject: {
    status: "created",
    projectId: "project-demo",
    generalBudgetId: "budget-demo",
    warnings: [],
  },
});
```

Expected response:

```ts
await expect(response.json()).resolves.toEqual({
  ok: true,
  requiresEmailVerification: true,
  verificationEmailSent: true,
  demoProject: {
    status: "created",
    projectId: "project-demo",
    generalBudgetId: "budget-demo",
    warnings: [],
  },
});
```

Expected call:

```ts
expect(mocks.registerUserWithCompanyAndDemoMock).toHaveBeenCalledWith({
  name: "Maria Calderon",
  email: "maria@example.com",
  passwordHash: "hashed-password",
  companyName: "Constructora Andina SAC",
  ruc: "20123456789",
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- app/api/register/route.test.ts
```

Expected: FAIL because route still imports old function and response lacks demo metadata.

- [ ] **Step 3: Update route**

In `app/api/register/route.ts`, replace import:

```ts
import { registerUserWithCompanyAndDemo } from "@/lib/auth/registration";
```

Replace call:

```ts
const registration = await registerUserWithCompanyAndDemo({
  name: data.name,
  email: data.email,
  passwordHash: await hashPassword(data.password),
  companyName: data.companyName,
  ruc: data.ruc || undefined,
});
```

Return:

```ts
return NextResponse.json(
  {
    ok: true,
    requiresEmailVerification: true,
    verificationEmailSent,
    demoProject: registration.demoProject,
  },
  { status: 201 },
);
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- app/api/register/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/register/route.ts app/api/register/route.test.ts
git commit -m "feat: return onboarding demo from registration"
```

---

## Task 7: Google OAuth Demo Coverage

**Files:**
- Modify: `lib/auth/options.ts`
- Test: existing auth option tests if present, otherwise add targeted tests in `lib/auth/options.test.ts`.

**Interfaces:**
- New Google users use `registerUserWithCompanyAndDemo`.
- Existing Google users use `ensureUserHasCompany`, then `ensureDemoProjectForCompany`.

- [ ] **Step 1: Inspect existing auth tests**

Run:

```bash
rg "signIn\\(|Google|registerUserWithCompany" lib/auth app -n
```

Expected: identify whether `lib/auth/options.test.ts` covers Google sign-in.

- [ ] **Step 2: Add failing test for new Google user**

In `lib/auth/options.test.ts`, add or update mocks to assert `registerUserWithCompanyAndDemo` is called when no user exists:

```ts
expect(registerUserWithCompanyAndDemo).toHaveBeenCalledWith({
  name: "Maria Calderon",
  email: "maria@example.com",
  avatarUrl: "https://example.com/avatar.png",
  emailVerifiedAt: expect.any(Date),
});
```

- [ ] **Step 3: Add failing test for existing Google user**

Mock existing user and `ensureUserHasCompany` returning `company-1`; assert:

```ts
expect(ensureDemoProjectForCompany).toHaveBeenCalledWith({
  userId: "user-1",
  companyId: "company-1",
  enabled: true,
});
```

- [ ] **Step 4: Update implementation**

In `lib/auth/options.ts`, replace import:

```ts
import {
  ensureUserHasCompany,
  registerUserWithCompanyAndDemo,
} from "@/lib/auth/registration";
import { ensureDemoProjectForCompany } from "@/lib/onboarding/demo-project";
```

For existing Google user, replace:

```ts
await ensureUserHasCompany(existingUser.id, {
  name: existingUser.name,
  email: existingUser.email,
});
```

with:

```ts
const companyId = await ensureUserHasCompany(existingUser.id, {
  name: existingUser.name,
  email: existingUser.email,
});

await ensureDemoProjectForCompany({
  userId: existingUser.id,
  companyId,
  enabled: true,
});
```

For new Google user, replace `registerUserWithCompany` with `registerUserWithCompanyAndDemo`.

- [ ] **Step 5: Run auth tests**

Run:

```bash
npm run test -- lib/auth/options.test.ts lib/auth/registration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/options.ts lib/auth/options.test.ts
git commit -m "feat: create demo project for google signups"
```

---

## Task 8: Onboarding Analytics Events

**Files:**
- Create or modify: `lib/analytics/events.ts`
- Modify: `lib/onboarding/demo-project.ts`
- Test: `lib/onboarding/demo-project.test.ts`

**Interfaces:**
- Produces typed events:
  - `demo_project_created`
  - `demo_project_creation_failed`
  - `demo_project_already_exists`

- [ ] **Step 1: Search for existing analytics helper**

Run:

```bash
rg "analytics|trackEvent|posthog|utm|event" lib app components -n
```

Expected: choose existing helper if one exists. If not, create `lib/analytics/events.ts`.

- [ ] **Step 2: Create typed helper if no existing helper exists**

Create:

```ts
export type AnalyticsEventName =
  | "demo_project_created"
  | "demo_project_creation_failed"
  | "demo_project_already_exists";

export type AnalyticsEventPayload = {
  userId: string;
  companyId: string;
  projectId?: string | null;
  generalBudgetId?: string | null;
  warnings?: string[];
};

export async function trackServerEvent(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload,
): Promise<void> {
  void name;
  void payload;
}
```

This is intentionally a typed no-op until a production analytics provider is wired.

- [ ] **Step 3: Add calls in demo service**

Call:

```ts
await trackServerEvent("demo_project_already_exists", { ... });
await trackServerEvent("demo_project_created", { ... });
await trackServerEvent("demo_project_creation_failed", { ... });
```

Do not let analytics errors fail demo creation. Wrap each call:

```ts
try {
  await trackServerEvent(name, payload);
} catch (error) {
  console.error("Analytics event failed", error);
}
```

- [ ] **Step 4: Update tests**

Mock helper and assert event names for created/already_exists/failed paths.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- lib/onboarding/demo-project.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/events.ts lib/onboarding/demo-project.ts lib/onboarding/demo-project.test.ts
git commit -m "feat: track onboarding demo project events"
```

---

## Task 9: Dashboard And Projects UX

**Files:**
- Inspect before modifying:
  - `components/projects/projects-table.tsx`
  - `app/projects/page.tsx`
  - dashboard page files found by `rg "dashboard" app components -n`
- Add or modify tests next to touched components.

**Interfaces:**
- Consumes `Project.isDemo` and `Project.demoKey` from project queries.
- Produces visible `Demo` badge and primary CTA path.

- [ ] **Step 1: Inspect project list query**

Run:

```bash
rg "project\\.findMany|listProjects|projects-table|isDemo|demoKey" lib app components -n
```

Expected: identify the function that feeds the projects table.

- [ ] **Step 2: Include demo fields in project list data**

Where projects are selected, include:

```ts
isDemo: true,
demoKey: true,
```

If the project type is manually defined in `types/project.ts`, add:

```ts
isDemo: boolean;
demoKey: string | null;
```

- [ ] **Step 3: Add project table badge test**

In `components/projects/projects-table.view-mode.test.tsx` or `components/projects/projects-table.test.tsx`, add a project with:

```ts
{
  id: "project-demo",
  name: "Edificio Multifamiliar - Demo",
  isDemo: true,
  demoKey: "edificio-multifamiliar",
}
```

Assert:

```ts
expect(screen.getByText("Demo")).toBeInTheDocument();
expect(screen.getByText("Edificio Multifamiliar - Demo")).toBeInTheDocument();
```

- [ ] **Step 4: Implement badge**

In `components/projects/projects-table.tsx`, near project name render:

```tsx
{project.isDemo ? (
  <Badge variant="secondary">Demo</Badge>
) : null}
```

Use existing `Badge` component from `components/ui/badge.tsx`.

- [ ] **Step 5: Add empty-dashboard behavior**

If dashboard/project list has an empty state, update it so the empty state is rare after registration. If only demo exists, show:

- Primary action: open `Edificio Multifamiliar - Demo`.
- Secondary action: create/import own project.

Use existing button styles and avoid marketing-heavy copy.

- [ ] **Step 6: Run component tests**

Run:

```bash
npm run test -- components/projects/projects-table.test.tsx components/projects/projects-table.view-mode.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/projects types lib app
git commit -m "feat: surface onboarding demo in projects"
```

---

## Task 10: Five-Minute Project Guide

**Files:**
- Create: `components/onboarding/demo-project-guide.tsx`
- Modify project detail page:
  - `app/projects/[id]/page.tsx`
  - any project detail content component it delegates to.
- Add tests for project detail rendering if existing.

**Interfaces:**
- Consumes project field `isDemo`.
- Produces guide UI only on demo project overview.

- [ ] **Step 1: Inspect project detail page**

Run:

```bash
Get-Content -LiteralPath app\\projects\\[id]\\page.tsx
rg "project detail|ProjectDetail|budget sections|polynomial" components app\\projects -n
```

- [ ] **Step 2: Create guide component**

Create `components/onboarding/demo-project-guide.tsx`:

```tsx
import { Calculator, FileSpreadsheet, FileText, ListChecks, Sigma } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { label: "Abre el presupuesto general", icon: FileSpreadsheet },
  { label: "Revisa una partida de estructuras", icon: ListChecks },
  { label: "Abre su APU", icon: Calculator },
  { label: "Revisa la formula polinomica", icon: Sigma },
  { label: "Exporta Excel o PDF", icon: FileText },
];

export function DemoProjectGuide() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">5 minutos para conocer MC Presupuestos</CardTitle>
          <Badge variant="secondary">Demo</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <li key={step.label} className="flex items-center gap-2 text-sm text-slate-700">
                <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Render only for demo project**

In project detail content, add:

```tsx
{project.isDemo ? <DemoProjectGuide /> : null}
```

- [ ] **Step 4: Test**

Add test assertion:

```ts
expect(screen.getByText("5 minutos para conocer MC Presupuestos")).toBeInTheDocument();
```

And for non-demo project:

```ts
expect(screen.queryByText("5 minutos para conocer MC Presupuestos")).not.toBeInTheDocument();
```

- [ ] **Step 5: Run tests**

Run relevant test found in Step 1, plus:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/onboarding app/projects components
git commit -m "feat: add demo project onboarding guide"
```

---

## Task 11: Activation Events From Demo Actions

**Files:**
- Modify existing action routes or UI event points for:
  - project opened
  - budget opened
  - APU opened
  - formula opened
  - export completed
- Likely routes:
  - `app/projects/[id]/page.tsx`
  - `app/budgets/[id]/page.tsx`
  - `app/budgets/[id]/polynomial-formula/page.tsx`
  - `app/api/exports/route.ts`
  - APU detail/export routes discovered by `rg "apu" app components -n`

**Interfaces:**
- Extends `AnalyticsEventName` with:
  - `demo_project_opened`
  - `demo_budget_opened`
  - `demo_apu_opened`
  - `demo_formula_opened`
  - `demo_export_completed`
  - `first_non_demo_project_created`

- [ ] **Step 1: Extend event types**

In `lib/analytics/events.ts`:

```ts
export type AnalyticsEventName =
  | "demo_project_created"
  | "demo_project_creation_failed"
  | "demo_project_already_exists"
  | "demo_project_opened"
  | "demo_budget_opened"
  | "demo_apu_opened"
  | "demo_formula_opened"
  | "demo_export_completed"
  | "first_non_demo_project_created";
```

- [ ] **Step 2: Track server-visible actions first**

Start with `app/api/exports/route.ts`, because export completion is server-side and meaningful. After successful export, if exported budget belongs to demo project, call:

```ts
await trackServerEvent("demo_export_completed", {
  userId: session.user.id,
  companyId: session.user.activeCompanyId ?? session.user.companyId ?? "",
  projectId,
});
```

Do not emit if company id is empty.

- [ ] **Step 3: Track first non-demo project creation**

In `app/api/projects/route.ts`, after successful project creation, check if the company has at least one demo and this new project is not demo. Emit:

```ts
await trackServerEvent("first_non_demo_project_created", {
  userId: session.user.id,
  companyId,
  projectId: project.id,
});
```

Only emit for the first non-demo project per company.

- [ ] **Step 4: Add tests for route-level events**

Use existing route tests:

```bash
npm run test -- app/api/exports/route.test.ts app/api/projects/route.test.ts
```

Add mocks for `trackServerEvent` and assert event emission only in demo/first-real-project conditions.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/events.ts app/api/exports/route.ts app/api/exports/route.test.ts app/api/projects/route.ts app/api/projects/route.test.ts
git commit -m "feat: track demo activation events"
```

---

## Task 12: Full Verification

**Files:**
- No new files unless fixing issues.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm run test -- lib/onboarding/demo-project.test.ts lib/auth/registration.test.ts app/api/register/route.test.ts lib/mcp/import-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader tests for touched areas**

Run:

```bash
npm run test -- app/api/projects/route.test.ts app/api/exports/route.test.ts components/projects/projects-table.test.tsx components/projects/projects-table.view-mode.test.tsx
```

Expected: PASS. If a listed file does not exist or no longer matches implementation, run the nearest touched test file and document the substitution.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Manual registration QA**

Run dev server:

```bash
npm run dev
```

Manual flow:

1. Register a new email/password user.
2. Verify API response includes `demoProject.status`.
3. Login after email verification path available in local flow.
4. Open projects list.
5. Confirm `Edificio Multifamiliar - Demo` appears with `Demo` badge.
6. Open demo project.
7. Confirm guide appears.
8. Open presupuesto general.
9. Open one APU.
10. Open formula polinomica.
11. Export Excel or PDF.

- [ ] **Step 6: Final commit**

```bash
git status --short
git add .
git commit -m "feat: onboard new users with demo project"
```

---

## Rollout Notes

- Behind an env flag is optional but recommended:

```env
ONBOARDING_DEMO_PROJECT_ENABLED=true
```

If added, pass `enabled: process.env.ONBOARDING_DEMO_PROJECT_ENABLED !== "false"` into `ensureDemoProjectForCompany`.

- Demo creation can be synchronous for Phase 1 because it guarantees the project exists after registration. If registration latency becomes high, move demo creation to a background job or "ensure on first dashboard load" endpoint.
- If project limits block Starter users from receiving the demo, update entitlement logic so the demo does not count against user-created project quota, or provision the demo before enforcing the first user-created project limit.
- Do not advertise metrados/cronograma in the guide until the demo asset contains meaningful module data.

---

## Success Criteria

- New email/password users receive a demo project automatically.
- New Google users receive a demo project automatically.
- Existing Google users who had no owned company get a company and a demo.
- Registration succeeds even if demo creation fails.
- Demo creation is idempotent per company.
- The demo project is visibly labeled as demo.
- Users see a five-step guide in the demo project.
- Analytics can distinguish demo creation, demo activation, and first real project creation.
- Existing `.mcp` import tests continue to pass.
- `npm run lint`, `npm run typecheck`, and targeted tests pass.

---

## Self-Review

- Spec coverage: The plan covers automatic demo creation, `.mcp` reuse, idempotency, email/password registration, Google OAuth, non-blocking failure, UI surfacing, onboarding guide, analytics, tests, and rollout.
- Placeholder scan: No `TBD`, `TODO`, or unspecified "handle later" steps remain. Phase 3 enrichment is explicitly out of Phase 1 implementation.
- Type consistency: `ensureDemoProjectForCompany`, `DemoProjectCreationResult`, `registerUserWithCompanyAndDemo`, and `projectOverrides` signatures are defined before dependent tasks use them.
