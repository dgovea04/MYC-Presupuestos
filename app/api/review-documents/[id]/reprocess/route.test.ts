import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  projectDocumentFindFirst: vi.fn(),
  documentVersionFindFirst: vi.fn(),
  read: vi.fn(),
  reprocessDocumentCoverage: vi.fn(),
  reviewRunUpdateMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  projectDocument: { findFirst: mocks.projectDocumentFindFirst },
  documentVersion: { findFirst: mocks.documentVersionFindFirst },
  reviewRun: { updateMany: mocks.reviewRunUpdateMany },
} }));
vi.mock("@/lib/review-intelligence/documents", () => ({ getReviewDocumentStorage: () => ({ read: mocks.read }) }));
vi.mock("@/lib/review-intelligence/extraction-persistence", () => ({ reprocessDocumentCoverage: mocks.reprocessDocumentCoverage }));

import { POST } from "./route";

describe("POST /api/review-documents/[id]/reprocess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue({ role: "EDITOR" });
    mocks.projectDocumentFindFirst.mockResolvedValue({ id: "document-1", companyId: "company-1", projectId: "project-1", currentVersionId: "version-1" });
    mocks.documentVersionFindFirst.mockResolvedValue({ id: "version-1", companyId: "company-1", projectId: "project-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf", originalFileName: "planos.pdf", mimeType: "application/pdf", sha256: "hash", extractionCoverage: [{ page: 1 }, { page: 2 }, { page: 3 }] });
    mocks.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.reprocessDocumentCoverage.mockResolvedValue({ coverage: [{ page: 2, coverage: "PROCESSED" }], warnings: ["Página 3: OCR no disponible."], partial: true });
    mocks.reviewRunUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a selector outside the document coverage before reading private storage", async () => {
    const response = await POST(request({ pages: [9] }), context());

    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.reprocessDocumentCoverage).not.toHaveBeenCalled();
  });

  it("rejects a document owned by another tenant", async () => {
    mocks.projectDocumentFindFirst.mockResolvedValue({ id: "document-1", companyId: "company-2", projectId: "project-1", currentVersionId: "version-1" });

    const response = await POST(request({ pages: [2] }), context());

    expect(response.status).toBe(403);
    expect(mocks.reprocessDocumentCoverage).not.toHaveBeenCalled();
  });

  it("reprocesses authorized pages idempotently and returns partial-success warnings", async () => {
    const response = await POST(request({ pages: [2, 3] }), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ partial: true, warnings: ["Página 3: OCR no disponible."] });
    expect(mocks.reprocessDocumentCoverage).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", projectId: "project-1", version: expect.objectContaining({ id: "version-1" }), pages: [2, 3] }), expect.anything());
    expect(mocks.reviewRunUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: "company-1", projectId: "project-1", status: { in: ["COMPLETED", "COMPLETED_WITH_WARNINGS"] }, documentVersionLinks: { some: expect.objectContaining({ documentVersionId: "version-1" }) } }), data: { status: "STALE" } }));
  });
});

function request(body: object): Request {
  return new Request("http://localhost/api/review-documents/document-1/reprocess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function context() {
  return { params: Promise.resolve({ id: "document-1" }) };
}
