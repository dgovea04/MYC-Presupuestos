# Khipu Project History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist completed Khipu executions as project-scoped history while keeping localStorage as the `/ai` lab fallback.

**Architecture:** Add a dedicated Prisma-backed history model, a pure data access service, one project history GET route, optional `projectId` on AI request payloads, and `AIWorkspace` project-aware history loading. Do not use history as prompt memory yet.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma/PostgreSQL, Vitest, existing Khipu AI route/service patterns.

---

## File Structure

- Modify: `prisma/schema.prisma`
  - Add `AiProjectHistoryEntry` relations to `User` and `Project`.
  - Add `model AiProjectHistoryEntry`.
- Create: `prisma/migrations/20260609170000_add_ai_project_history/migration.sql`
  - Create database table and indexes.
- Create: `lib/ai/project-history.ts`
  - Owns project access checks, listing, recording, payload mapping, caps.
- Create: `lib/ai/project-history.test.ts`
  - Unit tests with mocked Prisma client.
- Create: `app/api/projects/[id]/ai-history/route.ts`
  - Authenticated GET route for recent project history.
- Create: `app/api/projects/[id]/ai-history/route.test.ts`
  - Route tests with mocked auth/service.
- Modify: `lib/ai/validation.ts`
  - Add optional `projectId` to AI request schemas.
- Create: `lib/ai/project-history-route.ts`
  - Small helper that records project history after successful AI route execution.
- Create: `lib/ai/project-history-route.test.ts`
  - Tests non-blocking persistence behavior.
- Create: `app/api/ai/chat/route.test.ts`
  - Tests project-aware route persistence integration for the simplest AI route.
- Modify:
  - `app/api/ai/chat/route.ts`
  - `app/api/ai/apu/route.ts`
  - `app/api/ai/review/route.ts`
  - `app/api/ai/autocomplete/route.ts`
  - `app/api/ai/apu/generate/route.ts`
  - Save successful project-aware Khipu responses for endpoint results; keep catalog APU generate scoped to validation only in this increment.
- Add focused AI route coverage:
  - `app/api/ai/chat/route.test.ts`
- Modify:
  - `components/ai/AIWorkspace.tsx`
  - `components/ai/AIWorkspace.bridge.test.tsx`
  - Add project-aware history loading and preserve no-project localStorage behavior.

Do not modify:

- Budget/APU calculation files.
- S10 import/export files.
- `lib/ai/service.ts` token accounting.
- Prompt construction for history memory.
- UI layout beyond the existing history panel behavior.
- unrelated dirty files already present in the working tree:
  - `app/dashboard/page.tsx`
  - `components/budget/budget-editor.tsx`
  - `lib/dashboard/onboarding.test.ts`
  - `lib/dashboard/onboarding.ts`

---

### Task 1: Add Prisma Model and Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260609170000_add_ai_project_history/migration.sql`

- [ ] **Step 1: Add schema relations**

In `prisma/schema.prisma`, add this field to `model User` near the other AI relations:

```prisma
  aiProjectHistoryEntries AiProjectHistoryEntry[]
```

Add this field to `model Project` near the other project-owned child collections:

```prisma
  aiProjectHistoryEntries AiProjectHistoryEntry[]
```

- [ ] **Step 2: Add the history model**

Add this model after `AiTokenLedger` and before `ActivityEvent`:

```prisma
model AiProjectHistoryEntry {
  id             String   @id @default(cuid())
  projectId      String
  userId         String
  action         String
  summary        String
  context        Json
  answer         String
  structuredData Json?
  model          String
  requestedModel String
  fallbackUsed   Boolean  @default(false)
  warnings       String[] @default([])
  latencyMs      Int?
  createdAt      DateTime @default(now())
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
}
```

- [ ] **Step 3: Create migration SQL**

Create `prisma/migrations/20260609170000_add_ai_project_history/migration.sql`:

