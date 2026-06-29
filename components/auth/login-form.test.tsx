/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

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

  it("shows the verification notice and can resend the verification email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 })),
    );

    render(<LoginForm />);

    expect(screen.getByText(/Revisa tu correo/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificacion" }));

    await waitFor(() => {
      expect(screen.getByText("Te reenviamos el enlace de verificacion.")).toBeTruthy();
    });
  });
});
