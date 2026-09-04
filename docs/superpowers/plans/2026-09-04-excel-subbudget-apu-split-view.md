# Excel Sub-budget: Docked APU Split View Implementation Plan

> **For implementation agents:** execute this plan task-by-task and keep the checkbox state updated. Read the existing Excel-mode and APU contracts before changing code.

**Date:** 2026-09-04  
**Goal:** In the sub-budget view, replace the APU off-canvas behavior with a fluid two-pane workspace only in Excel mode: the sub-budget table remains on the left and the APU for the selected partida remains on the right. Selecting or focusing another partida updates the right pane without opening another off-canvas.

**Primary files:**

- `components/budget/budget-editor.tsx`
- `components/apu/apu-editor-sheet.tsx`
- `components/budget/budget-editor.view-mode.test.tsx`
- `components/apu/apu-editor-sheet.test.tsx`
- `app/globals.css` only if a small shared transition/state selector is required

**No new dependency is expected.** Reuse the existing Radix Dialog, Excel view-mode provider, formatting settings, table components, and existing APU calculations.

---

## 1. Current implementation and target behavior

### Current implementation

- A sub-budget is rendered through `BudgetFlowWrapper` → `BudgetFlow` → `BudgetEditor`.
- `BudgetEditor` owns `apuSheetSession` and opens an APU with `openApuSheet(item)`.
- `ApuSheetController` buffers the APU draft and renders `ApuEditorSheet`.
- `ApuEditorSheet` always uses `Dialog.Root`, an overlay, and a fixed right-side panel.
- Excel mode already exists through `useBudgetViewMode()` and is used by the budget table and APU styles.
- The budget table already exposes a stable row identity through `data-budget-row-id`, and editable cells already track spreadsheet selection state.
- The budget table already has an accessible `APU` action for each partida.
- `BudgetSummaryPanel` currently occupies the second column of the editor layout.

### Target behavior

#### Excel mode

1. On initial render, or when the persisted/global mode resolves to Excel, open the dock automatically when the sub-budget has at least one partida.
2. Select the first available partida by default; there is no separate row-level `APU` action in Excel mode.
3. The workspace has two sections on desktop:
   - **Left:** the existing sub-budget table and its existing editing behavior.
   - **Right:** the APU editor for the selected partida.
4. The right pane has its own vertical scroll and remains visible while the left table scrolls.
5. Focusing/selecting another partida changes the right pane to that partida’s APU.
6. The APU panel title, unit, performance, resources, decimals, borders, row height, and Excel density update to match the selected partida and current settings.
7. On narrow screens, the panes stack vertically rather than creating an unusable narrow split.

#### Modern mode

- Keep the current off-canvas/dialog behavior, focus restoration, focus trap, overlay, buffered draft lifecycle, and keyboard behavior unchanged.
- Keep the row-level `APU` action available in modern mode.
- Do not make the docked panel available in modern mode.

### Explicit non-goals

- Do not change budget, APU, or resource calculation formulas.
- Do not change API routes, persistence payloads, Prisma models, exports, or decimal precision.
- Do not replace the existing table with a third-party grid.
- Do not require a click on an `APU` action to initialize the Excel dock.
- Do not render the row-level `APU` action in Excel mode; partida selection is the Excel interaction for changing the right pane.
- Do not redesign the APU resource table beyond the layout needed for the docked pane.

---

## 2. Architectural decision

Use the existing `ApuEditorSheet` as a dual-presentation component instead of creating a second APU editor.

Add a presentation prop:

```ts
type ApuEditorPresentation = "sheet" | "docked";
```

`ApuEditorSheet` should default to `"sheet"`, preserving all current callers. In `"docked"` presentation:

- Keep `Dialog.Root` and the existing semantic `Dialog.Title`/`Dialog.Description` structure.
- Set the Radix dialog to non-modal behavior so it does not trap focus or render an overlay.
- Render the content inline inside the right layout pane rather than inside a portal.
- Reuse the existing APU body, calculations, resource editing, nested subpartida preview, AI actions, collaboration hooks, formatting variables, and Excel styling.
- Use a different outer shell class only for positioning, height, overflow, border radius, and shadow.

