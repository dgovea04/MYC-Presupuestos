import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const LOGO_DIRECTORY = path.join(process.cwd(), "public", "uploads", "logos");
const LOGO_PUBLIC_PREFIX = "/uploads/logos";

type StoredLogoFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  type: string;
};

function getLogoExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return null;
  }
}

async function ensureLogoDirectory() {
  await mkdir(LOGO_DIRECTORY, { recursive: true });
}

async function deleteLegacyLogos(companyId: string, keepFileName?: string) {
  await ensureLogoDirectory();
  const entries = await readdir(LOGO_DIRECTORY, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${companyId}-`) && entry.name !== keepFileName)
      .map((entry) => rm(path.join(LOGO_DIRECTORY, entry.name), { force: true })),
  );
}

export async function storeCompanyLogoFile(companyId: string, file: StoredLogoFile) {
  const extension = getLogoExtension(file.type);

  if (!extension) {
    throw new Error("Formato de logo no soportado.");
  }

  await ensureLogoDirectory();
  const fileName = `${companyId}-${Date.now()}.${extension}`;
  const targetPath = path.join(LOGO_DIRECTORY, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, fileBuffer);
  await deleteLegacyLogos(companyId, fileName);

  return `${LOGO_PUBLIC_PREFIX}/${fileName}`;
}

export async function deleteStoredCompanyLogo(logoUrl: string | null | undefined) {
  if (!logoUrl || !logoUrl.startsWith(`${LOGO_PUBLIC_PREFIX}/`)) {
    return;
  }

  const fileName = logoUrl.slice(`${LOGO_PUBLIC_PREFIX}/`.length);
  const targetPath = path.join(LOGO_DIRECTORY, fileName);

  if (!targetPath.startsWith(LOGO_DIRECTORY)) {
    throw new Error("Ruta de logo invalida.");
  }

  await rm(targetPath, { force: true });
}
