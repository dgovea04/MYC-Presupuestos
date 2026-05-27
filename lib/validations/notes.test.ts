import { describe, expect, it } from "vitest";

import { noteTaskCreateSchema, noteTaskUpdateSchema } from "@/lib/validations/notes";

describe("note task validation", () => {
  it("accepts a trimmed note with priority and context", () => {
    expect(
      noteTaskCreateSchema.parse({
        body: "  Revisar metrado de concreto  ",
        priority: "HIGH",
        projectId: "project-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        sourcePath: "/budgets/budget-1",
      }),
    ).toEqual({
      body: "Revisar metrado de concreto",
      priority: "HIGH",
      projectId: "project-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      sourcePath: "/budgets/budget-1",
    });
  });

  it("rejects empty body and unsupported priority", () => {
    expect(
      noteTaskCreateSchema.safeParse({
        body: "   ",
        priority: "URGENT",
        sourcePath: "/dashboard",
      }).success,
    ).toBe(false);
  });

  it("accepts status updates for resolving or reopening notes", () => {
    expect(
      noteTaskUpdateSchema.parse({
        status: "RESOLVED",
      }),
    ).toEqual({
      status: "RESOLVED",
    });
  });
});
