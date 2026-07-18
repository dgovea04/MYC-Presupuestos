# Work-schedule in-memory Prisma mock pattern

> Spec del patrón de mocking de Prisma in-memory usado por los tests del
> módulo work-schedule. Mantenido por futuros tests que consuman
> `lib/data/__mocks__/in-memory-prisma.ts` y por extensiones del patrón a
> nuevos módulos (apu, presupuesto, recursos).
>
> Companion al código en `lib/data/__mocks__/in-memory-prisma.ts` y al consumer
> de ejemplo en `lib/data/work-schedule-pipeline-integration.test.ts`.

## Goal

Definir un patrón reutilizable de mocking de Prisma para tests de la capa
`lib/data/*` que:

1. Use un store en memoria (Map + plain objects) sin requerir Docker ni un
   Postgres real.
2. Permita cover con contratos de dominio completos los entry points
   `saveWorkScheduleItem`, `saveWorkScheduleItemPatch`,
   `generateWorkScheduleBase`, `previewWorkScheduleBase`,
   `getWorkScheduleSection`, y todos los futuros.
3. Sea extensible — futuros tests pueden agregar sub-budgets o partidas
   custom sincopiar el factory entero.
4. Reduzca el boilerplate de cada test (`~50 LOC` por consumer nuevo) y
   elimine la necesidad de `vi.hoisted` ceremony.

## Context

Antes de este patrón, los tests que querían cruzar `lib/data/work-schedule.ts`
con su lógica de queries Prisma tenían tres opciones:

- **Real DB (Postgres + Docker)**: lento, flake-prone, requiere infrastructure
  en CI. Bloquea iteraciones rápidas.
- **Prisma test client (binary)**: posible pero introduce coupling fuerte al
  generated client. Hard-to-debug.
- **`vi.hoisted` con mock inline** (lo que hacíamos ad-hoc): efectivo pero el
  boilerplate (~120 lineas de handlers) se duplicaba en cada test. Y cada
  nuevo tests debía recordar re-listar los `vi.fn` en el reset.

El commit `eb1fdbc` introduce `lib/data/__mocks__/in-memory-prisma.ts`
compartido + reduzca el pipeline test de **502 → 268 LOC**. Vitest sigue
3/3 verde, TS 0 nuevos errores (baseline 338 mantenido).

## Architecture

### Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Test file (e.g. work-schedule-pipeline-integration.test.ts)              │
│                                                                          │
│   vi.mock("@/lib/db/prisma", async () => {                               │
│     const { prismaMock } = await import(".../in-memory-prisma");         │
│     return { prisma: prismaMock };                                        │
│   });                                                                     │
│                                                                          │
│   import { mockDb, resetInMemoryState, populateDefaultWorkScheduleFixture, │
│            ... } from ".../in-memory-prisma";                             │
│                                                                          │
│   beforeEach(() => { resetInMemoryState();                                │
│                      populateDefaultWorkScheduleFixture();                │
│   });                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │ dynamic import + module cache
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ lib/data/__mocks__/in-memory-prisma.ts (~675 LOC)                        │
│                                                                          │
│   Types: MockDb, MockTx, PrismaMock, InMemoryPrisma, Mock*Item, ...      │
│   Constants: DEFAULT_BUDGET_ID, DEFAULT_SUB_BUDGET_ID, ...               │
│   Factories: createMockTx(mockDb), createPrismaMock(mockDb, mockTx),     │
│              createReset(mockDb, mockTx, prismaMock),                    │
│              populateDefaultWorkScheduleFixtureImpl(mockDb),            │
│              addMockBudgetItemImpl / addMockSubBudgetImpl               │
│   Public API: makeMockDb() → { mockDb, mockTx, prismaMock, ... }         │
│   Default singleton: mockDb / mockTx / prismaMock / resetInMemoryState() │
└──────────────────────────────────────────────────────────────────────────┘
                                  │ invoca `$transaction(cb)` callback
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ lib/data/work-schedule.ts (codigo bajo test, sin cambios)                │
│                                                                          │
│   saveWorkScheduleItem(budgetId, userId, input)                          │
│     → prisma.budget.findFirst, prisma.budget.findMany,                   │
│       prisma.budgetItem.findFirst,                                       │
│       prisma.$transaction(async tx => {                                  │
│         tx.workSchedule.upsert / findUnique,                            │
│         tx.workScheduleItem.findUnique / create / update,                │
│         tx.workScheduleDistribution.deleteMany                           │
│       }),                                                                │
│       prisma.workSchedule.findUnique (read-back)                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### `vi.mock` + dynamic-import pattern (elimina `vi.hoisted`)

