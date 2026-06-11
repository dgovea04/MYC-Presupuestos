# Khipu Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Khipu and ChatGPT Bridge prompts with `prd/MYC-Prompt-Optimization-Guide.md` by sending clean typed task payloads and keeping stable behavior rules in reusable prompt builders.

**Architecture:** Add a focused task-payload layer under `lib/ai` that owns the clean `task`, `role`, `output`, `context`, and `input` contract. Refactor current prompt builders and the ChatGPT Bridge payload builder to consume that contract while preserving existing API routes, schemas, structured parsing, repair, usage accounting, history, and human review boundaries.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Vitest, React client components, Chrome MV3 extension JavaScript.

---

## Scope Check

This plan covers one coherent subsystem: prompt construction and bridge prompt payload shape for Khipu AI requests. It does not change model routing, Ollama adapters, token accounting, project history persistence, quality metrics, budget calculations, APU application behavior, or financial formulas.

---

## File Structure

- Create `lib/ai/task-payloads.ts`: typed clean task payload contract and builders for `chat`, `apu`, `review`, and `autocomplete`.
- Create `lib/ai/task-payloads.test.ts`: unit tests locking clean payload shape, schema names, context normalization, and project id omission.
- Modify `lib/ai/prompts.ts`: add reusable JSON-only system/base prompt helpers and task-payload prompt builder helpers while preserving existing exported functions.
- Modify `lib/ai/prompts.test.ts`: verify optimized prompt messages use clean task JSON and still include existing safety rules, context, evidence, and schemas.
- Modify `components/ai/AIWorkspace.tsx`: refactor `buildBridgePrompt` to send a clean task payload instead of `accion`, `instrucciones`, and `formatoSalida`.
- Modify `components/ai/AIWorkspace.bridge.test.tsx`: update bridge expectations and add assertions that instructions are no longer duplicated in the webapp payload.
- Modify `extensiones/MYC-ChatGPT-Bridge-V2/chatgpt-content.js`: align the extension-owned prompt base with the guide and keep webapp JSON as the only `INPUT JSON` body.
- Modify `extensiones/MYC-ChatGPT-Bridge-V2/README.md`: document the clean bridge payload contract and response expectation.
- Modify `prd/MYC-Prompt-Optimization-Guide.md`: replace the draft recommendation with the implemented contract, exact task names, schema names, and rollout notes.

---

### Task 1: Add The Clean AI Task Payload Contract

**Files:**
- Create: `lib/ai/task-payloads.ts`
- Create: `lib/ai/task-payloads.test.ts`

- [ ] **Step 1: Write the failing payload tests**

Create `lib/ai/task-payloads.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildAiTaskPayload,
  buildBridgeTaskPayload,
  type AiTaskPayload,
} from "@/lib/ai/task-payloads";

describe("AI task payloads", () => {
  it("builds a clean chat task payload with role, output, context, and input", () => {
    const payload = buildAiTaskPayload({
      action: "chat",
      payload: {
        message: "Revisa el rendimiento",
        context: {
          project: "Edificio Multifamiliar",
          module: "APU",
          selectedItem: "Concreto f'c=210",
          unit: "m3",
          currentCost: 420,
          activeTable: "Analisis de precios unitarios",
        },
        projectId: "project-1",
      },
    });

    expect(payload).toEqual({
      task: "technical_chat",
      role: "construction_cost_assistant_peru",
      output: {
        format: "text",
        schema: "technical_chat_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        module: "APU",
        selectedItem: "Concreto f'c=210",
        unit: "m3",
        currentCost: 420,
        activeTable: "Analisis de precios unitarios",
      },
      input: {
        message: "Revisa el rendimiento",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    } satisfies AiTaskPayload);
  });

  it("builds JSON-only task payloads for structured APU and review actions", () => {
    expect(
      buildAiTaskPayload({
        action: "apu",
        payload: {
          description: "Concreto armado f'c=210 kg/cm2",
          unit: "m3",
          context: { project: "Edificio Multifamiliar" },
        },
      }),
    ).toMatchObject({
      task: "generate_apu",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      input: {
        description: "Concreto armado f'c=210 kg/cm2",
        unit: "m3",
      },
    });

    expect(
      buildAiTaskPayload({
        action: "review",
        payload: {
          budgetSummary: "Partida 01.02 Concreto f'c=210 m3 S/ 420.",
          context: { project: "Edificio Multifamiliar" },
        },
      }),
    ).toMatchObject({
      task: "review_budget",
      output: {
        format: "json_only",
        schema: "budget_review_v1",
      },
      input: {
        budgetSummary: "Partida 01.02 Concreto f'c=210 m3 S/ 420.",
      },
    });
  });

  it("omits project id and empty context fields from bridge payloads", () => {
    const payload = buildBridgeTaskPayload({
      action: "apu",
      payload: {
        description: "Muro de ladrillo",
        unit: "m2",
        projectId: "project-1",
        context: {
          project: "Edificio Multifamiliar",
          module: "",
          selectedItem: undefined,
          unit: "m2",
        },
      },
    });

    expect(payload).toEqual({
      task: "generate_apu",
      role: "construction_cost_assistant_peru",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        unit: "m2",
      },
      input: {
        description: "Muro de ladrillo",
        unit: "m2",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    });

    expect(JSON.stringify(payload)).not.toContain("project-1");
  });
});
```

