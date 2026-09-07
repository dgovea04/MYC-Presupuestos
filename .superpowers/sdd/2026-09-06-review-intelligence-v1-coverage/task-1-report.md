# Task 1 report — Normalización de señales V1

## Estado

Implementado y verificado en `C:\MYC-Presupuestos\.worktrees\review-intelligence-v1-coverage`.

## Cambios realizados

- Añadido `lib/review-intelligence/normalization.ts`.
- Añadido `lib/review-intelligence/normalization.test.ts`.
- No fue necesario modificar `lib/review-intelligence/types.ts`.
- No se modificaron extractores, pipeline ni esquema de base de datos.

El módulo nuevo:

- Expone `NormalizedEvidenceMetadata`, `parseDecimalText`, `normalizeEvidenceMetadata` y `classifyEvidenceType`.
- Reconoce aliases de metadata sin distinguir mayúsculas/minúsculas y tolera acentos en los nombres de campos.
- Convierte cantidades y rendimientos a `Decimal` solamente cuando la entrada completa es numérica.
- Rechaza fórmulas, valores vacíos, `NaN`, infinitos y texto numérico incompleto.
- Divide componentes APU por `;`, `,` y `|`, eliminando espacios y entradas vacías.
- Usa `normalizeUnit` para unidades conocidas y conserva el texto recortado de unidades desconocidas.
- Conserva atributos no reconocidos como `Record<string, string>`.
- Clasifica con prioridad determinista: `QUANTITY`, `TECHNICAL_SPECIFICATION`, `APU_COMPONENT`, `UNIT`, `OTHER`.

## TDD

1. Se escribió primero la suite de normalización.
2. La primera ejecución falló porque faltaba el módulo requerido.
3. Se implementó el módulo mínimo para satisfacer los comportamientos especificados.
4. La suite enfocada pasó.

## Verificación

- `npm.cmd test -- lib/review-intelligence/normalization.test.ts`: 1 archivo, 7 tests pasados.
- `npm.cmd test -- lib/review-intelligence`: 25 archivos, 170 tests pasados.
- `node ./node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false`: pasó.
- ESLint sobre `normalization.ts`: sin errores.
- ESLint sobre el test: el repositorio lo ignora por sus patrones configurados; no produjo errores de lint.
- `git diff --check`: sin problemas de whitespace.

La ejecución literal de `npm.cmd run typecheck` no pudo escribir `tsconfig.build.tsbuildinfo` por permisos del worktree (`TS5033/EPERM`). Se verificó el mismo typecheck con `--incremental false`, evitando ese archivo generado, y pasó sin diagnósticos.

## Concerns

- El typecheck del script estándar depende de poder escribir el archivo incremental en el worktree; el código sí pasó el typecheck equivalente sin incremental.
- No se añadió migración ni integración con extractores, conforme al alcance de Task 1.

## Fix report — review round 1

### Findings addressed

- Replaced locale-sensitive `toLocaleLowerCase()` with locale-independent `toLowerCase()` after Unicode accent normalization.
- Changed alias definitions to ordered arrays and lookup to canonical-alias-first precedence, making conflicting metadata deterministic regardless of source object key order.
- Added focused coverage for a locale-sensitive dotted-I key, conflicting aliases, accented `especificación`, and `technicalSpec`.

### TDD evidence

- `npm.cmd test -- lib/review-intelligence/normalization.test.ts` before the implementation fix: 1 failing test (`expected '2' to be '1'`), demonstrating insertion-order alias resolution.
- `npm.cmd test -- lib/review-intelligence/normalization.test.ts` after the fix: 1 file, 10 tests passed.

### Verification after fixes

- `npm.cmd test -- lib/review-intelligence/normalization.test.ts`: 1 file, 10 tests passed.
- `npm.cmd test -- lib/review-intelligence`: 25 files, 173 tests passed.
- The new tests cover locale-independent alias matching, canonical precedence across reversed object insertion order, `especificación`, and `technicalSpec`.

### Final verification note

- The first post-fix strict typecheck reported `TS2345` at `normalization.ts(76,29)`: `recognizedKeys` had inferred a literal-union key type incompatible with the normalized string key lookup.
- The fix explicitly types `recognizedKeys` as `Set<string>`.
- `npm.cmd test -- lib/review-intelligence/normalization.test.ts`: 1 file, 10 tests passed after the type fix.
- `npm.cmd test -- lib/review-intelligence`: 25 files, 173 tests passed after the type fix.
- `node ./node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false`: passed after the type fix.
- No test hang or focused-test blocker occurred.
