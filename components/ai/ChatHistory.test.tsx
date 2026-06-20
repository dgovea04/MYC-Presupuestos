/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ChatHistory } from "@/components/ai/ChatHistory";
import type { AiHistoryEntry } from "@/components/ai/use-ai-assistant-controller";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

beforeAll(() => {
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
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

function createEntry(overrides: Partial<AiHistoryEntry> = {}): AiHistoryEntry {
  return {
    id: "entry-1",
    action: "chat",
    summary: "Genera recomendaciones para revisar este APU.",
    context: { project: "Demo" },
    result: {
      answer: "Respuesta simulada de Khipu con criterio tecnico.",
      model: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

async function renderChatHistory(props: Partial<React.ComponentProps<typeof ChatHistory>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <ChatHistory
        history={[createEntry()]}
        {...props}
      />,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return container;
}

describe("ChatHistory", () => {
  describe("maxHeight prop", () => {
    it("applies default max-h-72 class when no maxHeight prop is passed", async () => {
      const container = await renderChatHistory();

      const scrollable = container.firstElementChild;
      expect(scrollable).toBeTruthy();
      expect(scrollable?.className).toContain("max-h-72");
    });

    it("applies custom maxHeight class when maxHeight prop is passed", async () => {
      const container = await renderChatHistory({ maxHeight: "max-h-96" });

      const scrollable = container.firstElementChild;
      expect(scrollable).toBeTruthy();
      expect(scrollable?.className).toContain("max-h-96");
      expect(scrollable?.className).not.toContain("max-h-72");
    });

    it("applies arbitrary maxHeight value", async () => {
      const container = await renderChatHistory({ maxHeight: "max-h-[32rem]" });

      const scrollable = container.firstElementChild;
      expect(scrollable).toBeTruthy();
      expect(scrollable?.className).toContain("max-h-[32rem]");
    });

    it("always includes base layout classes regardless of maxHeight", async () => {
      const container = await renderChatHistory({ maxHeight: "max-h-80" });

      const scrollable = container.firstElementChild;
      expect(scrollable?.className).toContain("overflow-y-auto");
      expect(scrollable?.className).toContain("overscroll-contain");
      expect(scrollable?.className).toContain("rounded-2xl");
      expect(scrollable?.className).toContain("p-3");
    });
  });

  describe("empty history", () => {
    it("returns null when history is empty", async () => {
      const container = await renderChatHistory({ history: [] });

      expect(container.children.length).toBe(0);
    });
  });

  describe("rendering", () => {
    it("renders user message bubble with entry summary", async () => {
      const container = await renderChatHistory({
        history: [createEntry({ id: "e1", summary: "Texto de prueba del usuario." })],
      });

      const entryWrappers = container.querySelectorAll('[role="button"]');
      // First wrapper is the user message bubble
      expect(entryWrappers[0]?.textContent).toContain("Texto de prueba del usuario.");
    });

    it("renders Khipu response with answer text", async () => {
      const shortAnswer = "Respuesta breve de Khipu.";
      const container = await renderChatHistory({
        history: [createEntry({ id: "e1", result: { answer: shortAnswer, model: "llama3.1", fallbackUsed: false, warnings: [] } })],
      });

      // The answer appears inside an <article> rendered by AIMessage
      const articles = container.querySelectorAll("article");
      expect(articles[1]?.textContent).toContain(shortAnswer);
    });

    it("calls onSelect with the clicked entry when a user bubble is clicked", async () => {
      const entry = createEntry({ id: "click-1", summary: "Click me.", result: { answer: "Respuesta.", model: "llama3.1", fallbackUsed: false, warnings: [] } });
      const onSelect = vi.fn();

      const container = await renderChatHistory({ history: [entry], onSelect });

      // First wrapper is the user message bubble
      const userBubble = container.querySelector('[role="button"]') as HTMLElement | null;
      await act(async () => {
        userBubble?.click();
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(entry);
    });

    it("calls onSelect when a Khipu response bubble is clicked", async () => {
      const entry = createEntry({ id: "click-2", summary: "Pregunta.", result: { answer: "Respuesta Khipu.", model: "llama3.1", fallbackUsed: false, warnings: [] } });
      const onSelect = vi.fn();

      const container = await renderChatHistory({ history: [entry], onSelect });

      // Second wrapper is the Khipu response bubble
      const khipuBubble = container.querySelectorAll('[role="button"]')[1] as HTMLElement | undefined;
      await act(async () => {
        khipuBubble?.click();
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(entry);
    });

    it("truncates long Khipu responses to 300 characters with ellipsis", async () => {
      const longAnswer = "A".repeat(500) + "B".repeat(100);
      const entry = createEntry({
        id: "trunc-1",
        result: { answer: longAnswer, model: "llama3.1", fallbackUsed: false, warnings: [] },
      });

      const container = await renderChatHistory({ history: [entry] });

      // The answer text is inside a <p> rendered by AIMessage's renderMarkdownLite
      const articles = container.querySelectorAll("article");
      const answerParagraph = articles[1]?.querySelector("p");
      const answerText = answerParagraph?.textContent ?? "";

      expect(answerText.length).toBeLessThan(longAnswer.length);
      // truncateText slices to 300 and appends "…"
      expect(answerText).toMatch(/…$/);
      expect(answerText.length).toBeLessThanOrEqual(305);
    });

    it("shows 'Ahora' timestamp for a single recent entry (the last in chronological order)", async () => {
      const recentTimestamp = new Date(Date.now() - 10_000).toISOString();
      const entry = createEntry({
        id: "recent-1",
        timestamp: recentTimestamp,
        result: { answer: "Respuesta reciente.", model: "llama3.1", fallbackUsed: false, warnings: [] },
      });

      const container = await renderChatHistory({ history: [entry] });

      expect(container.textContent).toContain("Ahora");
    });

    it("shows a formatted timestamp instead of 'Ahora' for an old entry", async () => {
      const oldTimestamp = "2024-01-15T09:30:00Z";
      const entry = createEntry({
        id: "old-1",
        timestamp: oldTimestamp,
        result: { answer: "Respuesta vieja.", model: "llama3.1", fallbackUsed: false, warnings: [] },
      });

      const container = await renderChatHistory({ history: [entry] });

      expect(container.textContent).not.toContain("Ahora");
    });

    it("renders multiple history entries in chronological order", async () => {
      const entry1 = createEntry({
        id: "older",
        summary: "Primer mensaje",
        timestamp: "2026-01-01T10:00:00Z",
        result: { answer: "Primera respuesta.", model: "llama3.1", fallbackUsed: false, warnings: [] },
      });
      const entry2 = createEntry({
        id: "newer",
        summary: "Segundo mensaje",
        timestamp: "2026-01-01T11:00:00Z",
        result: { answer: "Segunda respuesta.", model: "llama3.1", fallbackUsed: false, warnings: [] },
      });

      const container = await renderChatHistory({ history: [entry2, entry1] });

      // history is newest-first; ChatHistory reverses so oldest appears first
      const text = container.textContent ?? "";
      const firstIndex = text.indexOf("Primer mensaje");
      const secondIndex = text.indexOf("Segundo mensaje");
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });
});
