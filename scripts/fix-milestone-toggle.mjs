import fs from 'fs';

const filePath = 'components/budget/work-schedule-page-content.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Remove onInlineRowSave from the quick-toggle path (race condition)
const oldQuickToggle = `              } else {
                const draft = createQuickToggleDraft(line, itemCodeToRowNumber);
                draft.isMilestone = !(line.isMilestone ?? false);
                onInlineDraftChange(inlineRowId, draft);
                onInlineRowSave(inlineRowId);
              }`;

const newQuickToggle = `              } else {
                const draft = createQuickToggleDraft(line, itemCodeToRowNumber);
                draft.isMilestone = !(line.isMilestone ?? false);
                onInlineDraftChange(inlineRowId, draft);
              }`;

if (content.includes(oldQuickToggle)) {
  content = content.replace(oldQuickToggle, newQuickToggle);
  console.log('Fix 1: Removed auto-save from quick-toggle');
} else {
  console.log('Fix 1 FAILED');
}

// Fix 2: Add itemCodeToRowNumber to memo comparator
const oldComparatorEnd = `    previousProps.onInlineRowCancel === nextProps.onInlineRowCancel &&
    areEditableLinesEqual(previousProps.inlineDraft, nextProps.inlineDraft)`;

const newComparatorEnd = `    previousProps.onInlineRowCancel === nextProps.onInlineRowCancel &&
    previousProps.itemCodeToRowNumber === nextProps.itemCodeToRowNumber &&
    areEditableLinesEqual(previousProps.inlineDraft, nextProps.inlineDraft)`;

if (content.includes(oldComparatorEnd)) {
  content = content.replace(oldComparatorEnd, newComparatorEnd);
  console.log('Fix 2: Added itemCodeToRowNumber to memo comparator');
} else {
  console.log('Fix 2 FAILED');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
