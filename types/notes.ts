export type NoteTaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type NoteTaskStatus = "OPEN" | "RESOLVED";

export type NoteTaskAuthor = {
  name: string;
  avatarUrl?: string | null;
};

export type NoteTaskRecord = {
  id: string;
  body: string;
  priority: NoteTaskPriority;
  status: NoteTaskStatus;
  projectId?: string;
  budgetId?: string;
  budgetItemId?: string;
  projectName?: string;
  budgetName?: string;
  budgetItemCode?: string;
  budgetItemDescription?: string;
  sourcePath: string;
  author: NoteTaskAuthor;
  sharedWith: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};