`BudgetEditor` should use two paths:

- **Modern mode or Excel mode with no active dock:** existing `ApuSheetController` buffered off-canvas path.
- **Excel mode with an active dock:** controlled inline `ApuEditorSheet presentation="docked"` path so the selected item can change without unmounting and recreating the off-canvas.

For the docked path, propagate APU updates into both the budget state and `apuSheetSession`. This ensures that:

- edits are immediately represented in the selected APU pane,
- switching to another partida does not discard the previous partida’s edits,
- the next selected partida is derived from the latest budget state, and
- closing the dock does not need a special “commit old panel before switch” step.

The existing buffered `ApuSheetController` remains responsible for modern/off-canvas behavior.

---

## 3. Files and responsibilities

### Modify `components/budget/budget-editor.tsx`

- Derive the Excel dock from `isExcelMode && summary.items.length > 0` so it initializes automatically from the calculated editor state.
- Track the selected partida separately and default it to the first calculated item when no row has been focused.
- Keep `openApuSheet` available for the modern sheet path and keyboard compatibility, but do not use a row-level APU action to initialize Excel mode.
- Update the row-focus/selection handler so that, while Excel mode is active, an item row becoming active selects that item for the right pane.
- Keep level rows from replacing the selected APU; only item rows can become the active APU selection.
- Update `handleApuItemUpdate` to update the parent budget state and the active session item when the updated item is the docked item.
- Recompose the editor shell so that the APU dock occupies the right pane and the summary panel moves below the table in the left pane while the dock is active.
- Render the old `ApuSheetController` only for the existing sheet path.
- Render `ApuEditorSheet` directly with `presentation="docked"` for the Excel split path.
- Add selected-partida attributes/classes to the relevant row/APU action so the active relationship is visually discoverable and testable.
- Preserve all existing table, autosave, navigation, paste, fill-down, AI, metrado, action menu, and summary behavior.

### Modify `components/apu/apu-editor-sheet.tsx`

- Add the optional `presentation` prop with default `"sheet"`.
- Split the outer Radix shell into sheet and docked presentation branches without duplicating APU business logic.
- Preserve the current portal and overlay for `"sheet"`.
- Render the docked content inline, with no overlay, no fixed viewport positioning, and no modal focus trap.
- Add a stable panel test id for the docked presentation, or extend the current test id with a `data-apu-presentation` attribute.
- Reset transient item-specific UI state when `item.id` changes in docked mode:
  - resource search query and highlighted index,
  - resource editing selection and menu position,
  - AI preview/error/loading state,
  - nested subpartida preview,
  - partida generator dialog state.
- Ensure the panel title and all derived values use the newly selected item immediately.
- Keep `data-view-mode="excel"`, `data-excel-field-border-scope="apu-editor"`, `data-density-mode="compact"`, `--excel-row-height`, and `--excel-field-border-color` on the docked wrapper.
- Keep `restoreFocusElement` and the existing focus restoration logic limited to the sheet presentation; dock switching must not steal focus from the budget table.
- Keep collaboration edit-session and presence cleanup correct when the selected item changes.

### Modify `components/budget/budget-editor.view-mode.test.tsx`

Add focused integration coverage for the Excel split behavior while retaining the current modern-mode tests.

### Modify `components/apu/apu-editor-sheet.test.tsx`

Add focused presentation and item-switching coverage for the APU component.

### Modify `app/globals.css` only if needed

Prefer Tailwind classes and existing view-mode helpers. Add a small CSS selector only if a reusable Excel dock transition cannot be expressed cleanly in existing classes. Do not add broad selectors that affect the modern off-canvas.

---

## 4. Implementation tasks

### Task 1: Establish the presentation contract

**Files:**

- Modify: `components/apu/apu-editor-sheet.tsx`
- Modify: `components/apu/apu-editor-sheet.test.tsx`

