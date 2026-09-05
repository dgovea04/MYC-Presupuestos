import { createHash, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalReviewDocumentStorage, verifyTemporaryReadToken } from "./storage";

const temporaryDirectories: string[] = [];

async function createStorage() {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "mc-review-storage-"));
  temporaryDirectories.push(rootDirectory);
  return {
    rootDirectory,
    storage: new LocalReviewDocumentStorage({
      rootDirectory,
      signingSecret: "test-only-signing-secret",
      temporaryUrlTtlSeconds: 60,
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    }),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("local review document storage", () => {
  it("stores tenant and project scoped versions outside public with their SHA-256 integrity", async () => {
    const { rootDirectory, storage } = await createStorage();
    const bytes = new TextEncoder().encode("presupuesto v1");

    const stored = await storage.put({
      companyId: "company-1",
      projectId: "project-1",
      documentId: "document-1",
      versionNumber: 1,
      originalFileName: "presupuesto.pdf",
      bytes,
    });

    expect(stored).toMatchObject({
      storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      fileSizeBytes: bytes.byteLength,
    });
    expect(stored.absolutePath).toBe(path.join(rootDirectory, ...stored.storageKey.split("/")));
    expect(stored.absolutePath.includes(`${path.sep}public${path.sep}`)).toBe(false);
    expect(existsSync(stored.absolutePath)).toBe(true);
  });

  it("provisions a missing private storage root without allowing public roots", async () => {
    const parentDirectory = await mkdtemp(path.join(tmpdir(), "mc-review-storage-parent-"));
    temporaryDirectories.push(parentDirectory);
    const rootDirectory = path.join(parentDirectory, "new-private-root");

    const storage = new LocalReviewDocumentStorage({ rootDirectory, signingSecret: "test-only-signing-secret", temporaryUrlTtlSeconds: 60 });
    const stored = await storage.put({ companyId: "company-1", projectId: "project-1", documentId: "document-1", versionNumber: 1, originalFileName: "budget.pdf", bytes: new Uint8Array([1]) });

    expect(existsSync(rootDirectory)).toBe(true);
    expect(existsSync(stored.absolutePath)).toBe(true);
  });

  it("issues a signed short-lived read token only for the matching tenant and project", async () => {
    const { storage } = await createStorage();
    const stored = await storage.put({ companyId: "company-1", projectId: "project-1", documentId: "document-1", versionNumber: 1, originalFileName: "planos.pdf", bytes: new Uint8Array([1, 2, 3]) });

    const temporaryReadUrl = await storage.createTemporaryReadUrl({ companyId: "company-1", projectId: "project-1", storageKey: stored.storageKey });
    const token = new URL(temporaryReadUrl, "https://mc.local").searchParams.get("token");

    expect(temporaryReadUrl).toMatch(/^\/api\/review-documents\/read\?token=/);
    expect(token).not.toBeNull();
    expect(verifyTemporaryReadToken(token!, { signingSecret: "test-only-signing-secret", now: () => new Date("2026-09-05T12:00:30.000Z") })).toEqual({
      companyId: "company-1",
      projectId: "project-1",
      storageKey: stored.storageKey,
      expiresAt: "2026-09-05T12:01:00.000Z",
    });
    expect(() => verifyTemporaryReadToken(token!, { signingSecret: "test-only-signing-secret", now: () => new Date("2026-09-05T12:01:01.000Z") })).toThrow("expired");
    await expect(storage.createTemporaryReadUrl({ companyId: "company-2", projectId: "project-1", storageKey: stored.storageKey })).rejects.toThrow("does not belong");
  });

  it("deletes only the scoped original file", async () => {
    const { storage } = await createStorage();
    const first = await storage.put({ companyId: "company-1", projectId: "project-1", documentId: "document-1", versionNumber: 1, originalFileName: "budget.pdf", bytes: new Uint8Array([1]) });
    const second = await storage.put({ companyId: "company-1", projectId: "project-2", documentId: "document-1", versionNumber: 1, originalFileName: "budget.pdf", bytes: new Uint8Array([2]) });

    await storage.delete({ companyId: "company-1", projectId: "project-1", storageKey: first.storageKey });

    expect(existsSync(first.absolutePath)).toBe(false);
    expect(existsSync(second.absolutePath)).toBe(true);
  });

  it("rejects traversal segments before authorizing a temporary URL or deletion", async () => {
    const { storage } = await createStorage();
    const traversalKey = "companies/company-1/projects/project-1/../project-2/documents/document-1/versions/1/original.pdf";

    await expect(storage.createTemporaryReadUrl({ companyId: "company-1", projectId: "project-1", storageKey: traversalKey })).rejects.toThrow("traversal");
    await expect(storage.delete({ companyId: "company-1", projectId: "project-1", storageKey: traversalKey })).rejects.toThrow("traversal");
  });

  it("rejects a storage root whose symlink resolves inside public", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "mc-review-storage-link-"));
    temporaryDirectories.push(rootDirectory);
    const linkPath = path.join(rootDirectory, "private-storage");
    await symlink(path.resolve(process.cwd(), "public"), linkPath, "junction");

    expect(() => new LocalReviewDocumentStorage({
      rootDirectory: linkPath,
      signingSecret: "test-only-signing-secret",
      temporaryUrlTtlSeconds: 60,
    })).toThrow("outside public");
  });

  it("rejects a signed token whose expiry is not a valid timestamp", () => {
    const encodedPayload = Buffer.from(JSON.stringify({
      companyId: "company-1",
      projectId: "project-1",
      storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf",
      expiresAt: "not-a-timestamp",
    })).toString("base64url");
    const signature = createHmac("sha256", "test-only-signing-secret").update(encodedPayload).digest("base64url");

    expect(() => verifyTemporaryReadToken(`${encodedPayload}.${signature}`, { signingSecret: "test-only-signing-secret" })).toThrow("expiry");
  });
});
