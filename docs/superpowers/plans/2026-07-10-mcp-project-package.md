# MCP Project Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native `.mcp` project package that exports a full MC Presupuestos project into one interoperable file and imports it back as a new project through a validated preview flow.

**Architecture:** The implementation will be additive. The existing export panel and `app/api/exports` flow remain the main download surface, while a new `lib/mcp/*` layer handles manifest creation, semantic snapshots, archive assembly, import preview, and persistence. Existing S10/Delphin import patterns are reused for preview, validation, membership checks, and revalidation.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma/PostgreSQL, Vitest, decimal.js, existing export panel, existing import preview/persistence services, existing ZIP helper logic

---

## Current Baseline

Relevant code already exists and should be reused:

- `app/api/exports/route.ts`
- `lib/exports/definitions.ts`
- `lib/exports/centralized.ts`
- `components/exports/export-panel.tsx`
- `app/api/imports/s10/import/route.ts`
- `app/api/imports/delphin/import/route.ts`
- `lib/s10/import-preview.ts`
- `lib/s10/import-persistence.ts`
- `lib/delphin/dprj-import.ts`
- `lib/data/projects.ts`
- `lib/data/budgets.ts`
- `lib/data/polynomial-formulas.ts`
- `lib/data/work-schedule.ts`
- `lib/risk/data.ts`
- `lib/metrados/*`

The gap is not file download itself; it is the lack of a project-wide semantic package and the lack of a previewable project import contract.

---

## File Structure

**Create**

- `lib/mcp/types.ts`
- `lib/mcp/manifest.ts`
- `lib/mcp/schema.ts`
- `lib/mcp/archive.ts`
- `lib/mcp/checksums.ts`
- `lib/mcp/export-snapshot.ts`
- `lib/mcp/export-snapshot.test.ts`
- `lib/mcp/import-preview.ts`
- `lib/mcp/import-preview.test.ts`
- `lib/mcp/import-persistence.ts`
- `lib/mcp/import-persistence.test.ts`
- `lib/mcp/serializers/project.ts`
- `lib/mcp/serializers/budgets.ts`
- `lib/mcp/serializers/polynomial-formula.ts`
- `lib/mcp/serializers/takeoffs.ts`
- `lib/mcp/serializers/work-schedule.ts`
- `lib/mcp/serializers/risk.ts`
- `lib/mcp/fixtures/minimal-project-package.ts`
- `lib/mcp/fixtures/full-project-package.ts`
- `app/api/imports/mcp/analyze/route.ts`
- `app/api/imports/mcp/analyze/route.test.ts`
- `app/api/imports/mcp/import/route.ts`
- `app/api/imports/mcp/import/route.test.ts`
- `app/imports/mcp/page.tsx`
- `components/imports/mcp-importer-page-content.tsx`
- `components/imports/mcp-importer-page-content.test.tsx`

**Modify**

- `lib/exports/definitions.ts`
- `lib/exports/centralized.ts`
- `app/api/exports/route.ts`
- `components/exports/export-panel.tsx`
- `lib/data/projects.ts`
- `lib/data/projects.test.ts`
- `README.md`

---

## Task 1: Extend export definitions to recognize the `.mcp` project package

**Files:**
- Modify: `lib/exports/definitions.ts`
- Test: `lib/exports/centralized.test.ts`

- [ ] **Step 1: Add the new export target and preset contract**

Update the type unions to include:

```ts
export type ExportTarget =
  | "budget"
  | "apu"
  | "resources"
  | "budget_resources"
  | "general_expenses"
  | "budget_footer"
  | "polynomial_formula"
  | "work_schedule"
  | "project_package";

export type ExportFormat = "xlsx" | "pdf" | "csv" | "zip" | "mcp";

export type ExportPreset =
  | "presupuesto_detallado"
  | "apu_consolidado"
  | "catalogo_insumos"
  | "lista_insumos_derivada"
  | "gastos_generales_detallado"
  | "pie_presupuesto_detallado"
  | "formula_polinomica_detallada"
  | "cronograma_ejecutivo"
  | "cronograma_partidas"
  | "calendario_valorizado"
  | "calendario_insumos"
  | "curva_s"
  | "proyecto_completo_mcp";
```

- [ ] **Step 2: Register the project package definition**

Add a new definition:

