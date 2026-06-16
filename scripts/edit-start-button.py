"""Add data-testid to the start review button in budget-editor.tsx"""
path = "components/budget/budget-editor.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add data-testid to the start button
old = '<Button type="button" onClick={() => onRetryWithProvider?.(panel.selectedProvider)}>\n                      {panel.selectedProvider === "chatgpt_bridge" ? "Revisar con ChatGPT Bridge" : "Revisar con Ollama"}'
new = '<Button type="button" data-testid="ai-budget-review-start" onClick={() => onRetryWithProvider?.(panel.selectedProvider)}>\n                      {panel.selectedProvider === "chatgpt_bridge" ? "Revisar con ChatGPT Bridge" : "Revisar con Ollama"}'

assert old in content, "Could not find the start button code"
content = content.replace(old, new, 1)

with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("data-testid added successfully!")
