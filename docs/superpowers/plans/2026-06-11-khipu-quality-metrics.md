# Khipu Quality Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit quality feedback metrics for Khipu suggestions: applied, edited, and dismissed.

**Architecture:** Persist project feedback as append-only events linked to `AiProjectHistoryEntry`, then compute the latest state per history entry for summaries. Keep browser-only session feedback local in `AIWorkspace` so non-project usage continues without backend persistence.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Prisma/PostgreSQL, Vitest, React client state/localStorage.

---

## File Structure

- Modify `prisma/schema.prisma`: add `AiSuggestionFeedbackType`, `AiSuggestionFeedbackEvent`, and relations on `User`, `Project`, and `AiProjectHistoryEntry`.
- Create `prisma/migrations/20260611160000_add_khipu_quality_feedback/migration.sql`: SQL migration for enum, table, foreign keys, and indexes.
- Create `lib/ai/suggestion-feedback.ts`: ownership-safe service for recording feedback, latest-state lookup, and summary counts.
- Create `lib/ai/suggestion-feedback.test.ts`: service tests with Prisma mocks.
- Create `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.ts`: POST endpoint to record project feedback.
- Create `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.test.ts`: route tests.
- Create `app/api/projects/[id]/ai-feedback/summary/route.ts`: GET endpoint for project quality summary.
- Create `app/api/projects/[id]/ai-feedback/summary/route.test.ts`: route tests.
- Modify `components/ai/AIWorkspace.tsx`: feedback controls, summary strip, persisted project feedback calls, local session fallback.
- Modify `components/ai/AIWorkspace.bridge.test.tsx`: UI tests for counters, project feedback API, and local feedback persistence.

---

### Task 1: Prisma Model And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260611160000_add_khipu_quality_feedback/migration.sql`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, add the enum near the other AI enums:

```prisma
enum AiSuggestionFeedbackType {
  APPLIED
  EDITED
  DISMISSED
}
```

Add relation fields:

```prisma
model User {
  // existing fields stay unchanged
  aiSuggestionFeedbackEvents AiSuggestionFeedbackEvent[]
}

model Project {
  // existing fields stay unchanged
  aiSuggestionFeedbackEvents AiSuggestionFeedbackEvent[]
}

model AiProjectHistoryEntry {
  // existing fields stay unchanged
  feedbackEvents AiSuggestionFeedbackEvent[]
}
```

Add the new model after `AiProjectHistoryEntry`:

```prisma
model AiSuggestionFeedbackEvent {
  id             String                   @id @default(cuid())
  historyEntryId String
  userId         String
  projectId      String
  feedbackType   AiSuggestionFeedbackType
  notes          String?
  createdAt      DateTime                 @default(now())
  historyEntry   AiProjectHistoryEntry    @relation(fields: [historyEntryId], references: [id], onDelete: Cascade)
  user           User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project        Project                  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([historyEntryId, createdAt(sort: Desc)])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([feedbackType, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Add SQL migration**

Create `prisma/migrations/20260611160000_add_khipu_quality_feedback/migration.sql`:

```sql
CREATE TYPE "AiSuggestionFeedbackType" AS ENUM ('APPLIED', 'EDITED', 'DISMISSED');

