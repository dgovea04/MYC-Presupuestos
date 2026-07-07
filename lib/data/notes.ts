import { prisma } from "@/lib/db/prisma";
import { ensureDate } from "@/lib/utils";
import { noteTaskCreateSchema, noteTaskUpdateSchema, type NoteTaskCreateInput, type NoteTaskUpdateInput } from "@/lib/validations/notes";
import { publishBudgetEvent } from "@/lib/collaboration/events";
import type { NoteTaskPriority, NoteTaskRecord, NoteTaskStatus } from "@/types/notes";

const noteTaskInclude = {
  user: {
    select: {
      name: true,
      avatarUrl: true,
    },
  },
  project: {
    select: {
      name: true,
    },
  },
  budget: {
    select: {
      name: true,
    },
  },
  budgetItem: {
    select: {
      code: true,
      description: true,
    },
  },
};

type NoteTaskWithContext = {
  id: string;
  userId: string;
  projectId: string | null;
  budgetId: string | null;
  budgetItemId: string | null;
  body: string;
  priority: NoteTaskPriority;
  status: NoteTaskStatus;
  sourcePath: string;
  sharedWith: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  user: { name: string; avatarUrl: string | null };
  project: { name: string } | null;
  budget: { name: string } | null;
  budgetItem: { code: string; description: string } | null;
};

type NoteTaskModel = {
  findMany(args: Record<string, unknown>): Promise<NoteTaskWithContext[]>;
  findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>;
  create(args: Record<string, unknown>): Promise<NoteTaskWithContext>;
  update(args: Record<string, unknown>): Promise<NoteTaskWithContext>;
  delete(args: Record<string, unknown>): Promise<unknown>;
};

const noteTaskModel = (prisma as unknown as { noteTask: NoteTaskModel }).noteTask;

export type NoteTaskListFilters = {
  status?: NoteTaskStatus;
  projectId?: string;
  budgetId?: string;
  budgetItemId?: string;
  sourcePath?: string;
};

export async function listNoteTasks(userId: string, filters: NoteTaskListFilters = {}): Promise<NoteTaskRecord[]> {
  const where: Record<string, unknown> = {
    OR: [
      { userId },
      { sharedWith: { has: userId } },
    ],
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.budgetId) {
    where.budgetId = filters.budgetId;
  }

  if (filters.budgetItemId) {
    where.budgetItemId = filters.budgetItemId;
  }

  if (filters.sourcePath) {
    where.sourcePath = filters.sourcePath;
  }

  const notes = await noteTaskModel.findMany({
    where,
    include: noteTaskInclude,
    orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return notes.map(serializeNoteTask);
}

export async function createNoteTask(userId: string, input: NoteTaskCreateInput): Promise<NoteTaskRecord> {
  const parsed = noteTaskCreateSchema.parse(input);
  const note = await noteTaskModel.create({
    data: {
      userId,
      body: parsed.body,
      priority: parsed.priority,
      sourcePath: parsed.sourcePath,
      projectId: parsed.projectId ?? null,
      budgetId: parsed.budgetId ?? null,
      budgetItemId: parsed.budgetItemId ?? null,
      sharedWith: parsed.sharedWith ?? [],
    },
    include: noteTaskInclude,
  });

  // Emit SSE event when a note is created with shared users and linked to a budget
  if (parsed.sharedWith && parsed.sharedWith.length > 0 && note.budgetId) {
    publishBudgetEvent(note.budgetId, "note.shared", {
      noteId: note.id,
      body: note.body,
      author: { name: note.user.name, avatarUrl: note.user.avatarUrl },
      sharedByUserId: userId,
      sharedWith: parsed.sharedWith,
    });
  }

  return serializeNoteTask(note);
}

export async function updateNoteTask(id: string, userId: string, input: NoteTaskUpdateInput): Promise<NoteTaskRecord> {
  const parsed = noteTaskUpdateSchema.parse(input);
  await ensureUserCanAccessNoteTask(id, userId);

  // Fetch current sharedWith and budgetId before updating, so we can detect
  // newly added users and emit SSE events for them.
  const previous = await noteTaskModel.findFirst({
    where: { id },
    select: { sharedWith: true, budgetId: true, body: true, userId: true },
  }) as { sharedWith: string[]; budgetId: string | null; body: string; userId: string } | null;

  const status = parsed.status;
  const note = await noteTaskModel.update({
    where: { id },
    data: {
      body: parsed.body,
      priority: parsed.priority,
      status,
      sharedWith: parsed.sharedWith,
      resolvedAt: status === "RESOLVED" ? new Date() : status === "OPEN" ? null : undefined,
    },
    include: noteTaskInclude,
  });

  // Emit SSE event for newly shared users when the note is linked to a budget
  if (parsed.sharedWith && previous && note.budgetId) {
    const oldSet = new Set(previous.sharedWith ?? []);
    const newUsers = parsed.sharedWith.filter((uid) => !oldSet.has(uid));
    if (newUsers.length > 0) {
      publishBudgetEvent(note.budgetId, "note.shared", {
        noteId: note.id,
        body: note.body,
        author: { name: note.user.name, avatarUrl: note.user.avatarUrl },
        sharedByUserId: userId,
        sharedWith: newUsers,
      });
    }
  }

  return serializeNoteTask(note);
}

export async function deleteNoteTask(id: string, userId: string) {
  await ensureUserOwnsNoteTask(id, userId);
  await noteTaskModel.delete({
    where: { id },
  });
}

async function ensureUserCanAccessNoteTask(id: string, userId: string) {
  const note = await noteTaskModel.findFirst({
    where: {
      id,
      OR: [
        { userId },
        { sharedWith: { has: userId } },
      ],
    },
    select: { id: true },
  });

  if (!note) {
    throw new Error("No tienes permisos para modificar esta nota");
  }
}

async function ensureUserOwnsNoteTask(id: string, userId: string) {
  const note = await noteTaskModel.findFirst({
    where: {
      id,
      userId,
    },
    select: { id: true },
  });

  if (!note) {
    throw new Error("Solo el autor puede eliminar esta nota");
  }
}

function serializeNoteTask(note: NoteTaskWithContext): NoteTaskRecord {
  return {
    id: note.id,
    body: note.body,
    priority: note.priority,
    status: note.status,
    projectId: note.projectId ?? undefined,
    budgetId: note.budgetId ?? undefined,
    budgetItemId: note.budgetItemId ?? undefined,
    projectName: note.project?.name,
    budgetName: note.budget?.name,
    budgetItemCode: note.budgetItem?.code,
    budgetItemDescription: note.budgetItem?.description,
    sourcePath: note.sourcePath,
    author: {
      name: note.user.name,
      avatarUrl: note.user.avatarUrl,
    },
    sharedWith: note.sharedWith,
    createdAt: ensureDate(note.createdAt).toISOString(),
    updatedAt: ensureDate(note.updatedAt).toISOString(),
    resolvedAt: note.resolvedAt ? ensureDate(note.resolvedAt).toISOString() : undefined,
  };
}
