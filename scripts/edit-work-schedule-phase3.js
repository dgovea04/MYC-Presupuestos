const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'budget', 'work-schedule-page-content.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const hadCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

let changes = 0;

// Replace useCallback handleGanttBarChange with a regular async function
const oldHandler = `  const handleGanttBarChange = useCallback(async (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => {\n    const editableLine: EditableLine = {\n      budgetItemId: line.budgetItemId,\n      description: line.description,\n      quantity: line.quantity,\n      performance: line.performance,\n      startDate: result.startDate,\n      endDate: result.endDate,\n      durationDays: result.durationDays,\n      predecessor: line.predecessor ?? "",\n      crew: line.crew?.toString() ?? "",\n      monthlyDistributions: result.monthlyDistributions,\n    };\n\n    try {\n      const nextData = await persistWorkScheduleLine(editableLine);\n      setData(normalizeWorkScheduleView(nextData));\n    } catch {\n      // Bar snaps back visually since we do not mutate local state optimistically\n    }\n  }, [persistWorkScheduleLine]);`;

const newHandler = `  async function handleGanttBarChange(line: WorkScheduleLineRecord, result: GanttBarChangeResult) {\n    const editableLine: EditableLine = {\n      budgetItemId: line.budgetItemId,\n      description: line.description,\n      quantity: line.quantity,\n      performance: line.performance,\n      startDate: result.startDate,\n      endDate: result.endDate,\n      durationDays: result.durationDays,\n      predecessor: line.predecessor ?? "",\n      crew: line.crew?.toString() ?? "",\n      monthlyDistributions: result.monthlyDistributions,\n    };\n\n    try {\n      const nextData = await persistWorkScheduleLine(editableLine);\n      setData(normalizeWorkScheduleView(nextData));\n    } catch (err) {\n      // eslint-disable-next-line no-console\n      console.error("Failed to save Gantt bar change:", err);\n    }\n  }`;

if (content.includes(oldHandler)) {
  content = content.replace(oldHandler, newHandler);
  changes++;
  console.log('Converted handleGanttBarChange to regular function');
} else if (!content.includes('async function handleGanttBarChange')) {
  console.log('WARNING: Could not find handleGanttBarChange to replace');
}

if (hadCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Done. Applied ${changes} changes.`);
