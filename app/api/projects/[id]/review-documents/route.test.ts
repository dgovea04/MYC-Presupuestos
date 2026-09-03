import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  projectFindFirst: vi.fn(),
  projectDocumentFindMany: vi.fn(),
  projectDocumentFindFirst: vi.fn(),
  createProjectDocument: vi.fn(),
  createDocumentVersion: vi.fn(),
  createProjectDocumentAndVersion: vi.fn(),
  validateDocumentFile: vi.fn(),
  projectDocumentUpdate: vi.fn(),
  documentVersionFindFirst: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  extractAndPersistDocumentVersion: vi.fn(),
  markStaleForChange: vi.fn().mockResolvedValue(0),
  documentVersionDeleteMany: vi.fn(),
  documentVersionFindMany: vi.fn(),
  projectDocumentUpdateMany: vi.fn(),
  projectDocumentDeleteMany: vi.fn(),
  reviewRunFindMany: vi.fn(),
  reviewFindingDeleteMany: vi.fn(),
  findingDecisionDeleteMany: vi.fn(),
  reviewAuditEventDeleteMany: vi.fn(),
  reviewRunDocumentVersionDeleteMany: vi.fn(),
  reviewRunDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  project: { findFirst: mocks.projectFindFirst },
  projectDocument: { findMany: mocks.projectDocumentFindMany, findFirst: mocks.projectDocumentFindFirst, update: mocks.projectDocumentUpdate },
  documentVersion: { findFirst: mocks.documentVersionFindFirst, findMany: mocks.documentVersionFindMany, deleteMany: mocks.documentVersionDeleteMany },
  reviewRun: { findMany: mocks.reviewRunFindMany },
  reviewFinding: { deleteMany: mocks.reviewFindingDeleteMany },
  findingDecision: { deleteMany: mocks.findingDecisionDeleteMany },
  reviewAuditEvent: { deleteMany: mocks.reviewAuditEventDeleteMany },
  reviewRunDocumentVersion: { deleteMany: mocks.reviewRunDocumentVersionDeleteMany },
  $transaction: mocks.transaction,
} }));
vi.mock("@/lib/review-intelligence/documents", () => ({
  createProjectDocument: mocks.createProjectDocument,
  createDocumentVersion: mocks.createDocumentVersion,
  createProjectDocumentAndVersion: mocks.createProjectDocumentAndVersion,
  validateDocumentFile: mocks.validateDocumentFile,
}));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/extraction-persistence", () => ({ extractAndPersistDocumentVersion: mocks.extractAndPersistDocumentVersion }));
vi.mock("@/lib/review-intelligence/stale", () => ({ markStaleForChange: mocks.markStaleForChange }));

import { DELETE, GET, POST } from "@/app/api/projects/[id]/review-documents/route";

describe("review documents API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1", companyId: "company-1" });
    mocks.projectDocumentFindMany.mockResolvedValue([]);
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.validateDocumentFile.mockResolvedValue({ sha256: "hash", mimeType: "application/pdf", extension: ".pdf", fileSizeBytes: 8, bytes: new Uint8Array() });
    mocks.documentVersionFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      projectDocument: { updateMany: mocks.projectDocumentUpdateMany, deleteMany: mocks.projectDocumentDeleteMany },
      documentVersion: { deleteMany: mocks.documentVersionDeleteMany },
      reviewRun: { findMany: mocks.reviewRunFindMany, deleteMany: mocks.reviewRunDeleteMany },
      reviewFinding: { deleteMany: mocks.reviewFindingDeleteMany },
      findingDecision: { deleteMany: mocks.findingDecisionDeleteMany },
      reviewAuditEvent: { deleteMany: mocks.reviewAuditEventDeleteMany },
      reviewRunDocumentVersion: { deleteMany: mocks.reviewRunDocumentVersionDeleteMany },
    }));
  });

  it("returns 401 without an authenticated session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-documents"), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 when the session cannot access the project workspace", async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1", companyId: "other-company" });
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("Workspace no disponible"));
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-documents"), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(403);
  });

  it("returns a paginated tenant-scoped document list", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", originalFileName: "spec.pdf", currentVersion: { id: "version-1" } }]);
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-documents?page=2&pageSize=10"), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ page: 2, pageSize: 10, documents: expect.any(Array) }));
    expect(mocks.projectDocumentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "company-1", projectId: "project-1" }, skip: 10, take: 11, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });

  it("rejects an upload without a file", async () => {
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-empty" }, body: new FormData() }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(400);
  });

  it("creates a document and version without returning a permanent URL", async () => {
    const document = { id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "spec.pdf" };
    const version = { id: "version-1", projectDocumentId: "document-1", versionNumber: 1, sha256: "hash" };
    mocks.createProjectDocument.mockResolvedValue(document);
    mocks.createDocumentVersion.mockResolvedValue(version);
    mocks.createProjectDocumentAndVersion.mockResolvedValue({ document, version });
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" }));
    form.set("category", "TECHNICAL_SPECIFICATION");
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-create" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(201);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({ document, version }));
    expect(payload).not.toHaveProperty("url");
    expect(mocks.createProjectDocumentAndVersion).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", projectId: "project-1", createdById: "user-1" }), expect.anything());
  });

  it("reports no next page when the final page has exactly pageSize rows", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-2" }, { id: "document-1" }]);
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-documents?pageSize=2"), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ documents: [{ id: "document-2" }, { id: "document-1" }], hasNextPage: false }));
  });

  it("validates a file before creating a project document", async () => {
    mocks.validateDocumentFile.mockRejectedValue(new Error("MIME inválido"));
    const form = new FormData();
    form.set("file", new File(["invalid"], "spec.pdf", { type: "application/pdf" }));
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-invalid" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.createProjectDocument).not.toHaveBeenCalled();
  });

  it("returns 409 when the persisted upload key replays a different payload", async () => {
    mocks.createProjectDocumentAndVersion.mockRejectedValue(new Error("Idempotency key conflict: payload hash differs."));
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" }));
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-conflict" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(409);
  });

  it("returns 409 when an idempotency key is reused for another target", async () => {
    mocks.documentVersionFindMany.mockResolvedValue([{ storageKey: "review-documents/company-1/project-1/key-target/other-document/hash", sha256: "hash", projectDocumentId: "other-document" }]);
    const form = new FormData(); form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" })); form.set("documentId", "document-1");
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-target" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(409);
    expect(mocks.createDocumentVersion).not.toHaveBeenCalled();
  });

  it("deletes all source documents and dependent review history only with explicit confirmation", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", currentVersionId: "version-1" }]);
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1" }]);
    mocks.reviewRunFindMany.mockResolvedValue([{ id: "run-1" }]);
    const response = await DELETE(new Request("http://localhost/api/projects/project-1/review-documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR DOCUMENTOS FUENTE" }) }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedDocuments: 1 });
    expect(mocks.projectDocumentUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["document-1"] }, companyId: "company-1", projectId: "project-1" }, data: { currentVersionId: null } });
    expect(mocks.documentVersionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["version-1"] }, companyId: "company-1", projectId: "project-1" } });
    expect(mocks.projectDocumentDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["document-1"] }, companyId: "company-1", projectId: "project-1" } });
  });
});
