import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("adds the secondary visual treatment without changing the default variant", () => {
    const defaultMarkup = renderToStaticMarkup(<Badge>Default</Badge>);
    const secondaryMarkup = renderToStaticMarkup(<Badge variant="secondary">Secondary</Badge>);

    expect(defaultMarkup).toContain("bg-[var(--app-surface-muted)]");
    expect(defaultMarkup).not.toContain("border-[var(--app-border)]");
    expect(secondaryMarkup).toContain("border-[var(--app-border)]");
    expect(secondaryMarkup).toContain("bg-[var(--app-surface)]");
  });
});