CREATE TABLE "AiSuggestionFeedbackEvent" (
  "id" TEXT NOT NULL,
  "historyEntryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "feedbackType" "AiSuggestionFeedbackType" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiSuggestionFeedbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiSuggestionFeedbackEvent_historyEntryId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("historyEntryId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_projectId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("projectId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_userId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("userId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_feedbackType_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("feedbackType", "createdAt" DESC);

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_historyEntryId_fkey"
  FOREIGN KEY ("historyEntryId") REFERENCES "AiProjectHistoryEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate Prisma**

Run:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js validate
```

Expected: schema is valid.

- [ ] **Step 4: Commit**

```powershell
git add prisma\schema.prisma prisma\migrations\20260611160000_add_khipu_quality_feedback\migration.sql
git commit -m "feat: add khipu quality feedback model"
```

---

### Task 2: Feedback Service

**Files:**
- Create: `lib/ai/suggestion-feedback.ts`
- Create: `lib/ai/suggestion-feedback.test.ts`

- [ ] **Step 1: Write service tests**

Create `lib/ai/suggestion-feedback.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    aiProjectHistoryEntry: {
      findFirst: vi.fn(),
    },
    aiSuggestionFeedbackEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import {
  getAiSuggestionFeedbackSummary,
  getLatestAiSuggestionFeedbackByHistoryEntry,
  recordAiSuggestionFeedback,
} from "@/lib/ai/suggestion-feedback";

describe("Khipu suggestion feedback service", () => {
  beforeEach(() => {
    prismaMock.aiProjectHistoryEntry.findFirst.mockReset();
    prismaMock.aiSuggestionFeedbackEvent.create.mockReset();
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockReset();
  });

  it("records feedback only after verifying project history ownership", async () => {
    const createdAt = new Date("2026-06-11T16:00:00.000Z");
    prismaMock.aiProjectHistoryEntry.findFirst.mockResolvedValue({ id: "history-1", projectId: "project-1" });
    prismaMock.aiSuggestionFeedbackEvent.create.mockResolvedValue({
      id: "feedback-1",
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "APPLIED",
      notes: null,
      createdAt,
    });

    const feedback = await recordAiSuggestionFeedback({
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "APPLIED",
    });

    expect(prismaMock.aiProjectHistoryEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: "history-1",
        projectId: "project-1",
        userId: "user-1",
        project: { company: { userId: "user-1" } },
      },
      select: { id: true, projectId: true },
    });
    expect(prismaMock.aiSuggestionFeedbackEvent.create).toHaveBeenCalledWith({
      data: {
        historyEntryId: "history-1",
        projectId: "project-1",
        userId: "user-1",
        feedbackType: "APPLIED",
        notes: undefined,
      },
    });
    expect(feedback).toEqual({
      id: "feedback-1",
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "APPLIED",
      notes: undefined,
      timestamp: "2026-06-11T16:00:00.000Z",
    });
  });

  it("does not record feedback for inaccessible history", async () => {
    prismaMock.aiProjectHistoryEntry.findFirst.mockResolvedValue(null);

    await expect(
      recordAiSuggestionFeedback({
        historyEntryId: "history-2",
        projectId: "project-1",
        userId: "user-1",
        feedbackType: "DISMISSED",
      }),
    ).resolves.toBeNull();
    expect(prismaMock.aiSuggestionFeedbackEvent.create).not.toHaveBeenCalled();
  });

  it("returns latest feedback state by history entry", async () => {
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createFeedback({ historyEntryId: "history-1", feedbackType: "EDITED", createdAt: new Date("2026-06-11T16:02:00.000Z") }),
      createFeedback({ historyEntryId: "history-1", feedbackType: "APPLIED", createdAt: new Date("2026-06-11T16:01:00.000Z") }),
      createFeedback({ historyEntryId: "history-2", feedbackType: "DISMISSED", createdAt: new Date("2026-06-11T16:03:00.000Z") }),
    ]);

    await expect(
      getLatestAiSuggestionFeedbackByHistoryEntry({
        projectId: "project-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      "history-1": "EDITED",
      "history-2": "DISMISSED",
    });
  });

  it("summarizes latest feedback state instead of raw event count", async () => {
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createFeedback({ historyEntryId: "history-1", feedbackType: "EDITED", createdAt: new Date("2026-06-11T16:02:00.000Z") }),
      createFeedback({ historyEntryId: "history-1", feedbackType: "APPLIED", createdAt: new Date("2026-06-11T16:01:00.000Z") }),
      createFeedback({ historyEntryId: "history-2", feedbackType: "DISMISSED", createdAt: new Date("2026-06-11T16:03:00.000Z") }),
      createFeedback({ historyEntryId: "history-3", feedbackType: "APPLIED", createdAt: new Date("2026-06-11T16:04:00.000Z") }),
    ]);

    await expect(
      getAiSuggestionFeedbackSummary({
        projectId: "project-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      applied: 1,
      edited: 1,
      dismissed: 1,
    });
  });
});

