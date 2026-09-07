import "dotenv/config";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { registerUserWithCompany } from "@/lib/auth/registration";

const email = process.env.E2E_USER_EMAIL ?? `e2e-${Date.now()}@mycpresupuestos.local`;
const password = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";

async function ensureUser(userEmail: string, name: string, companyName: string) {
  const existing = await prisma.user.findUnique({ where: { email: userEmail }, include: { companyMemberships: { where: { status: "ACTIVE" }, orderBy: { joinedAt: "asc" }, take: 1 } } });
  const account = existing?.companyMemberships[0]
    ? { userId: existing.id, companyId: existing.companyMemberships[0].companyId }
    : await registerUserWithCompany({ name, email: userEmail, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), companyName }).then((registered) => ({ userId: registered.user.id, companyId: registered.company.id }));
  await prisma.user.update({ where: { id: account.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), status: "ACTIVE", membershipPlan: { connect: { slug: "empresa" } } } });
  return account;
}

async function ensureBudget(companyId: string, userId: string, label: string) {
  const project = await prisma.project.findFirst({ where: { companyId, name: `${label} E2E Project` } }) ?? await prisma.project.create({ data: { companyId, name: `${label} E2E Project` } });
  const existing = await prisma.budget.findFirst({ where: { projectId: project.id, name: `${label} E2E Budget` } });
  const budget = existing ?? await prisma.budget.create({ data: { projectId: project.id, name: `${label} E2E Budget` } });
  const item = await prisma.budgetItem.findFirst({ where: { budgetId: budget.id } });
  const budgetItem = item ?? await prisma.budgetItem.create({ data: { budgetId: budget.id, code: "E2E-001", description: "Ítem E2E", unit: "und", quantity: "1", unitPrice: "10", partial: "10" } });
  await prisma.projectMembership.upsert({ where: { projectId_userId: { projectId: project.id, userId } }, update: { role: "ADMIN" }, create: { projectId: project.id, companyId, userId, role: "ADMIN" } });
  return { budgetId: budget.id, itemId: budgetItem.id };
}

async function main() {
  const owner = await ensureUser(email, "E2E Collaboration User", "E2E Collaboration Company");
  const foreign = await ensureUser(process.env.E2E_FOREIGN_USER_EMAIL ?? `e2e-foreign-${Date.now()}@mycpresupuestos.local`, "E2E Foreign User", "E2E Foreign Company");
  const budget = await ensureBudget(owner.companyId, owner.userId, "primary");
  const foreignBudget = await ensureBudget(foreign.companyId, foreign.userId, "foreign");
  console.log(JSON.stringify({ E2E_USER_EMAIL: email, E2E_USER_PASSWORD: password, E2E_COLLABORATION_BUDGET_ID: budget.budgetId, E2E_COLLABORATION_BUDGET_ITEM_ID: budget.itemId, E2E_FOREIGN_BUDGET_ID: foreignBudget.budgetId }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
