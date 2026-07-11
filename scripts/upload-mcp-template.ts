/**
 * Script para cargar un archivo .mcp como plantilla en StoredProjectPackage.
 * Detecta duplicados por (companyId, projectName) y pregunta antes de sobrescribir.
 *
 * Uso:
 *   npx tsx scripts/upload-mcp-template.ts <ruta-archivo.mcp> <userId> <companyId> [projectType] [--force]
 *
 * Ejemplo:
 *   npx tsx scripts/upload-mcp-template.ts presupuesto-ejemplo/exportados/vivienda-template.mcp user_xxx comp_xxx vivienda
 *   npx tsx scripts/upload-mcp-template.ts presupuesto-ejemplo/exportados/vivienda-template.mcp user_xxx comp_xxx vivienda --force
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { basename } from "node:path";
import { storeProjectPackage, findExistingPackage } from "@/lib/data/stored-project-packages";
import { prisma } from "@/lib/db/prisma";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("Uso: npx tsx scripts/upload-mcp-template.ts <ruta-archivo.mcp> <userId> <companyId> [projectType] [--force]");
    process.exit(1);
  }

  const filePath = args[0];
  const userId = args[1];
  const companyId = args[2];
  const projectType = args[3] && !args[3].startsWith("--") ? args[3] : "";
  const force = args.includes("--force");

  // Leer el archivo .mcp
  console.log(`Leyendo archivo: ${filePath}`);
  const content = readFileSync(filePath);

  // Derivar nombre del proyecto desde el nombre del archivo
  const fileName = basename(filePath, ".mcp");
  const projectName = fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  console.log(`Nombre del proyecto: "${projectName}"`);
  console.log(`Tipo: "${projectType || "(no especificado)"}"`);
  console.log(`Tamaño: ${(content.length / 1024).toFixed(1)} KB`);

  // Verificar que el usuario y empresa existen
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`Usuario "${userId}" no encontrado.`);
    process.exit(1);
  }

  console.log(`Usuario: ${user.name} (${user.email})`);

  const membership = await prisma.companyMembership.findFirst({
    where: { userId, companyId, status: "ACTIVE" },
    select: { company: { select: { id: true, name: true } } },
  });

  if (!membership) {
    console.error(`El usuario no es miembro activo de la empresa "${companyId}".`);
    process.exit(1);
  }

  console.log(`Empresa: ${membership.company.name} (${membership.company.id})`);

  // Verificar si ya existe un paquete con el mismo nombre en esta empresa
  const existing = await findExistingPackage(companyId, projectName);

  if (existing) {
    console.log(`\n⚠️  Ya existe una plantilla con el mismo nombre:`);
    console.log(`   ID: ${existing.id}`);
    console.log(`   Nombre: ${existing.projectName}`);
    console.log(`   Tipo actual: ${existing.projectType}`);
    console.log(`   Creado: ${existing.createdAt}`);

    if (force) {
      console.log(`   Modo --force: se sobrescribirá automáticamente.`);
    } else {
      const answer = await ask(`\n¿Sobrescribir con el nuevo contenido? (s/N): `);
      if (answer.toLowerCase() !== "s" && answer.toLowerCase() !== "si" && answer.toLowerCase() !== "sí") {
        console.log("Cancelado. No se realizaron cambios.");
        await prisma.$disconnect();
        process.exit(0);
      }
    }
  }

  // Guardar en StoredProjectPackage (upsert automático)
  const stored = await storeProjectPackage({
    projectName,
    projectType,
    description: `Plantilla cargada manualmente: ${projectName} (${projectType || "Sin tipo"})`,
    content,
    companyId,
    userId,
  });

  const action = stored.updated ? "actualizada" : "guardada";
  console.log(`\n✅ Plantilla .mcp ${action} exitosamente:`);
  console.log(`   ID: ${stored.id}`);
  console.log(`   Nombre: ${stored.projectName}`);
  console.log(`   Tipo: ${stored.projectType || "(no especificado)"}`);
  console.log(`   Fecha: ${stored.createdAt}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