function createFeedback({
  createdAt,
  feedbackType,
  historyEntryId,
}: {
  createdAt: Date;
  feedbackType: "APPLIED" | "EDITED" | "DISMISSED";
  historyEntryId: string;
}) {
  return {
    id: `${historyEntryId}-${feedbackType}`,
    historyEntryId,
    projectId: "project-1",
    userId: "user-1",
    feedbackType,
    notes: null,
    createdAt,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- lib/ai/suggestion-feedback.test.ts
```

Expected: fail because `lib/ai/suggestion-feedback.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `lib/ai/suggestion-feedback.ts`:

```ts
import type { AiSuggestionFeedbackType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AiSuggestionFeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
};

export type AiSuggestionFeedbackEventDto = {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
  timestamp: string;
};

type RecordAiSuggestionFeedbackInput = {
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
};

type ProjectFeedbackInput = {
  projectId: string;
  userId: string;
};

export async function recordAiSuggestionFeedback({
  feedbackType,
  historyEntryId,
  notes,
  projectId,
  userId,
}: RecordAiSuggestionFeedbackInput): Promise<AiSuggestionFeedbackEventDto | null> {
  const historyEntry = await prisma.aiProjectHistoryEntry.findFirst({
    where: {
      id: historyEntryId,
      projectId,
      userId,
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!historyEntry) {
    return null;
  }

  const event = await prisma.aiSuggestionFeedbackEvent.create({
    data: {
      historyEntryId,
      projectId,
      userId,
      feedbackType,
      notes: normalizeNotes(notes),
    },
  });

  return mapFeedbackEvent(event);
}

export async function getLatestAiSuggestionFeedbackByHistoryEntry({
  projectId,
  userId,
}: ProjectFeedbackInput): Promise<Record<string, AiSuggestionFeedbackType>> {
  const events = await findProjectFeedbackEvents(projectId, userId);
  const latestByHistoryEntry: Record<string, AiSuggestionFeedbackType> = {};

  for (const event of events) {
    if (!latestByHistoryEntry[event.historyEntryId]) {
      latestByHistoryEntry[event.historyEntryId] = event.feedbackType;
    }
  }

  return latestByHistoryEntry;
}

export async function getAiSuggestionFeedbackSummary({
  projectId,
  userId,
}: ProjectFeedbackInput): Promise<AiSuggestionFeedbackSummary> {
  const latestByHistoryEntry = await getLatestAiSuggestionFeedbackByHistoryEntry({ projectId, userId });
  const summary: AiSuggestionFeedbackSummary = {
    applied: 0,
    edited: 0,
    dismissed: 0,
  };

  for (const feedbackType of Object.values(latestByHistoryEntry)) {
    if (feedbackType === "APPLIED") {
      summary.applied += 1;
    } else if (feedbackType === "EDITED") {
      summary.edited += 1;
    } else {
      summary.dismissed += 1;
    }
  }

  return summary;
}

function findProjectFeedbackEvents(projectId: string, userId: string) {
  return prisma.aiSuggestionFeedbackEvent.findMany({
    where: {
      projectId,
      userId,
      project: {
        company: {
          userId,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function mapFeedbackEvent(event: {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes: string | null;
  createdAt: Date;
}): AiSuggestionFeedbackEventDto {
  return {
    id: event.id,
    historyEntryId: event.historyEntryId,
    projectId: event.projectId,
    userId: event.userId,
    feedbackType: event.feedbackType,
    notes: event.notes ?? undefined,
    timestamp: event.createdAt.toISOString(),
  };
}

function normalizeNotes(notes: string | undefined) {
  const trimmed = notes?.trim();
  return trimmed ? trimmed.slice(0, 500) : undefined;
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm run test -- lib/ai/suggestion-feedback.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib\ai\suggestion-feedback.ts lib\ai\suggestion-feedback.test.ts
git commit -m "feat: add khipu suggestion feedback service"
```

---

### Task 3: Feedback API Routes

**Files:**
- Create: `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.ts`
- Create: `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.test.ts`
- Create: `app/api/projects/[id]/ai-feedback/summary/route.ts`
- Create: `app/api/projects/[id]/ai-feedback/summary/route.test.ts`

- [ ] **Step 1: Write POST route test**

Create `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getProjectHeaderById: vi.fn(),
  recordAiSuggestionFeedback: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  recordAiSuggestionFeedback: mocks.recordAiSuggestionFeedback,
}));

import { POST } from "@/app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route";

describe("POST /api/projects/[id]/ai-history/[historyEntryId]/feedback", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getProjectHeaderById.mockReset();
    mocks.recordAiSuggestionFeedback.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/projects/project-1/ai-history/history-1/feedback"), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for an invalid feedback type", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1" });

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/ai-history/history-1/feedback", {
        method: "POST",
        body: JSON.stringify({ feedbackType: "UNKNOWN" }),
      }),
      { params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid feedback type" });
  });

  it("records feedback after project access is verified", async () => {
    const feedback = {
      id: "feedback-1",
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "APPLIED",
      timestamp: "2026-06-11T16:00:00.000Z",
    };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1" });
    mocks.recordAiSuggestionFeedback.mockResolvedValue(feedback);

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/ai-history/history-1/feedback", {
        method: "POST",
        body: JSON.stringify({ feedbackType: "APPLIED", notes: "Usada en presupuesto" }),
      }),
      { params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ feedback });
    expect(mocks.recordAiSuggestionFeedback).toHaveBeenCalledWith({
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "APPLIED",
      notes: "Usada en presupuesto",
    });
  });

  it("returns 404 when project or history is inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1" });
    mocks.recordAiSuggestionFeedback.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/ai-history/history-2/feedback", {
        method: "POST",
        body: JSON.stringify({ feedbackType: "DISMISSED" }),
      }),
      { params: Promise.resolve({ id: "project-1", historyEntryId: "history-2" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Feedback target not found" });
  });
});
```

- [ ] **Step 2: Implement POST route**

Create `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { AiSuggestionFeedbackType } from "@prisma/client";
import { recordAiSuggestionFeedback } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

const FEEDBACK_TYPES = new Set<AiSuggestionFeedbackType>(["APPLIED", "EDITED", "DISMISSED"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; historyEntryId: string }> },
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { historyEntryId, id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const feedbackType = readFeedbackType(body);
    if (!feedbackType) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    const feedback = await recordAiSuggestionFeedback({
      historyEntryId,
      projectId: id,
      userId: session.user.id,
      feedbackType,
      notes: readNotes(body),
    });

    if (!feedback) {
      return NextResponse.json({ error: "Feedback target not found" }, { status: 404 });
    }

    return NextResponse.json({ feedback });
  } catch {
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}

function readFeedbackType(value: unknown): AiSuggestionFeedbackType | null {
  if (!isRecord(value) || typeof value.feedbackType !== "string") {
    return null;
  }

  return FEEDBACK_TYPES.has(value.feedbackType as AiSuggestionFeedbackType)
    ? (value.feedbackType as AiSuggestionFeedbackType)
    : null;
}

function readNotes(value: unknown) {
  if (!isRecord(value) || typeof value.notes !== "string") {
    return undefined;
  }

  const trimmed = value.notes.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 3: Write summary route test**

Create `app/api/projects/[id]/ai-feedback/summary/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getProjectHeaderById: vi.fn(),
  getAiSuggestionFeedbackSummary: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  getAiSuggestionFeedbackSummary: mocks.getAiSuggestionFeedbackSummary,
}));

