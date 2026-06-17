import { describe, expect, it } from "vitest";
import { formatAiText } from "@/lib/ai/formatting";

describe("formatAiText", () => {
  it("strips HTML line breaks and replaces with newlines", () => {
    expect(formatAiText("line1<br>line2")).toBe("line1\nline2");
    expect(formatAiText("line1<br/>line2")).toBe("line1\nline2");
    expect(formatAiText("line1<br />line2")).toBe("line1\nline2");
    expect(formatAiText("line1<BR>line2")).toBe("line1\nline2");
  });

  it("converts consecutive <br> tags into double newlines (paragraph separator)", () => {
    expect(formatAiText("line1<br><br>line2")).toBe("line1\n\nline2");
    expect(formatAiText("line1<br/><br/>line2")).toBe("line1\n\nline2");
    expect(formatAiText("line1<br> <br>line2")).toBe("line1\n\nline2");
    expect(formatAiText("line1<br>\n<br>line2")).toBe("line1\n\nline2");
    expect(formatAiText("line1<br><br><br>line2")).toBe("line1\n\nline2");
  });

  it("preserves single <br> as single newline even with other content nearby", () => {
    expect(formatAiText("a<br>b<br><br>c")).toBe("a\nb\n\nc");
  });

  it("strips HTML tags while preserving inner text", () => {
    expect(formatAiText("<strong>bold</strong>")).toBe("bold");
    expect(formatAiText("<em>italic</em>")).toBe("italic");
    expect(formatAiText('<span class="foo">text</span>')).toBe("text");
    expect(formatAiText("<div>block</div>")).toBe("block");
    expect(formatAiText("<p>paragraph</p>")).toBe("paragraph");
    expect(formatAiText("<b>old bold</b>")).toBe("old bold");
    expect(formatAiText("<i>italic</i>")).toBe("italic");
    expect(formatAiText('<a href="url">link</a>')).toBe("link");
  });

  it("strips unknown HTML tags", () => {
    expect(formatAiText("<blockquote>quote</blockquote>")).toBe("quote");
    expect(formatAiText("<hr>")).toBe("");
  });

  it("preserves markdown inline formatting markers (handled by renderer later)", () => {
    expect(formatAiText("**bold text**")).toBe("**bold text**");
    expect(formatAiText("*italic text*")).toBe("*italic text*");
    expect(formatAiText("`code`")).toBe("`code`");
    expect(formatAiText("[link](https://example.com)")).toBe("[link](https://example.com)");
    expect(formatAiText("~~strikethrough~~")).toBe("~~strikethrough~~");
    expect(formatAiText("text with **bold** and *italic* and `code`")).toBe("text with **bold** and *italic* and `code`");
  });

  it("normalizes 3+ consecutive newlines to 2", () => {
    expect(formatAiText("line1\n\n\n\nline2")).toBe("line1\n\nline2");
    expect(formatAiText("a\n\n\nb\n\n\nc")).toBe("a\n\nb\n\nc");
  });

  it("trims leading and trailing whitespace", () => {
    expect(formatAiText("  hello  ")).toBe("hello");
    expect(formatAiText("\n\nhello\n\n")).toBe("hello");
  });

  it("handles complex mixed content", () => {
    // Single <br> between items stays as single newlines
    const singleBr = "**Unidad y metrología**<br>189.71 PEN/m³ en sus componentes:<br>- Item 1<br>- Item 2";
    const singleResult = formatAiText(singleBr);
    expect(singleResult).toContain("**Unidad y metrología**");
    expect(singleResult).toContain("189.71 PEN/m³ en sus componentes:");
    expect(singleResult).toContain("- Item 1");
    expect(singleResult).toContain("- Item 2");
    expect(singleResult).not.toContain("<br>");
    expect(singleResult).not.toContain("<br/>");

    // Consecutive <br><br> creates paragraph separation for lists
    const doubleBr = "**Unidad y metrología**<br><br>189.71 PEN/m³ en sus componentes:<br><br>- Item 1<br>- Item 2";
    const doubleResult = formatAiText(doubleBr);
    expect(doubleResult).toContain("\n\n- Item 1");
    expect(doubleResult).toContain("- Item 2");
    expect(doubleResult).not.toContain("<br>");
  });

  it("handles empty input", () => {
    expect(formatAiText("")).toBe("");
  });

  it("handles input with only whitespace", () => {
    expect(formatAiText("   \n  \n  ")).toBe("");
  });

  it("handles text with no formatting", () => {
    const plain = "This is plain text without any formatting.";
    expect(formatAiText(plain)).toBe(plain);
  });
});
