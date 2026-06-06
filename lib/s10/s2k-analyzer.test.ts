import { describe, expect, it } from "vitest";

import { analyzeS2kBuffer, createS10ImportPreview } from "@/lib/s10/s2k-analyzer";

describe("analyzeS2kBuffer", () => {
  it("detects ZIP based S10 backups from the PK signature", () => {
    const result = analyzeS2kBuffer(Buffer.from("PK\u0003\u0004s10 payload"));

    expect(result.detectedKind).toBe("zip");
    expect(result.signature).toBe("PK");
    expect(result.recommendedAction).toContain("ZIP");
  });

  it("detects SQL Server tape backups from visible header text", () => {
    const result = analyzeS2kBuffer(Buffer.from("Microsoft Tape Format\u0000S10 backup"));

    expect(result.detectedKind).toBe("sql-server-backup");
    expect(result.asciiPreview).toContain("Microsoft Tape Format");
  });

  it("detects SQL Server backups from TAPE headers and UTF-16 metadata", () => {
    const result = analyzeS2kBuffer(
      Buffer.concat([
        Buffer.from([0x54, 0x41, 0x50, 0x45, 0x00, 0x00, 0x03, 0x00]),
        Buffer.from("Microsoft SQL Server", "utf16le"),
      ]),
    );

    expect(result.detectedKind).toBe("sql-server-backup");
    expect(result.signature).toBe("TAPE");
  });

  it("detects SQL Server backups when UTF-16 metadata starts after an odd offset", () => {
    const result = analyzeS2kBuffer(
      Buffer.concat([
        Buffer.from([0x54, 0x41, 0x50, 0x45, 0x00, 0x00, 0x03, 0x00, 0xff]),
        Buffer.from("Microsoft SQL Server", "utf16le"),
      ]),
    );

    expect(result.detectedKind).toBe("sql-server-backup");
  });

  it("detects SQLite database files from the sqlite header", () => {
    const result = analyzeS2kBuffer(Buffer.from("SQLite format 3\u0000rest"));

    expect(result.detectedKind).toBe("sqlite");
    expect(result.asciiPreview).toContain("SQLite format 3");
  });

  it("keeps unknown binary files analyzable without throwing", () => {
    const result = analyzeS2kBuffer(Buffer.from([0, 1, 2, 255, 16, 32, 48]));

    expect(result.detectedKind).toBe("unknown");
    expect(result.sizeBytes).toBe(7);
    expect(result.hexPreview).toBe("00 01 02 ff 10 20 30");
  });
});

describe("createS10ImportPreview", () => {
  it("reports that project import needs a concrete decoder after classification", () => {
    const preview = createS10ImportPreview({
      fileName: "obra.s2k",
      buffer: Buffer.from("PK\u0003\u0004s10 payload"),
    });

    expect(preview.fileName).toBe("obra.s2k");
    expect(preview.status).toBe("needs-decoder");
    expect(preview.analysis.detectedKind).toBe("zip");
    expect(preview.messages[0]).toContain("obra.s2k");
  });
});
