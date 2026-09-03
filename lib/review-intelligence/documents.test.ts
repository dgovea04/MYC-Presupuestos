import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createDocumentVersion, createProjectDocument, createProjectDocumentAndVersion } from "./documents";

const validPdf = (suffix: string): Uint8Array => new TextEncoder().encode(`%PDF-1.7\nxref\n0 1\n0000000000 65535 f \n1 0 obj\n<</Subject (${suffix})>>\nendobj\ntrailer\n<<>>\nstartxref\n9\n%%EOF`);

function createClient() {
  return {
    projectDocument: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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
    client.$transaction.mockImplementation(async (callback) => callback(client));
    client.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    const existing = { id: "version-1", sha256: "existing" };
    client.documentVersion.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const file = new File([validPdf("one")], "budget.pdf", { type: "application/pdf" });

    const result = await createDocumentVersion({
      companyId: "company-1",
      projectId: "project-1",
      projectDocumentId: "document-1",
      storageKey: "documents/document-1/v1",
      file,
    }, client);

    expect(result).toBe(existing);
    expect(client.documentVersion.create).not.toHaveBeenCalled();
    expect(client.documentVersion.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: "company-1", projectId: "project-1" }) });
  });

  it("creates the next version and makes it current", async () => {
    const client = createClient();
    client.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    client.documentVersion.findFirst.mockResolvedValue(null);
    client.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } });
    const created = { id: "version-3", versionNumber: 3, sha256: "hash" };
    const transaction = createClient();
    transaction.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    transaction.documentVersion.findFirst.mockResolvedValue(null);
    transaction.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } });
    transaction.documentVersion.create.mockResolvedValue(created);
    transaction.projectDocument.update.mockResolvedValue({});
    client.$transaction.mockImplementation(async (callback) => callback(transaction));
    const file = new File([validPdf("two")], "budget.pdf", { type: "application/pdf" });

    const result = await createDocumentVersion({
      companyId: "company-1",
      projectId: "project-1",
      projectDocumentId: "document-1",
      storageKey: "documents/document-1/v3",
      file,
    }, client);

    expect(result).toBe(created);
    expect(transaction.documentVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ versionNumber: 3, sha256: expect.any(String) }),
    }));
    expect(transaction.projectDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "document-1", companyId: "company-1", projectId: "project-1" },
      data: { currentVersionId: "version-3" },
    }));
  });

  it("replays the same idempotency storage key and rejects a different payload", async () => {
    const client = createClient();
    const transaction = createClient();
    transaction.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    transaction.documentVersion.findFirst.mockResolvedValueOnce({ id: "version-1", projectDocumentId: "document-1", versionNumber: 1, sha256: "other-hash" });
    client.$transaction.mockImplementation(async (callback) => callback(transaction));
    const file = new File([validPdf("replay")], "budget.pdf", { type: "application/pdf" });
    await expect(createDocumentVersion({ companyId: "company-1", projectId: "project-1", projectDocumentId: "document-1", storageKey: "idempotency/key-1", file }, client)).rejects.toThrow("Idempotency key conflict");
    expect(transaction.documentVersion.create).not.toHaveBeenCalled();
  });

  it("replays the same idempotency key and hash without creating a version", async () => {
    const client = createClient(); const transaction = createClient();
    transaction.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    transaction.documentVersion.findFirst.mockResolvedValueOnce({ id: "version-1", projectDocumentId: "document-1", versionNumber: 1, sha256: createHash("sha256").update(validPdf("same")).digest("hex") }); client.$transaction.mockImplementation(async (callback) => callback(transaction));
    const file = new File([validPdf("same")], "budget.pdf", { type: "application/pdf" });
    const result = await createDocumentVersion({ companyId: "company-1", projectId: "project-1", projectDocumentId: "document-1", storageKey: "idempotency/key-1", file }, client);
    expect(result.id).toBe("version-1"); expect(transaction.documentVersion.create).not.toHaveBeenCalled();
  });

  it("rejects a direct version call when the document belongs to another tenant or project", async () => {
    const client = createClient();
    client.$transaction.mockImplementation(async (callback) => callback(client));
    client.projectDocument.findFirst.mockResolvedValue(null);
    const file = new File([validPdf("tenant")], "budget.pdf", { type: "application/pdf" });

    await expect(createDocumentVersion({ companyId: "attacker-company", projectId: "other-project", projectDocumentId: "document-1", storageKey: "documents/document-1/v1", file }, client)).rejects.toThrow("no pertenece");
    expect(client.documentVersion.findFirst).not.toHaveBeenCalled();
  });

  it("does not update currentVersion when version creation fails inside the transaction", async () => {
    const client = createClient();
    const transaction = createClient();
    transaction.projectDocument.findFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "budget.pdf" });
    transaction.documentVersion.findFirst.mockResolvedValue(null);
    transaction.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
    transaction.documentVersion.create.mockRejectedValue(new Error("storage failure"));
    client.$transaction.mockImplementation(async (callback) => callback(transaction));
    const file = new File([validPdf("three")], "budget.pdf", { type: "application/pdf" });

    await expect(createDocumentVersion({ companyId: "company-1", projectId: "project-1", projectDocumentId: "document-1", storageKey: "documents/document-1/v1", file }, client)).rejects.toThrow("storage failure");
    expect(transaction.projectDocument.update).not.toHaveBeenCalled();
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

  it("validates before creating a document-version transaction", async () => {
    const client = createClient();
    const file = new File(["plain text"], "invalid.pdf", { type: "application/pdf" });
    await expect(createProjectDocumentAndVersion({ companyId: "company-1", projectId: "project-1", createdById: "user-1", name: "Invalid", originalFileName: file.name, storageKey: "key", file }, client)).rejects.toThrow("MIME");
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.projectDocument.create).not.toHaveBeenCalled();
  });

  it("creates document and version in one transaction", async () => {
    const client = createClient();
    const transaction = createClient();
    transaction.projectDocument.findFirst.mockResolvedValue(null);
    transaction.projectDocument.create.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "valid.pdf" });
    transaction.documentVersion.findFirst.mockResolvedValue(null);
    transaction.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
    transaction.documentVersion.create.mockResolvedValue({ id: "version-1", projectDocumentId: "document-1", versionNumber: 1, sha256: "hash" });
    transaction.projectDocument.update.mockResolvedValue({});
    client.$transaction.mockImplementation(async (callback) => callback(transaction));
    const file = new File([validPdf("atomic")], "valid.pdf", { type: "application/pdf" });
    const result = await createProjectDocumentAndVersion({ companyId: "company-1", projectId: "project-1", createdById: "user-1", name: "Valid", originalFileName: file.name, storageKey: "key", file }, client);
    expect(result).toEqual({ document: expect.objectContaining({ id: "document-1" }), version: expect.objectContaining({ id: "version-1" }) });
    expect(client.$transaction).toHaveBeenCalledOnce();
  });
});