```sql
CREATE TABLE "AiProjectHistoryEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "structuredData" JSONB,
    "model" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProjectHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProjectHistoryEntry_projectId_createdAt_idx" ON "AiProjectHistoryEntry"("projectId", "createdAt" DESC);
CREATE INDEX "AiProjectHistoryEntry_userId_createdAt_idx" ON "AiProjectHistoryEntry"("userId", "createdAt" DESC);
CREATE INDEX "AiProjectHistoryEntry_action_createdAt_idx" ON "AiProjectHistoryEntry"("action", "createdAt" DESC);

ALTER TABLE "AiProjectHistoryEntry" ADD CONSTRAINT "AiProjectHistoryEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiProjectHistoryEntry" ADD CONSTRAINT "AiProjectHistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Validate Prisma schema**

Run:

```bash
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js validate
```

Expected: PASS. Prisma reports the schema is valid.

- [ ] **Step 5: Generate Prisma client**

Run:

```bash
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js generate
```

Expected: PASS. Prisma client generation completes.

- [ ] **Step 6: Commit schema and migration**

```bash
git add prisma/schema.prisma prisma/migrations/20260609170000_add_ai_project_history/migration.sql
git commit -m "feat: add khipu project history model"
```

---

### Task 2: Add Project History Data Service

**Files:**
- Create: `lib/ai/project-history.test.ts`
- Create: `lib/ai/project-history.ts`

- [ ] **Step 1: Create failing data service tests**

Create `lib/ai/project-history.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    aiProjectHistoryEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { getAiProjectHistory, recordAiProjectHistory } from "@/lib/ai/project-history";

describe("Khipu project history data service", () => {
  beforeEach(() => {
    prismaMock.project.findFirst.mockReset();
    prismaMock.aiProjectHistoryEntry.create.mockReset();
    prismaMock.aiProjectHistoryEntry.findMany.mockReset();
  });

  it("lists recent history only after verifying project ownership", async () => {
    const createdAt = new Date("2026-06-09T15:30:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.findMany.mockResolvedValue([
      createDbEntry({ id: "history-1", projectId: "project-1", userId: "user-1", createdAt }),
    ]);

    const entries = await getAiProjectHistory("project-1", "user-1", 5);

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        company: {
          userId: "user-1",
        },
      },
      select: {
        id: true,
      },
    });
    expect(prismaMock.aiProjectHistoryEntry.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        userId: "user-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
    expect(entries).toEqual([
      expect.objectContaining({
        id: "history-1",
        projectId: "project-1",
        timestamp: "2026-06-09T15:30:00.000Z",
        result: expect.objectContaining({
          answer: "Respuesta tecnica",
          model: "llama3.1",
        }),
      }),
    ]);
  });

  it("returns an empty list for an inaccessible project", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(getAiProjectHistory("project-2", "user-1")).resolves.toEqual([]);
    expect(prismaMock.aiProjectHistoryEntry.findMany).not.toHaveBeenCalled();
  });

  it("caps requested history limits between 1 and 20", async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.findMany.mockResolvedValue([]);

    await getAiProjectHistory("project-1", "user-1", 100);

    expect(prismaMock.aiProjectHistoryEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });

  it("records a successful Khipu execution with context and result metadata", async () => {
    const createdAt = new Date("2026-06-09T15:40:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.create.mockResolvedValue(
      createDbEntry({
        id: "history-created",
        projectId: "project-1",
        userId: "user-1",
        createdAt,
        action: "review",
        summary: "Revision de presupuesto",
      }),
    );

    const entry = await recordAiProjectHistory({
      projectId: "project-1",
      userId: "user-1",
      action: "review",
      summary: "Revision de presupuesto",
      context: { project: "Hospital Norte", module: "Presupuesto" },
      result: {
        answer: "Respuesta tecnica",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: ["Validar precios"],
        latencyMs: 450,
        structuredData: {
          answer: "Respuesta tecnica",
          findings: [],
          assumptions: [],
        },
      },
    });

    expect(prismaMock.aiProjectHistoryEntry.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "user-1",
        action: "review",
        summary: "Revision de presupuesto",
        context: { project: "Hospital Norte", module: "Presupuesto" },
        answer: "Respuesta tecnica",
        structuredData: {
          answer: "Respuesta tecnica",
          findings: [],
          assumptions: [],
        },
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: ["Validar precios"],
        latencyMs: 450,
      },
    });
    expect(entry).toEqual(expect.objectContaining({ id: "history-created", action: "review" }));
  });
});