import { GET } from "@/app/api/projects/[id]/ai-feedback/summary/route";

describe("GET /api/projects/[id]/ai-feedback/summary", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getProjectHeaderById.mockReset();
    mocks.getAiSuggestionFeedbackSummary.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns summary after project access is verified", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1" });
    mocks.getAiSuggestionFeedbackSummary.mockResolvedValue({ applied: 2, edited: 1, dismissed: 3 });

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { applied: 2, edited: 1, dismissed: 3 },
    });
    expect(mocks.getAiSuggestionFeedbackSummary).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
    });
  });
});
```

- [ ] **Step 4: Implement summary route**

Create `app/api/projects/[id]/ai-feedback/summary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAiSuggestionFeedbackSummary } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const summary = await getAiSuggestionFeedbackSummary({
      projectId: id,
      userId: session.user.id,
    });

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Unable to load feedback summary" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run route tests**

Run:

```powershell
npm run test -- app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.test.ts app/api/projects/[id]/ai-feedback/summary/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add app\api\projects\[id]\ai-history\[historyEntryId]\feedback\route.ts app\api\projects\[id]\ai-history\[historyEntryId]\feedback\route.test.ts app\api\projects\[id]\ai-feedback\summary\route.ts app\api\projects\[id]\ai-feedback\summary\route.test.ts
git commit -m "feat: add khipu feedback api routes"
```

