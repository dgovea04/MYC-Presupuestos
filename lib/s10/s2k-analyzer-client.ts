import { createS10ImportPreview, s2kAnalysisReadBytes, type S10ImportPreview } from "@/lib/s10/s2k-analyzer";

export async function analyzeS2kFileLocally(file: File): Promise<S10ImportPreview> {
  const header = await file.slice(0, s2kAnalysisReadBytes).arrayBuffer();

  return createS10ImportPreview({
    fileName: file.name,
    buffer: new Uint8Array(header),
    sizeBytes: file.size,
  });
}