function createDbEntry({
  action = "chat",
  createdAt,
  id,
  projectId,
  summary = "Consulta tecnica",
  userId,
}: {
  action?: string;
  createdAt: Date;
  id: string;
  projectId: string;
  summary?: string;
  userId: string;
}) {
  return {
    id,
    projectId,
    userId,
    action,
    summary,
    context: { project: "Hospital Norte" },
    answer: "Respuesta tecnica",
    structuredData: null,
    model: "llama3.1",
    requestedModel: "llama3.1",
    fallbackUsed: false,
    warnings: [],
    latencyMs: 350,
    createdAt,
  };
}
```

- [ ] **Step 2: Run data service tests to verify failure**

Run:

```bash
npm run test -- lib/ai/project-history.test.ts
```

Expected: FAIL because `@/lib/ai/project-history` does not exist.

- [ ] **Step 3: Implement the data service**

Create `lib/ai/project-history.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AiAction, AiContext, AiEndpointResult } from "@/lib/ai/types";

export type AiProjectHistoryEntry = {
  id: string;
  projectId: string;
  userId: string;
  action: Exclude<AiAction, "json">;
  summary: string;
  context: AiContext;
  result: AiEndpointResult;
  timestamp: string;
};

export type RecordAiProjectHistoryInput = {
  projectId: string;
  userId: string;
  action: Exclude<AiAction, "json">;
  summary: string;
  context?: AiContext;
  result: AiEndpointResult;
};

const DEFAULT_HISTORY_LIMIT = 20;

export async function getAiProjectHistory(projectId: string, userId: string, limit = DEFAULT_HISTORY_LIMIT) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return [];
  }

  const entries = await prisma.aiProjectHistoryEntry.findMany({
    where: {
      projectId,
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: clampHistoryLimit(limit),
  });

  return entries.map(mapHistoryEntry);
}

export async function recordAiProjectHistory({
  action,
  context = {},
  projectId,
  result,
  summary,
  userId,
}: RecordAiProjectHistoryInput) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return null;
  }

  const entry = await prisma.aiProjectHistoryEntry.create({
    data: {
      projectId,
      userId,
      action,
      summary: summary.slice(0, 240),
      context: toJsonObject(context),
      answer: result.answer,
      structuredData: result.structuredData === undefined ? Prisma.JsonNull : toJsonValue(result.structuredData),
      model: result.model,
      requestedModel: result.requestedModel,
      fallbackUsed: result.fallbackUsed,
      warnings: result.warnings,
      latencyMs: result.latencyMs,
    },
  });

  return mapHistoryEntry(entry);
}

function clampHistoryLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), DEFAULT_HISTORY_LIMIT);
}

function mapHistoryEntry(entry: {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  summary: string;
  context: unknown;
  answer: string;
  structuredData: unknown;
  model: string;
  requestedModel: string;
  fallbackUsed: boolean;
  warnings: string[];
  latencyMs: number | null;
  createdAt: Date;
}): AiProjectHistoryEntry {
  return {
    id: entry.id,
    projectId: entry.projectId,
    userId: entry.userId,
    action: readHistoryAction(entry.action),
    summary: entry.summary,
    context: readHistoryContext(entry.context),
    result: {
      answer: entry.answer,
      model: entry.model,
      requestedModel: entry.requestedModel,
      fallbackUsed: entry.fallbackUsed,
      warnings: entry.warnings,
      latencyMs: entry.latencyMs ?? undefined,
      structuredData: entry.structuredData ?? undefined,
    },
    timestamp: entry.createdAt.toISOString(),
  };
}

function readHistoryAction(action: string): Exclude<AiAction, "json"> {
  if (action === "apu" || action === "review" || action === "autocomplete") {
    return action;
  }

  return "chat";
}

function readHistoryContext(value: unknown): AiContext {
  if (!isRecord(value)) {
    return {};
  }

  return {
    project: typeof value.project === "string" ? value.project : undefined,
    module: typeof value.module === "string" ? value.module : undefined,
    selectedItem: typeof value.selectedItem === "string" ? value.selectedItem : undefined,
    unit: typeof value.unit === "string" ? value.unit : undefined,
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: typeof value.activeTable === "string" ? value.activeTable : undefined,
  };
}

function toJsonObject(context: AiContext): Prisma.JsonObject {
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)) as Prisma.JsonObject;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized: unknown = JSON.parse(JSON.stringify(value ?? null));
  return serialized as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run data service tests**

Run:

```bash
npm run test -- lib/ai/project-history.test.ts
```

Expected: PASS. All project history service tests pass.

- [ ] **Step 5: Commit data service**

```bash
git add lib/ai/project-history.ts lib/ai/project-history.test.ts
git commit -m "feat: add khipu project history service"
```

