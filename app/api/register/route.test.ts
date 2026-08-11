import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  registerUserWithCompanyMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  issueEmailVerificationMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUniqueMock },
  },
}));

vi.mock("@/lib/auth/registration", () => ({
  registerUserWithCompany: mocks.registerUserWithCompanyMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPasswordMock,
}));

vi.mock("@/lib/auth/email-verification", () => ({
  issueEmailVerification: mocks.issueEmailVerificationMock,
}));

import { POST } from "@/app/api/register/route";

function buildRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Maria Calderon",
  email: "maria@example.com",
  password: "password123",
  companyName: "Constructora Andina SAC",
  ruc: "20123456789",
};

describe("POST /api/register", () => {
  beforeEach(() => {
    mocks.findUniqueMock.mockReset();
    mocks.registerUserWithCompanyMock.mockReset();
    mocks.hashPasswordMock.mockReset();
    mocks.issueEmailVerificationMock.mockReset();
  });

  it("registers a new user successfully, issues email verification, and returns 201", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyMock.mockResolvedValue({ user: { id: "user-1" }, company: { id: "company-1" } });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requiresEmailVerification: true,
      verificationEmailSent: true,
    });

    expect(mocks.findUniqueMock).toHaveBeenCalledWith({
      where: { email: "maria@example.com" },
      select: { email: true, passwordHash: true },
    });
    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(mocks.registerUserWithCompanyMock).toHaveBeenCalledWith({
      name: "Maria Calderon",
      email: "maria@example.com",
      passwordHash: "hashed-password",
      companyName: "Constructora Andina SAC",
      ruc: "20123456789",
    });
    expect(mocks.issueEmailVerificationMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "maria@example.com",
      name: "Maria Calderon",
    });
  });

  it("returns 409 when the email is already registered with a password", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      email: "maria@example.com",
      passwordHash: "some-existing-hash",
    });

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Ese correo ya esta registrado",
    });
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();
  });

  it("returns 409 with Google-specific message when the email belongs to a Google-linked account (no passwordHash)", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      email: "maria@example.com",
      passwordHash: null,
    });

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Este correo ya esta registrado mediante Google. Continua con Google para iniciar sesion.",
    });
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();
  });

  it("registers without RUC when it is not provided", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyMock.mockResolvedValue({ user: { id: "user-1" }, company: { id: "company-1" } });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const body = { ...validBody };
    delete body.ruc;

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(201);
    expect(mocks.registerUserWithCompanyMock).toHaveBeenCalledWith(
      expect.objectContaining({ ruc: undefined }),
    );
  });

  it("returns 400 when the request body fails validation", async () => {
    const response = await POST(
      buildRequest({ ...validBody, password: "12" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "La contrasena debe tener al menos 8 caracteres",
    });
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();
  });

  it("returns 400 when registerUserWithCompany throws an error", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyMock.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "DB connection failed",
    });
  });

  it("registers successfully with empty RUC string (treated as undefined)", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyMock.mockResolvedValue({ user: { id: "user-1" }, company: { id: "company-1" } });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const body = { ...validBody, ruc: "" };

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(201);
    expect(mocks.registerUserWithCompanyMock).toHaveBeenCalledWith(
      expect.objectContaining({ ruc: undefined }),
    );
  });

  it("still creates the account when sending the verification email fails", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyMock.mockResolvedValue({ user: { id: "user-1" }, company: { id: "company-1" } });
    mocks.issueEmailVerificationMock.mockRejectedValue(new Error("Email provider unavailable"));

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requiresEmailVerification: true,
      verificationEmailSent: false,
    });
  });
});
