import { prisma } from "@/lib/db/prisma";

export async function getKnowledgeEvidenceProvenance(evidenceId: string) {
  const evidence = await prisma.knowledgeEvidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      companyId: true,
      projectId: true,
      documentId: true,
      fileName: true,
      page: true,
      sheet: true,
      cellRange: true,
      url: true,
      quote: true,
      checksum: true,
      createdAt: true,
      source: { select: { id: true, label: true, sourceType: true, companyId: true, projectId: true, createdById: true } },
      reviewEvidenceLinks: {
        select: {
          reviewEvidenceId: true,
          relationType: true,
          companyId: true,
          projectId: true,
          reviewEvidence: {
            select: {
              id: true,
              companyId: true,
              projectId: true,
              documentVersionId: true,
              evidenceType: true,
              originalText: true,
              locationJson: true,
              documentVersion: {
                select: {
                  id: true,
                  versionNumber: true,
                  projectDocumentId: true,
                  projectDocument: { select: { id: true, name: true, originalFileName: true } },
                },
              },
              findings: { select: { id: true, findingType: true } },
            },
          },
        },
      },
    },
  });
  if (!evidence) throw new Error("Knowledge evidence not found");
  const reviewEvidence = evidence.reviewEvidenceLinks.map((link) => link.reviewEvidence);
  return {
    ...evidence,
    provenance: {
      documentId: evidence.documentId,
      fileName: evidence.fileName,
      documentVersionId: reviewEvidence[0]?.documentVersionId ?? null,
      documentVersion: reviewEvidence[0]?.documentVersion?.versionNumber ?? null,
      documentName: reviewEvidence[0]?.documentVersion?.projectDocument.name ?? null,
      findingIds: reviewEvidence.flatMap((row) => row.findings.map((finding) => finding.id)),
      findingTypes: reviewEvidence.flatMap((row) => row.findings.map((finding) => finding.findingType)),
      locations: reviewEvidence.map((row) => row.locationJson),
      reviewEvidenceIds: reviewEvidence.map((row) => row.id),
    },
  };
}
