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
  persistReviewDocumentUpload: vi.fn(),
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
  reviewAuditEventCreate: vi.fn(),
  reviewAuditEventUpdateMany: vi.fn(),
  reviewRunDocumentVersionDeleteMany: vi.fn(),
  reviewRunDeleteMany: vi.fn(),
  transaction: vi.fn(),
  getReviewDocumentStorage: vi.fn(),
  storageRead: vi.fn(),
  storageDelete: vi.fn(),
  storagePut: vi.fn(),
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
  validateDocumentFile: mocks.validateDocumentFile,
  persistReviewDocumentUpload: mocks.persistReviewDocumentUpload,
  getReviewDocumentStorage: mocks.getReviewDocumentStorage,
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
    mocks.reviewRunFindMany.mockResolvedValue([]);
    mocks.storageRead.mockResolvedValue(new Uint8Array([1]));
    mocks.getReviewDocumentStorage.mockReturnValue({ read: mocks.storageRead, delete: mocks.storageDelete, put: mocks.storagePut, createTemporaryReadUrl: vi.fn() });
    mocks.persistReviewDocumentUpload.mockResolvedValue({ document: { id: "document-1", companyId: "company-1", projectId: "project-1", originalFileName: "spec.pdf" }, version: { id: "version-1", projectDocumentId: "document-1", versionNumber: 1, sha256: "hash" } });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      projectDocument: { updateMany: mocks.projectDocumentUpdateMany, deleteMany: mocks.projectDocumentDeleteMany },
      documentVersion: { deleteMany: mocks.documentVersionDeleteMany },
      reviewRun: { findMany: mocks.reviewRunFindMany, deleteMany: mocks.reviewRunDeleteMany },
      reviewFinding: { deleteMany: mocks.reviewFindingDeleteMany },
      findingDecision: { deleteMany: mocks.findingDecisionDeleteMany },
      reviewAuditEvent: { deleteMany: mocks.reviewAuditEventDeleteMany, create: mocks.reviewAuditEventCreate, updateMany: mocks.reviewAuditEventUpdateMany },
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

  it("exposes an explainable classification suggestion using persisted XLSX header signals", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", originalFileName: "source.xlsx", category: "OTHER", currentVersion: { id: "version-1", evidence: [{ metadataJson: { classificationHeaders: ["Código", "Descripción", "Metrado"] } }] } }]);
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-documents"), { params: Promise.resolve({ id: "project-1" }) });
    const payload = await response.json() as { documents: Array<{ classificationSuggestion?: { category: string; signals: string[] } }> };
    expect(payload.documents[0]?.classificationSuggestion).toEqual(expect.objectContaining({ category: "QUANTITY_TAKEOFF", signals: expect.arrayContaining(["header:metrado"]) }));
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
    mocks.persistReviewDocumentUpload.mockResolvedValue({ document, version });
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" }));
    form.set("category", "TECHNICAL_SPECIFICATION");
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-create" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(201);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({ document, version }));
    expect(payload).not.toHaveProperty("url");
    expect(mocks.persistReviewDocumentUpload).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", projectId: "project-1", createdById: "user-1", bytes: expect.any(Uint8Array) }), expect.anything(), expect.anything());
  });

  it("sends the validated upload bytes to tenant-scoped storage before extraction", async () => {
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" }));
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-storage" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });

    expect(response.status).toBe(201);
    expect(mocks.persistReviewDocumentUpload).toHaveBeenCalledWith(expect.objectContaining({
      bytes: new Uint8Array(),
      sha256: "hash",
      idempotencyKey: "key-storage",
    }), expect.anything(), expect.anything());
    expect(mocks.extractAndPersistDocumentVersion).toHaveBeenCalledOnce();
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
    mocks.persistReviewDocumentUpload.mockRejectedValue(new Error("Idempotency key conflict: payload hash differs."));
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" }));
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-conflict" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(409);
  });

  it("returns 409 when an idempotency key is reused for another target", async () => {
    mocks.documentVersionFindMany.mockResolvedValue([{ storageKey: "review-documents/company-1/project-1/key-target/other-document/hash", sha256: "hash", projectDocumentId: "other-document", projectDocument: { originalFileName: "spec.pdf", name: "spec.pdf" } }]);
    const form = new FormData(); form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" })); form.set("documentId", "document-1");
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-target" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(409);
    expect(mocks.createDocumentVersion).not.toHaveBeenCalled();
  });

  it("deletes all source documents and dependent review history only with explicit confirmation", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", currentVersionId: "version-1" }]);
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf" }]);
    mocks.reviewRunFindMany.mockResolvedValue([{ id: "run-1" }]);
    const response = await DELETE(new Request("http://localhost/api/projects/project-1/review-documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR DOCUMENTOS FUENTE" }) }), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedDocuments: 1 });
    expect(mocks.projectDocumentUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["document-1"] }, companyId: "company-1", projectId: "project-1" }, data: { currentVersionId: null } });
    expect(mocks.documentVersionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["version-1"] }, companyId: "company-1", projectId: "project-1" } });
    expect(mocks.projectDocumentDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["document-1"] }, companyId: "company-1", projectId: "project-1" } });
    expect(mocks.getReviewDocumentStorage()).toEqual(expect.objectContaining({ delete: expect.any(Function) }));
    expect(mocks.reviewAuditEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.reviewAuditEventUpdateMany).toHaveBeenCalledWith({ where: { reviewRunId: { in: ["run-1"] }, companyId: "company-1", projectId: "project-1" }, data: { reviewRunId: null } });
    expect(mocks.reviewAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "REVIEW_DOCUMENTS_DELETED", payloadJson: { documentCount: 1, versionCount: 1 } }) }));
  });

  it("rejects a new-document idempotency replay whose file identity changes", async () => {
    mocks.documentVersionFindMany.mockResolvedValue([{ sha256: "hash", projectDocumentId: "document-old", projectDocument: { originalFileName: "other.pdf", name: "Other source" } }]);
    const form = new FormData(); form.set("file", new File(["%PDF-1.7"], "spec.pdf", { type: "application/pdf" })); form.set("name", "Specification");
    const response = await POST(new Request("http://localhost/api/projects/project-1/review-documents", { method: "POST", headers: { "Idempotency-Key": "key-new-document" }, body: form }), { params: Promise.resolve({ id: "project-1" }) });

    expect(response.status).toBe(409);
    expect(mocks.persistReviewDocumentUpload).not.toHaveBeenCalled();
  });

  it("removes every historical binary even when a document has no current version pointer", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", currentVersionId: null }]);
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1", projectDocumentId: "document-1", versionNumber: 1, originalFileName: "old.pdf", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf" }, { id: "version-2", projectDocumentId: "document-1", versionNumber: 2, originalFileName: "new.pdf", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/2/original.pdf" }]);
    const response = await DELETE(new Request("http://localhost/api/projects/project-1/review-documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR DOCUMENTOS FUENTE" }) }), { params: Promise.resolve({ id: "project-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.storageDelete).toHaveBeenCalledTimes(2);
    expect(mocks.documentVersionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["version-1", "version-2"] }, companyId: "company-1", projectId: "project-1" } });
  });

  it("restores removed binaries when the database deletion transaction fails", async () => {
    mocks.projectDocumentFindMany.mockResolvedValue([{ id: "document-1", currentVersionId: "version-1" }]);
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1", projectDocumentId: "document-1", versionNumber: 1, originalFileName: "spec.pdf", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf" }]);
    mocks.transaction.mockRejectedValueOnce(new Error("database failure"));
    const response = await DELETE(new Request("http://localhost/api/projects/project-1/review-documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR DOCUMENTOS FUENTE" }) }), { params: Promise.resolve({ id: "project-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.storageRead).toHaveBeenCalledOnce();
    expect(mocks.storageDelete).toHaveBeenCalledOnce();
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.objectContaining({ documentId: "document-1", versionNumber: 1, originalFileName: "spec.pdf", bytes: new Uint8Array([1]) }));
  });
});
