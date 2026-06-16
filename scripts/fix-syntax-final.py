with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """      .map((finding) => (
        severity: resolveFindingSeverity(finding),
        type: resolveFindingType(finding),
        description: typeof finding.description === \"string\" ? finding.description : \"\",
        impact: buildFindingImpact(finding),
        recommendedAction: typeof finding.recommended_review === \"string\" ? finding.recommended_review : \"\",
      }))"""

new = """      .map((finding) => ({
        severity: resolveFindingSeverity(finding),
        type: resolveFindingType(finding),
        description: typeof finding.description === \"string\" ? finding.description : \"\",
        impact: buildFindingImpact(finding),
        recommendedAction: typeof finding.recommended_review === \"string\" ? finding.recommended_review : \"\",
      }))"""

# Hmm they look the same. Let me check the difference more carefully.
# The old has `(` after `=>` and old has `}))` at end
# The new should have `({` after `=>` and `}))` at end
# Actually both end in `}))` which is wrong - should be `}))`
# Wait, actually: `({ ... }) ));` would be: `({ ... })));`
# Let me re-read the correct format:
# .map((finding) => ({ ... }))
# So: `=> ({` ... `}))`

old = """      .map((finding) => (
        severity: resolveFindingSeverity(finding),"""

new = """      .map((finding) => ({
        severity: resolveFindingSeverity(finding),"""

content = content.replace(old, new, 1)

# Also fix the closing - the `}))` at end is actually correct for implicit return
# (it's `}))` closing: arrow params + implicit return parens + call chain
# But there might be an extra `;` or wrong closing
# Let me check the end

with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed")
