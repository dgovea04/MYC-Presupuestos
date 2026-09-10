import { describe, expect, it } from "vitest";
import { KnowledgeRequestValidationError, knowledgeRouteErrorResponse } from "./route-errors";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

describe("knowledge route error responses", () => {
  it("classifies request validation as 400", async () => {
    const response = knowledgeRouteErrorResponse(new KnowledgeRequestValidationError("companyId es requerido"), "internal");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "companyId es requerido" });
  });

  it("classifies authorization as 403", async () => {
    const response = knowledgeRouteErrorResponse(new WorkspaceAuthorizationError("No tienes acceso"), "internal");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No tienes acceso" });
  });

  it("hides internal errors behind a stable 500 response", async () => {
    const response = knowledgeRouteErrorResponse(new Error("database password leaked"), "No se pudo consultar Knowledge");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo consultar Knowledge" });
  });
});
