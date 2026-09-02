import { describe, expect, it, vi } from "vitest";

import { createDocumentVersion, createProjectDocument } from "./documents";

function createClient() {
  return {
    projectDocument: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe("review document persistence", () => {
  it("rejects an extension whose real MIME is not a supported document", async () => {
    const client = createClient();
    const file = new File(["plain text"], "budget.pdf", { type: "application/pdf" });

    await expect(createDocumentVersion({
      companyId: "company-1",
      projectId: "project-1",
      projectDocumentId: "document-1",
      storageKey: "documents/document-1/v1",
      file,
    }, client)).rejects.toThrow("MIME");
  });

  it("deduplicates a version by SHA-256 without creating another record", async () => {
    const client = createClient();
    const existing = { id: "version-1", sha256: "existing" };
    client.documentVersion.findUnique.mockResolvedValue(existing);
    const file = new File([new Uint8Array([37, 80, 68, 70, 45, 49])], "budget.pdf", { type: "application/pdf" });

    const result = await createDocumentVersion({
      companyId: "company-1",
      projectId: "project-1",
      projectDocumentId: "document-1",
      storageKey: "documents/document-1/v1",
      file,
    }, client);

    expect(result).toBe(existing);
    expect(client.documentVersion.create).not.toHaveBeenCalled();
  });

  it("creates the next version and makes it current", async () => {
    const client = createClient();
    client.documentVersion.findUnique.mockResolvedValue(null);
    client.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } });
    const created = { id: "version-3", versionNumber: 3, sha256: "hash" };
    client.documentVersion.create.mockResolvedValue(created);
    client.projectDocument.update.mockResolvedValue({});
    const file = new File([new Uint8Array([37, 80, 68, 70, 45, 50])], "budget.pdf", { type: "application/pdf" });

    const result = await createDocumentVersion({
      companyId: "company-1",
      projectId: "project-1",
      projectDocumentId: "document-1",
      storageKey: "documents/document-1/v3",
      file,
    }, client);

    expect(result).toBe(created);
    expect(client.documentVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ versionNumber: 3, sha256: expect.any(String) }),
    }));
    expect(client.projectDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "document-1", companyId: "company-1", projectId: "project-1" },
      data: { currentVersionId: "version-3" },
    }));
  });

  it("deduplicates project documents by tenant, project and original file name", async () => {
    const client = createClient();
    const existing = { id: "document-1", originalFileName: "budget.xlsx" };
    client.projectDocument.findFirst.mockResolvedValue(existing);

    const result = await createProjectDocument({
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      name: "Budget",
      originalFileName: "budget.xlsx",
    }, client);

    expect(result).toBe(existing);
    expect(client.projectDocument.create).not.toHaveBeenCalled();
  });
});
