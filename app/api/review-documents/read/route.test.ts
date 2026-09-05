import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), verifyReviewDocumentReadToken: vi.fn(), getReviewDocumentStorage: vi.fn(), projectFindFirst: vi.fn(), documentVersionFindFirst: vi.fn(), storageRead: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/documents", () => ({ verifyReviewDocumentReadToken: mocks.verifyReviewDocumentReadToken, getReviewDocumentStorage: mocks.getReviewDocumentStorage }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { project: { findFirst: mocks.projectFindFirst }, documentVersion: { findFirst: mocks.documentVersionFindFirst } } }));

import { GET } from "@/app/api/review-documents/read/route";

describe("review document read API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.verifyReviewDocumentReadToken.mockReturnValue({ companyId: "company-1", projectId: "project-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf", expiresAt: "2026-09-05T12:05:00.000Z" });
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1", companyId: "company-1" });
    mocks.documentVersionFindFirst.mockResolvedValue({ id: "version-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf", originalFileName: "spec.pdf", mimeType: "application/pdf" });
    mocks.storageRead.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.getReviewDocumentStorage.mockReturnValue({ read: mocks.storageRead });
  });

  it("streams bytes only after token, session, membership, and persisted provenance validation", async () => {
    const response = await GET(new Request("http://localhost/api/review-documents/read?token=signed"));

    expect(response.status).toBe(200);
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mocks.documentVersionFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: "company-1", projectId: "project-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf" }) }));
    expect(mocks.storageRead).toHaveBeenCalledWith({ companyId: "company-1", projectId: "project-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf" });
  });

  it("rejects invalid tokens and never reads a binary", async () => {
    mocks.verifyReviewDocumentReadToken.mockImplementation(() => { throw new Error("Temporary read token has expired."); });
    const response = await GET(new Request("http://localhost/api/review-documents/read?token=expired"));

    expect(response.status).toBe(401);
    expect(mocks.storageRead).not.toHaveBeenCalled();
  });
});
