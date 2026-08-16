import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  registerUserWithCompanyAndDemoMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  issueEmailVerificationMock: vi.fn(),
  trackServerEventMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUniqueMock },
  },
}));

vi.mock("@/lib/auth/registration", () => ({
  registerUserWithCompanyAndDemo: mocks.registerUserWithCompanyAndDemoMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPasswordMock,
}));

vi.mock("@/lib/auth/email-verification", () => ({
  issueEmailVerification: mocks.issueEmailVerificationMock,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackServerEvent: mocks.trackServerEventMock,
}));

import { POST } from "@/app/api/register/route";

function buildRequest(body: Record<string, string>, cookie?: string) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
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
    mocks.registerUserWithCompanyAndDemoMock.mockReset();
    mocks.hashPasswordMock.mockReset();
    mocks.issueEmailVerificationMock.mockReset();
    mocks.trackServerEventMock.mockReset();
  });

  it("registers a new user successfully, issues email verification, and returns 201", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
      user: { id: "user-1" },
      company: { id: "company-1" },
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requiresEmailVerification: true,
      verificationEmailSent: true,
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });

    expect(mocks.findUniqueMock).toHaveBeenCalledWith({
      where: { email: "maria@example.com" },
      select: { email: true, passwordHash: true },
    });
    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(mocks.registerUserWithCompanyAndDemoMock).toHaveBeenCalledWith({
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

  it("carries landing CTA context into signup_completed", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
      user: { id: "user-1" },
      company: { id: "company-1" },
      demoProject: { status: "created", projectId: "project-demo", generalBudgetId: "budget-demo", warnings: [] },
    });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const context = encodeURIComponent(JSON.stringify({
      landing_path: "/software-presupuestos-construccion",
      landing_variant: "acquisition-v1",
      cta_location: "acquisition_hero",
    }));
    const attribution = encodeURIComponent(JSON.stringify({
      firstTouch: { utm_source: "google" },
      lastTouch: { utm_source: "linkedin", utm_campaign: "founding-users" },
    }));

    await POST(buildRequest(validBody, `mc-registration-context=${context}; mc-attribution=${attribution}`));

    expect(mocks.trackServerEventMock).toHaveBeenCalledWith("signup_completed", expect.objectContaining({
      userId: "user-1",
      landing_path: "/software-presupuestos-construccion",
      landing_variant: "acquisition-v1",
      cta_location: "acquisition_hero",
      first_touch_utm_source: "google",
      utm_source: "linkedin",
    }));
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
    expect(mocks.registerUserWithCompanyAndDemoMock).not.toHaveBeenCalled();
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
    expect(mocks.registerUserWithCompanyAndDemoMock).not.toHaveBeenCalled();
  });

  it("registers without RUC when it is not provided", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
      user: { id: "user-1" },
      company: { id: "company-1" },
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const body = { ...validBody };
    delete body.ruc;

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(201);
    expect(mocks.registerUserWithCompanyAndDemoMock).toHaveBeenCalledWith(
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
    expect(mocks.registerUserWithCompanyAndDemoMock).not.toHaveBeenCalled();
  });

  it("returns 400 when registerUserWithCompanyAndDemo throws an error", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "DB connection failed",
    });
  });

  it("registers successfully with empty RUC string (treated as undefined)", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
      user: { id: "user-1" },
      company: { id: "company-1" },
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });
    mocks.issueEmailVerificationMock.mockResolvedValue({ sent: true });

    const body = { ...validBody, ruc: "" };

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(201);
    expect(mocks.registerUserWithCompanyAndDemoMock).toHaveBeenCalledWith(
      expect.objectContaining({ ruc: undefined }),
    );
  });

  it("still creates the account when sending the verification email fails", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.registerUserWithCompanyAndDemoMock.mockResolvedValue({
      user: { id: "user-1" },
      company: { id: "company-1" },
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });
    mocks.issueEmailVerificationMock.mockRejectedValue(new Error("Email provider unavailable"));

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requiresEmailVerification: true,
      verificationEmailSent: false,
      demoProject: {
        status: "created",
        projectId: "project-demo",
        generalBudgetId: "budget-demo",
        warnings: [],
      },
    });
  });
});