```ts
project_package: {
  target: "project_package",
  label: "Proyecto completo",
  presets: [
    {
      id: "proyecto_completo_mcp",
      label: "Proyecto completo .mcp",
      description: "Snapshot completo del proyecto para respaldo, traslado e interoperabilidad.",
      formats: ["mcp"],
      defaultFormat: "mcp",
      defaultOptions: {
        sections: ["project", "budgets", "apu", "general_expenses", "footer", "polynomial_formula", "takeoffs", "work_schedule", "risk"],
      },
    },
  ],
},
```

- [ ] **Step 3: Add the failing test for request normalization**

Add a test like:

```ts
it("accepts project package requests in mcp format", () => {
  const normalized = normalizeExportRequest({
    target: "project_package",
    targetId: "project-1",
    format: "mcp",
    preset: "proyecto_completo_mcp",
  });

  expect(normalized.target).toBe("project_package");
  expect(normalized.format).toBe("mcp");
});
```

- [ ] **Step 4: Run the targeted test to verify it fails**

Run: `npm run test -- lib/exports/centralized.test.ts`

Expected: FAIL because the target/format/preset do not exist yet.

---

## Task 2: Create the core `.mcp` type system and manifest helpers

**Files:**
- Create: `lib/mcp/types.ts`
- Create: `lib/mcp/manifest.ts`
- Create: `lib/mcp/schema.ts`
- Test: `lib/mcp/export-snapshot.test.ts`

- [ ] **Step 1: Define the canonical package types**

Add core types:

```ts
export type McpFormatVersion = "1.0.0";

export type McpModuleId =
  | "project"
  | "budgets"
  | "budget_items"
  | "apus"
  | "project_resources"
  | "general_expenses"
  | "budget_footer"
  | "polynomial_formula"
  | "takeoffs"
  | "work_schedule"
  | "risk_analysis";

export type McpCompatibility = "supported" | "supported_with_warnings" | "unsupported";
```

- [ ] **Step 2: Define the manifest factory contract**

Create a helper like:

```ts
export function createMcpManifest(input: {
  projectId: string;
  projectName: string;
  appVersion: string;
  modules: McpManifestModule[];
}): McpManifest
```

with fields for `format`, `formatVersion`, `schemaVersion`, `exportedAt`, `source`, `package`, `project`, and `modules`.

- [ ] **Step 3: Add the failing manifest test**

```ts
it("builds a manifest for a full project package", () => {
  const manifest = createMcpManifest({
    projectId: "project-1",
    projectName: "Hospital Norte",
    appVersion: "0.1.0",
    modules: [{ id: "project", path: "project.json", required: true }],
  });

  expect(manifest.format).toBe("MC_PROJECT_PACKAGE");
  expect(manifest.package.fileExtension).toBe(".mcp");
  expect(manifest.modules[0]?.path).toBe("project.json");
});
```

- [ ] **Step 4: Run the new targeted test**

Run: `npm run test -- lib/mcp/export-snapshot.test.ts`

Expected: FAIL because the new helpers do not exist yet.

---

## Task 3: Build decimal-safe serializers for each project module

**Files:**
- Create: `lib/mcp/serializers/project.ts`
- Create: `lib/mcp/serializers/budgets.ts`
- Create: `lib/mcp/serializers/polynomial-formula.ts`
- Create: `lib/mcp/serializers/takeoffs.ts`
- Create: `lib/mcp/serializers/work-schedule.ts`
- Create: `lib/mcp/serializers/risk.ts`
- Test: `lib/mcp/export-snapshot.test.ts`

- [ ] **Step 1: Add the decimal serialization helper usage**

Use a shared convention where sensitive numeric fields are serialized to strings:

```ts
function decimalToString(value: Decimal | Prisma.Decimal | number | null | undefined, scale?: number) {
  if (value == null) return null;
  const decimal = new Decimal(value);
  return scale == null ? decimal.toFixed() : decimal.toFixed(scale);
}
```

- [ ] **Step 2: Add the failing serializer test for polynomial coefficients**

```ts
it("serializes polynomial coefficients with 3 decimals", () => {
  const payload = serializePolynomialFormula({
    monomials: [
      {
        code: "M1",
        coefficient: new Prisma.Decimal("0.347"),
      },
    ],
  } as never);

  expect(payload.monomials[0]?.coefficient).toBe("0.347");
});
```

- [ ] **Step 3: Add the failing serializer test for budget item precision**

```ts
it("serializes budget item amounts as strings", () => {
  const payload = serializeBudgetItems({
    items: [
      {
        code: "01.01",
        quantity: new Prisma.Decimal("125.5000"),
        unitPrice: new Prisma.Decimal("89.3600"),
        partial: new Prisma.Decimal("11215.6800"),
      },
    ],
  } as never);

  expect(payload.items[0]).toMatchObject({
    quantity: "125.5000",
    unitPrice: "89.3600",
    partial: "11215.6800",
  });
});
```