- [ ] **Step 2: Run the payload test to verify it fails**

Run:

```powershell
npm run test -- lib/ai/task-payloads.test.ts
```

Expected: FAIL because `lib/ai/task-payloads.ts` does not exist.

- [ ] **Step 3: Implement the payload builders**

Create `lib/ai/task-payloads.ts`:

```ts
import type { AiContext } from "@/lib/ai/types";

export type AiPromptAction = "chat" | "apu" | "review" | "autocomplete";

export type AiTaskName =
  | "technical_chat"
  | "generate_apu"
  | "review_budget"
  | "autocomplete_construction_text";

export type AiOutputFormat = "text" | "json_only";

export type AiOutputSchemaName =
  | "technical_chat_v1"
  | "apu_generation_v1"
  | "budget_review_v1"
  | "autocomplete_text_v1";

export type AiTaskPayload = {
  task: AiTaskName;
  role: "construction_cost_assistant_peru";
  output: {
    format: AiOutputFormat;
    schema: AiOutputSchemaName;
  };
  context?: AiContext;
  input: Record<string, string>;
  guardrails: {
    humanReviewRequired: true;
    noAutomaticBudgetMutation: true;
    noExactPriceFabrication: true;
  };
};

type BuildAiTaskPayloadInput = {
  action: AiPromptAction;
  payload: Record<string, unknown>;
};

export function buildAiTaskPayload({ action, payload }: BuildAiTaskPayloadInput): AiTaskPayload {
  const context = readContext(payload.context);

  return {
    task: readTaskName(action),
    role: "construction_cost_assistant_peru",
    output: readOutput(action),
    ...(context ? { context } : {}),
    input: readInput(action, payload),
    guardrails: {
      humanReviewRequired: true,
      noAutomaticBudgetMutation: true,
      noExactPriceFabrication: true,
    },
  };
}

export function buildBridgeTaskPayload(input: BuildAiTaskPayloadInput): AiTaskPayload {
  return buildAiTaskPayload(input);
}

function readTaskName(action: AiPromptAction): AiTaskName {
  if (action === "apu") return "generate_apu";
  if (action === "review") return "review_budget";
  if (action === "autocomplete") return "autocomplete_construction_text";
  return "technical_chat";
}

function readOutput(action: AiPromptAction): AiTaskPayload["output"] {
  if (action === "apu") {
    return { format: "json_only", schema: "apu_generation_v1" };
  }

  if (action === "review") {
    return { format: "json_only", schema: "budget_review_v1" };
  }

  if (action === "autocomplete") {
    return { format: "text", schema: "autocomplete_text_v1" };
  }

  return { format: "text", schema: "technical_chat_v1" };
}

function readInput(action: AiPromptAction, payload: Record<string, unknown>): Record<string, string> {
  if (action === "apu") {
    return omitEmptyStrings({
      description: readRequiredString(payload.description, "description"),
      unit: readOptionalString(payload.unit),
    });
  }

  if (action === "review") {
    return {
      budgetSummary: readRequiredString(payload.budgetSummary, "budgetSummary"),
    };
  }

  if (action === "autocomplete") {
    return {
      input: readRequiredString(payload.input, "input"),
    };
  }

  return {
    message: readRequiredString(payload.message, "message"),
  };
}

function readContext(value: unknown): AiContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const context: AiContext = {
    project: readOptionalString(value.project),
    module: readOptionalString(value.module),
    selectedItem: readOptionalString(value.selectedItem),
    unit: readOptionalString(value.unit),
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: readOptionalString(value.activeTable),
  };

  const entries = Object.entries(context).filter(([, entryValue]) => entryValue !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function omitEmptyStrings(value: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
  );
}

function readRequiredString(value: unknown, key: string) {
  const stringValue = readOptionalString(value);
  if (!stringValue) {
    throw new Error(`Missing AI task input: ${key}`);
  }

  return stringValue;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run the payload test to verify it passes**

Run:

```powershell
npm run test -- lib/ai/task-payloads.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib\ai\task-payloads.ts lib\ai\task-payloads.test.ts
git commit -m "feat: add khipu ai task payloads"
```

---

### Task 2: Refactor Prompt Builders Around Task Payloads

**Files:**
- Modify: `lib/ai/prompts.ts`
- Modify: `lib/ai/prompts.test.ts`

- [ ] **Step 1: Add failing prompt tests**

In `lib/ai/prompts.test.ts`, update the import:

```ts
import {
  buildApuPrompt,
  buildAutocompletePrompt,
  buildCatalogApuPrompt,
  buildChatMessages,
  buildPromptFromTaskPayload,
  buildReviewPrompt,
  buildTaskPayloadSystemPrompt,
} from "@/lib/ai/prompts";
```

Add these tests inside `describe("AI prompts", () => { ... })`:

```ts
  it("keeps stable task rules in the system prompt instead of the task payload", () => {
    const systemPrompt = buildTaskPayloadSystemPrompt({ jsonOnly: true });

    expect(systemPrompt).toContain("Eres un asistente tecnico experto");
    expect(systemPrompt).toContain("Responde unicamente con JSON valido");
    expect(systemPrompt).toContain("No modifiques presupuestos automaticamente");
    expect(systemPrompt).toContain("Toda recomendacion debe quedar para revision humana");
  });

  it("renders a clean INPUT JSON payload from an AI task payload", () => {
    const prompt = buildPromptFromTaskPayload({
      task: "generate_apu",
      role: "construction_cost_assistant_peru",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        selectedItem: "Concreto f'c=210",
        unit: "m3",
        currentCost: 420,
      },
      input: {
        description: "Concreto armado f'c=210",
        unit: "m3",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    });

    expect(prompt).toContain("INPUT JSON:");
    expect(prompt).toContain('"task": "generate_apu"');
    expect(prompt).toContain('"schema": "apu_generation_v1"');
    expect(prompt).toContain('"description": "Concreto armado f\'c=210"');
    expect(prompt).not.toContain("instrucciones");
    expect(prompt).not.toContain("formatoSalida");
  });

  it("builds structured APU prompts from a clean task payload while preserving schema instructions", () => {
    const prompt = buildApuPrompt("Concreto armado f'c=210", "m3");

    expect(prompt).toContain("INPUT JSON:");
    expect(prompt).toContain('"task": "generate_apu"');
    expect(prompt).toContain('"schema": "apu_generation_v1"');
    expect(prompt).toContain('"description": "Concreto armado f\'c=210"');
    expect(prompt).toContain('"unit": "m3"');
    expect(prompt).toContain('"humanReviewRequired": true');
    expect(prompt).not.toContain("Devuelve solo un objeto JSON valido sin markdown ni texto adicional.");
  });
