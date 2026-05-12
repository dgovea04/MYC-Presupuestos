# Default Budget Rates Settings Design

## Summary

This phase turns the current static "Porcentajes por defecto" recommendation in `Configuracion` into a real, centralized settings feature.

The application will persist three new user preferences in `UserSettings`:

- `defaultIgvRate`
- `defaultGeneralExpensesRate`
- `defaultUtilityRate`

These values will be stored in the domain as decimal rates:

- `0.18`
- `0.10`
- `0.08`

But the settings UI will display and edit them as human-readable percentages:

- `18`
- `10`
- `8`

The same settings source will drive both:

- automatic creation of new project budgets,
- manual forms that currently hardcode budget rate suggestions.

Existing budgets must keep their current rates. This phase only changes future suggestions and future record creation.

## Current State

The system currently hardcodes budget default rates in more than one place.

### Project Creation

`lib/data/projects.ts` defines `defaultBudgetRates` with:

- `igvRate: 0.18`
- `generalExpensesRate: 0.10`
- `utilityRate: 0.08`

Those values are used when creating new project budget structures and when recovering missing budget records.

### Manual Budget Form

`components/budget/budget-form.tsx` currently hardcodes the same values directly in the form:

- `defaultValue="0.18"`
- `defaultValue="0.10"`
- `defaultValue="0.08"`

That means the product still has duplicated business defaults, and those defaults are expressed in raw decimal form that is not especially friendly for end users.

## Goals

- Add persisted user settings for default budget rates.
- Show those settings in `Configuracion` using human percentage inputs.
- Store the values internally as decimal rates compatible with existing calculations.
- Use the same centralized defaults for both project creation and manual budget forms.
- Keep calculation logic and conversion logic outside the UI wherever practical.

## Non-Goals

- Do not recalculate existing budgets when settings change.
- Do not alter the financial formulas themselves.
- Do not change how budget totals are computed once rates are set on a budget.
- Do not introduce country-specific tax logic beyond configurable default suggestions.
- Do not broaden this phase into editable specialty templates or other settings groups.

## Recommended Approach

Use a centralized settings-driven defaults approach:

1. extend `UserSettings` persistence with three decimal rate fields,
2. expose them through the existing settings data layer,
3. add a small conversion utility between UI percentage values and stored decimal rates,
4. update the settings UI to edit those values in human percentage form,
5. make both automatic creation flows and manual forms read from the same settings source.

This gives a single source of truth for suggested rates while preserving compatibility with the current calculation model.

## Data Model

### User Settings Shape

`UserSettingsRecord` should evolve to include:

- `defaultCurrency`
- `currencyDecimals`
- `defaultIgvRate`
- `defaultGeneralExpensesRate`
- `defaultUtilityRate`

The new three fields should be represented in the domain as decimal rates, not UI percentages.

### Default Values

If the user has no persisted settings row, the application should use:

- `defaultIgvRate: 0.18`
- `defaultGeneralExpensesRate: 0.10`
- `defaultUtilityRate: 0.08`

These defaults must live in the same central settings source as the existing currency defaults.

### Persistence Format

These three values should be stored as decimals because:

- current budget calculations already consume decimal rates,
- Prisma budget fields already use decimal-style semantics,
- keeping domain values in one representation reduces downstream risk.

Recommended storage shape in `UserSettings`:

- `defaultIgvRate DECIMAL(10,4)`
- `defaultGeneralExpensesRate DECIMAL(10,4)`
- `defaultUtilityRate DECIMAL(10,4)`

## UI Representation

### Human Percentage Inputs

The settings screen should present these values as percentages that a user would naturally type:

- `18`
- `10`
- `8`

That means the UI must convert:

- displayed input `18` -> stored decimal `0.18`
- stored decimal `0.18` -> displayed input `18`

### Conversion Rules

The conversion behavior must be explicit and testable:

- UI input percentage is divided by `100` before persistence,
- stored decimal rate is multiplied by `100` for display,
- rounding must preserve the precision needed by the budget domain.

For this phase, the safest representation is:

- preserve up to two decimals in displayed percentage input when needed,
- preserve up to four decimals in stored rate values.

Examples:

- `18` -> `0.18`
- `18.5` -> `0.185`
- `10.25` -> `0.1025`

## Validation

### Domain Validation

Stored values should remain validated as decimal rates between `0` and `1`.