- [x] Add `ApuEditorPresentation` and the optional `presentation` prop.
- [x] Keep the default value as `"sheet"`.
- [x] Add a test that the default presentation still renders the existing fixed sheet/portal contract.
- [x] Add a test that `presentation="docked"` renders without the overlay and exposes:
  - `data-apu-presentation="docked"`,
  - `data-view-mode="excel"`,
  - `data-excel-field-border-scope="apu-editor"`,
  - `data-density-mode="compact"` when Excel mode is active.
- [x] Confirm that the docked panel has no `fixed inset-y-0 right-0` positioning.
- [x] Confirm that the existing `ApuEditorSheet` Excel inheritance test remains green.

**Verification:**

```bash
npm run test -- components/apu/apu-editor-sheet.test.tsx
```

**Exit criterion:** both sheet and docked presentations render from the same APU implementation, and the default sheet behavior is unchanged.

---

### Task 2: Add the docked shell without changing APU logic

**Files:**

- Modify: `components/apu/apu-editor-sheet.tsx`
- Modify: `components/apu/apu-editor-sheet.test.tsx`

- [x] Keep the existing APU header, summary cards, controls, resource table, nested subpartida dialog, and AI dialogs intact.
- [x] Replace only the outer shell selection with a presentation-aware shell:
  - sheet: existing portal, overlay, fixed right panel, and current width/padding behavior;
  - docked: inline panel, `relative` positioning, `flex` column layout, `min-h-0`, bounded height, independent overflow, Excel borders, and no backdrop.
- [x] Set the docked shell to use the configured Excel row height and the existing Excel field-border CSS variables.
- [x] Make the docked panel responsive:
  - desktop: fill its grid column and remain sticky where appropriate;
  - tablet/mobile: use normal document flow and stack below the table.
- [x] Keep the existing `Dialog.Close` button available in both presentations.
- [x] Ensure nested Radix dialogs such as the subpartida editor and partida generator continue to use their own modal behavior.
- [x] Add a test asserting that the docked panel keeps the APU header and resource table readable inside a bounded scroll container.

**Exit criterion:** rendering the docked presentation creates a right-hand panel that scrolls independently and does not cover the budget table.

---

### Task 3: Make docked APU updates controlled and item-safe

**Files:**

- Modify: `components/budget/budget-editor.tsx`
- Modify: `components/apu/apu-editor-sheet.tsx` only for item-change reset effects if required
- Modify: `components/budget/budget-editor.view-mode.test.tsx`
- Modify: `components/apu/apu-editor-sheet.test.tsx`

- [x] Add a dock-specific render path that passes the current session item directly to `ApuEditorSheet`.
- [x] Do not use `key={apuSheetSession.item.id}` in the docked path; the panel should remain mounted while the selected item changes.
- [x] Update `handleApuItemUpdate` so that it:
  - preserves the existing linked-resource price synchronization;
  - updates `state.items` exactly as it does today;
  - updates `apuSheetSession.item` when the changed item is currently docked;
  - does not change behavior for the buffered sheet controller.
- [x] Add item-id change handling in `ApuEditorSheet` to clear only transient UI state, not the incoming item data.
- [x] Verify that editing performance, resource quantity, resource price, or resource assignment in the docked APU remains visible after the parent budget state updates.
- [x] Verify that a docked APU with unsaved changes can be switched to another item without losing the first item’s edits.
- [x] Verify that switching back to the first item shows the updated draft from the budget state.
- [x] Ensure the docked path does not call `restoreFocusElement.focus()` when switching items.

**Exit criterion:** the dock is a controlled view of the latest selected budget item, and switching items never discards an edit.

---

### Task 4: Create the Excel two-pane budget layout

**Files:**

- Modify: `components/budget/budget-editor.tsx`
- Modify: `components/budget/budget-editor.view-mode.test.tsx`

- [x] Derive the Excel dock from the calculated `summary.items` state and render it automatically whenever Excel mode is active and partidas exist.
- [x] Default the selected partida to the first available calculated item, including when Excel mode is restored from persisted browser/server settings.
- [x] Hide row-level `APU` actions in Excel mode; keep them available in modern mode.
- [x] Keep the editor full-width when not in Excel mode or when there are no partidas to show.
- [x] When `isExcelApuDocked` is true, use a responsive layout with:
  - left column: the existing budget `Card` and the existing `BudgetSummaryPanel` below it;
  - right column: the docked `ApuEditorSheet`.