```

- [ ] **Step 2: Run prompt tests to verify they fail**

Run:

```powershell
npm run test -- lib/ai/prompts.test.ts
```

Expected: FAIL because `buildPromptFromTaskPayload` and `buildTaskPayloadSystemPrompt` are not exported, and `buildApuPrompt` still uses the legacy string format.

- [ ] **Step 3: Implement system and task prompt helpers**

In `lib/ai/prompts.ts`, add this import:

```ts
import { buildAiTaskPayload, type AiTaskPayload } from "@/lib/ai/task-payloads";
```

Add these helpers after `MYC_AI_SYSTEM_PROMPT`:

```ts
export function buildTaskPayloadSystemPrompt({ jsonOnly }: { jsonOnly: boolean }) {
  return [
    "Eres un asistente tecnico experto en presupuestos de construccion en Peru, APU, metrados, costos, rendimientos y formula polinomica.",
    "Debes ejecutar la tarea indicada en INPUT JSON.",
    "Reglas obligatorias:",
    jsonOnly ? "- Responde unicamente con JSON valido." : "- Responde de forma tecnica, clara, estructurada y profesional.",
    "- No uses markdown cuando el output.format sea json_only.",
    "- No agregues explicacion antes ni despues cuando el output.format sea json_only.",
    "- No uses bloques de codigo.",
    "- No modifiques presupuestos automaticamente.",
    "- No inventes precios exactos.",
    "- Si falta informacion, declara supuestos o datos requeridos.",
    "- Toda recomendacion debe quedar para revision humana.",
  ].join("\n");
}