---

### Task 3: Add Project History GET Route

**Files:**
- Create: `app/api/projects/[id]/ai-history/route.test.ts`
- Create: `app/api/projects/[id]/ai-history/route.ts`

- [ ] **Step 1: Create failing route tests**

Create `app/api/projects/[id]/ai-history/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getAiProjectHistory: vi.fn(),
  getProjectHeaderById: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/ai/project-history", () => ({
  getAiProjectHistory: mocks.getAiProjectHistory,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

import { GET } from "@/app/api/projects/[id]/ai-history/route";

describe("GET /api/projects/[id]/ai-history", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getAiProjectHistory.mockReset();
    mocks.getProjectHeaderById.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns recent project history newest first", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", status: "ACTIVE" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockResolvedValue([
      {
        id: "history-2",
        projectId: "project-1",
        userId: "user-1",
        action: "review",
        summary: "Revision reciente",
        context: { project: "Hospital Norte" },
        result: {
          answer: "Respuesta reciente",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
        timestamp: "2026-06-09T16:00:00.000Z",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: expect.any(Array) });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getAiProjectHistory).toHaveBeenCalledWith("project-1", "user-1", 20);
  });

  it("returns an empty list for an owned project without history", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", status: "ACTIVE" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: [] });
  });

  it("returns 404 for inaccessible projects", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", status: "ACTIVE" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-2/ai-history"), {
      params: Promise.resolve({ id: "project-2" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Proyecto no encontrado" });
    expect(mocks.getAiProjectHistory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm run test -- app/api/projects/[id]/ai-history/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

Create `app/api/projects/[id]/ai-history/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAiProjectHistory } from "@/lib/ai/project-history";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.status === "SUSPENDED") {
    return NextResponse.json({ error: "Usuario suspendido" }, { status: 403 });
  }

  const { id } = await params;
  const project = await getProjectHeaderById(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const entries = await getAiProjectHistory(id, session.user.id, 20);

  return NextResponse.json({ entries });
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test -- app/api/projects/[id]/ai-history/route.test.ts lib/ai/project-history.test.ts
```

Expected: PASS. Route and service tests pass.

- [ ] **Step 5: Commit route**

```bash
git add app/api/projects/[id]/ai-history/route.ts app/api/projects/[id]/ai-history/route.test.ts
git commit -m "feat: add khipu project history api"
```

---

### Task 4: Record History From AI Routes

**Files:**
- Modify: `lib/ai/validation.ts`
- Create: `lib/ai/project-history-route.ts`
- Create: `lib/ai/project-history-route.test.ts`
- Create: `app/api/ai/chat/route.test.ts`
- Modify:
  - `app/api/ai/chat/route.ts`
  - `app/api/ai/apu/route.ts`
  - `app/api/ai/review/route.ts`
  - `app/api/ai/autocomplete/route.ts`
  - `app/api/ai/apu/generate/route.ts`

- [ ] **Step 1: Add optional projectId to validation schemas**

In `lib/ai/validation.ts`, add:

```ts
const projectIdSchema = z.string().trim().min(1).optional();
```

Then add `projectId: projectIdSchema` to:

- `aiChatRequestSchema`
- `aiApuRequestSchema`
- `aiApuCatalogGenerateRequestSchema`
- `aiReviewRequestSchema`
- `aiAutocompleteRequestSchema`

- [ ] **Step 2: Create failing helper tests**

Create `lib/ai/project-history-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordAiProjectHistory: vi.fn(),
}));

vi.mock("@/lib/ai/project-history", () => ({
  recordAiProjectHistory: mocks.recordAiProjectHistory,
}));

import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";

