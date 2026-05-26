# AI APU Skill — MYC Presupuestos

## Purpose

Use this skill when building, improving, debugging, or reviewing features related to AI-assisted generation of **Análisis de Precios Unitarios (APU)** for MYC Presupuestos.

The goal is to help the system generate editable APU proposals using:

- Similar existing partidas
- Existing catalog resources
- Strict JSON output
- Backend validation
- Human review before saving

This skill is designed for a construction budgeting SaaS focused on Peru and Latin American workflows.

---

## Core Principle

The AI must never act as an uncontrolled estimator.

The AI should behave as a **technical assistant** that adapts existing structured data.

The system should prioritize:

1. Reusing similar partidas
2. Reusing existing catalog resources
3. Preserving units and resource types
4. Returning structured JSON only
5. Flagging uncertainty for human review

---

## Mandatory AI Rules

When generating or modifying an APU, always enforce these rules:

1. Use similar partidas as the primary reference.
2. Preserve the structure of the most similar partida when technically reasonable.
3. Use only resources provided in `matchingResources`.
4. Never invent resource IDs, names, units, codes, or categories.
5. Never create placeholder values such as:
   - `matchingResources[0].id`
   - `example-resource-id`
   - `id-de-partida`
   - `Ejemplo de Material`
6. If a required resource is missing, add it to `suggested_new_resources`, not to `items`.
7. Return only valid JSON when the API requires structured output.
8. Mark uncertain rows with `requires_review: true`.
9. Set `requires_human_review: true` for AI-generated APUs.
10. Do not save AI-generated APUs directly without backend validation and user confirmation.
11. Do not change units unless the backend provides an explicit conversion rule.
12. Do not convert resource categories manually.
13. Do not replace a material, labor, equipment, or tool with a weak semantic match.
14. Do not include resources outside the provided catalog context.
15. Always assume the backend will validate the AI response before showing or saving it.

---

## Allowed Item Types

APU item `type` must be one of:

```ts
'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'TOOLS'
```

The item `source` must always be:

```ts
'catalog'
```

---

## Recommended Output Shape

AI-generated APU proposals should follow this structure:

```ts
type AiApuProposal = {
  partida_name: string
  unit: string
  based_on_partida_id?: string
  confidence: number
  items: AiApuItem[]
  suggested_new_resources: SuggestedNewResource[]
  warnings: string[]
  requires_human_review: true
}

type AiApuItem = {
  resource_id: string
  name: string
  type: 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'TOOLS'
  unit: string
  quantity: number
  source: 'catalog'
  requires_review: boolean
}

type SuggestedNewResource = {
  type: 'suggested_new_resource'
  reason: string
  based_on: string
}
```

---

## Backend Validation Requirements

Never trust the LLM response directly.

Before displaying or saving a generated APU, validate:

### JSON validation

- Response is valid JSON.
- No markdown or extra text is included.
- Required keys exist.
- No unexpected keys exist.
- Numeric fields are numbers, not strings.

### Catalog validation

For every item:

- `resource_id` exists in `matchingResources`.
- `name` exactly matches the catalog resource name.
- `unit` exactly matches the catalog resource unit.
- `type` matches the catalog category or approved internal mapping.
- `source` equals `catalog`.

### Quantity validation

- Quantity is a number.
- Quantity is greater than or equal to 0.
- Quantity is technically reasonable compared with similar partidas.
- Abnormal quantities are flagged for review.

### Safety validation

Reject or quarantine the proposal if:

- It uses unknown resources.
- It invents resource IDs.
- It includes placeholder values.
- It includes resources not present in `matchingResources`.
- It includes unsupported item types.
- It changes units without a backend-approved conversion.

---

## Recommended Zod Schema

Use a strict schema similar to this:

```ts
import { z } from 'zod'

export const aiApuItemSchema = z.object({
  resource_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'TOOLS']),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  source: z.literal('catalog'),
  requires_review: z.boolean(),
}).strict()

export const suggestedNewResourceSchema = z.object({
  type: z.literal('suggested_new_resource'),
  reason: z.string().min(1),
  based_on: z.string().min(1),
}).strict()

export const aiApuProposalSchema = z.object({
  partida_name: z.string().min(1),
  unit: z.string().min(1),
  based_on_partida_id: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  items: z.array(aiApuItemSchema),
  suggested_new_resources: z.array(suggestedNewResourceSchema),
  warnings: z.array(z.string().min(1)),
  requires_human_review: z.literal(true),
}).strict()
```

---

## APU Generation Flow

