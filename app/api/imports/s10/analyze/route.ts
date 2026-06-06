import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createS10ImportPreview } from "@/lib/s10/s2k-analyzer";

const maxS2kUploadBytes = 80 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .s2k para analizar." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".s2k")) {
      return NextResponse.json({ error: "El archivo debe tener extension .s2k." }, { status: 400 });
    }

    if (file.size > maxS2kUploadBytes) {
      return NextResponse.json({ error: "El archivo .s2k supera el limite de 80 MB para analisis local." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const preview = createS10ImportPreview({
      fileName: file.name,
      buffer: Buffer.from(arrayBuffer),
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("S10 analyze POST failed", error);
    return NextResponse.json({ error: "No se pudo analizar el archivo S10." }, { status: 500 });
  }
}
