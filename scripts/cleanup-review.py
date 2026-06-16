"""Clean up and finalize the AI review provider toggle implementation.

Changes:
1. Remove openAiBudgetReview() function
2. Revert button onClick handlers back to runAiBudgetReview()
3. Remove the 'Revisar con Ollama/ChatGPT Bridge' start button from dialog footer
4. Keep provider toggle visible and ENABLED during loading (remove disabled)
5. Revert test to original (single click)
"""
import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(content)

# =========== EDIT budget-editor.tsx ===========
path = 'components/budget/budget-editor.tsx'
content = read_file(path)

# 1. Remove openAiBudgetReview() function
# Find it by pattern: from "function openAiBudgetReview()" to the next "function"
old = """  function openAiBudgetReview() {
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
new = """  function applyAiAutocomplete()"""
count = content.count(old)
if count == 0:
    # Try with \r\n
    old_rn = old.replace('\n', '\r\n')
    count = content.count(old_rn)
    if count > 0:
        content = content.replace(old_rn, new, 1)
        print(f"Removed openAiBudgetReview (CRLF match, {count} found)")
    else:
        print("WARNING: Could not find openAiBudgetReview to remove!")
else:
    content = content.replace(old, new, 1)
    print(f"Removed openAiBudgetReview (LF match, {count} found)")

# 2. Revert button onClick handlers from openAiBudgetReview() to runAiBudgetReview()
old_handlers = [
    ('onClick={() => openAiBudgetReview()}', 'onClick={() => void runAiBudgetReview()}'),
]
for old_str, new_str in old_handlers:
    c = content.count(old_str)
    if c > 0:
        content = content.replace(old_str, new_str, c)
        print(f"Reverted {c} onClick handler(s) back to runAiBudgetReview")

# Also check header action menu handler
old_menu = """                onClick={() => {
                  openAiBudgetReview();
                  closeHeaderActionMenu(true);
                }}"""
new_menu = """                onClick={() => {
                  void runAiBudgetReview();
                  closeHeaderActionMenu(true);
                }}"""
c = content.count(old_menu)
if c > 0:
    content = content.replace(old_menu, new_menu, 1)
    print("Reverted header action menu onClick handler")
else:
    old_menu_rn = old_menu.replace('\n', '\r\n')
    new_menu_rn = new_menu.replace('\n', '\r\n')
    c = content.count(old_menu_rn)
    if c > 0:
        content = content.replace(old_menu_rn, new_menu_rn, 1)
        print("Reverted header action menu onClick handler (CRLF)")

# 3. Remove the "Revisar con Ollama/ChatGPT Bridge" start button from footer
old_footer = """                <div className="flex gap-2">
                  {panel.kind === "review" && !panel.result && !panel.loading ? (
                    <Button type="button" data-testid="ai-budget-review-start" onClick={() => onRetryWithProvider?.(panel.selectedProvider)}>
                      {panel.selectedProvider === "chatgpt_bridge" ? "Revisar con ChatGPT Bridge" : "Revisar con Ollama"}
                    </Button>
                  ) : null}
                  {panel.kind === "autocomplete" ? ("""
new_footer = """                <div className="flex gap-2">
                  {panel.kind === "autocomplete" ? ("""
c = content.count(old_footer)
if c > 0:
    content = content.replace(old_footer, new_footer, 1)
    print("Removed start button from footer")
else:
    print("WARNING: Could not find start button in footer!")

# 4. Make provider toggle NOT disabled during loading
# Change: disabled={panel.loading} to nothing (remove disabled)
old_disabled = 'disabled={panel.loading}'
# There are two toggle buttons with this disabled
c = content.count(old_disabled)
if c > 0:
    content = content.replace(old_disabled, '', c)
    print(f"Removed {c} disabled={panel.loading} from toggle buttons")

# Also remove disabled from the second button
old_disabled2 = 'disabled={panel.loading}'
# Already handled above if there's only one variant

write_file(path, content)
print("budget-editor.tsx updated successfully!")

# =========== EDIT test file ===========
test_path = 'components/budget/budget-editor.view-mode.test.tsx'
test_content = read_file(test_path)

# Revert test to original - just the single click
old_test = """    await act(async () => {
      getButtonByText("Revisar Presupuesto").click();
    });

    await act(async () => {
      const startButton = document.querySelector('[data-testid="ai-budget-review-start"]');
      (startButton as HTMLElement)?.click();
    });"""

new_test = """    await act(async () => {
      getButtonByText("Revisar Presupuesto").click();
    });"""

if old_test in test_content:
    test_content = test_content.replace(old_test, new_test, 1)
    print("Test reverted to original (single click)")
else:
    # Try with different whitespace
    print("WARNING: Could not find test pattern to revert!")
    # Print the actual lines around the test to debug
    lines = test_content.split('\n')
    for i, line in enumerate(lines):
        if 'Revisar Presupuesto' in line and 'click' in line:
            print(f"  Found at line {i+1}: {line.strip()}")
        if 'startButton' in line:
            print(f"  Found at line {i+1}: {line.strip()}")

write_file(test_path, test_content)
print("Test file updated successfully!")
