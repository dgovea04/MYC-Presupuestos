with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """  .map((finding) => {
    severity: resolveFindingSeverity(finding),
    type: resolveFindingType(finding),
    description: typeof finding.description === \"string\" ? finding.description : \"\",
    impact: buildFindingImpact(finding),
    recommendedAction: typeof finding.recommended_review === \"string\" ? finding.recommended_review : \"\",
  };
});"""

new = """  .map((finding) => ({
    severity: resolveFindingSeverity(finding),
    type: resolveFindingType(finding),
    description: typeof finding.description === \"string\" ? finding.description : \"\",
    impact: buildFindingImpact(finding),
    recommendedAction: typeof finding.recommended_review === \"string\" ? finding.recommended_review : \"\",
  }));
});"""

if old not in content:
    print("Old string NOT found - searching alternatives...")
    # Find the exact content
    idx = content.find(".map((finding) => {")
    if idx >= 0:
        print(f"Found at index {idx}")
        print(content[idx:idx+350])
else:
    content = content.replace(old, new, 1)
    with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed .map() syntax")