export function buildPromptFromTaskPayload(payload: AiTaskPayload) {
  return ["INPUT JSON:", JSON.stringify(payload, null, 2)].join("\n");
}
```

- [ ] **Step 4: Refactor specialized prompt builders**

Replace `buildApuPrompt`, `buildReviewPrompt`, and `buildAutocompletePrompt` in `lib/ai/prompts.ts` with:

```ts
export function buildApuPrompt(description: string, unit?: string) {
  return buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "apu",
      payload: {
        description,
        unit,
      },
    }),
  );
}

export function buildReviewPrompt(budgetSummary: string, options: { evidence?: AiEvidence[] } = {}) {
  const evidenceBlock = buildEvidenceSystemMessage(options.evidence ?? []);
  const taskPrompt = buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "review",
      payload: {
        budgetSummary,
      },
    }),
  );

  return [taskPrompt, ...(evidenceBlock ? ["", evidenceBlock] : [])].join("\n");
}

export function buildAutocompletePrompt(input: string) {
  return buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "autocomplete",
      payload: {
        input,
      },
    }),
  );
}
```

- [ ] **Step 5: Update chat message construction to use JSON-only system rules when needed**

In `buildChatMessages`, keep the existing system message for normal chat. Do not switch chat to JSON-only because streaming chat expects natural text:

```ts
export function buildChatMessages({
  message,
  context,
  evidence = [],
}: {
  message: string;
  context?: AiContext;
  evidence?: AiEvidence[];
}): AiMessage[] {
  const contextBlock = buildContextBlock(context);
  const evidenceBlock = buildEvidenceSystemMessage(evidence);

  return [
    { role: "system", content: MYC_AI_SYSTEM_PROMPT },
    ...(contextBlock ? [{ role: "system" as const, content: contextBlock }] : []),
    ...(evidenceBlock ? [{ role: "system" as const, content: evidenceBlock }] : []),
    { role: "user", content: message },
  ];
}
```

Leave this function unchanged if it already matches the block above.

- [ ] **Step 6: Run prompt tests**

Run:

```powershell
npm run test -- lib/ai/prompts.test.ts lib/ai/task-payloads.test.ts
```

Expected: PASS after updating any legacy test expectations from exact text instructions to clean payload assertions.

- [ ] **Step 7: Commit**

```powershell
git add lib\ai\prompts.ts lib\ai\prompts.test.ts
git commit -m "feat: build khipu prompts from task payloads"
```

---

### Task 3: Migrate ChatGPT Bridge Payload In The Workspace

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Update bridge tests for the clean payload**

In `components/ai/AIWorkspace.bridge.test.tsx`, inside `it("sends the active AI request through the browser bridge when ChatGPT Bridge is selected", ...)`, replace the `jsonPrompt` expectation with:

```ts
        jsonPrompt: expect.objectContaining({
          task: "technical_chat",
          role: "construction_cost_assistant_peru",
          output: {
            format: "text",
            schema: "technical_chat_v1",
          },
          input: {
            message: "Consulta inicial",
          },
          guardrails: {
            humanReviewRequired: true,
            noAutomaticBudgetMutation: true,
            noExactPriceFabrication: true,
          },
        }),
