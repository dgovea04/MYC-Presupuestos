import { describe, expect, it, vi } from "vitest";
import { createKnowledgeSupplier } from "./suppliers";

const { create } = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue({ id: "s1" }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeSupplier: { create } } }));

describe("knowledge supplier service", () => {
  it("normalizes RUC and contact fields while preserving the display name", async () => {
    await createKnowledgeSupplier({ name: " Proveedor SAC ", ruc: "20-12345678-9", email: "CONTACTO@EXAMPLE.PE" });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Proveedor SAC", ruc: "20123456789", email: "contacto@example.pe", status: "ACTIVE" }) });
  });

  it("rejects malformed RUC values", async () => {
    await expect(createKnowledgeSupplier({ name: "Proveedor", ruc: "123" })).rejects.toThrow("RUC must contain 11 digits");
  });
});