describe("AI project history route helper", () => {
  beforeEach(() => {
    mocks.recordAiProjectHistory.mockReset();
  });

  it("returns the original result when projectId is absent", async () => {
    const result = createResult();

    await expect(
      attachProjectHistoryEntry({
        action: "chat",
        context: { project: "Hospital Norte" },
        projectId: undefined,
        result,
        summary: "Consulta tecnica",
        userId: "user-1",
      }),
    ).resolves.toEqual(result);
    expect(mocks.recordAiProjectHistory).not.toHaveBeenCalled();
  });

  it("returns the result with a historyEntry when project history is saved", async () => {
    const result = createResult();
    mocks.recordAiProjectHistory.mockResolvedValue({
      id: "history-1",
      projectId: "project-1",
      userId: "user-1",
      action: "chat",
      summary: "Consulta tecnica",
      context: { project: "Hospital Norte" },
      result,
      timestamp: "2026-06-09T16:10:00.000Z",
    });

    const response = await attachProjectHistoryEntry({
      action: "chat",
      context: { project: "Hospital Norte" },
      projectId: "project-1",
      result,
      summary: "Consulta tecnica",
      userId: "user-1",
    });

    expect(response).toEqual({
      ...result,
      historyEntry: expect.objectContaining({ id: "history-1" }),
    });
  });

  it("keeps the AI answer when history persistence fails and appends a warning", async () => {
    const result = createResult();
    mocks.recordAiProjectHistory.mockRejectedValue(new Error("database down"));

    const response = await attachProjectHistoryEntry({
      action: "review",
      context: {},
      projectId: "project-1",
      result,
      summary: "Revision",
      userId: "user-1",
    });

    expect(response.answer).toBe("Respuesta tecnica");
    expect(response.warnings).toContain("Khipu respondio, pero no se pudo guardar el historial del proyecto.");
  });
});

function createResult() {
  return {
    answer: "Respuesta tecnica",
    model: "llama3.1",
    requestedModel: "llama3.1",
    fallbackUsed: false,
    warnings: [] as string[],
    latencyMs: 320,
  };
}
```

- [ ] **Step 3: Run helper tests to verify failure**

Run:

```bash
npm run test -- lib/ai/project-history-route.test.ts
```

Expected: FAIL because `project-history-route` does not exist.

- [ ] **Step 4: Implement helper**

Create `lib/ai/project-history-route.ts`:

```ts
import { recordAiProjectHistory, type AiProjectHistoryEntry } from "@/lib/ai/project-history";
import type { AiAction, AiContext, AiEndpointResult } from "@/lib/ai/types";

export type AiEndpointResultWithHistory = AiEndpointResult & {
  historyEntry?: AiProjectHistoryEntry;
};

export async function attachProjectHistoryEntry({
  action,
  context,
  projectId,
  result,
  summary,
  userId,
}: {
  action: Exclude<AiAction, "json">;
  context?: AiContext;
  projectId?: string;
  result: AiEndpointResult;
  summary: string;
  userId: string;
}): Promise<AiEndpointResultWithHistory> {
  if (!projectId) {
    return result;
  }

  try {
    const historyEntry = await recordAiProjectHistory({
      action,
      context,
      projectId,
      result,
      summary,
      userId,
    });

    return historyEntry ? { ...result, historyEntry } : result;
  } catch {
    return {
      ...result,
      warnings: [...result.warnings, "Khipu respondio, pero no se pudo guardar el historial del proyecto."],
    };
  }
}
```

- [ ] **Step 5: Update AI routes**

In each AI route, import:

```ts
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
```

Then wrap the successful result.

For `app/api/ai/chat/route.ts`, replace:

```ts
return NextResponse.json(result);
```

with:

```ts
return NextResponse.json(
  await attachProjectHistoryEntry({
    action: "chat",
    context: data.context,
    projectId: data.projectId,
    result,
    summary: data.message,
    userId: session.user.id,
  }),
);
```

For `app/api/ai/apu/route.ts`, use:

```ts
return NextResponse.json(
  await attachProjectHistoryEntry({
    action: "apu",
    context: data.context,
    projectId: data.projectId,
    result,
    summary: data.description,
    userId: session.user.id,
  }),
);
```

For `app/api/ai/review/route.ts`, use:

```ts
return NextResponse.json(
  await attachProjectHistoryEntry({
    action: "review",
    context: data.context,
    projectId: data.projectId,
    result,
    summary: data.budgetSummary.slice(0, 140),
    userId: session.user.id,
  }),
);
```

For `app/api/ai/autocomplete/route.ts`, use:

```ts
return NextResponse.json(
  await attachProjectHistoryEntry({
    action: "autocomplete",
    context: data.context,
    projectId: data.projectId,
    result,
    summary: data.input,
    userId: session.user.id,
  }),
);
```

For `app/api/ai/apu/generate/route.ts`, this route returns `AiApuCatalogGenerationResult`, not `AiEndpointResult`. Do not force it through this helper in the first implementation. Keep its `projectId` validation available for a later catalog-specific persistence helper.

- [ ] **Step 6: Add focused chat route integration tests**

Create `app/api/ai/chat/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  buildChatMessages: vi.fn(),
  generateAiResponse: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildChatMessages: mocks.buildChatMessages,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/ai/service", () => ({
  generateAiResponse: mocks.generateAiResponse,
}));

