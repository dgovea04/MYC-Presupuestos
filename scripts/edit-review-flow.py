"""Edit budget-editor.tsx to change the review flow:
- Clicking "Revisar Presupuesto" opens the dialog with provider toggle visible and enabled
- User picks a provider and clicks "Revisar" button to start the review
"""
import re

path = "components/budget/budget-editor.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add openAiBudgetReview function after runAiBudgetReview
# Find where runAiBudgetReview ends (after the catch block) and add openAiBudgetReview before the next function
old = """    }
  }

  function applyAiAutocomplete()"""
  
new = """    }
  }

  function openAiBudgetReview() {
    const title = "Revision IA del presupuesto";
    const requestSummary = {
      items: summary.items.length,
      totalDirectCost: summary.totals.totalDirectCost,
      budgetName: summary.name,
      currency: summary.currency,
      projectName,
    };
    setAiPanel({ kind: "review", title, result: null, loading: false, error: "", selectedProvider: "auto", requestSummary });
  }

  function applyAiAutocomplete()"""

content = content.replace(old, new, 1)

# 2. Change button onClick handlers from runAiBudgetReview() to openAiBudgetReview()
# First button (line ~1829): toolbar button
old = 'onClick={() => void runAiBudgetReview()}\n                  className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)]"'
new = 'onClick={() => openAiBudgetReview()}\n                  className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)]"'
content = content.replace(old, new, 1)

# Second button (line ~2284): header action menu
old = """                onClick={() => {
                  void runAiBudgetReview();
                  closeHeaderActionMenu(true);
                }}"""
new = """                onClick={() => {
                  openAiBudgetReview();
                  closeHeaderActionMenu(true);
                }}"""
content = content.replace(old, new, 1)

# 3. Add a "Revisar" start button in the dialog footer
# The footer currently has "Descartar" button and conditional "Aplicar texto"
# I need to add a "Revisar con [Provider]" button when there's no result yet

old = """              <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Descartar
                </Button>
                {panel.kind === "autocomplete" ? (
                  <Button type="button" onClick={onApplyAutocomplete}>
                    Aplicar texto
                  </Button>
                ) : null}
              </div>"""

new = """              <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Descartar
                </Button>
                <div className="flex gap-2">
                  {panel.kind === "review" && !panel.result && !panel.loading ? (
                    <Button type="button" onClick={() => onRetryWithProvider?.(panel.selectedProvider)}>
                      {panel.selectedProvider === "chatgpt_bridge" ? "Revisar con ChatGPT Bridge" : "Revisar con Ollama"}
                    </Button>
                  ) : null}
                  {panel.kind === "autocomplete" ? (
                    <Button type="button" onClick={onApplyAutocomplete}>
                      Aplicar texto
                    </Button>
                  ) : null}
                </div>
              </div>"""

content = content.replace(old, new, 1)

with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("File edited successfully!")
