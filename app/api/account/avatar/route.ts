import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteStoredAvatar, storeAvatarFile } from "@/lib/account/avatar-storage";
import { getAuthSession } from "@/lib/auth/session";
import { clearUserAvatar, getUserAccount, updateUserAccountAvatar } from "@/lib/data/account";
import { accountAvatarUploadSchema } from "@/lib/validations/account";

const AVATAR_VALIDATION_ERROR = "Revisa la imagen seleccionada e intenta nuevamente.";
const AVATAR_SAVE_ERROR = "No se pudo guardar la imagen de perfil.";

function revalidateAccountPaths() {
  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/budgets");
  revalidatePath("/resources");
  revalidatePath("/settings");
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let storedAvatarUrl: string | null = null;

  try {
    const currentAccount = await getUserAccount(session.user.id);
    const formData = await request.formData();
    const payload = accountAvatarUploadSchema.parse({
      avatar: formData.get("avatar"),
    });
    const avatarFile = payload.avatar as File;

    storedAvatarUrl = await storeAvatarFile(session.user.id, avatarFile);
    const account = await updateUserAccountAvatar(session.user.id, storedAvatarUrl);

    if (currentAccount.avatarUrl && currentAccount.avatarUrl !== storedAvatarUrl) {
      await deleteStoredAvatar(currentAccount.avatarUrl);
    }

    revalidateAccountPaths();

    return NextResponse.json(account);
  } catch (error) {
    if (storedAvatarUrl) {
      await deleteStoredAvatar(storedAvatarUrl);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: AVATAR_VALIDATION_ERROR }, { status: 400 });
    }

    return NextResponse.json({ error: AVATAR_SAVE_ERROR }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const currentAccount = await getUserAccount(session.user.id);

    if (currentAccount.avatarUrl) {
      await deleteStoredAvatar(currentAccount.avatarUrl);
    }

    const account = await clearUserAvatar(session.user.id);

    revalidateAccountPaths();

    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: AVATAR_SAVE_ERROR }, { status: 400 });
  }
}