- [ ] **Step 4: Run the targeted tests**

Run: `npm run test -- lib/mcp/export-snapshot.test.ts`

Expected: FAIL because the serializers are not implemented yet.

---

## Task 4: Implement the project snapshot aggregator

**Files:**
- Create: `lib/mcp/export-snapshot.ts`
- Modify: `lib/data/projects.ts`
- Test: `lib/mcp/export-snapshot.test.ts`

- [ ] **Step 1: Add a data-layer loader for the full project graph**

Add a focused project graph loader in `lib/data/projects.ts`:

```ts
export async function getProjectForPackageExport(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
    include: {
      budgets: {
        include: {
          levels: true,
          items: {
            include: {
              apu: {
                include: {
                  resources: true,
                },
              },
            },
          },
          generalExpenses: true,
          generalExpenseGroups: {
            include: {
              titles: {
                include: {
                  items: true,
                },
              },
            },
          },
          footerRows: true,
        },
      },
      polynomialFormulas: {
        include: {
          monomials: {
            include: {
              components: true,
            },
          },
        },
      },
    },
  });
}
```

- [ ] **Step 2: Create the snapshot builder**

Create:

```ts
export async function buildProjectPackageSnapshot(projectId: string, userId: string) {
  const project = await getProjectForPackageExport(projectId, userId);
  if (!project) {
    throw new Error("Proyecto no encontrado");
  }

  return {
    manifest: createMcpManifest(...),
    files: [
      { path: "project.json", content: ... },
      { path: "budgets/budget-tree.json", content: ... },
      { path: "budgets/budget-items.json", content: ... },
      { path: "budgets/apus.json", content: ... },
    ],
  };
}
```

- [ ] **Step 3: Add the failing snapshot test**

```ts
it("builds a semantic project snapshot with required files", async () => {
  const snapshot = await buildProjectPackageSnapshot("project-1", "user-1");

  expect(snapshot.files.map((file) => file.path)).toEqual(
    expect.arrayContaining([
      "project.json",
      "budgets/budget-tree.json",
      "budgets/budget-items.json",
      "budgets/apus.json",
    ]),
  );
});
```

- [ ] **Step 4: Run the targeted test**

Run: `npm run test -- lib/mcp/export-snapshot.test.ts`

Expected: FAIL because the snapshot builder does not exist yet.

---

## Task 5: Implement archive assembly and checksum validation

**Files:**
- Create: `lib/mcp/archive.ts`
- Create: `lib/mcp/checksums.ts`
- Modify: `lib/exports/centralized.ts`
- Test: `lib/mcp/export-snapshot.test.ts`

- [ ] **Step 1: Extract or reuse ZIP assembly**

Move or reuse the stored ZIP builder from `lib/exports/centralized.ts` so both work schedule ZIP and `.mcp` can share it:

```ts
export function buildStoredArchive(entries: ArchiveEntry[]) {
  // existing ZIP-store logic
}
```

- [ ] **Step 2: Add checksum generation**

Create:

```ts
export function createSha256Checksums(files: Array<{ path: string; content: string | Buffer }>) {
  return Object.fromEntries(
    files.map((file) => [file.path, createHash("sha256").update(file.content).digest("hex")]),
  );
}
```

- [ ] **Step 3: Add the failing integrity test**

```ts
it("writes checksums/sha256.json into the .mcp archive inputs", async () => {
  const snapshot = await buildProjectPackageSnapshot("project-1", "user-1");
  const archive = await buildProjectPackageArchive(snapshot);

  expect(archive.fileName.endsWith(".mcp")).toBe(true);
  expect(archive.entries.some((entry) => entry.fileName === "checksums/sha256.json")).toBe(true);
});
```

- [ ] **Step 4: Run the targeted tests**

Run: `npm run test -- lib/mcp/export-snapshot.test.ts`

Expected: FAIL because checksums/archive assembly are not implemented yet.

---

## Task 6: Wire `.mcp` export into the centralized export route

**Files:**
- Modify: `lib/exports/centralized.ts`
- Modify: `app/api/exports/route.ts`
- Modify: `components/exports/export-panel.tsx`
- Test: `lib/exports/centralized.test.ts`

- [ ] **Step 1: Add the new content type and dispatch path**

Extend `createCentralizedExport`:

```ts
const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  mcp: "application/octet-stream",
};

if (request.target === "project_package") {
  return createProjectPackageExport(request, userId);
}
```