---

### Task 4: Khipu Workspace Feedback UI

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Add failing UI tests**

In `components/ai/AIWorkspace.bridge.test.tsx`, add tests inside the existing describe block:

```ts
  it("records local session feedback and updates quality counters", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Streaming no disponible" }),
        });
      }

      if (url === "/api/ai/chat") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            answer: "Respuesta para medir",
            model: "llama3.1",
            requestedModel: "llama3.1",
            fallbackUsed: false,
            warnings: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace();

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });
    await act(async () => {
      getButtonByText("Aplicada").click();
    });

    expect(getByText("Aplicadas")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
    expect(window.localStorage.getItem("myc-ai-session-feedback")).toContain("APPLIED");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/feedback"))).toBe(false);
  });

  it("records project feedback through the API and updates counters", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => ({ summary: { applied: 0, edited: 0, dismissed: 0 } }) });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createSseStream([
            {
              event: "final",
              data: {
                answer: "Respuesta proyecto",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
                historyEntry: {
                  id: "history-1",
                  projectId: "project-1",
                  userId: "user-1",
                  action: "chat",
                  summary: "Consulta inicial",
                  context: { project: "Edificio Multifamiliar" },
                  result: {
                    answer: "Respuesta proyecto",
                    model: "llama3.1",
                    requestedModel: "llama3.1",
                    fallbackUsed: false,
                    warnings: [],
                  },
                  timestamp: "2026-06-11T16:10:00.000Z",
                },
              },
            },
          ]),
        });
      }

      if (url === "/api/projects/project-1/ai-history/history-1/feedback") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            feedback: {
              id: "feedback-1",
              historyEntryId: "history-1",
              projectId: "project-1",
              userId: "user-1",
              feedbackType: "EDITED",
              timestamp: "2026-06-11T16:11:00.000Z",
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
    await act(async () => {
      getButtonByText("Editada").click();
    });

    expect(getByText("Editadas")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
    const feedbackRequest = fetchMock.mock.calls.find(([url]) => url === "/api/projects/project-1/ai-history/history-1/feedback");
    expect(JSON.parse(String(feedbackRequest?.[1]?.body))).toEqual({ feedbackType: "EDITED" });
  });
```

- [ ] **Step 2: Implement UI types and state**

In `components/ai/AIWorkspace.tsx`, add:

```ts
type AiFeedbackType = "APPLIED" | "EDITED" | "DISMISSED";

type AiFeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
};

type AiFeedbackState = Record<string, AiFeedbackType>;

const AI_FEEDBACK_STORAGE_KEY = "myc-ai-session-feedback";
```