import { POST } from "@/app/api/ai/chat/route";

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.buildChatMessages.mockReset();
    mocks.generateAiResponse.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.buildChatMessages.mockReturnValue([{ role: "user", content: "Consulta tecnica" }]);
    mocks.generateAiResponse.mockResolvedValue({
      answer: "Respuesta tecnica",
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("records project history when projectId is provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
          projectId: "project-1",
          context: { project: "Hospital Norte", module: "APU" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-1" } }));
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: { project: "Hospital Norte", module: "APU" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Respuesta tecnica" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("keeps chat behavior when projectId is absent", async () => {
    await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
        }),
      }),
    );

    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: undefined,
        summary: "Consulta tecnica",
      }),
    );
  });
});
```

- [ ] **Step 7: Run helper, chat route, and validation-adjacent tests**

Run:

```bash
npm run test -- lib/ai/project-history-route.test.ts app/api/ai/chat/route.test.ts lib/ai/structured-output.test.ts lib/ai/prompts.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit route persistence helper**

```bash
git add lib/ai/validation.ts lib/ai/project-history-route.ts lib/ai/project-history-route.test.ts app/api/ai/chat/route.ts app/api/ai/chat/route.test.ts app/api/ai/apu/route.ts app/api/ai/review/route.ts app/api/ai/autocomplete/route.ts
git commit -m "feat: record khipu project history from ai routes"
```

---

### Task 5: Add Project-Aware UI History

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Add failing UI tests**

In `components/ai/AIWorkspace.bridge.test.tsx`, add tests inside the existing describe block:

```ts
  it("loads project history when a project id is provided", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-project-1",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta persistida",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta persistida",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace({ projectId: "project-1" });

    expect(getByText("Consulta persistida")).toBeTruthy();

    await act(async () => {
      getButtonByText("Ver detalle").click();
    });

    expect(getByText("Respuesta persistida")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-history");
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });

  it("prepends returned project history after a successful project-aware Ollama request", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/ai/chat") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            answer: "Nueva respuesta",
            model: "llama3.1",
            requestedModel: "llama3.1",
            fallbackUsed: false,
            warnings: [],
            historyEntry: {
              id: "history-new",
              projectId: "project-1",
              userId: "user-1",
              action: "chat",
              summary: "Consulta inicial",
              context: { project: "Edificio Multifamiliar", module: "APU" },
              result: {
                answer: "Nueva respuesta",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
              },
              timestamp: "2026-06-09T16:25:00.000Z",
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Consulta inicial")).toBeTruthy();
    expect(getByText("Nueva respuesta")).toBeTruthy();
    const chatRequest = fetchMock.mock.calls.find(([url]) => url === "/api/ai/chat");
    expect(JSON.parse(String(chatRequest?.[1]?.body))).toEqual(expect.objectContaining({ projectId: "project-1" }));
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });
```

Update `renderWorkspace` to accept props:

```ts
async function renderWorkspace(props: Partial<React.ComponentProps<typeof AIWorkspace>> = {}) {
```

and render:

```tsx
root.render(<AIWorkspace initialChatMessage="Consulta inicial" {...props} />);
```

- [ ] **Step 2: Run UI tests to verify failure**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because `AIWorkspace` does not accept/load `projectId` yet.

- [ ] **Step 3: Update AIWorkspace types**

In `components/ai/AIWorkspace.tsx`, add `projectId?: string` to props and function parameters:

```ts
export function AIWorkspace({
  projectId,
  initialAction = "chat",
  ...
}: {
  projectId?: string;
  initialAction?: AiAction;
  ...
}) {
```

Extend `AiResult` local handling by accepting an optional `historyEntry` from API payload:

```ts
type AiResultWithHistory = AiResult & {
  historyEntry?: AiHistoryEntry;
};
```

Change `readAiResult(payload: unknown): AiResult` to return `AiResultWithHistory` and map `historyEntry` when present.

- [ ] **Step 4: Load server history only when projectId exists**

Replace the localStorage-only history state with:

```ts
const [history, setHistory] = useState<AiHistoryEntry[]>(() => (projectId ? [] : readStoredHistory()));
```

