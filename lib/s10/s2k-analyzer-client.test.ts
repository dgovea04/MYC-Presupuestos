import { describe, expect, it, vi } from "vitest";

import { analyzeS2kFileLocally } from "@/lib/s10/s2k-analyzer-client";
import { s2kAnalysisReadBytes } from "@/lib/s10/s2k-analyzer";

describe("analyzeS2kFileLocally", () => {
  it("reads only the header slice and does not require an upload", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04]), new Uint8Array(20_000)],
      "obra.s2k",
    );
    const slice = vi.spyOn(file, "slice");

    const preview = await analyzeS2kFileLocally(file);

    expect(slice).toHaveBeenCalledWith(0, s2kAnalysisReadBytes);
    expect(preview.fileName).toBe("obra.s2k");
    expect(preview.analysis.detectedKind).toBe("zip");
    expect(preview.analysis.sizeBytes).toBe(file.size);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