- [x] Use a desktop grid only above the project’s existing wide-layout breakpoint. On smaller screens, stack the APU below the budget table.
- [x] Preserve the existing table width, horizontal scrolling, sticky headers, virtualized rows, and Excel row height.
- [x] Give the right panel a bounded viewport height and independent vertical scrolling so the left table does not move when the APU resources scroll.
- [x] Keep the summary visible rather than allowing it to compete with the APU pane for the right column.
- [x] Use existing border, surface, and Excel-mode classes; avoid adding gradients or oversized shadows.
- [x] Add a short, subtle transition for the dock entering/leaving the layout if it can be implemented without delaying interaction.
- [x] Ensure closing the dock restores the original single-column/table-plus-summary layout.

**Exit criterion:** Excel mode visibly becomes a left budget table/right APU workspace only while an APU is active, with no layout regression when closed.

---

### Task 5: Synchronize the selected partida with the APU pane

**Files:**

- Modify: `components/budget/budget-editor.tsx`
- Modify: `components/budget/budget-editor.view-mode.test.tsx`

- [x] Keep `openApuSheet(item)` as the explicit way to start the dock.
- [x] Add a row-to-item resolver using the existing `BudgetDisplayRow` and `getRowId` helpers.
- [x] Extend the row focus/selection flow so that, only when Excel dock mode is already active:
  - focusing an item row selects that item in the APU pane;
  - focusing a level row leaves the current APU selected;
  - focusing controls outside the table does not replace the APU.
- [x] Ensure keyboard navigation between budget rows changes the APU pane without opening a dialog or moving focus into the APU pane.
- [x] Ensure clicking the `APU` button for any row changes the selected pane immediately.
- [x] Add a visible selected state on the active budget row and/or APU action using data attributes such as:
  - `data-apu-selected="true"`;
  - `data-apu-selected-item-id="..."` on the editor scope.
- [x] Preserve the current behavior before the first APU is opened: ordinary row focus must not automatically mount the APU panel.
- [x] Avoid replacing a selected item with a level row or with the active row of a nested menu.

**Exit criterion:** after opening one APU, selecting another partida by row focus, keyboard navigation, or its APU button updates the right pane to the correct item.

---

### Task 6: Preserve modern mode and existing keyboard/focus contracts

**Files:**

- Modify: `components/budget/budget-editor.tsx` only as needed
- Modify: `components/budget/budget-editor.view-mode.test.tsx`
- Modify: `components/apu/apu-editor-sheet.test.tsx` only as needed

- [x] Confirm modern mode still renders the fixed right off-canvas with overlay.
- [x] Confirm `Escape` closes the modern sheet and restores focus to the previous budget control.
- [x] Confirm the modern APU sheet still traps tab navigation.
- [x] Confirm Excel dock mode does not trap focus inside the APU panel.
- [x] Confirm Excel dock mode keeps focus in the budget table after a row switch.
- [x] Confirm background budget shortcuts remain suppressed only while the modern APU sheet is open, as currently covered by tests; define the expected dock behavior explicitly and test it.
- [x] Preserve `Ctrl/Cmd + Enter` behavior in Excel mode: it should open the dock for the active item rather than the old off-canvas.
- [x] Preserve `Ctrl/Cmd + S`, fill-down, paste, and `Alt + Arrow` behavior in the left table while the dock is visible.
- [x] Do not let a click inside the dock trigger the budget editor’s outside-blur cleanup.

**Exit criterion:** the new dock changes only the intended Excel interaction and all existing focus/keyboard guarantees remain stable.

---

### Task 7: Add targeted integration tests for the complete flow

**Files:**

- Modify: `components/budget/budget-editor.view-mode.test.tsx`
- Modify: `components/apu/apu-editor-sheet.test.tsx`

Add or adapt test helpers to locate:

- the budget editor root;
- the budget table surface;
- a row by `data-budget-row-id`;
- a row’s APU button;
- the docked APU panel by `data-testid="apu-editor-sheet-panel"` and `data-apu-presentation="docked"`.

