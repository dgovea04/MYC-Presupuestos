import { describe, expect, it } from "vitest";
import {
  getNextGeneralExpenseItemCode,
  getNextGeneralExpenseTitleCode,
} from "@/lib/general-expenses/code-generation";

describe("general expense code generation", () => {
  it("generates the next title code from existing siblings", () => {
    expect(getNextGeneralExpenseTitleCode("1", ["1.1", "1.2", "1.9"])).toBe("1.10");
    expect(getNextGeneralExpenseTitleCode("2", [])).toBe("2.1");
  });

  it("generates the next item code from existing siblings", () => {
    expect(getNextGeneralExpenseItemCode("1.4", ["1.4.1", "1.4.2", "1.4.11"])).toBe("1.4.12");
    expect(getNextGeneralExpenseItemCode("2.3", [])).toBe("2.3.1");
  });
});