```

Add these assertions after the existing `expect((event as CustomEvent).detail).toEqual(...)` block:

```ts
    const bridgePayload = (event as CustomEvent).detail.jsonPrompt;
    expect(bridgePayload).not.toHaveProperty("accion");
    expect(bridgePayload).not.toHaveProperty("instrucciones");
    expect(bridgePayload).not.toHaveProperty("formatoSalida");
```

In `it("omits project id from ChatGPT Bridge prompt payload when project-aware", ...)`, replace:

```ts
    expect((event as CustomEvent).detail.jsonPrompt.payload).toEqual(
```

with:

```ts
    expect((event as CustomEvent).detail.jsonPrompt.input).toEqual(
```

and add:

```ts
    expect(JSON.stringify((event as CustomEvent).detail.jsonPrompt)).not.toContain("project-1");
```

- [ ] **Step 2: Run workspace bridge tests to verify they fail**

Run:

```powershell
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because `buildBridgePrompt` still returns `accion`, `instrucciones`, `payload`, and `formatoSalida`.

- [ ] **Step 3: Refactor `AIWorkspace.tsx` bridge prompt builder**

In `components/ai/AIWorkspace.tsx`, add this import:

```ts
import { buildBridgeTaskPayload } from "@/lib/ai/task-payloads";
```

Replace the existing `buildBridgePrompt` function with:

```ts
function buildBridgePrompt(request: RequestState) {
  return buildBridgeTaskPayload({
    action: request.action,
    payload: request.payload,
  });
}
```

Delete `readBridgeOutputFormat` if it becomes unused.

- [ ] **Step 4: Run workspace bridge tests**

Run:

```powershell
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS. If TypeScript reports `readBridgeOutputFormat` as unused, remove the function.

- [ ] **Step 5: Commit**

```powershell
git add components\ai\AIWorkspace.tsx components\ai\AIWorkspace.bridge.test.tsx
git commit -m "feat: send clean khipu bridge payloads"
```

---

### Task 4: Align The Chrome Bridge Base Prompt

**Files:**
- Modify: `extensiones/MYC-ChatGPT-Bridge-V2/chatgpt-content.js`
- Modify: `extensiones/MYC-ChatGPT-Bridge-V2/README.md`

- [ ] **Step 1: Update extension prompt builder**

In `extensiones/MYC-ChatGPT-Bridge-V2/chatgpt-content.js`, replace `buildPrompt(jsonPrompt, settings)` with:

```js
  function buildPrompt(jsonPrompt, settings) {
    const strictJson = settings?.requireJson !== false && jsonPrompt?.output?.format === "json_only";

    const rules = [
      "Eres un asistente tecnico experto en presupuestos de construccion en Peru, APU, metrados, costos, rendimientos y formula polinomica.",
      "Debes ejecutar la tarea indicada en INPUT JSON.",
      "Reglas obligatorias:",
      strictJson ? "- Responde unicamente con JSON valido." : "- Responde de forma tecnica, clara, estructurada y profesional.",
      "- No uses markdown cuando output.format sea json_only.",
      "- No agregues explicacion antes ni despues cuando output.format sea json_only.",
      "- No uses bloques de codigo.",
      "- No modifiques presupuestos automaticamente.",
      "- No inventes precios exactos.",
      "- Si falta informacion, declara supuestos o datos requeridos.",
      "- Toda recomendacion debe quedar para revision humana."
    ].join("\n");

    return [
      rules,
      "",
      "INPUT JSON:",
      JSON.stringify(jsonPrompt, null, 2)
    ].join("\n");
  }
```

- [ ] **Step 2: Update extension README payload example**

In `extensiones/MYC-ChatGPT-Bridge-V2/README.md`, replace the old `jsonPrompt` example with:

```js
window.dispatchEvent(
  new CustomEvent("MYCBridgeSendPrompt", {
    detail: {
      jsonPrompt: {
        task: "generate_apu",
        role: "construction_cost_assistant_peru",
        output: {
          format: "json_only",
          schema: "apu_generation_v1"
        },
        context: {
          project: "Edificio Multifamiliar",
          selectedItem: "Muro de ladrillo King Kong",
          unit: "m2"
        },
        input: {
          description: "Muro de ladrillo King Kong",
          unit: "m2"
        },
        guardrails: {
          humanReviewRequired: true,
          noAutomaticBudgetMutation: true,
          noExactPriceFabrication: true
        }
      },
      metadata: {
        source: "myc-presupuestos",
        action: "apu"
      }
    }
  })
);
```

Replace the helper example with:

```js
const requestId = sendToMYCChatGPTBridge({
  task: "generate_apu",
  role: "construction_cost_assistant_peru",
  output: {
    format: "json_only",
    schema: "apu_generation_v1"
  },
  input: {
    description: "Concreto f'c=210 kg/cm2",
    unit: "m3"
  },
  guardrails: {
    humanReviewRequired: true,
    noAutomaticBudgetMutation: true,
    noExactPriceFabrication: true
  }
});
```

- [ ] **Step 3: Verify extension prompt references**

Run:

```powershell
rg -n "accion|instrucciones|formatoSalida" extensiones/MYC-ChatGPT-Bridge-V2 components/ai/AIWorkspace.tsx
```

Expected: no matches in `AIWorkspace.tsx`; extension docs may only mention old keys if explicitly describing migration. Remove old example references.

- [ ] **Step 4: Commit**

```powershell
git add extensiones\MYC-ChatGPT-Bridge-V2\chatgpt-content.js extensiones\MYC-ChatGPT-Bridge-V2\README.md
git commit -m "feat: align chatgpt bridge prompt base"
```

---

### Task 5: Update The Prompt Optimization Guide

**Files:**
- Modify: `prd/MYC-Prompt-Optimization-Guide.md`

- [ ] **Step 1: Replace the draft guide with the implemented contract**

Replace the full contents of `prd/MYC-Prompt-Optimization-Guide.md` with:

```md
# MYC Presupuestos - Optimizacion de Prompts para Khipu y ChatGPT Bridge V2

## Objetivo

Khipu debe enviar prompts compactos, consistentes y faciles de mantener. Las reglas estables viven en los prompt builders y en la extension ChatGPT Bridge. La webapp envia un `INPUT JSON` limpio que describe la tarea, el contexto, el formato esperado y los datos de entrada.

## Contrato Vigente

```json
{
  "task": "generate_apu",
  "role": "construction_cost_assistant_peru",
  "output": {
    "format": "json_only",
    "schema": "apu_generation_v1"
  },
  "context": {
    "project": "Edificio Multifamiliar",
    "selectedItem": "Concreto f'c=210",
    "unit": "m3",
    "currentCost": 420
  },
  "input": {
    "description": "Concreto armado f'c=210",
    "unit": "m3"
  },
  "guardrails": {
    "humanReviewRequired": true,
    "noAutomaticBudgetMutation": true,
    "noExactPriceFabrication": true
  }
}
```

## Tasks Soportadas

| Accion UI | task | output.format | output.schema |
| --- | --- | --- | --- |
| chat | technical_chat | text | technical_chat_v1 |
| apu | generate_apu | json_only | apu_generation_v1 |
| review | review_budget | json_only | budget_review_v1 |
| autocomplete | autocomplete_construction_text | text | autocomplete_text_v1 |

## Prompt Base

El prompt base lo inyecta `lib/ai/prompts.ts` para Ollama y `extensiones/MYC-ChatGPT-Bridge-V2/chatgpt-content.js` para ChatGPT Bridge.

Reglas obligatorias:

- Ejecutar la tarea indicada en `INPUT JSON`.
- Responder solo JSON valido cuando `output.format` sea `json_only`.
- No usar markdown ni bloques de codigo en respuestas JSON.
- No modificar presupuestos automaticamente.
- No inventar precios exactos.
- Declarar supuestos o datos requeridos cuando falte informacion.
- Mantener toda recomendacion para revision humana.

## Beneficios

- Menos duplicacion entre webapp y extension.
- Menos tokens por solicitud.
- Salidas mas consistentes.
- Contrato testeable desde TypeScript.
- Mejor compatibilidad entre Ollama, ChatGPT Bridge y futuros proveedores.

## Restricciones

- No enviar `projectId` al ChatGPT Bridge.
- No incluir instrucciones largas dentro del JSON de la webapp.
- No cambiar formulas, calculos financieros ni aplicacion automatica de APU.
- Toda salida estructurada debe seguir validandose en backend antes de mostrarse o aplicarse.
```

- [ ] **Step 2: Verify the guide contains the final task names**

Run:

```powershell
rg -n "technical_chat|generate_apu|review_budget|autocomplete_construction_text|accion|formatoSalida|instrucciones" prd/MYC-Prompt-Optimization-Guide.md
```

Expected: task names are present. `accion`, `formatoSalida`, and `instrucciones` should not appear except if intentionally documenting removed legacy keys; this plan expects no legacy key matches.

- [ ] **Step 3: Commit**

```powershell
git add prd\MYC-Prompt-Optimization-Guide.md
git commit -m "docs: document khipu prompt payload contract"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused AI prompt and bridge tests**

Run:

```powershell
npm run test -- lib/ai/task-payloads.test.ts lib/ai/prompts.test.ts lib/ai/myc-bridge-client.test.ts components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run AI route tests that depend on prompt builders**

Run:

```powershell
npm run test -- app/api/ai/chat/route.test.ts app/api/ai/chat/stream/route.test.ts app/api/ai/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS with no TypeScript or lint errors.

- [ ] **Step 4: Search for legacy bridge payload keys in active webapp code**

Run:

```powershell
rg -n "accion|instrucciones|formatoSalida" app components lib
```

Expected: no active webapp matches for bridge payload construction. Spanish UI copy unrelated to payload keys may remain only if it is user-facing text and not part of the bridge JSON contract.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git status --short
```

Expected: only files touched by this plan are changed before final commit, or a clean tree after commits.

- [ ] **Step 6: Commit final fixes if verification required corrections**

If verification required small corrections:

```powershell
git add lib\ai\task-payloads.ts lib\ai\task-payloads.test.ts lib\ai\prompts.ts lib\ai\prompts.test.ts components\ai\AIWorkspace.tsx components\ai\AIWorkspace.bridge.test.tsx extensiones\MYC-ChatGPT-Bridge-V2\chatgpt-content.js extensiones\MYC-ChatGPT-Bridge-V2\README.md prd\MYC-Prompt-Optimization-Guide.md
git commit -m "fix: stabilize khipu prompt optimization"
```

If no corrections were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan covers clean JSON payloads, reusable prompt rules, Ollama prompt builders, ChatGPT Bridge payloads, extension prompt injection, documentation, and verification.
- Scope control: the plan does not touch financial formulas, automatic budget mutation, APU application, project history, token accounting, runtime model selection, quality metrics, or UI layout beyond bridge payload construction tests.
- Placeholder scan: no incomplete placeholders are intentionally left in tasks or code snippets.
- Type consistency: `AiPromptAction`, `AiTaskName`, `AiOutputFormat`, `AiOutputSchemaName`, and `AiTaskPayload` names are used consistently across tasks.
- Route compatibility: existing `/api/ai/*` route contracts remain unchanged; only prompt contents and bridge JSON payload shape change.
