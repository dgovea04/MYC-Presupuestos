import { prisma } from "@/lib/db/prisma";
import { ensureDate } from "@/lib/utils";
import { noteTaskCreateSchema, noteTaskUpdateSchema, type NoteTaskCreateInput, type NoteTaskUpdateInput } from "@/lib/validations/notes";
import type { NoteTaskPriority, NoteTaskRecord, NoteTaskStatus } from "@/types/notes";

const noteTaskInclude = {
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
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
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
  const where: Record<string, string> = {
    userId,
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
    },
    include: noteTaskInclude,
  });

  return serializeNoteTask(note);
}

export async function updateNoteTask(id: string, userId: string, input: NoteTaskUpdateInput): Promise<NoteTaskRecord> {
  const parsed = noteTaskUpdateSchema.parse(input);
  await ensureUserCanAccessNoteTask(id, userId);
  const status = parsed.status;
  const note = await noteTaskModel.update({
    where: { id },
    data: {
      body: parsed.body,
      priority: parsed.priority,
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : status === "OPEN" ? null : undefined,
    },
    include: noteTaskInclude,
  });

  return serializeNoteTask(note);
}

export async function deleteNoteTask(id: string, userId: string) {
  await ensureUserCanAccessNoteTask(id, userId);
  await noteTaskModel.delete({
    where: { id },
  });
}

async function ensureUserCanAccessNoteTask(id: string, userId: string) {
  const note = await noteTaskModel.findFirst({
    where: {
      id,
      userId,
    },
    select: { id: true },
  });

  if (!note) {
    throw new Error("No tienes permisos para modificar esta nota");
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
    createdAt: ensureDate(note.createdAt).toISOString(),
    updatedAt: ensureDate(note.updatedAt).toISOString(),
    resolvedAt: note.resolvedAt ? ensureDate(note.resolvedAt).toISOString() : undefined,
  };
}
