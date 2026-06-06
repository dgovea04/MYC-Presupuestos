export type S10SqlServerConnectionInput = {
  server: string;
  user?: string;
  password?: string;
  trustServerCertificate: boolean;
};

export function parseConnectionInputFromUrl(request: Request): S10SqlServerConnectionInput {
  const url = new URL(request.url);

  return {
    server: readOptionalUrlString(url, "server") ?? ".\\SQLEXPRESS",
    user: readOptionalUrlString(url, "user"),
    password: readOptionalUrlString(url, "password"),
    trustServerCertificate: readOptionalUrlString(url, "trustServerCertificate") !== "false",
  };
}

export function readRequiredUrlString(request: Request, key: string) {
  const value = readOptionalUrlString(new URL(request.url), key);
  if (!value) {
    throw new S10SqlServerRequestError(`Falta ${key}.`, 400);
  }

  return value;
}

export function readRequiredRecordString(record: Record<string, unknown>, key: string) {
  const value = readOptionalRecordString(record, key);
  if (!value) {
    throw new S10SqlServerRequestError(`Falta ${key}.`, 400);
  }

  return value;
}

export function readOptionalRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function readBooleanRecordValue(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class S10SqlServerRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function readOptionalUrlString(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
