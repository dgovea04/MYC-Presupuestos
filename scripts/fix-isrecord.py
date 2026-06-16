with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = 'function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null;\n}'
new = 'function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}'

if old in content:
    content = content.replace(old, new, 1)
    with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed isRecord in budget-editor.tsx")
else:
    print("Pattern not found - checking for variations...")
    # Try to find and show the actual content
    idx = content.find("function isRecord(value: unknown): value is Record<string, unknown>")
    if idx >= 0:
        print("Found at index", idx)
        print(repr(content[idx:idx+120]))
