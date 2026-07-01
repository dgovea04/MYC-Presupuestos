// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolynomialFormulaSectionTabs } from "@/components/budget/polynomial-formula-section-tabs";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    onMouseEnter,
    onFocus,
    className,
    prefetch,
    "aria-current": ariaCurrent,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={className}
      data-prefetch={prefetch ? "true" : "false"}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  ),
}));

describe("PolynomialFormulaSectionTabs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("prefetches neighbor tabs on mount and navigates with client transitions", async () => {
    await act(async () => {
      root.render(
        <PolynomialFormulaSectionTabs
          budgetId="general-1"
          activeSection={{ budgetId: "sub-2", title: "Formula polinomica - Arquitectura" }}
          sections={[
            {
              title: "Formula polinomica - Estructuras",
              budgetId: "sub-1",
              currency: "PEN",
              summary: { hasFormula: true, monomialCount: 6, totalBaseAmount: "1000.0000", status: "DRAFT" },
            },
            {
              title: "Formula polinomica - Arquitectura",
              budgetId: "sub-2",
              currency: "PEN",
              summary: { hasFormula: true, monomialCount: 5, totalBaseAmount: "800.0000", status: "VALID" },
            },
            {
              title: "Formula polinomica - Instalaciones",
              budgetId: "sub-3",
              currency: "PEN",
              summary: { hasFormula: true, monomialCount: 4, totalBaseAmount: "700.0000", status: "DRAFT" },
            },
          ]}
        />,
      );
    });

    const estructurasLink = getAnchor("Estructuras");

    expect(routerMocks.prefetch).toHaveBeenCalledWith("/budgets/general-1/polynomial-formula?section=sub-1");
    expect(routerMocks.prefetch).toHaveBeenCalledWith("/budgets/general-1/polynomial-formula?section=sub-3");

    estructurasLink.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    estructurasLink.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(estructurasLink.getAttribute("data-prefetch")).toBe("true");

    await act(async () => {
      estructurasLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/budgets/general-1/polynomial-formula?section=sub-1");
    expect(getAnchor("Arquitectura").getAttribute("aria-current")).toBe("page");
  });
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function getAnchor(text: string) {
  const anchor = [...document.querySelectorAll("a")].find((candidate) => candidate.textContent?.includes(text));

  if (!(anchor instanceof HTMLAnchorElement)) {
    throw new Error(`Missing anchor: ${text}`);
  }

  return anchor;
}
