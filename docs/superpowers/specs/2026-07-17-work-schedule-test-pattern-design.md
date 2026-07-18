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

## Materialized consumers

Tres Pattern C consumers han rendereado este spec en codigo real:

1. **`lib/data/work-schedule-section.test.ts`** — 4 tests verde contra
   `getWorkScheduleSection`. Materializa el Pattern C demo descrito en
   §"Two usage modes" sin variacion. Verificado en commit `9e6fb52`.

2. **`lib/data/resources-bundle.test.ts`** — 14 tests verde contra
   `resourceMutationTouchesGlobalCatalog` + `prisma.resource.{findMany,
   count, findFirst, create, update, delete}`. Primera extension del
   modulo shared a un handler no-work-schedule (`prisma.resource.*`).
   Demuestra el flujo de extension detallado en §"Extension guide".
   Verificado en commit `126aa90`.

3. **`lib/data/resources-mutating-bundle.test.ts`** — 15 tests verde contra
   `createResource`, `createResourceForUser`, `updateResource`,
   `deleteResource`, `saveResourcesPatch`. Segunda extension: introduce
   un **`vi.mock` adicional** sobre `@/lib/workspace/access` como
   **Pattern D** (multi-layer mock). Verificado en commit `261230e`.

### Pattern D: multi-layer mock (workspace + prisma stubs)

Cuando el codigo bajo test depende transitivamente de **multiples modulos**
que requieren mocks (e.g. mutating resource flows dependen de `prisma` Y de
`@/lib/workspace/access`), anadir `vi.mock` adicionales. Cada uno es
independiente; el orden no importa (vitest los hoistea todos antes de los
static imports):

```typescript
// Mock layer 1 — Prisma in-memory
vi.mock("@/lib/db/prisma", async () => {
  const { makeMockDb } = await import("@/lib/data/__mocks__/in-memory-prisma");
  bundleRef.current = makeMockDb();
  return { prisma: bundleRef.current.prismaMock };
});

// Mock layer 2 — workspace access (stub via vi.mock, NO via vi.spyOn)
vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: vi.fn().mockResolvedValue({
    companyId: "company-mock",
    role: "ADMIN",
  }),
}));

// Static imports - codigo bajo test + workspace mock fn (vitest auto-typea)
import { saveResourcesPatch } from "@/lib/data/resources";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

// Tests pueden verificar el stub:
expect(assertWorkspaceMembership).toHaveBeenCalledWith(
  expect.objectContaining({ userId, companyId, minimumRole: "EDITOR" }),
);
```

Para forzar comportamiento especifico del stub en un test particular:

```typescript
vi.mocked(assertWorkspaceMembership).mockRejectedValueOnce(
  new Error("Forbidden: user is not a member of company"),
);
```

Reset entre tests via `vi.mocked(...).mockClear()` en `afterEach`.

### Pattern variants summary

- **Pattern A** (vi.doMock): mas simple pero pierde auto-reset; OK para
  test suites pequenos con un solo consumer.
- **Pattern C** (vi.mock + vi.hoisted sync shell): canónico para multi-
  consumer reuse. Verificado en 3 tests ahora.
- **Pattern D** (Pattern C + vi.mock adicionales): extension para codigo
  bajo test con dependencias transitivas que requieren mocks.

## When to type handler returns

Inicialmente el modulo shared retornaba `Promise<unknown[]>` /
`Promise<unknown>` para los handlers de `prisma.resource.*` y
`tx.workScheduleItem.*`. Esto forzaba a los consumers a usar
`as MockResource[]` (o equivalente) en cada callsite. Round 6 refactorizo
a retornos tipeados para eliminar los 15 casts en `resources-bundle.test.ts`.

### Breakpoint criteria

De Round 5 → Round 6 registro empirico:

