export type McpSerializedProject = {
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  projectType: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  currency: string;
  exportedAt: string;
};

export function serializeProject(project: {
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  projectType: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  status: string;
  currency: string;
}): McpSerializedProject {
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    location: project.location,
    projectType: project.projectType,
    startDate: maybeDate(project.startDate),
    endDate: maybeDate(project.endDate),
    status: project.status,
    currency: project.currency,
    exportedAt: new Date().toISOString(),
  };
}

function maybeDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}
