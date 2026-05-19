import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const AVATAR_DIRECTORY = path.join(process.cwd(), "public", "uploads", "avatars");
const AVATAR_PUBLIC_PREFIX = "/uploads/avatars";

type StoredAvatarFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  type: string;
};

function getAvatarExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return null;
  }
}

async function ensureAvatarDirectory() {
  await mkdir(AVATAR_DIRECTORY, { recursive: true });
}

async function deleteLegacyAvatars(userId: string, keepFileName?: string) {
  await ensureAvatarDirectory();
  const entries = await readdir(AVATAR_DIRECTORY, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${userId}-`) && entry.name !== keepFileName)
      .map((entry) => rm(path.join(AVATAR_DIRECTORY, entry.name), { force: true })),
  );
}

export async function storeAvatarFile(userId: string, file: StoredAvatarFile) {
  const extension = getAvatarExtension(file.type);

  if (!extension) {
    throw new Error("Formato de imagen no soportado.");
  }

  await ensureAvatarDirectory();
  const fileName = `${userId}-${Date.now()}.${extension}`;
  const targetPath = path.join(AVATAR_DIRECTORY, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, fileBuffer);
  await deleteLegacyAvatars(userId, fileName);

  return `${AVATAR_PUBLIC_PREFIX}/${fileName}`;
}

export async function deleteStoredAvatar(avatarUrl: string | null | undefined) {
  if (!avatarUrl || !avatarUrl.startsWith(`${AVATAR_PUBLIC_PREFIX}/`)) {
    return;
  }

  const fileName = avatarUrl.slice(`${AVATAR_PUBLIC_PREFIX}/`.length);
  const targetPath = path.join(AVATAR_DIRECTORY, fileName);

  if (!targetPath.startsWith(AVATAR_DIRECTORY)) {
    throw new Error("Ruta de avatar invalida.");
  }

  await rm(targetPath, { force: true });
}
