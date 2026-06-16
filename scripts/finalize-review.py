"""Finalize the AI budget review implementation:
- Remove openAiBudgetReview function
- Revert button onClick handlers to runAiBudgetReview()
- Remove the "Revisar con Ollama/ChatGPT Bridge" start button from footer
- Keep provider toggle visible in dialog at all review stages
- Keep selectedProvider field and provider pass-through
- Revert test to original state (single click)
"""
import re

# ====== Edit budget-editor.tsx ======
path = "components/budget/budget-editor.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove openAiBudgetReview function (lines 966-976)
old_block = """  function openAiBudgetReview() \{
    const title = "Revision IA del presupuesto";
    const requestSummary = \{
      items: summary.items.length,
      totalDirectCost: summary.totals.totalDirectCost,
      budgetName: summary.name,
      currency: summary.currency,
      projectName,
    };
    setAiPanel\(\{ kind: "review", title, result: null, loading: false, error: "", selectedProvider: "auto", requestSummary \}\);
  }

  function applyAiAutocomplete"""
  
# Use a line-based approach instead of regex
lines = content.split('\n')
new_lines = []
skip_block = False
skipping = False
for line in lines:
    if 'function openAiBudgetReview()' in line:
        skipping = True
        continue
    if skipping:
        if line.strip() == '}' or line.strip() == '}':
            # This might be the closing brace of openAiBudgetReview
            # Check if the next non-empty line starts applyAiAutocomplete
            skipping = False
            continue
        continue
    new_lines.append(line)
content = '\n'.join(new_lines)

# Actually, the above approach is fragile. Let me use a more targeted approach.
# Let me re-read the file and find exact patterns.
print("Using alternative approach...")