That keeps them compatible with existing budget validation and calculation flows.

### UI Validation

The settings form should validate user-facing percentage input in human terms before converting:

- minimum `0`
- maximum `100`

After conversion, persisted values must still satisfy domain validation:

- minimum `0`
- maximum `1`

This creates a clear separation:

- UI validates percentage semantics,
- domain validates decimal-rate semantics.

## Architecture Notes

### Separation of Responsibilities

- `lib/validations/settings.ts` should validate stored settings payloads in decimal form.
- A dedicated conversion helper should handle `percentage <-> decimal rate` translation.
- `lib/data/settings.ts` should keep owning normalized defaults, persistence, and runtime row handling.
- `components/settings/user-settings-form.tsx` should render human-friendly fields and call the conversion helper.
- `lib/data/projects.ts` should consume stored decimal defaults from settings.
- manual budget entry surfaces should receive already-resolved defaults instead of embedding hardcoded constants.

This prevents repeated conversion logic in multiple components.

### Central Budget Defaults

The project currently has a `defaultBudgetRates` constant in `lib/data/projects.ts`.

For this phase, those numeric defaults should stop being treated as system constants. Instead:

- a central settings-driven budget defaults source should be used,
- project creation should merge settings-derived defaults into created budgets,
- manual forms should read suggested values from the same source.

The key principle is: the product should have one source of truth for suggested budget rates.

## Application Behavior

### Project Creation

When a user creates a new project, all generated budgets should use the user's configured default rates:

- `igvRate`
- `generalExpensesRate`
- `utilityRate`

This applies both to:

- initial project creation,
- any recovery/hydration path that creates missing budgets later.

### Manual Budget Forms

Manual budget creation forms should use settings-driven suggestions instead of hardcoded decimal strings.

The UI may continue to submit decimal-compatible values to the backend, but the form should no longer own the actual business defaults.

### Existing Records

Changing settings must not mutate:

- existing budgets,
- existing totals,
- historical financial data.

Only newly created budgets and newly opened suggestion-driven forms should reflect the updated settings.

## Settings Screen Design

The settings page should gain a new editable section for default budget rates.

Recommended inputs:

- `IGV (%)`
- `Gastos generales (%)`
- `Utilidad (%)`

Recommended help text:

- explain that values are entered as percentages,
- clarify that they affect new budgets and suggested form defaults,
- clarify that existing budgets are not changed retroactively.

This can live within the current `UserSettingsForm` if the form remains manageable, or be split into a second focused settings form if that keeps responsibilities clearer.

## Error Handling

- Invalid human percentage input should be rejected before save.
- Invalid converted decimal values should still fail domain validation.
- If settings are missing, the app should fall back safely to the central defaults.
- If persistence returns malformed data, the data layer should fail loudly rather than silently producing incorrect saved rates.

## Testing Strategy

Add or update tests in these areas:

- percentage/decimal conversion helper,
- settings validation for the three new decimal fields,
- settings data-layer defaults and persistence,
- project creation using settings-derived rates,
- recovery/hydration path using settings-derived rates,
- manual budget form showing settings-derived suggested values,
- settings form converting human input to stored decimal values correctly.

Tests should focus on behavior and precision, not snapshots.

## Risks And Mitigations

### Risk: UI/Domain Mismatch

The user types `18`, but the backend expects `0.18`.

Mitigation: isolate the conversion logic in a tested helper and keep domain validation in decimal form.

### Risk: Default Duplication Persists

If project creation uses settings but manual forms keep `0.18 / 0.10 / 0.08` locally, the feature becomes inconsistent.

Mitigation: update both automatic and manual entry points in the same phase.

### Risk: Precision Drift

Repeated conversion or inconsistent rounding may alter rates subtly.

Mitigation: define one canonical storage format, one conversion helper, and explicit test cases for precision-sensitive values.

### Risk: Hidden Legacy Budget Paths

Some read-time repair flow may still create budgets with old hardcoded defaults.

Mitigation: cover both creation and recovery paths with tests.

## Implementation Boundaries

This phase is intentionally scoped to:

- persisted default budget rate settings,
- UI editing in human percentage form,
- centralized defaults resolution,
- automatic project budget creation,
- manual form suggestions.

It does not include:

- retroactive budget migration,
- formula changes,
- exchange rate logic,
- reporting-specific override rules,
- specialty-template customization.
