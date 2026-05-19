/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLSpanElement> & { src: string }) => <span aria-label={alt} data-next-image={src} {...props} />,
}));

import { AccountPageContent } from "@/components/account/account-page-content";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

describe("AccountPageContent", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    if (activeContainer) {
      const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

      if (root) {
        await act(async () => {
          root.unmount();
        });
      }

      activeContainer.remove();
      activeContainer = null;
    }
  });

  it("submits profile, avatar, and password updates to the dedicated account APIs", async () => {
    const fetchMock = vi.fn(async (input: string) => ({
      ok: true,
      json: async () => {
        if (input === "/api/account") {
          return {
            id: "user-1",
            name: "Maria Calderon",
            email: "maria@example.com",
            avatarUrl: null,
            phone: "987654321",
            jobTitle: "Ingeniera Residente",
            bio: "Especialista en costos",
            createdAt: "2026-05-18T10:00:00.000Z",
          };
        }

        if (input === "/api/account/avatar") {
          return {
            id: "user-1",
            name: "Maria Calderon",
            email: "maria@example.com",
            avatarUrl: "/uploads/avatars/user-1.webp",
            phone: "987654321",
            jobTitle: "Ingeniera Residente",
            bio: "Especialista en costos",
            createdAt: "2026-05-18T10:00:00.000Z",
          };
        }

        return { ok: true };
      },
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { getButton, getInput } = await renderContent(
      <AccountPageContent
        initialAccount={{
          id: "user-1",
          name: "Maria",
          email: "maria@example.com",
          avatarUrl: null,
          phone: "",
          jobTitle: "",
          bio: "",
          createdAt: "2026-05-18T10:00:00.000Z",
        }}
      />,
    );

    await act(async () => {
      updateInputValue(getInput("accountName"), "Maria Calderon");
      updateInputValue(getInput("accountPhone"), "987654321");
      updateInputValue(getInput("accountJobTitle"), "Ingeniera Residente");
      updateInputValue(getInput("accountBio"), "Especialista en costos");
      getButton(/Guardar perfil/).click();
    });

    await act(async () => {
      const avatarInput = getInput("accountAvatar") as HTMLInputElement;
      const file = new File(["avatar"], "avatar.webp", { type: "image/webp" });
      Object.defineProperty(avatarInput, "files", {
        configurable: true,
        value: [file],
      });
      avatarInput.dispatchEvent(new Event("change", { bubbles: true }));
      getButton(/Subir imagen/).click();
    });

    await act(async () => {
      updateInputValue(getInput("currentPassword"), "actual-123");
      updateInputValue(getInput("newPassword"), "nueva-12345");
      updateInputValue(getInput("confirmPassword"), "nueva-12345");
      getButton(/Cambiar contrasena/).click();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/account",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Maria Calderon",
          phone: "987654321",
          jobTitle: "Ingeniera Residente",
          bio: "Especialista en costos",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/account/avatar", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/account/password", expect.objectContaining({ method: "PATCH" }));
  });
});

async function renderContent(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;
  activeContainer = container;

  await act(async () => {
    root.render(element);
  });

  return {
    getButton(pattern: RegExp) {
      const button = [...container.querySelectorAll("button")].find((element) => pattern.test(element.textContent ?? ""));

      if (!button) {
        throw new Error(`Button not found for pattern ${pattern}`);
      }

      return button as HTMLButtonElement;
    },
    getInput(id: string) {
      const input = container.querySelector(`#${id}`);

      if (!input) {
        throw new Error(`Input #${id} not found`);
      }

      return input as HTMLInputElement;
    },
  };
}

function updateInputValue(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
