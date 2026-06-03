import { describe, expect, it } from "vitest";

import { suggestResourceIuCodes } from "@/lib/resources/iu-suggestions";

describe("suggestResourceIuCodes", () => {
  it("suggests dictionary alternatives for an angle resource without current IU", () => {
    const suggestions = suggestResourceIuCodes({
      description: 'ANGULO 2" x 2" x 3/16" x 6 M',
      dictionaryRows: [
        { code: "51", element: "Angulo de acero al carbono", note: null },
        { code: "52", element: "Ángulo de aluminio", note: null },
        { code: "85", element: "Angulo perimetral", note: "1/" },
      ],
      unifiedIndexRows: [],
      maxSuggestions: 3,
    });

    expect(suggestions.map((suggestion) => suggestion.code)).toContain("51");
    expect(suggestions.map((suggestion) => suggestion.code)).toContain("52");
  });

  it("prefers material-specific dictionary matches", () => {
    const suggestions = suggestResourceIuCodes({
      description: "ANGULO DE ALUMINIO 2 X 2",
      dictionaryRows: [
        { code: "51", element: "Angulo de acero al carbono", note: null },
        { code: "52", element: "Ángulo de aluminio", note: null },
      ],
      unifiedIndexRows: [],
    });

    expect(suggestions[0]).toMatchObject({ code: "52" });
  });
});
