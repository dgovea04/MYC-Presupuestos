/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Select, type SelectValueChangeEvent } from "@/components/ui/select";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let activeContainer: HTMLDivElement | null = null;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Select", () => {
  beforeAll(() => {
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  afterAll(() => {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      return;
    }

    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

  afterEach(async () => {
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

  it("applies resolved excel view mode to portaled content", async () => {
    const { getTrigger } = await renderSelect(
      <div data-view-mode="excel">
        <Select defaultValue="materials">
          <option value="materials">Materials</option>
          <option value="labor">Labor</option>
        </Select>
      </div>,
    );

    await act(async () => {
      getTrigger().click();
    });

    const content = document.body.querySelector(".ui-select-content");
    const item = document.body.querySelector('[role="option"]');

    expect(content?.getAttribute("data-view-mode")).toBe("excel");
    expect(item?.getAttribute("data-view-mode")).toBe("excel");
  });

  it("syncs portaled content when view mode changes after mount", async () => {
    const { getByTestId, getTrigger } = await renderSelect(<SelectModeHarness />);

    await act(async () => {
      getTrigger().click();
    });

    const content = getPortaledContent();
    const item = getPortaledItem();

    expect(content.getAttribute("data-view-mode")).toBe("modern");
    expect(item.getAttribute("data-view-mode")).toBe("modern");

    await act(async () => {
      getByTestId("toggle-mode").click();
    });

    expect(content.getAttribute("data-view-mode")).toBe("excel");
    expect(item.getAttribute("data-view-mode")).toBe("excel");
  });

  it("forwards trigger props and emits a value-focused change event", async () => {
    const handleFocus = vi.fn();
    const handleChange = vi.fn<(event: SelectValueChangeEvent) => void>();
    const { getTrigger } = await renderSelect(
      <Select
        aria-label="Category"
        data-testid="category-select"
        defaultValue="materials"
        onFocus={handleFocus}
        onChange={handleChange}
      >
        <option value="materials">Materials</option>
        <option value="labor">Labor</option>
      </Select>,
    );

    const trigger = getTrigger();

    expect(trigger.getAttribute("aria-label")).toBe("Category");
    expect(trigger.getAttribute("data-testid")).toBe("category-select");

    await act(async () => {
      trigger.focus();
    });

    expect(handleFocus).toHaveBeenCalledTimes(1);

    await act(async () => {
      trigger.click();
    });

    const laborOption = Array.from(document.body.querySelectorAll('[role="option"]')).find(
      (option) => option.textContent === "Labor",
    );

    if (!(laborOption instanceof HTMLElement)) {
      throw new Error("Missing Labor option");
    }

    await act(async () => {
      laborOption.click();
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0]?.[0].target.value).toBe("labor");
    expect(handleChange.mock.calls[0]?.[0].currentTarget.value).toBe("labor");
  });

  it("preserves Radix form integration through the generated native select", async () => {
    const formChange = vi.fn();
    const { getTrigger, host } = await renderSelect(
      <form id="budget-form" onChange={formChange}>
        <Select
          autoComplete="section-budget category"
          defaultValue="materials"
          form="budget-form"
          name="category"
          required
        >
          <option value="materials">Materials</option>
          <option value="labor">Labor</option>
        </Select>
      </form>,
    );

    const nativeSelect = host.querySelector('select[name="category"]');

    if (!(nativeSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing native select integration");
    }

    expect(nativeSelect.required).toBe(true);
    expect(nativeSelect.getAttribute("autocomplete")).toBe("section-budget category");
    expect(nativeSelect.form?.id).toBe("budget-form");
    expect(host.querySelector('input[type="hidden"][name="category"]')).toBeNull();

    await act(async () => {
      getTrigger().click();
    });

    const laborOption = Array.from(document.body.querySelectorAll('[role="option"]')).find(
      (option) => option.textContent === "Labor",
    );

    if (!(laborOption instanceof HTMLElement)) {
      throw new Error("Missing Labor option");
    }

    await act(async () => {
      laborOption.click();
    });

    expect(nativeSelect.value).toBe("labor");
    expect(formChange).toHaveBeenCalled();
  });

  it("keeps enabled empty-string options selectable and re-selectable", async () => {
    const handleChange = vi.fn<(event: SelectValueChangeEvent) => void>();
    const { getTrigger, host } = await renderSelect(
      <Select defaultValue="labor" name="category" onChange={handleChange}>
        <option value="" disabled>
          Selecciona una categoria
        </option>
        <option value="">Sin categoria</option>
        <option value="labor">Labor</option>
      </Select>,
    );
    const trigger = getTrigger();
    const nativeSelect = host.querySelector('select[name="category"]');

    if (!(nativeSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing wrapper fallback select");
    }

    expect(nativeSelect.style.position).toBe("absolute");
    expect(nativeSelect.style.inset).toBe("0px");
    expect(nativeSelect.style.width).toBe("100%");
    expect(nativeSelect.style.height).toBe("100%");
    expect(nativeSelect.style.opacity).toBe("0");
    expect(nativeSelect.style.pointerEvents).toBe("none");

    expect(Array.from(nativeSelect.options).map((option) => option.value)).toEqual(["", "labor"]);

    await selectOption(() => trigger, "Sin categoria");

    expect(handleChange.mock.calls.at(-1)?.[0].target.value).toBe("");
    expect(trigger.textContent).toContain("Sin categoria");
    expect(nativeSelect.value).toBe("");

    await selectOption(() => trigger, "Labor");

    expect(handleChange.mock.calls.at(-1)?.[0].target.value).toBe("labor");
    expect(trigger.textContent).toContain("Labor");
    expect(nativeSelect.value).toBe("labor");

    await selectOption(() => trigger, "Sin categoria");

    expect(handleChange.mock.calls.at(-1)?.[0].target.value).toBe("");
    expect(trigger.textContent).toContain("Sin categoria");
    expect(nativeSelect.value).toBe("");
  });

  it("renders the fallback native select for unnamed required empty-string mode", async () => {
    const { host } = await renderSelect(
      <form>
        <Select required defaultValue="labor">
          <option value="" disabled>
            Selecciona una categoria
          </option>
          <option value="">Sin categoria</option>
          <option value="labor">Labor</option>
        </Select>
      </form>,
    );

    const nativeSelect = host.querySelector("select");

    if (!(nativeSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing unnamed required fallback select");
    }

    expect(nativeSelect.required).toBe(true);
    expect(nativeSelect.name).toBe("");
    expect(nativeSelect.value).toBe("labor");
  });

  it("does not bubble fallback native change events for controlled value updates", async () => {
    const { getByTestId, host } = await renderSelect(<ControlledFallbackSelectHarness />);

    const nativeSelect = host.querySelector('select[name="category"]');

    if (!(nativeSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing wrapper fallback select");
    }

    const fallbackChange = vi.fn();
    nativeSelect.addEventListener("change", fallbackChange);

    expect(nativeSelect.value).toBe("labor");

    await act(async () => {
      getByTestId("set-empty").click();
    });

    expect(nativeSelect.value).toBe("");
    expect(fallbackChange).not.toHaveBeenCalled();

    await act(async () => {
      getByTestId("set-labor").click();
    });

    expect(nativeSelect.value).toBe("labor");
    expect(fallbackChange).not.toHaveBeenCalled();
  });

  it("does not emit a stale fallback change when a controlled user selection is rejected then later applied externally", async () => {
    const { getByTestId, getTrigger, host } = await renderSelect(<RejectedThenDeferredFallbackSelectHarness />);

    const nativeSelect = host.querySelector('select[name="category"]');

    if (!(nativeSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing wrapper fallback select");
    }

    const fallbackChange = vi.fn();
    nativeSelect.addEventListener("change", fallbackChange);

    await selectOption(getTrigger, "Sin categoria");

    expect(nativeSelect.value).toBe("labor");
    expect(fallbackChange).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      getByTestId("apply-empty").click();
    });

    expect(nativeSelect.value).toBe("");
    expect(fallbackChange).not.toHaveBeenCalled();
  });

  it("can disable body scroll lock compensation only while the menu is open", async () => {
    const { getTrigger } = await renderSelect(
      <Select defaultValue="materials" disableBodyScrollLockCompensation>
        <option value="materials">Materials</option>
        <option value="labor">Labor</option>
      </Select>,
    );

    expect(document.body.style.marginRight).toBe("");
    expect(document.body.style.paddingRight).toBe("");

    await act(async () => {
      getTrigger().click();
    });

    await act(async () => {
      document.body.setAttribute("data-scroll-locked", "1");
    });

    expect(document.body.style.getPropertyValue("margin-right")).toBe("0px");
    expect(document.body.style.getPropertyPriority("margin-right")).toBe("important");
    expect(document.body.style.getPropertyValue("padding-right")).toBe("0px");
    expect(document.body.style.getPropertyPriority("padding-right")).toBe("important");

    const laborOption = Array.from(document.body.querySelectorAll('[role="option"]')).find(
      (option) => option.textContent === "Labor",
    );

    if (!(laborOption instanceof HTMLElement)) {
      throw new Error("Missing Labor option");
    }

    await act(async () => {
      laborOption.click();
    });

    expect(document.body.style.marginRight).toBe("");
    expect(document.body.style.paddingRight).toBe("");
    document.body.removeAttribute("data-scroll-locked");
  });
});

async function renderSelect(node: React.ReactNode) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return {
    host: nextContainer,
    getByTestId: (testId: string) => {
      const element = nextContainer.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${testId}`);
      }

      return element;
    },
    getTrigger: () => {
      const element = nextContainer.querySelector('[role="combobox"]');

      if (!(element instanceof HTMLElement)) {
        throw new Error("Missing select trigger");
      }

      return element;
    },
  };
}

function getPortaledContent() {
  const element = document.body.querySelector(".ui-select-content");

  if (!(element instanceof HTMLElement)) {
    throw new Error("Missing portaled select content");
  }

  return element;
}

function getPortaledItem() {
  const element = document.body.querySelector('[role="option"]');

  if (!(element instanceof HTMLElement)) {
    throw new Error("Missing portaled select item");
  }

  return element;
}

async function selectOption(getTrigger: () => HTMLElement, label: string) {
  await act(async () => {
    getTrigger().click();
  });

  const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(
    (candidate) => candidate.textContent === label,
  );

  if (!(option instanceof HTMLElement)) {
    throw new Error(`Missing option: ${label}`);
  }

  await act(async () => {
    option.click();
  });
}

function SelectModeHarness() {
  const [viewMode, setViewMode] = React.useState<"modern" | "excel">("modern");

  return (
    <div data-view-mode={viewMode}>
      <button data-testid="toggle-mode" type="button" onClick={() => setViewMode("excel")}>
        Toggle mode
      </button>
      <Select defaultValue="materials">
        <option value="materials">Materials</option>
        <option value="labor">Labor</option>
      </Select>
    </div>
  );
}

function ControlledFallbackSelectHarness() {
  const [value, setValue] = React.useState("labor");

  return (
    <form>
      <button data-testid="set-empty" type="button" onClick={() => setValue("")}>
        Empty
      </button>
      <button data-testid="set-labor" type="button" onClick={() => setValue("labor")}>
        Labor
      </button>
      <Select name="category" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="" disabled>
          Selecciona una categoria
        </option>
        <option value="">Sin categoria</option>
        <option value="labor">Labor</option>
      </Select>
    </form>
  );
}

function RejectedThenDeferredFallbackSelectHarness() {
  const [value, setValue] = React.useState("labor");

  return (
    <div>
      <button data-testid="apply-empty" type="button" onClick={() => setValue("")}>
        Apply empty externally
      </button>
      <Select name="category" value={value} onChange={() => undefined}>
        <option value="" disabled>
          Selecciona una categoria
        </option>
        <option value="">Sin categoria</option>
        <option value="labor">Labor</option>
      </Select>
    </div>
  );
}
