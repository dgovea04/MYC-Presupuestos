/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AiViewContextProvider, useActiveAiViewContext } from "@/components/ai/ai-view-context";
import { usePublishAiViewContext } from "@/hooks/use-ai-view-context";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

describe("AiViewContextProvider", () => {
  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
    }

    activeRoot = null;
    activeContainer?.remove();
    activeContainer = null;
    document.body.innerHTML = "";
  });

  it("publishes the current view context over the bootstrap value", async () => {
    const screen = await renderHarness({
      bootstrap: { route: "/projects/demo", projectId: "demo", module: "Proyecto" },
      published: { route: "/projects/demo/presupuestos", projectId: "demo", module: "Presupuestos", budgetId: "budget-1" },
      publishing: true,
    });

    expect(screen.read()).toContain('"route":"/projects/demo/presupuestos"');
    expect(screen.read()).toContain('"projectId":"demo"');
    expect(screen.read()).toContain('"module":"Presupuestos"');
    expect(screen.read()).toContain('"budgetId":"budget-1"');
    expect(screen.read()).not.toContain('"module":"Proyecto"');
  });

  it("restores the bootstrap context when the publisher unmounts", async () => {
    const screen = await renderHarness({
      bootstrap: { route: "/projects/demo", projectId: "demo", module: "Proyecto" },
      published: { route: "/projects/demo/presupuestos", projectId: "demo", module: "Presupuestos" },
      publishing: true,
    });

    expect(screen.read()).toContain('"module":"Presupuestos"');

    await screen.rerender({
      bootstrap: { route: "/projects/demo", projectId: "demo", module: "Proyecto" },
      published: { route: "/projects/demo/presupuestos", projectId: "demo", module: "Presupuestos" },
      publishing: false,
    });

    expect(screen.read()).toContain('"route":"/projects/demo"');
    expect(screen.read()).toContain('"module":"Proyecto"');
    expect(screen.read()).not.toContain('"module":"Presupuestos"');
  });
});

async function renderHarness(props: HarnessProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  activeContainer = container;
  activeRoot = root;

  await act(async () => {
    root.render(<Harness {...props} />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    read: () => container.textContent ?? "",
    rerender: async (nextProps: HarnessProps) => {
      await act(async () => {
        root.render(<Harness {...nextProps} />);
      });

      await act(async () => {
        await Promise.resolve();
      });
    },
  };
}

type HarnessProps = {
  bootstrap: {
    route?: string;
    projectId?: string;
    module?: string;
    budgetId?: string;
  };
  published: {
    route?: string;
    projectId?: string;
    module?: string;
    budgetId?: string;
  };
  publishing: boolean;
};

function Harness({ bootstrap, published, publishing }: HarnessProps) {
  return (
    <AiViewContextProvider value={bootstrap}>
      {publishing ? <Publisher value={published} /> : null}
      <Reader />
    </AiViewContextProvider>
  );
}

function Publisher({ value }: { value: HarnessProps["published"] }) {
  usePublishAiViewContext(value);
  return null;
}

function Reader() {
  const value = useActiveAiViewContext();
  return <pre>{JSON.stringify(value)}</pre>;
}