Required tests:

- [x] Excel mode starts with the docked APU automatically when a partida exists.
- [x] Persisted Excel mode after a reload/server restart still mounts the dock without a row-level APU click.
- [x] Modern mode still exposes the row-level `APU` action and uses the existing off-canvas path.
- [x] The left pane contains the existing budget table and its rows.
- [x] The right pane contains the selected partida description, unit, performance, and APU table.
- [x] The right pane has no dialog overlay.
- [x] Clicking/focusing a second partida changes the right-pane title and selected-item id.
- [x] Clicking a second row’s `APU` button updates the existing panel rather than creating multiple panels.
- [x] Editing the first docked APU, switching to a second item, and returning preserves the first edit.
- [x] Closing the dock removes the right pane and restores the single-pane layout.
- [x] Switching back to modern mode uses the existing off-canvas path.
- [x] Mobile or narrow viewport layout stacks the panes without horizontal overlap, using DOM/class assertions rather than screenshot-only assertions.
- [x] Existing APU Excel inheritance tests continue to pass for row height, field borders, density, and decimals.

**Focused verification:**

```bash
npm run test -- \
  components/budget/budget-editor.view-mode.test.tsx \
  components/apu/apu-editor-sheet.test.tsx
```



## Implementation completed

- Added the shared `ApuEditorSheet` `sheet`/`docked` presentation contract.
- Added the Excel-only left budget table/right APU workspace with responsive stacking and independent APU scrolling.
- Excel mode now initializes the dock automatically from the first calculated partida, including persisted Excel mode after a reload/server restart.
- Removed row-level APU actions from Excel mode while preserving the modern-mode action and off-canvas behavior.
- Synchronized dock selection with focused partida rows while preserving table focus.
- Preserved modern mode’s modal off-canvas, overlay, focus restoration, and tab-trap behavior.
- Added coverage for automatic startup, persisted Excel mode, hidden Excel actions, modern-mode action availability, dock metadata, switching, edit preservation, and regressions.

### Verification

- `npm run test -- components/budget/budget-editor.view-mode.test.tsx components/apu/apu-editor-sheet.test.tsx` — 69 tests passed.
- `npm run test -- components/budget/budget-flow.test.tsx components/budget/budget-flow-wrapper.test.tsx` — 3 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with 3 pre-existing warnings in unrelated files.
- `git diff --check` — passed.

---

### Task 8: Verify regressions and document the final contract

**Files:**

- Modify: `DESIGN.md` only if the project’s UI contract section needs the new Excel behavior recorded
- This plan: mark completed tasks and record verification results

- [x] Run the focused tests from Tasks 1 and 7.
- [x] Run the budget flow tests:

```bash
npm run test -- \
  components/budget/budget-flow.test.tsx \
  components/budget/budget-flow-wrapper.test.tsx
```

- [x] Run typecheck:

```bash
npm run typecheck
```

- [x] Run lint:

```bash
npm run lint
```

- [x] Run the full test suite when the focused tests are green:

```bash
npm run test
```

- [x] If unrelated pre-existing failures occur, record the exact failing files and distinguish them from this feature.
- [x] Confirm no changes were made to calculation libraries, API contracts, persistence schemas, or export logic.
- [x] If updating `DESIGN.md`, document:
  - Excel mode opens APU inline only after an explicit APU action;
  - the budget table stays on the left;
  - the selected partida APU stays on the right;
  - focus/keyboard remains in the left table during row switching;
  - modern mode retains the off-canvas contract.

**Final acceptance criteria:**

- [x] Excel mode supports a fluid left-table/right-APU workspace.
- [x] Another selected partida replaces the right-pane APU without opening a second off-canvas.
- [x] APU edits are not lost when changing selection.
- [x] The right pane inherits Excel density, row height, borders, and configured decimals.
- [x] The left table keeps its current editing, virtual scrolling, selection, paste, fill-down, and autosave behavior.
- [x] Modern mode remains unchanged.
- [x] Focus and accessibility behavior are covered by tests.
- [x] Typecheck, lint, and relevant tests pass.