Add an effect:

```ts
useEffect(() => {
  if (!projectId) {
    return;
  }

  let active = true;
  void loadProjectHistory(projectId).then((entries) => {
    if (active) {
      setHistory(entries);
    }
  });

  return () => {
    active = false;
  };
}, [projectId]);
```

Update the localStorage persistence effect:

```ts
useEffect(() => {
  if (projectId) {
    return;
  }

  window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
}, [history, projectId]);
```

- [ ] **Step 5: Include projectId in non-bridge requests and use returned historyEntry**

In `buildRequest`, add `projectId` to payloads only when present:

```ts
...(projectId ? { projectId } : {}),
```

Add that spread to `chat`, `apu`, `review`, and `autocomplete` payload objects.

After a successful fetch, replace manual history insertion with:

```ts
const nextHistoryEntry =
  nextResult.historyEntry ??
  (!projectId
    ? {
        id: `${Date.now()}-${request.action}`,
        action: request.action,
        summary: summarizeRequest(request),
        context,
        result: nextResult,
        timestamp: new Date().toISOString(),
      }
    : null);

if (nextHistoryEntry) {
  setHistory((current) => [nextHistoryEntry, ...current]);
}
```

For ChatGPT Bridge response handling, keep local session behavior. It should continue to insert a local history entry even if `projectId` exists, because Bridge persistence is out of scope.

- [ ] **Step 6: Add project history fetch helpers**

Add these helpers near the existing readers:

```ts
async function loadProjectHistory(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-history`);
    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return [];
    }

    return payload.entries.map(readHistoryEntry).filter((entry): entry is AiHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

function readHistoryEntry(value: unknown): AiHistoryEntry | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.action !== "string" || typeof value.summary !== "string") {
    return null;
  }

  if (!isRecord(value.result) || typeof value.timestamp !== "string") {
    return null;
  }

  return {
    id: value.id,
    action: readHistoryAction(value.action),
    summary: value.summary,
    context: readAiContext(value.context),
    result: readAiResult(value.result),
    timestamp: value.timestamp,
  };
}

function readHistoryAction(action: string): AiAction {
  if (action === "apu" || action === "review" || action === "autocomplete") {
    return action;
  }

  return "chat";
}

function readAiContext(value: unknown): AiContext {
  if (!isRecord(value)) {
    return {};
  }

  return {
    project: typeof value.project === "string" ? value.project : undefined,
    module: typeof value.module === "string" ? value.module : undefined,
    selectedItem: typeof value.selectedItem === "string" ? value.selectedItem : undefined,
    unit: typeof value.unit === "string" ? value.unit : undefined,
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: typeof value.activeTable === "string" ? value.activeTable : undefined,
  };
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit UI changes**

```bash
git add components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx
git commit -m "feat: load khipu history by project"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused project history and AI tests**

Run:

```bash
npm run test -- lib/ai/project-history.test.ts lib/ai/project-history-route.test.ts app/api/projects/[id]/ai-history/route.test.ts app/api/ai/chat/route.test.ts components/ai/AIWorkspace.bridge.test.tsx lib/ai/retrieval-context.test.ts lib/ai/prompts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Validate Prisma**

Run:

```bash
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js validate
```

Expected: PASS.

- [ ] **Step 4: Confirm old assistant names remain absent**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output. `rg` exits with code 1 when there are no matches; that is expected.

- [ ] **Step 5: Confirm scope**

Run:

```bash
git status --short
```

Expected: Khipu project history changes are committed. The only remaining dirty files should be the unrelated pre-existing files:

- `app/dashboard/page.tsx`
- `components/budget/budget-editor.tsx`
- `lib/dashboard/onboarding.test.ts`
- `lib/dashboard/onboarding.ts`

Do not stage, commit, revert, or modify those unrelated files.

---

## Self-Review Checklist

- The plan persists Khipu history by project, not by browser session only.
- The plan keeps localStorage fallback when `projectId` is absent.
- The plan does not turn history into prompt memory.
- The plan does not persist ChatGPT Bridge responses server-side.
- The plan does not modify token accounting, budget calculations, S10 imports, streaming, embeddings, or metrics.
- Project access is checked through `Project -> Company -> User`.
- History persistence failure does not fail a successful AI answer.
- Tests cover service, API, AI route helper, and UI behavior.
