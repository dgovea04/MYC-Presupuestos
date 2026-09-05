import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type ReviewDocumentStorage = {
  put(input: ReviewDocumentStoragePutInput): Promise<StoredReviewDocument>;
  createTemporaryReadUrl(input: TemporaryReadUrlInput): Promise<string>;
  delete(input: DeleteReviewDocumentInput): Promise<void>;
};

export type ReviewDocumentStoragePutInput = {
  companyId: string;
  projectId: string;
  documentId: string;
  versionNumber: number;
  originalFileName: string;
  bytes: Uint8Array;
};

export type StoredReviewDocument = {
  storageKey: string;
  absolutePath: string;
  sha256: string;
  fileSizeBytes: number;
};

export type TemporaryReadUrlInput = {
  companyId: string;
  projectId: string;
  storageKey: string;
};

export type DeleteReviewDocumentInput = TemporaryReadUrlInput;

type TemporaryReadTokenPayload = {
  companyId: string;
  projectId: string;
  storageKey: string;
  expiresAt: string;
};

export type LocalReviewDocumentStorageOptions = {
  rootDirectory: string;
  signingSecret: string;
  temporaryUrlTtlSeconds: number;
  now?: () => Date;
};

export class LocalReviewDocumentStorage implements ReviewDocumentStorage {
  private readonly rootDirectory: string;
  private readonly signingSecret: string;
  private readonly temporaryUrlTtlSeconds: number;
  private readonly now: () => Date;

  constructor(options: LocalReviewDocumentStorageOptions) {
    this.rootDirectory = assertPrivateStorageDirectory(options.rootDirectory);
    if (options.signingSecret.length < 16) throw new Error("Review storage signing secret must be at least 16 characters.");
    if (!Number.isInteger(options.temporaryUrlTtlSeconds) || options.temporaryUrlTtlSeconds <= 0) throw new Error("Temporary URL TTL must be a positive whole number of seconds.");
    this.signingSecret = options.signingSecret;
    this.temporaryUrlTtlSeconds = options.temporaryUrlTtlSeconds;
    this.now = options.now ?? (() => new Date());
  }

  async put(input: ReviewDocumentStoragePutInput): Promise<StoredReviewDocument> {
    assertStorageIdentifier(input.companyId, "companyId");
    assertStorageIdentifier(input.projectId, "projectId");
    assertStorageIdentifier(input.documentId, "documentId");
    if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) throw new Error("versionNumber must be a positive whole number.");
    const extension = documentExtension(input.originalFileName);
    const storageKey = `companies/${input.companyId}/projects/${input.projectId}/documents/${input.documentId}/versions/${input.versionNumber}/original${extension}`;
    const absolutePath = resolveStoragePath(this.rootDirectory, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes, { flag: "wx" });
    return { storageKey, absolutePath, sha256: createHash("sha256").update(input.bytes).digest("hex"), fileSizeBytes: input.bytes.byteLength };
  }

  async createTemporaryReadUrl(input: TemporaryReadUrlInput): Promise<string> {
    assertStorageKeyScope(input);
    const expiresAt = new Date(this.now().getTime() + this.temporaryUrlTtlSeconds * 1_000).toISOString();
    const payload: TemporaryReadTokenPayload = { ...input, expiresAt };
    return `/api/review-documents/read?token=${encodeTemporaryReadToken(payload, this.signingSecret)}`;
  }

  async delete(input: DeleteReviewDocumentInput): Promise<void> {
    assertStorageKeyScope(input);
    await rm(resolveStoragePath(this.rootDirectory, input.storageKey), { force: true });
  }
}

export function verifyTemporaryReadToken(token: string, options: { signingSecret: string; now?: () => Date }): TemporaryReadTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || token.split(".").length !== 2) throw new Error("Temporary read token is invalid.");
  const expectedSignature = sign(encodedPayload, options.signingSecret);
  if (!safeEqual(signature, expectedSignature)) throw new Error("Temporary read token signature is invalid.");
  let payload: TemporaryReadTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TemporaryReadTokenPayload;
  } catch {
    throw new Error("Temporary read token payload is invalid.");
  }
  assertStorageKeyScope(payload);
  const expirationTime = new Date(payload.expiresAt).getTime();
  if (!Number.isFinite(expirationTime)) throw new Error("Temporary read token expiry is invalid.");
  if (expirationTime <= (options.now ?? (() => new Date()))().getTime()) throw new Error("Temporary read token has expired.");
  return payload;
}

function encodeTemporaryReadToken(payload: TemporaryReadTokenPayload, signingSecret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, signingSecret)}`;
}

function sign(value: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}

function assertPrivateStorageDirectory(rootDirectory: string): string {
  const resolvedRoot = realpathSync(path.resolve(rootDirectory));
  const publicDirectory = realpathSync(path.resolve(process.cwd(), "public"));
  const relativeToPublic = path.relative(publicDirectory, resolvedRoot);
  if (relativeToPublic === "" || (!relativeToPublic.startsWith(`..${path.sep}`) && relativeToPublic !== ".." && !path.isAbsolute(relativeToPublic))) {
    throw new Error("Review document storage directory must be outside public.");
  }
  return resolvedRoot;
}

function assertStorageKeyScope(input: TemporaryReadUrlInput): void {
  assertStorageIdentifier(input.companyId, "companyId");
  assertStorageIdentifier(input.projectId, "projectId");
  const segments = storageKeySegments(input.storageKey);
  if (segments[1] !== input.companyId || segments[3] !== input.projectId) throw new Error("Storage key does not belong to the company and project scope.");
}

function assertStorageIdentifier(value: string, field: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${field} contains unsupported characters.`);
}

function documentExtension(fileName: string): ".pdf" | ".xlsx" {
  const extension = path.extname(fileName).toLowerCase();
  if (extension !== ".pdf" && extension !== ".xlsx") throw new Error("Review document storage only accepts PDF and XLSX originals.");
  return extension;
}

function resolveStoragePath(rootDirectory: string, storageKey: string): string {
  const resolvedPath = path.resolve(rootDirectory, ...storageKeySegments(storageKey));
  if (path.relative(rootDirectory, resolvedPath).startsWith("..") || path.isAbsolute(path.relative(rootDirectory, resolvedPath))) {
    throw new Error("Storage key escapes the configured directory.");
  }
  return resolvedPath;
}

function storageKeySegments(storageKey: string): string[] {
  if (storageKey.includes("\\")) throw new Error("Storage key contains traversal segments.");
  const segments = storageKey.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("Storage key contains traversal segments.");
  if (segments.length !== 9 || segments[0] !== "companies" || segments[2] !== "projects" || segments[4] !== "documents" || segments[6] !== "versions") {
    throw new Error("Storage key has an invalid format.");
  }
  assertStorageIdentifier(segments[1], "storage key companyId");
  assertStorageIdentifier(segments[3], "storage key projectId");
  assertStorageIdentifier(segments[5], "storage key documentId");
  if (!/^[1-9]\d*$/.test(segments[7])) throw new Error("Storage key version must be a positive whole number.");
  if (segments[8] !== "original.pdf" && segments[8] !== "original.xlsx") throw new Error("Storage key original file name is invalid.");
  return segments;
}
