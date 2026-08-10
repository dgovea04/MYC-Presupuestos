import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appDirectory = path.join(process.cwd(), "app");

function collectLoadingFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectLoadingFiles(entryPath);
    }

    return entry === "loading.tsx" ? [entryPath] : [];
  });
}

function toProjectPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

describe("loading skeleton policy", () => {
  it("keeps route loading files on shared skeleton compositions", () => {
    const loadingFiles = collectLoadingFiles(appDirectory);
    const violations = loadingFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const fileLabel = toProjectPath(filePath);
      const fileViolations: string[] = [];

      if (source.includes("AppSkeletonBlock")) {
        fileViolations.push(`${fileLabel}: imports AppSkeletonBlock directly`);
      }

      if (source.includes("animate-pulse")) {
        fileViolations.push(`${fileLabel}: hand-rolls animate-pulse`);
      }

      if (!source.includes("@/components/loading") && !source.includes("@/components/ui/loading")) {
        fileViolations.push(`${fileLabel}: does not use shared loading skeletons`);
      }

      return fileViolations;
    });

    expect(violations).toEqual([]);
  });
});
