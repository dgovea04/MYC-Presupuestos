# Fix: Move clearPendingBridgeTimeout inside BudgetEditor component
# The function references pendingBridgeTimeoutRef which is a useRef inside the component

target_file = "components/budget/budget-editor.tsx"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove the standalone clearPendingBridgeTimeout function at the bottom
old_standalone = """function clearPendingBridgeTimeout() {
  if (pendingBridgeTimeoutRef.current !== null) {
    window.clearTimeout(pendingBridgeTimeoutRef.current);
    pendingBridgeTimeoutRef.current = null;
  }
}"""

if old_standalone in content:
    content = content.replace(old_standalone, "")
    print("Removed standalone clearPendingBridgeTimeout")
else:
    print("Standalone clearPendingBridgeTimeout not found, checking...")
    # Check if it's there with a slightly different format
    if "function clearPendingBridgeTimeout" in content:
        print("Found but text doesn't match exactly")
    else:
        print("Not found at all")

# 2. Add a local clearPendingBridgeTimeout inside the component
# Find the scheduleCatalogClose function which is a good place to add it
# Add it right after scheduleCatalogClose

old_insertion = """  const scheduleCatalogClose = useCallback((rowId: string) => {"""

new_insertion = """  function clearPendingBridgeTimeout() {
    if (pendingBridgeTimeoutRef.current !== null) {
      window.clearTimeout(pendingBridgeTimeoutRef.current);
      pendingBridgeTimeoutRef.current = null;
    }
  }

  const scheduleCatalogClose = useCallback((rowId: string) => {"""

if old_insertion in content:
    content = content.replace(old_insertion, new_insertion)
    print("Added local clearPendingBridgeTimeout")
else:
    print("Could not find insertion point!")
    # Try to find scheduleCatalogClose regardless of whitespace
    import re
    matches = list(re.finditer(r'scheduleCatalogClose', content))
    print(f"Found {len(matches)} scheduleCatalogClose occurrences")
    for m in matches:
        print(f"  at position {m.start()}")

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