- [ ] **Step 2: Implement the new export handler**

```ts
async function createProjectPackageExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const snapshot = await buildProjectPackageSnapshot(request.targetId, userId);
  const archive = await buildProjectPackageArchive(snapshot);

  return {
    content: archive.content,
    contentType: "application/octet-stream",
    fileName: archive.fileName,
  };
}
```

- [ ] **Step 3: Update the export panel labels**

Add a human label in `components/exports/export-panel.tsx`:

```ts
const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  pdf: "PDF",
  xlsx: "Excel",
  zip: "ZIP",
  mcp: "MCP",
};
```

- [ ] **Step 4: Add the failing export route test**

Add or extend a route test asserting that:

```ts
expect(response.headers.get("Content-Disposition")).toContain(".mcp");
```

- [ ] **Step 5: Run the targeted tests**

Run: `npm run test -- app/api/exports/route.test.ts lib/exports/centralized.test.ts`

Expected: PASS after implementation.

---

## Task 7: Create the `.mcp` import preview service

**Files:**
- Create: `lib/mcp/import-preview.ts`
- Create: `lib/mcp/import-preview.test.ts`
- Create: `app/api/imports/mcp/analyze/route.ts`
- Create: `app/api/imports/mcp/analyze/route.test.ts`

- [ ] **Step 1: Define the preview result contract**

```ts
export type McpImportPreview = {
  compatibility: "supported" | "supported_with_warnings" | "unsupported";
  projectName: string;
  formatVersion: string;
  modules: Array<{ id: string; present: boolean; required: boolean }>;
  warnings: string[];
  errors: string[];
};
```

- [ ] **Step 2: Implement preview parsing**

Create a service like:

```ts
export async function analyzeProjectPackageFile(file: File | Buffer) {
  const archive = await openProjectPackageArchive(file);
  const manifest = readManifest(archive);
  validateManifestVersion(manifest);
  validateChecksums(archive, manifest);
  return buildPreviewFromArchive(archive, manifest);
}
```

- [ ] **Step 3: Add the failing preview test**

```ts
it("returns supported preview for a valid .mcp file", async () => {
  const preview = await analyzeProjectPackageBuffer(buildFixtureProjectPackageBuffer());

  expect(preview.compatibility).toBe("supported");
  expect(preview.projectName).toBe("Hospital Norte");
});
```

- [ ] **Step 4: Add the failing analyze route test**

Use a multipart upload test and expect:

```ts
expect(response.status).toBe(200);
expect(body.compatibility).toBe("supported");
```

- [ ] **Step 5: Run the targeted tests**

Run: `npm run test -- lib/mcp/import-preview.test.ts app/api/imports/mcp/analyze/route.test.ts`

Expected: FAIL before implementation, PASS after implementation.

---

## Task 8: Implement `.mcp` import persistence as "restore as new project"

**Files:**
- Create: `lib/mcp/import-persistence.ts`
- Create: `lib/mcp/import-persistence.test.ts`
- Create: `app/api/imports/mcp/import/route.ts`
- Create: `app/api/imports/mcp/import/route.test.ts`

- [ ] **Step 1: Implement the persistence entry point**

Create:

```ts
export async function importProjectPackageToMyc(
  userId: string,
  input: McpImportPayload,
  options: { companyId: string; mode: "restore_as_new_project" },
) {
  return prisma.$transaction(async (tx) => {
    // create project
    // create budgets and sub-budgets
    // create levels/items
    // create APUs/resources
    // create general expenses/footer
    // create formula/takeoffs/schedule/risk
  });
}
```

- [ ] **Step 2: Add the failing roundtrip test**

```ts
it("imports a valid .mcp snapshot as a new project", async () => {
  const result = await importProjectPackageToMyc("user-1", fullFixtureProjectPackage, {
    companyId: "company-1",
    mode: "restore_as_new_project",
  });

  expect(result.projectId).toBeTruthy();
  expect(result.generalBudgetId).toBeTruthy();
  expect(result.warnings).toEqual([]);
});
```

- [ ] **Step 3: Add the failing import route test**

Assert:

```ts
expect(response.status).toBe(201);
expect(body.projectId).toBeTruthy();
```

- [ ] **Step 4: Reuse route patterns from S10/Delphin import**

The route should mirror:

- session validation
- workspace membership check
- multipart upload parsing
- revalidate dashboard/projects/budgets paths

- [ ] **Step 5: Run the targeted tests**

Run: `npm run test -- lib/mcp/import-persistence.test.ts app/api/imports/mcp/import/route.test.ts`

