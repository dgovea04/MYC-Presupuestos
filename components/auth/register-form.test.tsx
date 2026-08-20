/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/components/auth/register-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/components/auth/google-signin-button", () => ({
  GoogleSignInButton: () => <button type="button">Google</button>,
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    vi.unstubAllGlobals();
  });

  it("redirects to login with verification status after a successful registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, verificationEmailSent: true }), { status: 201 }),
      ),
    );

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Maria Calderon" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "maria@example.com" } });
    fireEvent.change(screen.getByLabelText("Contrasena"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/Empresa o perfil profesional/), {
      target: { value: "Constructora Andina SAC" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Crear cuenta" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/login?verifyEmail=1&email=maria%40example.com&sent=1");
    });
  });

  it("keeps company optional and removes the RUC field from the form", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Empresa o perfil profesional/).hasAttribute("required")).toBe(false);
    expect(screen.queryByLabelText("RUC")).toBeNull();
  });
});
