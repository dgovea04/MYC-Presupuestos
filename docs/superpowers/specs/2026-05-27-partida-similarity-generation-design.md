# Partida Similarity Generation V1 Design

## Goal

Build a semi-manual, deterministic system that suggests new construction cost partidas from similar catalog partidas, aggregates insumos statistically, assigns prices only from the resource catalog, and requires full human review before saving.

## Scope

V1 does not use AI, LLMs, embeddings, external services, or automatic catalog mutation. The engine uses normalized text, technical variable extraction, weighted similarity rules, frequency thresholds, decimal-safe quantity statistics, and catalog resource matching.

## Architecture

The feature is split into pure domain services in `lib/partida-generation`, a data/API layer around Prisma, and a client review sheet embedded in the existing partidas catalog. Calculation logic stays isolated from UI and is covered by Vitest tests.

## Data Flow

1. User enters a partida description and optional unit.
2. API loads catalog partidas with APU rows and user-accessible resources.
3. Similarity engine extracts variables and ranks candidates.
4. User selects/removes candidates and marks a primary source.
5. Aggregation service groups insumos, calculates frequency and quantity statistics, and assigns confidence labels.
6. Price matching service resolves prices from the resource catalog only.
7. User edits the generated partida and insumos.
8. Save endpoint creates the reviewed `CatalogPartida` and stores traceability in `GeneratedPartida`, `GeneratedPartidaSource`, and `GeneratedPartidaInsumo`.

## Persistence

Traceability records store source text, generated name, unit, score, source partidas, selected primary source, selected insumos, suggested quantity, final quantity, catalog price, final price, confidence, calculation method, and metadata JSON.

## UI

The catalog page gets a "Generar por similitud" action. The review sheet is a compact SaaS workflow with search, candidate selection, suggested insumos, editable final review, and explicit save. It reuses existing table, button, input, and formatting patterns.

## Testing

Tests cover variable extraction, weighted scoring, deterministic candidate ranking, statistical aggregation, catalog-only price matching, payload validation, and save behavior.
