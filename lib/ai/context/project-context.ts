import { prisma } from "@/lib/db/prisma";

export async function getProjectContextSummary({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<string> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
    },
    select: {
      name: true,
      clientName: true,
      location: true,
      projectType: true,
      status: true,
      budgets: {
        select: {
          name: true,
          currency: true,
          totalAmount: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 5,
      },
    },
  });

  if (!project) {
    return "";
  }

  const budgetLines = project.budgets.map(
    (budget) => `- Presupuesto: ${budget.name} (${budget.currency} ${budget.totalAmount.toString()})`,
  );

  return [
    `Proyecto: ${project.name}`,
    project.clientName ? `Cliente: ${project.clientName}` : undefined,
    project.location ? `Ubicacion: ${project.location}` : undefined,
    project.projectType ? `Tipo: ${project.projectType}` : undefined,
    `Estado: ${project.status}`,
    ...budgetLines,
  ]
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .join("\n");
}