Expected: FAIL before implementation, PASS after implementation.

---

## Task 9: Add the `.mcp` importer UI

**Files:**
- Create: `app/imports/mcp/page.tsx`
- Create: `components/imports/mcp-importer-page-content.tsx`
- Create: `components/imports/mcp-importer-page-content.test.tsx`

- [ ] **Step 1: Create the importer page shell**

Match the other import pages with:

```tsx
export default function McpImportPage() {
  return <McpImporterPageContent />;
}
```

- [ ] **Step 2: Implement the page content flow**

The component should support:

- file picker for `.mcp`
- company selector
- analyze button
- preview summary
- warnings/errors panel
- import button for `restore_as_new_project`

- [ ] **Step 3: Add the failing UI test**

```tsx
it("shows a preview summary after analyzing a valid .mcp file", async () => {
  render(<McpImporterPageContent companies={[{ id: "company-1", name: "MC SAC" }]} />);

  expect(await screen.findByText("Proyecto detectado")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the targeted UI test**

Run: `npm run test -- components/imports/mcp-importer-page-content.test.tsx`

Expected: FAIL before implementation, PASS after implementation.

---

## Task 10: Add regression coverage for roundtrip integrity

**Files:**
- Modify: `lib/mcp/export-snapshot.test.ts`
- Modify: `lib/mcp/import-persistence.test.ts`

- [ ] **Step 1: Add the export -> import roundtrip test**

```ts
it("roundtrips a project package without losing budget, apu, and polynomial precision", async () => {
  const snapshot = await buildProjectPackageSnapshot("project-1", "user-1");
  const archive = await buildProjectPackageArchive(snapshot);
  const preview = await analyzeProjectPackageBuffer(archive.content);

  expect(preview.compatibility).toBe("supported");

  const result = await importProjectPackageToMyc("user-1", preview.packagePayload, {
    companyId: "company-1",
    mode: "restore_as_new_project",
  });

  expect(result.warnings).toEqual([]);
});
```

- [ ] **Step 2: Add the checksum corruption test**

```ts
it("rejects an archive whose checksum file does not match project.json", async () => {
  await expect(analyzeProjectPackageBuffer(buildCorruptedFixtureProjectPackageBuffer())).rejects.toThrow(
    "checksum",
  );
});
```

- [ ] **Step 3: Run the focused regression suite**

Run: `npm run test -- lib/mcp/export-snapshot.test.ts lib/mcp/import-preview.test.ts lib/mcp/import-persistence.test.ts`

Expected: PASS

---

## Task 11: Document the feature and operating constraints

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a new README section**

Document:

- what `.mcp` is
- where to export/import it
- what the package includes
- current limitations of V1

- [ ] **Step 2: Include sample user-facing flow**

Example:

```text
1. Abrir proyecto
2. Exportar proyecto (.mcp)
3. Ir a /imports/mcp
4. Analizar archivo
5. Importar como proyecto nuevo
```

- [ ] **Step 3: Mention compatibility boundaries**

Document:

- V1 supports `restore_as_new_project`
- no merge yet
- no secrets exported

---

## Verification Commands

Run targeted suites first:

```bash
npm run test -- lib/mcp/export-snapshot.test.ts
npm run test -- lib/mcp/import-preview.test.ts
npm run test -- lib/mcp/import-persistence.test.ts
npm run test -- app/api/imports/mcp/analyze/route.test.ts
npm run test -- app/api/imports/mcp/import/route.test.ts
npm run test -- components/imports/mcp-importer-page-content.test.tsx
npm run test -- app/api/exports/route.test.ts
```

Then run broader verification:

```bash
npm run test
npm run lint
```

---

## Release Acceptance Criteria

**Export**

- project export panel can generate a `.mcp` file
- the archive contains `manifest.json`, required module files, and `checksums/sha256.json`

**Preview**

- the analyzer accepts valid `.mcp` files
- it reports compatibility, modules, warnings, and errors clearly

**Import**

- a valid package can be restored as a new project
- budgets, APUs, general expenses, footer, polynomial formula, takeoffs, schedule, and risk persist correctly when present

**Precision**

- decimal-safe financial fields survive roundtrip
- polynomial coefficients keep 3 decimals

**Interoperability**

- the package is modular and readable
- the core contract does not depend on raw Prisma rows

---

## Open Decisions

- whether `ai/project-context.json` enters V1 or V2
- whether all attachments ship in V1 or only report-relevant ones
- whether the export button appears only in project detail first or also in the projects table
- whether `.mcp` gets a dedicated entitlement separate from `exports.advanced`
