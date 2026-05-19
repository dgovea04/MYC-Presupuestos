import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReportResponsibleMeta } from "@/types/report-meta";

type SupportedImageExtension = "png" | "jpeg" | "jpg";

export type ReportIdentityAsset = {
  buffer: Buffer;
  extension: SupportedImageExtension;
};

export type ReportIdentityAssets = {
  avatar: ReportIdentityAsset | null;
  companyLogo: ReportIdentityAsset | null;
};

function getExtensionFromPublicUrl(publicUrl: string): SupportedImageExtension | null {
  const extension = path.extname(publicUrl).toLowerCase();

  if (extension === ".png") return "png";
  if (extension === ".jpg") return "jpg";
  if (extension === ".jpeg") return "jpeg";
  return null;
}

async function loadPublicImageAsset(publicUrl: string | null | undefined): Promise<ReportIdentityAsset | null> {
  if (!publicUrl || !publicUrl.startsWith("/")) {
    return null;
  }

  const extension = getExtensionFromPublicUrl(publicUrl);
  if (!extension) {
    return null;
  }

  const normalizedRelativePath = publicUrl.replace(/^\/+/, "").replace(/\//g, path.sep);
  const absolutePath = path.resolve(process.cwd(), "public", normalizedRelativePath);
  const publicRoot = path.resolve(process.cwd(), "public");

  if (!absolutePath.startsWith(publicRoot)) {
    return null;
  }

  try {
    const buffer = await readFile(absolutePath);
    return { buffer, extension };
  } catch {
    return null;
  }
}

export async function loadReportIdentityAssets(responsible?: ReportResponsibleMeta): Promise<ReportIdentityAssets> {
  const [avatar, companyLogo] = await Promise.all([
    loadPublicImageAsset(responsible?.avatarUrl),
    loadPublicImageAsset(responsible?.companyLogoUrl),
  ]);

  return {
    avatar,
    companyLogo,
  };
}
