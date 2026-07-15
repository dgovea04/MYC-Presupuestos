// Remove remaining 7 function blocks that the brace matcher couldn't handle
// Strategy: find function start, then find next top-level function as end boundary
const fs = require('fs');
const p = 'C:/MYC-Presupuestos/components/budget/work-schedule-page-content.tsx';
let content = fs.readFileSync(p, 'utf8');
let lines = content.split('\r\n');

const remainingFunctions = [
  'ValuationCalendarView',
  'ResourceCalendarView', 
  'CurveSView',
  'WorkScheduleEditorSheet',
  'WorkScheduleGenerationDialog',
  'DerivedTableCard',
  'formatPredecessorToken',
];

// Find function starts
let blocks = [];
for (const name of remainingFunctions) {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('function ' + name + '(') || t.startsWith('export function ' + name + '(')) {
      blocks.push({ name, start: i });
      break;
    }
  }
}

// Sort by start position descending (remove from bottom to top)
blocks.sort((a, b) => b.start - a.start);

// For each block, find the next top-level function declaration
for (const block of blocks) {
  let end = lines.length - 1;
  for (let i = block.start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    // Check if this is a top-level function declaration (not nested)
    if ((t.startsWith('function ') || t.startsWith('export function ')) && 
        !t.includes('=>') && !t.includes(':') && t.includes('(')) {
      // Make sure it's a real function declaration, not a call
      // Function declarations have the pattern: function Name(
      const match = t.match(/^(export\s+)?function\s+(\w+)\(/);
      if (match) {
        end = i - 1;
        break;
      }
    }
  }
  block.end = end;
}

console.log('Blocks to remove:');
for (const b of blocks) {
  console.log(`  ${b.name}: lines ${b.start + 1}-${b.end + 1} (${b.end - b.start + 1} lines)`);
}

// Remove blocks from bottom to top
for (const b of blocks) {
  lines = [...lines.slice(0, b.start), ...lines.slice(b.end + 1)];
}

console.log(`\nNew line count: ${lines.length}`);

fs.writeFileSync(p, lines.join('\r\n'), 'utf8');
console.log('Done.');