Inside `AIWorkspaceContent`, add state:

```ts
const [feedbackByHistoryId, setFeedbackByHistoryId] = useState<AiFeedbackState>(() =>
  projectId ? {} : readStoredFeedback(),
);
const [feedbackSummary, setFeedbackSummary] = useState<AiFeedbackSummary>(() =>
  projectId ? createEmptyFeedbackSummary() : summarizeFeedbackState(readStoredFeedback()),
);
const [feedbackError, setFeedbackError] = useState("");
```

- [ ] **Step 3: Implement summary loading and localStorage persistence**

Add effects inside `AIWorkspaceContent`:

```ts
useEffect(() => {
  if (projectId) {
    return;
  }

  window.localStorage.setItem(AI_FEEDBACK_STORAGE_KEY, JSON.stringify(feedbackByHistoryId));
  setFeedbackSummary(summarizeFeedbackState(feedbackByHistoryId));
}, [feedbackByHistoryId, projectId]);

useEffect(() => {
  if (!projectId) {
    const stored = readStoredFeedback();
    setFeedbackByHistoryId(stored);
    setFeedbackSummary(summarizeFeedbackState(stored));
    return;
  }

  let active = true;
  void loadProjectFeedbackSummary(projectId).then((summary) => {
    if (active) {
      setFeedbackSummary(summary);
    }
  });

  return () => {
    active = false;
  };
}, [projectId]);
```

- [ ] **Step 4: Implement feedback handler**

Add inside `AIWorkspaceContent`:

```ts
async function submitFeedback(entry: AiHistoryEntry, feedbackType: AiFeedbackType) {
  setFeedbackError("");

  if (!projectId) {
    setFeedbackByHistoryId((current) => ({
      ...current,
      [entry.id]: feedbackType,
    }));
    return;
  }

  const previousFeedback = feedbackByHistoryId[entry.id];
  setFeedbackByHistoryId((current) => ({
    ...current,
    [entry.id]: feedbackType,
  }));
  setFeedbackSummary((current) => updateFeedbackSummary(current, previousFeedback, feedbackType));

  try {
    const response = await fetch(`/api/projects/${projectId}/ai-history/${entry.id}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ feedbackType }),
    });
    const payload: unknown = await response.json();

    if (!response.ok || !isRecord(payload)) {
      throw new Error(readErrorMessage(payload));
    }
  } catch (caughtError) {
    setFeedbackByHistoryId((current) => {
      const next = { ...current };
      if (previousFeedback) {
        next[entry.id] = previousFeedback;
      } else {
        delete next[entry.id];
      }
      return next;
    });
    setFeedbackSummary((current) => updateFeedbackSummary(current, feedbackType, previousFeedback));
    setFeedbackError(caughtError instanceof Error ? caughtError.message : "No se pudo registrar la metrica de calidad.");
  }
}
```

- [ ] **Step 5: Render summary and controls**

Near the preparation/status area, render:

```tsx
<div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
  <QualityMetric label="Aplicadas" value={feedbackSummary.applied} />
  <QualityMetric label="Editadas" value={feedbackSummary.edited} />
  <QualityMetric label="Descartadas" value={feedbackSummary.dismissed} />
