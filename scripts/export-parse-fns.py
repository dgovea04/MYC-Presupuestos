import re

path = "components/budget/budget-editor.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add export to isRecord
content = content.replace(
    "function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === \"object\" && value !== null;\n}\n\nfunction readBridgeAiResult",
    "export function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === \"object\" && value !== null;\n}\n\nfunction readBridgeAiResult",
    1
)

# Add re-export for tryParseJsonFromRawText before calculateCodeInputWidth
content = content.replace(
    "  return null;\n}\n\nfunction calculateCodeInputWidth",
    "  return null;\n}\n\nexport { tryParseJsonFromRawText };\n\nfunction calculateCodeInputWidth",
    1
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