| Criterio | Threshold | Justificación |
|----------|-----------|---------------|
| N consumers del handler | N >= 2 | 1 consumer tolera el cast; >= 2 justifica refactor estructural en el handler. |
| Ratio casts/LOC en consumer | >= 1 cast per 30 LOC | Indica friccion sistematico en el consumer, no anecdote. |
| Handler read vs write | read | Casts prevalentes en validacion de filter results. |
| Consumer dense unwrapping | acceso a > 3 fields del result | Cada field access con cast es overhead. |

Si 2+ criterios se cumplen para un handler, hacer el refactor. Round 6
aplico a `prisma.resource.{findMany, findFirst}` + `tx.workScheduleItem.
{findUnique, findMany}` que cumplieron los 4 criterios.

### Decision algo

```text
1. Override del return es trivial (1-line `Promise<unknown[]>` →
   `Promise<MockResource[]>` sin overload interfaces necesarios)?
   SI: hacer proactivamente en round 1 del modulo. NO requiere Pattern
   decision-tree, es mecanico.
2. Requiere overload interfaces con multiples call signatures
   (select / include / projection narrowing)?
   SI: evitarlas. vitest's `MockedFunction<X>` colapsa overloads al
   signature LAST en callsite resolution (TS18046 / TS2353). En su
   lugar, hacer el handler devolver UNA forma completa + campos
   opcionales en el tipo del entity. Ver trade-off documentado en el
   header de `in-memory-prisma.ts`.
3. Handler es read-only (find / get / count) vs write
   (create / update / delete)?
   READ: typing primero. Casts prevalentes en validation de filter
   results.
   WRITE: typing primero si el consumer necesita seed del return value
   para validaciones downstream (id, timestamps).
```

### Trade-off conocido: fidelity vs typing

Round 6 dropped Prisma's projection behavior en
`prisma.resource.findMany({select: { code: true }})`: el mock ahora
devuelve full `MockResource[]` en vez de `{code: string}[]`. Consumers
pueden leer `.code` u otros fields directamente. El codigo real
(Prisma tipado) devuelve solo los keys pedidos.

Consumers **NO deben depender de shape-narrow detection** tipo
`if ('unitPrice' in result) ...` para distinguir projections. Esto
breakaria contra el mock pero no contra produccion real. Documentar
esta restriccion en cualquier test que mock-ea este handler.

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

## When NOT to use this pattern

El patron in-memory es optimo para el caso comun (CRUD work-schedule con
selectivas queries de una sola tabla). Pero hay escenarios donde el mock
**silenciosamente perderia fidelidad** sin detectar el bug. Estos requieren
**Prisma test client real** (Postgres SQLite binary via `@prisma/client/test`)
o **integration tests contra una DB real** (Docker-compose Postgres).

### 1. Raw SQL via `$queryRaw` / `$executeRaw`

`lib/data/account.ts` usa `prisma.$queryRaw` 6 veces (lineas 85, 174, 202,
224, 242, 258) para queries optimizadas con JOINs y agregaciones que Prisma
typed query builder no soporta bien. `lib/auth/email-verification.ts` y
`lib/auth/options.ts` usan `$queryRaw` + `$executeRaw` para operaciones
transaccionales de verificacion de email (lineas ~42, 47, 84, 93, 102, 108).

**Por que el in-memory mock falla**: el modulo shared NO incluye handlers
para `$queryRaw`/`$executeRaw`. Si un test usa el patron in-memory para codigo
que hace raw SQL, el handler es `undefined` y el test fallara con
`TypeError: prisma.$queryRaw is not a function` — eso es detectable, pero
significa que el patron esta siendo mal aplicado.

**Que usar en su lugar**: mock local con `vi.fn()` que retorne un valor
hard-coded para el SQL especifico bajo test, o `prisma-extension-bundle`
(NO recomendado: requiere setup adicional). No usar el modulo shared.

### 2. Schema migration tests (DDL via raw SQL)

Ejemplo real: `prisma/migrations/20260717005227_prisma7_work_schedule_generation_settings/migration.sql`
incluye CREATE TABLE / CREATE INDEX / ADD FOREIGN KEY CONSTRAINT — esto es
DDL real de Postgres con extension JSONB. NO es mockeable: el motor ejecuta
los statements literal para que tome efecto el schema.