</div>
```

Under the current `AIMessage` response, render a feedback control only when there is an entry id. Use the returned `historyEntry` for project responses and the session fallback entry for local history:

```tsx
{result ? (
  <FeedbackControls
    selected={readResultFeedbackId(result) ? feedbackByHistoryId[readResultFeedbackId(result) ?? ""] : undefined}
    onSelect={(feedbackType) => {
      const entry = readFeedbackEntryForResult(result, history);
      if (entry) {
        void submitFeedback(entry, feedbackType);
      }
    }}
  />
) : null}
```

Add helper components near other small UI helpers:

```tsx
function QualityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FeedbackControls({
  onSelect,
  selected,
}: {
  onSelect: (feedbackType: AiFeedbackType) => void;
  selected?: AiFeedbackType;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        ["APPLIED", "Aplicada"],
        ["EDITED", "Editada"],
        ["DISMISSED", "Descartada"],
      ].map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          type="button"
          variant={selected === value ? "default" : "outline"}
          onClick={() => onSelect(value as AiFeedbackType)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add utility helpers**

Add below existing helper functions:

```ts
function createEmptyFeedbackSummary(): AiFeedbackSummary {
  return { applied: 0, edited: 0, dismissed: 0 };
}

function summarizeFeedbackState(state: AiFeedbackState): AiFeedbackSummary {
  return Object.values(state).reduce((summary, feedbackType) => updateFeedbackSummary(summary, undefined, feedbackType), createEmptyFeedbackSummary());
}

function updateFeedbackSummary(summary: AiFeedbackSummary, previous: AiFeedbackType | undefined, next: AiFeedbackType | undefined) {
  const updated = { ...summary };
  if (previous === "APPLIED") updated.applied -= 1;
  if (previous === "EDITED") updated.edited -= 1;
  if (previous === "DISMISSED") updated.dismissed -= 1;
  if (next === "APPLIED") updated.applied += 1;
  if (next === "EDITED") updated.edited += 1;
  if (next === "DISMISSED") updated.dismissed += 1;
  return {
    applied: Math.max(0, updated.applied),
    edited: Math.max(0, updated.edited),
    dismissed: Math.max(0, updated.dismissed),
  };
}

function readStoredFeedback(): AiFeedbackState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(AI_FEEDBACK_STORAGE_KEY) ?? "{}");
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AiFeedbackType] => isFeedbackType(entry[1])),
    );
  } catch {
    return {};
  }
}

function isFeedbackType(value: unknown): value is AiFeedbackType {
  return value === "APPLIED" || value === "EDITED" || value === "DISMISSED";
}

async function loadProjectFeedbackSummary(projectId: string): Promise<AiFeedbackSummary> {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-feedback/summary`);
    if (!response.ok) {
      return createEmptyFeedbackSummary();
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.summary)) {
      return createEmptyFeedbackSummary();
    }

    return {
      applied: typeof payload.summary.applied === "number" ? payload.summary.applied : 0,
      edited: typeof payload.summary.edited === "number" ? payload.summary.edited : 0,
      dismissed: typeof payload.summary.dismissed === "number" ? payload.summary.dismissed : 0,
    };
  } catch {
    return createEmptyFeedbackSummary();
  }
}
```

- [ ] **Step 7: Run UI tests**

Run:

```powershell
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add components\ai\AIWorkspace.tsx components\ai\AIWorkspace.bridge.test.tsx
git commit -m "feat: add khipu quality feedback UI"
```

---

### Task 5: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- lib/ai/suggestion-feedback.test.ts app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.test.ts app/api/projects/[id]/ai-feedback/summary/route.test.ts components/ai/AIWorkspace.bridge.test.tsx lib/ai/project-history.test.ts lib/ai/project-history-route.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Validate Prisma**

Run:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js validate
```

Expected: schema is valid.

- [ ] **Step 4: Search for old naming**

Run:

```powershell
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no product-facing Khipu regressions.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git status --short
```

Expected: only unrelated pre-existing dirty files remain, or no changes if this task owns all diffs.

- [ ] **Step 6: Commit final fixes if needed**

If verification required small corrections:

```powershell
git add <changed-files>
git commit -m "fix: stabilize khipu quality metrics"
```

If no corrections were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: model, persistence, service ownership checks, API, UI controls, session fallback, summary counters, and tests are covered.
- Completeness scan: no incomplete markers are intentionally left in the plan.
- Type consistency: feedback type names use `APPLIED`, `EDITED`, and `DISMISSED` consistently across Prisma, service, API, and UI.
- Route consistency: project routes use the existing `app/api/projects/[id]/...` convention rather than `[projectId]`.