Use this flow when implementing AI APU generation:

```txt
User enters partida name + unit
        ↓
Normalize query
        ↓
Search similar partidas
        ↓
Search matching catalog resources
        ↓
Build compact AI context
        ↓
Send controlled prompt to local or external LLM
        ↓
Receive JSON proposal
        ↓
Validate JSON schema
        ↓
Validate catalog references
        ↓
Calculate backend confidence
        ↓
Show editable proposal to user
        ↓
User reviews / edits / accepts
        ↓
Save only after confirmation
```

---

## Similar Partida Strategy

The AI should not generate an APU from zero when similar partidas exist.

Use similar partidas to preserve:

- Labor composition
- Resource structure
- Material ratios
- Equipment usage
- Tools percentage
- Performance assumptions
- Unit-specific logic

### Good behavior

For query:

```txt
ACERO DE REFUERZO F'Y = 4200 KG/CM2
```

If the most similar partida already includes:

- CAPATAZ
- OPERARIO
- OFICIAL
- PEON
- ALAMBRE NEGRO N° 16
- ACERO CORRUGADO
- HERRAMIENTAS MANUALES

The AI should preserve that structure and only adapt names/resources when valid matches exist in `matchingResources`.

### Bad behavior

The AI should not add resources such as:

- Welding machine
- Crane
- Cement
- Sand
- New steel item

unless they exist in `matchingResources` and are technically justified.

---

## Resource Matching Rules

When matching resources:

1. Prefer exact or near-exact semantic matches.
2. Prefer resources with the same unit.
3. Prefer resources with the same category.
4. Avoid replacing one category with another.
5. Avoid resources with low confidence unless marked for review.
6. If a resource is missing, add a suggested new resource instead of inventing one.

### Required resource copy behavior

When using a resource, copy these fields exactly from `matchingResources`:

- `id` → `resource_id`
- `name` → `name`
- `unit` → `unit`
- `category` → `type`

Do not copy from `similarPartidas.apuRows.description` if the equivalent catalog resource name differs.

---

## Confidence Scoring

Do not rely only on the LLM confidence value.

Calculate backend confidence using objective signals.

Recommended formula:

```txt
confidence =
  similarPartidaScore * 0.50 +
  resourceMatchScore * 0.35 +
  structureSimilarityScore * 0.15
```

### Suggested interpretation

| Confidence | Meaning | UX Treatment |
|---|---|---|
| 0.85–1.00 | Strong match | Show as high-confidence draft |
| 0.65–0.84 | Usable with review | Show warnings and review badges |
| 0.40–0.64 | Weak proposal | Require careful review |
| 0.00–0.39 | Unsafe | Do not auto-generate full APU |

Always keep `requires_human_review: true`.

---

## UI Requirements

AI APU generation should feel like a professional copilot, not a chatbot.

Recommended UI pattern:

### Main area

Editable APU table with:

- Resource name
- Type
- Unit
- Quantity
- Unit price
- Partial cost
- Review badge
- Source badge

### Side panel

Show:

- Similar partidas used
- Confidence score
- Matching resources used
- Missing resources suggested
- Warnings
- Validation status

### User actions

Provide actions such as:

- Accept proposal
- Edit row
- Remove row
- Replace resource
- Regenerate with another reference
- View similar partida
- Save as draft

---

## UX Copy Guidelines

Use clear technical language.

Good labels:

- `Propuesta generada por IA`
- `Requiere revisión`
- `Basado en partida similar`
- `Recurso del catálogo`
- `Recurso sugerido`
- `Validación pendiente`
- `No guardar sin revisión técnica`

Avoid vague labels:

- `Magic result`
- `Perfect estimate`
- `AI knows best`
- `Autogenerated final cost`

---

## Prompt Template for Local LLM / Ollama

Use a compact prompt with strict rules.

```txt
You are an expert assistant for construction unit price analysis in Peru.

Mandatory rules:
1. Use similarPartidas as the primary reference.
2. Preserve the most similar APU structure when technically reasonable.
3. Use only resources from matchingResources.
4. Never invent resource IDs, names, units, or categories.
5. If a resource is missing, add it to suggested_new_resources, not items.
6. Return only valid JSON.
7. Mark uncertain data with requires_review=true.
8. The backend will validate your output before showing it to the user.
9. In items, type must be MATERIAL, LABOR, EQUIPMENT, or TOOLS.
10. In items, source must be catalog.
11. In items, name and unit must be strings copied from matchingResources.
12. In items, quantity must be a number.
13. Never write placeholders.
```