**Por que el in-memory mock falla**: el modulo shared solo modela DML
(SELECT/UPDATE/INSERT/DELETE). Las migraciones ejercitan el motor completo
— si pasan en Postgres real, el validator del query esta implicitamente
tested. Si pasan contra un mock in-memory, no prueban nada.

**Que usar en su lugar**: integration tests con `@prisma/client` contra una
DB de test real (CI runs `docker-compose up postgres` o testcontainers).
Alternativa: `prisma migrate diff` para validar que las migraciones sean
consistentes sin necesidad de DB completa (no ejecuta DDL, solo compara
schema actual vs desired).

### 3. Cross-table joins con `groupBy` / `aggregate`

Cuando el codigo usa `prisma.X.groupBy({by:[...], _count, _sum})` o
`prisma.X.aggregate({_count, _avg})`, el handler in-memory tendria que
implementar todo el SQL GROUP BY algebra. En la practica el codigo del
proyecto prefiere `findMany` + reduce in-process en vez de `groupBy`
(ver `lib/work-schedule/` donde se hace aggregation en TypeScript).

**Por que el in-memory mock falla**: si en el futuro alguien escribe
`prisma.budget.groupBy({by:["kind"], _count:true})`, el mock no devolveria
el shape correcto y el test pasaria con falso positivo.

**Que usar en su lugar**: Prisma test client real o `prisma-mock` library.
Como higiene, agregar una busqueda pre-test: `grep -rn '\.groupBy\|\.aggregate' lib/`
para confirmar que el codigo bajo test no depende de aggregations.

### 4. Prisma middleware / extensions (`prisma.$use`)

Si algun modulo set up un middleware como `auditLogger` via
`prisma.$use(async (params, next) => {...})`, el in-memory mock no respeta
el middleware flow — los tests pasan pero la auditoria real estaria deshabilitada
en produccion o viceversa.

**Verificar pre-test**: `grep -rn 'prisma.\$use\|Prisma.plugins' lib/`. Si
existe middleware, no usar este patron o agregar handler explicito para
`$use` en el modulo shared (raro, pero existe).

### 5. Tipos derivados de introspeccion (Prisma.JsonValue, Prisma.Decimal)

El modulo shared usa `MockedFunction<...>` y tipos a mano para los handlers
porque Prisma genera tipos via introspection al `prisma generate` runtime.
Hay clases de types como `Prisma.Decimal` (usado en `account.ts` para
montos) que NO estan representadas trivialmente en mocks — el handler tendria
que importar `Prisma.Decimal` y reconstruir el wrapper. Si un test espera
que `partial instanceof Prisma.Decimal` retorne true, el in-memory mock
fallara silenciosamente devolviendo un `number` nativo.

**Verificar pre-test**: revisar `lib/calculations/` y `lib/db/serializers.ts`
para ver si dependen de `Prisma.Decimal` instances. Si los tests son
unit-test pure functions, no usan Prisma directamente y este patron es seguro.
Si los tests son integration con el modulo `lib/data/`, hay que extender el
mock con `Prisma.Decimal` reconstruction.

### Decision checklist antes de aplicar este patron

Antes de escribir un test nuevo con este modulo shared, verificar:

- [ ] El codigo bajo test NO usa `$queryRaw` o `$executeRaw`
- [ ] El codigo bajo test NO trigger schema migrations
- [ ] El codigo bajo test NO usa `groupBy`/`aggregate` (o si los usa,
      considerar Prisma test client real)
- [ ] El proyecto NO set up `prisma.$use` middleware (o ya esta manejado)
- [ ] Los campos Decimal/Json son serializados antes de llegar al codigo
      bajo test (o el mock los reconstruye explicitamente)

Si todos los checks pasan, el patron aplica. Si cualquiera falla, evaluar
las alternativas en cada subseccion arriba.

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