Vitest hoiste el factory de `vi.mock(...)` al top del archivo antes de los
imports. El problema clásico de `vi.mock("@/lib/db/prisma", () => ({...}))` es
que el factory no puede capturar closures del archivo (vi.mock factories no
permiten referencias a variables top-level declaradas con let/const en el
archivo sin `vi.hoisted`).

**La solucion**: usar `await import(...)` dentro del factory. El hoisting de
Vitest sigue aplicando pero el resolve del modulo ocurre en runtime via
Node module cache, asi que el singleton del modulo `in-memory-prisma` queda
capturado por referencia.

```typescript
// top of test file:
vi.mock("@/lib/db/prisma", async () => {
  const { prismaMock } = await import("@/lib/data/__mocks__/in-memory-prisma");
  return { prisma: prismaMock };
});

// imports DEBAJO del vi.mock — Vitest levanta el factory antes de evaluar
// `import { saveWorkScheduleItem } from "@/lib/data/work-schedule";`
import { saveWorkScheduleItem } from "@/lib/data/work-schedule";
```

Verificado: vitest 3/3 verde + tsc 0 nuevos errores con esta configuración
(`work-schedule-pipeline-integration.test.ts` commit `eb1fdbc`).

### Two usage modes

#### 1. Default singleton (backward compatible, 80% de casos)

```typescript
import {
  mockDb,
  mockTx,
  resetInMemoryState,
  populateDefaultWorkScheduleFixture,
} from "@/lib/data/__mocks__/in-memory-prisma";

beforeEach(() => {
  resetInMemoryState();                 // limpia state + mockClear todos los vi.fn
  populateDefaultWorkScheduleFixture(); // 1 budget GENERAL + 1 sub-budget + 3 partidas
});

it("...", async () => {
  await saveWorkScheduleItem(BUDGET_ID, USER_ID, input);
  expect(mockDb.workScheduleItems.size).toBe(1);
});
```

`resetInMemoryState()` itera todos los `vi.fn` via `collectAllMockFns()` (recorre
recursivamente con `vi.isMockFunction(v)` + `WeakSet` dedup). Si el modulo se
extiende con nuevos `vi.fn`, el reset los captura automaticamente — no hay
lista hardcoded que mantener.

#### 2. `makeMockDb()` factory con isolation (tests concurrentes / multi-fixture)

**Limitacion del naive sync vi.hoisted**: el patron
`vi.hoisted(() => makeMockDb())` — donde el callback llama directamente a
`makeMockDb()` referenciando el import estatico — NO funciona en vitest,
porque `vi.hoisted` corre ANTES de que los imports estaticos esten
inicializados (`ReferenceError: Cannot access '__vi_import_0__' before
initialization`). Solo se puede llamar `makeMockDb()` DENTRO de async paths.

**Pattern C (recomendado, copy-pasteable, verified)**:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InMemoryPrisma } from "@/lib/data/__mocks__/in-memory-prisma";

// 1. vi.hoisted declara un SHELL sincronico (sin referencias a imports).
//    vi.hoisted se ejecuta antes de los static imports, asi que el callback
//    debe retornar solo valores "primitivos" (objetos sync, sin imports).
const bundleRef = vi.hoisted<{ current: InMemoryPrisma | null }>(() => ({
  current: null,
}));

// 2. vi.mock factory awaits import + popula el shell. Aqui si se puede
//    hacer await import() porque el factory de vi.mock corre DESPUES de que
//    los static imports esten inicializados.
vi.mock("@/lib/db/prisma", async () => {
  const { makeMockDb } = await import("@/lib/data/__mocks__/in-memory-prisma");
  bundleRef.current = makeMockDb();
  return { prisma: bundleRef.current.prismaMock };
});

// 3. Imports DEBAJO del vi.mock — codigo bajo test importa normalmente.
import { getWorkScheduleSection } from "@/lib/data/work-schedule";

// 4. Helper para acceder el bundle populado (defensivo si algo se rompe).
function requireBundle(): InMemoryPrisma {
  if (bundleRef.current === null) {
    throw new Error("Bundle no inicializado; vi.mock factory debio correr primero.");
  }
  return bundleRef.current;
}