---

## Local LLM Recommendations

When using Ollama, prioritize consistency over creativity.

Recommended settings:

```json
{
  "temperature": 0.1,
  "top_p": 0.8,
  "repeat_penalty": 1.1,
  "num_ctx": 8192
}
```

For JSON-only generation:

- Use low temperature.
- Use compact context.
- Provide a valid output example.
- Validate output server-side.
- Retry once with validation errors if needed.

---

## Retry Strategy

If validation fails, do not silently accept the result.

Use a repair prompt:

```txt
The previous JSON failed validation.
Return a corrected JSON object only.
Do not add markdown.
Do not add explanation.
Validation errors:
{{errors}}
Original allowed matchingResources:
{{matchingResources}}
Previous response:
{{previousResponse}}
```

Limit retries to avoid loops.

Recommended:

- 1 generation attempt
- 1 repair attempt
- then show error to user

---

## Editable Draft Behavior

AI output should be treated as a draft.

Before saving:

- User must review rows.
- User must confirm quantities.
- User must approve suggested resources if any.
- Backend must pass validation.

Never auto-save generated APUs directly to production catalog.

---

## Suggested File Organization

Recommended structure:

```txt
lib/ai/apu/
  build-apu-context.ts
  generate-apu-proposal.ts
  validate-apu-proposal.ts
  calculate-apu-confidence.ts
  repair-apu-json.ts
  apu-ai-schema.ts

app/api/ai/apu/generate/route.ts

components/apu-ai/
  AiApuPanel.tsx
  AiApuProposalTable.tsx
  AiApuWarnings.tsx
  SimilarPartidasList.tsx
  SuggestedResourcesList.tsx
```

---

## API Route Expectations

The APU generation API should:

1. Receive query, unit, category, and optional project type.
2. Fetch similar partidas.
3. Fetch matching resources.
4. Build compact context.
5. Call Ollama or configured LLM provider.
6. Parse JSON.
7. Validate schema.
8. Validate catalog resources.
9. Calculate backend confidence.
10. Return a safe proposal object.

Do not expose raw LLM output directly to the client.

---

## Database Considerations

Useful tables or models:

```txt
resources
resource_aliases
partidas
apu_rows
ai_apu_generations
ai_apu_validation_errors
ai_suggested_resources
```

### Recommended logging

Store generation logs for debugging:

- query
- selected similar partidas
- selected matching resources
- provider/model used
- validation result
- warnings
- accepted/rejected status

Do not store unnecessary sensitive user data.

---

## Testing Requirements

Add tests for:

- Valid JSON response
- Invalid JSON response
- Unknown resource ID rejection
- Placeholder rejection
- Incorrect unit rejection
- Incorrect item type rejection
- Missing resource moved to `suggested_new_resources`
- Similar partida structure preservation
- Backend confidence calculation

---

## Example: Correct Generated APU

```json
{
  "partida_name": "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
  "unit": "KG",
  "based_on_partida_id": "cmpacm81h01osu9wstrwy5q2e",
  "confidence": 0.95,
  "items": [
    {
      "resource_id": "cmpacm6lv000cu9wsgs3xfwkn",
      "name": "CAPATAZ",
      "type": "LABOR",
      "unit": "HH",
      "quantity": 0.0032,
      "source": "catalog",
      "requires_review": true
    },
    {
      "resource_id": "cmpacm6m4000ou9wsh6641jfs",
      "name": "OPERARIO",
      "type": "LABOR",
      "unit": "HH",
      "quantity": 0.032,
      "source": "catalog",
      "requires_review": true
    }
  ],
  "suggested_new_resources": [],
  "warnings": [
    "La propuesta replica la estructura de la partida similar encontrada y requiere revisión humana antes de guardarse."
  ],
  "requires_human_review": true
}
```

---

## Implementation Priorities

When implementing this feature, prioritize in this order:

1. Strict schema validation
2. Catalog resource validation
3. Similar partida retrieval
4. Matching resource retrieval
5. AI generation
6. Editable review UI
7. Confidence scoring
8. Logging and audit trail
9. Resource suggestion workflow
10. Advanced regeneration options

---

## Definition of Done

The AI APU feature is acceptable when:

- The AI cannot save invalid resources.
- The AI cannot invent catalog items.
- The AI returns strict JSON only.
- Backend validation rejects unsafe output.
- User can review and edit before saving.
- The proposal clearly shows similar partida references.
- Every row shows whether it requires review.
- Missing resources are separated from valid catalog items.
- Generated APUs are traceable through logs.

