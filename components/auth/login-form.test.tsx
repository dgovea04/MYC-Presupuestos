/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

afterEach(() => {
  cleanup();
});

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  searchParams: new URLSearchParams("verifyEmail=1&email=maria@example.com&sent=1"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}));

vi.mock("@/components/auth/google-signin-button", () => ({
  GoogleSignInButton: () => <button type="button">Google</button>,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.signIn.mockReset();
    mocks.searchParams = new URLSearchParams("verifyEmail=1&email=maria@example.com&sent=1");
    vi.unstubAllGlobals();
  });

  it("opens a separate MFA step after valid credentials and submits the code without repeating them", async () => {
    mocks.signIn
      .mockResolvedValueOnce({ error: "MFA_REQUIRED" })
      .mockResolvedValueOnce({ ok: true, error: null });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Contrasena"), { target: { value: "password123" } });
    const submitButton = screen.getByRole("button", { name: "Iniciar sesion" });
    const form = submitButton.closest("form");
    fireEvent.submit(form!);

    await waitFor(() => expect(screen.getByLabelText("Código MFA o código de recuperación")).toBeTruthy());
    expect(mocks.signIn).toHaveBeenNthCalledWith(1, "credentials", {
      email: "maria@example.com",
      password: "password123",
      redirect: false,
    });
    expect(screen.queryByLabelText("Correo")).toBeNull();
    expect(screen.queryByLabelText("Contrasena")).toBeNull();
    const mfaInput = screen.getByLabelText("Código MFA o código de recuperación");
    fireEvent.change(mfaInput, { target: { value: "123456" } });
    expect((mfaInput as HTMLInputElement).value).toBe("123456");
    await waitFor(() => expect((submitButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenLastCalledWith("credentials", {
        email: "maria@example.com",
        password: "password123",
        mfaCode: "123456",
        redirect: false,
      });
    });
  });

  it("keeps the credential step for ordinary login errors", async () => {
    mocks.signIn.mockResolvedValueOnce({ error: "CredentialsSignin" });

    render(<LoginForm />);

    const form = screen.getByRole("button", { name: "Iniciar sesion" }).closest("form");
    fireEvent.submit(form!);

    await waitFor(() => expect(screen.getByText(/Credenciales inválidas/i)).toBeTruthy());
    expect(screen.getByLabelText("Correo")).toBeTruthy();
    expect(screen.getByLabelText("Contrasena")).toBeTruthy();
    expect(screen.queryByLabelText("Código MFA o código de recuperación")).toBeNull();
  });

  it("shows the verification notice and can resend the verification email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 })),
    );

    render(<LoginForm />);

    expect(screen.getAllByText(/Revisa tu correo/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificacion" }));

    await waitFor(() => {
      expect(screen.getByText("Te reenviamos el enlace de verificacion.")).toBeTruthy();
    });
  });
});