describe("...", () => {
  beforeEach(() => {
    const bundle = requireBundle();
    bundle.reset();
    bundle.populateDefault();
  });

  it("...", async () => {
    requireBundle().addMockBudgetItem({ id: "...", code: "...", ... });
    const view = await getWorkScheduleSection("budget-001", "user-001");
    expect(view.groups.length).toBe(1);
    // ...
  });
});
```

**Materializado como demo**: `lib/data/work-schedule-section.test.ts` usa
exactamente este patron, con 4 tests verde contra `getWorkScheduleSection`.
bundle.mockDb / bundle.mockTx / bundle.prismaMock / bundle.addMockBudgetItem
estan todos accesibles sincronicamente via `requireBundle()` despues de que el
vi.mock factory haya corrido (siempre cierto al momento de ejecutar tests).

**Pattern alternativo (Pattern A: vi.doMock, no hoisted)**:

```typescript
import { makeMockDb } from "@/lib/data/__mocks__/in-memory-prisma";
const bundle = makeMockDb(); // top-level, sync
beforeAll(() => {
  vi.doMock("@/lib/db/prisma", () => ({ prisma: bundle.prismaMock }));
});
import { saveWorkScheduleItem } from "@/lib/data/work-schedule";
// tests use `bundle.mockDb.X` etc directamente
```

Este es mas simple que Pattern C, pero `vi.doMock` no es hoisted y debe
llamarse dentro de `beforeAll` o antes de los tests. Funciona correctamente
en vitest pero pierde algunas de las features automatic mock-reset de
`vi.mock`.

## Fixture conventions

### Default fixture (3 partidas baseline)

```
projectId:        project-001
budgetGeneral:    { id: 'budget-001', currency: 'PEN', name: 'Presupuesto Test General',
                    project: { projectCalendars: [] } }
