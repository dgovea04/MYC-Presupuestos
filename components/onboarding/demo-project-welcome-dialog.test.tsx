/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoProjectWelcomeDialog } from "@/components/onboarding/demo-project-welcome-dialog";

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: { children: ReactNode; href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

describe("DemoProjectWelcomeDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens on the first dashboard visit and starts the tutorial route", async () => {
    render(<DemoProjectWelcomeDialog projectId="project-demo" projectName="Edificio Multifamiliar - Demo" />);

    expect(await screen.findByTestId("demo-project-welcome-dialog")).toBeTruthy();
    expect(screen.getByText("Conoce MC Presupuestos en 5 minutos")).toBeTruthy();
    expect(screen.getByText(/Proyecto recomendado:/).parentElement?.className).toContain("border-violet-200");

    const startLink = screen.getByRole("link", { name: /Comenzar tutorial/i });
    expect(startLink.getAttribute("href")).toBe("/projects/project-demo?demoTour=1");
    expect(startLink.className).toContain("bg-violet-700");

    fireEvent.click(startLink);

    expect(window.localStorage.getItem("mc-demo-project-welcome:project-demo")).toBe("started");
    await waitFor(() => {
      expect(screen.queryByTestId("demo-project-welcome-dialog")).toBeNull();
    });
  });

  it("does not show again after the user postpones it", async () => {
    render(<DemoProjectWelcomeDialog projectId="project-demo" projectName="Edificio Multifamiliar - Demo" />);

    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));

    expect(window.localStorage.getItem("mc-demo-project-welcome:project-demo")).toBe("dismissed");
    await waitFor(() => {
      expect(screen.queryByTestId("demo-project-welcome-dialog")).toBeNull();
    });

    render(<DemoProjectWelcomeDialog projectId="project-demo" projectName="Edificio Multifamiliar - Demo" />);

    await waitFor(() => {
      expect(screen.queryByTestId("demo-project-welcome-dialog")).toBeNull();
    });
  });
});
