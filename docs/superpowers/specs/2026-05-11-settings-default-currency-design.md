# Default Currency Settings Design

## Summary

This phase turns the existing static "Moneda por defecto" recommendation in `Configuracion` into a real user setting.

The new setting will be stored alongside `currencyDecimals` in `UserSettings` as `defaultCurrency`. It will serve two purposes:

- define the default currency for newly created project budgets,
- expose a reusable global preference that future reports and export flows can use as their initial suggested currency.

Existing budgets must keep their current currency. This setting only affects new records and future suggestion flows.

## Current State

The current settings module persists only one preference:

- `currencyDecimals`

The settings screen already includes a real editable form for decimal precision, but "Moneda por defecto" is still presented as a static recommendation card.

Budget creation currently hardcodes currency through `defaultBudgetRates` in `lib/data/projects.ts`, where every generated general budget and sub budget starts with `currency: "PEN"`.

That means the product has no single source of truth for a user's preferred currency.

## Goals

- Add a persisted `defaultCurrency` preference to the user settings model.
- Let users edit that preference from the `Configuracion` screen.
- Use the preference when creating new project budgets.
- Keep a reusable settings access path so future modules can ask for the user's global currency suggestion without duplicating logic.

## Non-Goals

- Do not rewrite currency on existing budgets or projects.
- Do not introduce multi-currency conversion logic.
- Do not change reporting or export behavior yet beyond making the setting available for future use.
- Do not broaden the currency catalog beyond a small validated list for this first phase.

## Recommended Approach

Use a centralized settings-driven approach:

1. extend persisted user settings with `defaultCurrency`,
2. expose that value through the existing settings data layer,
3. consume it from project creation logic instead of hardcoding `PEN`,
4. update the settings UI to edit both currency and decimals in one form.

This approach gives immediate user-facing value while preserving clean architecture. UI remains thin, persistence stays localized, and creation flows depend on a reusable settings service instead of duplicated defaults.

## Data Model

### User Settings Shape

`UserSettingsRecord` should evolve from:

- `currencyDecimals`

to:

- `currencyDecimals`
- `defaultCurrency`

### Default Values

If the user has no persisted settings row, the application should use:

- `defaultCurrency: "PEN"`
- `currencyDecimals: 2`

These defaults must live in one central place in `lib/data/settings.ts`.

### Validation

`defaultCurrency` should be validated with a narrow enum for this phase:

- `PEN`
- `USD`

This keeps input safe and avoids creating unsupported downstream states before the rest of the product is ready for a larger currency catalog.

## UI Design

### Settings Screen

The "Formato y visualizacion" card remains the editing surface for user formatting preferences. The form should expand from one control to two:

- default currency selector,
- currency decimals selector.

The static recommendation card for "Moneda por defecto" should either be removed from the recommendation list or replaced with a note that the setting is now active, so the screen does not suggest a feature that already exists.

### Form Behavior

The form should:

- initialize from the full settings payload,
- submit `defaultCurrency` and `currencyDecimals` together,
- show a single success or error state,
- update the preview using the selected currency and decimal precision.

### Preview

The current monetary preview can stay as the feedback mechanism, but it should format the sample amount using both:

- selected currency,
- selected decimals.

That gives the user immediate confirmation that the setting affects display semantics.

## Application Behavior

### Creation Flow

When a user creates a new project, the generated general budget and all default sub budgets should use the user's `defaultCurrency`.

The preferred source of truth is the settings data layer, not a UI payload passed through forms. Project creation should fetch the current user settings server-side and derive the initial budget currency from there.

### Existing Records

Changing `defaultCurrency` must not mutate:

- existing projects,
- existing budgets,
- historical calculations.

This prevents silent financial changes and keeps current records stable.

### Future Reuse

Future report and export modules should be able to consume `getUserSettings(userId)` and read `defaultCurrency` as their initial suggestion, even if they later allow per-report overrides.

## Architecture Notes

### Separation of Responsibilities

- `lib/validations/settings.ts` validates inbound settings payloads.
- `lib/data/settings.ts` owns default values, persistence, and read/write normalization.
- `components/settings/user-settings-form.tsx` only renders and submits fields.
- `lib/data/projects.ts` consumes settings to derive initial budget currency during creation.

This keeps business defaults out of the UI and avoids hardcoded currency behavior in multiple modules.

### Budget Defaults

The current `defaultBudgetRates` object mixes rate defaults with the default currency. For this phase, currency should stop being a fixed constant inside that object.

Recommended adjustment:

- keep reusable numeric rate defaults in one constant,
- inject currency at creation time from the user settings result.

That preserves clarity and avoids implying that currency is a universal system constant.

## Error Handling

- Invalid `defaultCurrency` input should fail validation and return the existing API error pattern.
- If settings are missing, the app should fall back safely to the central default settings object.
- If project creation cannot read settings for any reason, it should still use the central fallback of `PEN` instead of failing due only to missing optional preferences.

## Testing Strategy

Add or update tests in these areas:

- settings validation: accepts `PEN` and `USD`, rejects unsupported currency values,
- settings data layer: returns fallback defaults when no row exists,
- settings write path: persists and returns both `currencyDecimals` and `defaultCurrency`,
- project creation flow: uses the user's `defaultCurrency` for generated budgets instead of hardcoded `PEN`.

Tests should stay focused on behavior and not on UI snapshots.

## Risks And Mitigations

### Risk: Partial Adoption

If the UI saves `defaultCurrency` but project creation still uses hardcoded `PEN`, the setting becomes misleading.

Mitigation: implement persistence and creation-flow adoption in the same phase.

### Risk: Over-Broad Currency Support

Adding a large free-form currency list too early can produce unsupported states in reports, imports, and formatting helpers.

Mitigation: limit this first phase to a small validated enum.

### Risk: Hidden Existing Dependencies

Some modules may assume `PEN` implicitly.

Mitigation: constrain this phase to initial currency assignment only, avoid retroactive mutation, and cover creation flow with tests.

## Implementation Boundaries

This design is intentionally scoped to one coherent slice:

- real editable setting,
- persistence,
- validated defaults,
- creation flow integration,
- future-ready read path.

It does not include exchange rates, currency conversion, reporting overrides, or migrations of existing financial records.