subBudget:        { id: 'sub-budget-001', name: 'Estructuras', levels: [level-01] }
items:            [
  { id: 'cline_excav_001', code: '01.01', description: 'Excavacion manual de zanjas',
    unit: 'm3', quantity: 250, unitPrice: 25, partial: 6250 },
  { id: 'cline_cim_002', code: '01.02', description: 'Cimentacion corrida de concreto',
    unit: 'm3', quantity: 45, unitPrice: 85, partial: 3825 },
  { id: 'cline_est_003', code: '01.03', description: 'Estructura de concreto armado',
    unit: 'm3', quantity: 120, unitPrice: 150, partial: 18000 },
]
```

Cubre el 90% de los tests del work-schedule (save + cascade + critical-path).
Partidas codificadas 01.01/01.02/01.03 permiten tests de predecessor FS puro
sin configurar nada.

### Customizing fixtures

`addMockBudgetItem(overrides: Partial<MockBudgetItem> & { id: string })` —
agrega o reemplaza una partida en el primer sub-budget. Util para extender
el default:

```typescript
populateDefaultWorkScheduleFixture();
addMockBudgetItem({ id: 'cline_extra_004', code: '01.04', description: 'Losa aligerada', unit: 'm2', quantity: 80 });
```

`addMockSubBudget(overrides: Partial<MockSubBudget> & { id: string; name: string })` —
agrega un sub-budget adicional. Util para tests multi-sub-budget.

### Required pre-populate state

Los helpers `addMock*` lanzan `Error` si no se ha llamado
`populateDefaultWorkScheduleFixture()` antes — esto previene mutaciones
sobre state vacío.

## Handler coverage (narrow-but-sufficient)

El modulo no pretende cubrir TODOS los callsites de Prisma — solo los que
`lib/data/work-schedule.ts` actualmente consume. Si se extiende a otros
modulos (recursos, presupuesto, APU), agregar handlers segun necesidad.

### Callsites cubiertos

| Operation                                  | Callsite                                       | Handler |
| ------------------------------------------ | ---------------------------------------------- | ------- |
| `prisma.budget.findFirst`                  | `getAccessibleGeneralBudget`                   | ✓       |
| `prisma.budget.findMany`                   | `getSubBudgetsForProject`                      | ✓       |
| `prisma.budgetItem.findFirst`              | `validateWorkSchedulePredecessors`             | ✓       |
| `prisma.workSchedule.findUnique`           | `loadWorkScheduleDataset`                      | ✓       |
| `prisma.$transaction(cb)`                  | all save paths                                 | ✓       |
| `tx.workSchedule.upsert`                   | save flow                                      | ✓       |
| `tx.workSchedule.findUnique`               | save flow                                      | ✓       |
| `tx.workScheduleItem.findUnique`           | save flow (idempotency check)                  | ✓       |
| `tx.workScheduleItem.findMany`             | cascade save                                   | ✓       |
| `tx.workScheduleItem.create`               | save flow                                      | ✓       |
| `tx.workScheduleItem.update`               | save flow                                      | ✓       |
| `tx.workScheduleDistribution.deleteMany`   | save flow (replace distributions)              | ✓       |

### Lo que NO cubre (intencionalmente narrow)

- **`prisma.resource.*`** (carga de APU resources) — los fixtures usan
  `apu: null`. Si un test necesita resources reales, debera poblar el APU
  en el fixture y extender el handler en este modulo.
- **`prisma.projectCalendar.*`** — el fixture tiene `projectCalendars: []`
  (default = cada dia trabaja). Tests con calendar customized deben poblar
  el campo y posiblemente extender `validateWorkScheduleInput`.
- **`prisma.workSchedule.findUnique` con `include: { items: { include: { distributions } } }`**
  — el handler actual soporta `include: { items }` y agrega distributions
  inline. NO soporta niveles de include mas profundos.

## Trade-offs

### Pros

- **Boilerplate reduction**: cada test nuevo ahorra ~290 LOC vs duplicar el
  factory inline.
- **Type-safe**: todos los vi.fn estan tipados via `MockedFunction<...>`,
  ASI el consumer recibe autocomplete y refactor friendliness.
- **True isolation** via `makeMockDb()` para tests que lo necesiten.
- **No magic lists**: `collectAllMockFns()` es programatico, sobrevive a
  extensiones del modulo sin necesidad de actualizar reset.

### Cons

- **`test.concurrent` isolation fragility**: el singleton default comparte state
  cross-tests dentro del mismo archivo. Si dos tests corren concurrentes
  (`test.concurrent`) sin pasar por el bundle factory, mutaran el mismo
  `mockDb` y habran undefined behavior. Mitigacion: en modo concurrente, usar
  `makeMockDb()` (modo 2) por test.
- **Module-level side effect**: `const _default = makeMockDb()` corre al
  cargar el modulo via import. Si el modulo se importa sin vi.mock
  (transitively por otra cosa), el singleton se inicializa inutilmente.
  ~ms-cost, no impactful.
- **Dual API maintenance**: top-level wrappers (`addMockBudgetItem`,
  `addMockSubBudget`) marcadas `@deprecated` coexisten con el bundle method.
  Es 2-line wrappers pero es ruido de contrato. Follow-up: prune las
  wrappers o quitar el `@deprecated`.

## Extension guide for new modules

Para extender el patrón a `lib/data/resources.ts` o `lib/data/access.ts`:

1. **Inventariar las prisma callsites** del modulo target (grep
   `prisma.X.Y` en el archivo, listar todas las operations).
2. **Agregar handlers nuevos** en `createPrismaMock(mockDb, mockTx)` para
   cada callsite nuevo. Pattern: leer el state del `mockDb.X.Y` mock y
   retornar lo que el consumer espera.
3. **Extender el state** del MockDb con los fields necesarios
   (`mockDb.resources: Map<...>`, etc.). Si la entidad nueva no encaja
   en los Maps existentes, agregar nuevos Map<key, entity>.
4. **Extender `populateDefaultWorkScheduleFixtureImpl`** con los campos
   nuevos (e.g. resources populados si los fixtures los necesitan).
5. **Extender `resetInMemoryState`** — NO requiere cambios si ya usa
  `collectAllMockFns()`; el reset captura los nuevos vi.fn automaticamente.
6. **Agregar un test consumer demoplaza** (e.g. `resources.test.ts` con
   el `vi.mock("@/lib/db/prisma", ...)` pattern + 1-2 assertions que
   ejerciten los handlers nuevos). Sigue el § "two usage modes" arriba.

## Reference

- `lib/data/__mocks__/in-memory-prisma.ts` — module completo
  (675 LOC, types + constantes + factories + reset + populate + addMock helpers).
- `lib/data/work-schedule-pipeline-integration.test.ts` — consumer de
  ejemplo, 3 tests con assertions exactas (projectDurationDays=30 en FS puro,
  cascade lazy-shift = projectDurationDays=36, idempotency call counts).
- Commit `eb1fdbc` — `refactor(data-work-schedule): extract in-memory prisma mock to reusable module`.
- AGENTS.md — `Use TypeScript strict mode + Never use any`. El modulo usa
  `MockedFunction<(...args: unknown[]) => unknown>` para respetar esta regla.
