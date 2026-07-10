import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  console.log("[DB-CHECK] ====== START DB CHECK ======");
  console.log("[DB-CHECK] User:", session.user.id, session.user.email);

  // Get user's first active company
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true, company: { select: { name: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No tienes empresas activas" }, { status: 400 });
  }

  const companyId = membership.companyId;
  console.log("[DB-CHECK] Company:", companyId, membership.company.name);

  const results: Record<string, unknown> = {
    user: { id: session.user.id, email: session.user.email },
    company: { id: companyId, name: membership.company.name },
    timestamp: new Date().toISOString(),
    tests: [] as Array<Record<string, unknown>>,
  };

  // Test 1: Direct project creation
  try {
    console.log("[DB-CHECK] Test 1: Direct project creation (no transaction)...");
    const projectName = `DB-CHECK-DIRECT-${Date.now()}`;

    const created = await prisma.project.create({
      data: {
        companyId,
        name: projectName,
        status: "PLANNING",
      },
    });

    console.log("[DB-CHECK] Created project:", JSON.stringify({ id: created.id, name: created.name }));

    // Immediately verify
    const found = await prisma.project.findUnique({ where: { id: created.id } });

    if (found) {
      console.log("[DB-CHECK] Direct creation VERIFIED: project found in DB");
      results.tests.push({
        name: "direct-creation",
        passed: true,
        projectId: created.id,
        projectName: created.name,
      });
    } else {
      console.error("[DB-CHECK] Direct creation FAILED: project NOT FOUND in DB after create!");
      results.tests.push({
        name: "direct-creation",
        passed: false,
        error: "Project was created but immediately not found in DB",
      });
    }

    // Clean up
    await prisma.project.delete({ where: { id: created.id } });
    console.log("[DB-CHECK] Cleaned up direct test project");
  } catch (error) {
    console.error("[DB-CHECK] Test 1 error:", error);
    results.tests.push({
      name: "direct-creation",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: Transaction-based project creation (mirrors the MCP import pattern)
  try {
    console.log("[DB-CHECK] Test 2: Transaction-based project creation...");
    const projectName = `DB-CHECK-TX-${Date.now()}`;

    const txResult = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          companyId,
          name: projectName,
          status: "PLANNING",
        },
      });

      // Create a budget too (like MCP import does)
      await tx.budget.create({
        data: {
          projectId: project.id,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "PEN",
          igvRate: 0.18,
          generalExpensesRate: 0.10,
          utilityRate: 0.08,
          totalDirectCost: 0,
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: 0,
        },
      });

      return { projectId: project.id, projectName: project.name };
    });

    console.log("[DB-CHECK] Transaction result:", JSON.stringify(txResult));

    // Immediately verify - use main prisma client (separate from tx)
    const foundProject = await prisma.project.findUnique({
      where: { id: txResult.projectId },
      select: { id: true, name: true },
    });
    const foundBudget = await prisma.budget.findFirst({
      where: { projectId: txResult.projectId },
      select: { id: true, name: true, kind: true },
    });

    if (foundProject && foundBudget) {
      console.log("[DB-CHECK] Transaction VERIFIED: project and budget found in DB");
      results.tests.push({
        name: "transaction-creation",
        passed: true,
        projectId: txResult.projectId,
        projectName: txResult.projectName,
        budget: { id: foundBudget.id, name: foundBudget.name, kind: foundBudget.kind },
      });
    } else {
      console.error("[DB-CHECK] Transaction FAILED: project or budget NOT FOUND in DB!");
      results.tests.push({
        name: "transaction-creation",
        passed: false,
        error: `Project found: ${!!foundProject}, Budget found: ${!!foundBudget}`,
        projectId: txResult.projectId,
      });
    }

    // Clean up (need to delete budget first due to FK constraints)
    if (foundBudget) {
      await prisma.budget.delete({ where: { id: foundBudget.id } });
    }
    if (foundProject) {
      await prisma.project.delete({ where: { id: foundProject.id } });
    }
    console.log("[DB-CHECK] Cleaned up transaction test project");
  } catch (error) {
    console.error("[DB-CHECK] Test 2 error:", error);
    results.tests.push({
      name: "transaction-creation",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2b: Transaction with SAME options as MCP import (maxWait: 10_000, timeout: 120_000)
  try {
    console.log("[DB-CHECK] Test 2b: Transaction with MCP import options (maxWait: 10s, timeout: 120s)...");
    const projectName = `DB-CHECK-OPT-${Date.now()}`;

    const txResult = await prisma.$transaction(
      async (tx) => {
        const project = await tx.project.create({
          data: {
            companyId,
            name: projectName,
            status: "PLANNING",
          },
        });

        await tx.budget.create({
          data: {
            projectId: project.id,
            kind: "GENERAL",
            name: "Presupuesto General",
            currency: "PEN",
            igvRate: 0.18,
            generalExpensesRate: 0.10,
            utilityRate: 0.08,
            totalDirectCost: 0,
            totalGeneralExpenses: 0,
            totalUtility: 0,
            totalTax: 0,
            totalAmount: 0,
          },
        });

        return { projectId: project.id, projectName: project.name };
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    console.log("[DB-CHECK] Transaction with options result:", JSON.stringify(txResult));

    // Verify with retry (same pattern as MCP import verification)
    let foundProject: { id: string; name: string } | null = null;
    let foundBudget: { id: string; name: string; kind: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      foundProject = await prisma.project.findUnique({
        where: { id: txResult.projectId },
        select: { id: true, name: true },
      });
      foundBudget = await prisma.budget.findFirst({
        where: { projectId: txResult.projectId },
        select: { id: true, name: true, kind: true },
      });

      if (foundProject && foundBudget) {
        console.log(`[DB-CHECK] Transaction with options VERIFIED (attempt ${attempt + 1})`);
        break;
      }

      if (attempt < 4) {
        const delayMs = [100, 500, 1000, 2000, 3000][attempt] ?? 1000;
        console.log(`[DB-CHECK] Transaction with options: NOT FOUND (attempt ${attempt + 1}), retry in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (foundProject && foundBudget) {
      results.tests.push({
        name: "transaction-with-options",
        passed: true,
        projectId: txResult.projectId,
        options: { maxWait: 10000, timeout: 120000 },
        foundAfterRetry: foundProject.id === txResult.projectId,
      });
    } else {
      console.error("[DB-CHECK] Transaction with options FAILED: NOT FOUND after all retries!");
      results.tests.push({
        name: "transaction-with-options",
        passed: false,
        error: `Project found: ${!!foundProject}, Budget found: ${!!foundBudget} (after 5 retries with backoff)`,
        projectId: txResult.projectId,
        options: { maxWait: 10000, timeout: 120000 },
      });
    }

    // Clean up
    if (foundBudget) {
      await prisma.budget.delete({ where: { id: foundBudget.id } });
    }
    if (foundProject) {
      await prisma.project.delete({ where: { id: foundProject.id } });
    }
    console.log("[DB-CHECK] Cleaned up transaction with options test project");
  } catch (error) {
    console.error("[DB-CHECK] Test 2b error:", error);
    results.tests.push({
      name: "transaction-with-options",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Edge case - create, verify, then create again (simulates import flow)
  try {
    console.log("[DB-CHECK] Test 3: Sequential creation (simulating import + page load)...");
    const projectName = `DB-CHECK-SEQ-${Date.now()}`;

    const p1 = await prisma.project.create({
      data: {
        companyId,
        name: projectName,
        status: "PLANNING",
      },
    });

    const v1 = await prisma.project.findUnique({ where: { id: p1.id } });

    // Simulate another operation (like a page load)
    const v2 = await prisma.project.findUnique({ where: { id: p1.id } });

    if (v1 && v2) {
      console.log("[DB-CHECK] Sequential verification PASSED");
      results.tests.push({
        name: "sequential-verification",
        passed: true,
        projectId: p1.id,
      });
    } else {
      console.error("[DB-CHECK] Sequential verification FAILED");
      results.tests.push({
        name: "sequential-verification",
        passed: false,
        error: `v1: ${!!v1}, v2: ${!!v2}`,
      });
    }

    await prisma.project.delete({ where: { id: p1.id } });
  } catch (error) {
    console.error("[DB-CHECK] Test 3 error:", error);
    results.tests.push({
      name: "sequential-verification",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Summary
  const allPassed = (results.tests as Array<Record<string, unknown>>).every(
    (t: Record<string, unknown>) => t.passed === true,
  );

  results.summary = {
    allPassed,
    total: (results.tests as Array<Record<string, unknown>>).length,
    passed: (results.tests as Array<Record<string, unknown>>).filter((t) => t.passed === true).length,
    failed: (results.tests as Array<Record<string, unknown>>).filter((t) => t.passed === false).length,
  };

  console.log("[DB-CHECK] Summary:", JSON.stringify(results.summary));
  console.log("[DB-CHECK] ====== END DB CHECK ======");

  return NextResponse.json(results);
}
