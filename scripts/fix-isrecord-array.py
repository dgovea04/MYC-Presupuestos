with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = 'function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null;\n}'
new = 'export function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}'

if old in content:
    content = content.replace(old, new, 1)
    with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed isRecord successfully")
else:
    print("Old string not found - checking current content...")
    # find the line
    for i, line in enumerate(content.split("\n")):
        if "function isRecord" in line:
            print(f"Line {i+1}: {line}")
        if "return typeof value" in line:
            print(f"Line {i+1}: {line}")
