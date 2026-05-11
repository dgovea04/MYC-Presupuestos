export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

export type ProjectRecord = {
  id: string;
  companyId: string;
  name: string;
  clientName?: string | null;
  location?: string | null;
  projectType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ProjectStatus;
  createdAt?: string;
  updatedAt?: string;
};
