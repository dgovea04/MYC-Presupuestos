import { prisma } from "../lib/db/prisma";
import JSZip from "jszip";

async function main() {
  const pkg = await prisma.storedProjectPackage.findFirst({
    where: { projectName: { contains: "Vivienda Template" } },
    select: { id: true, projectName: true, mcpContent: true },
  });

  if (!pkg) {
    console.log("❌ No se encontró el paquete 'Vivienda Template' en la BD.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📦 Paquete: ${pkg.projectName} (${pkg.id})`);

  const zip = await JSZip.loadAsync(Buffer.from(pkg.mcpContent, "base64"));

  // List ALL files in the .mcp
  console.log("\n📁 Archivos en el .mcp:");
  const fileNames: string[] = [];
  zip.forEach((relativePath) => fileNames.push(relativePath));
  fileNames.sort().forEach((f) => console.log(`   ${f}`));

  // Check project-resources.json
  const resourcesFile = zip.file("budgets/project-resources.json");
  if (!resourcesFile) {
    console.log("\n⚠️  NO existe 'budgets/project-resources.json'");
    console.log("   → El .mcp fue exportado sin project_resources.");
    console.log("   → Esto explica por qué los insumos no tienen nombres ni aparecen en la lista de insumos.");
  } else {
    const content = JSON.parse(await resourcesFile.async("string"));
    console.log(`\n✅ 'budgets/project-resources.json' existe`);
    console.log(`   Resources: ${content.resources?.length ?? 0}`);
    if (content.resources?.length > 0) {
      console.log("   Muestra:");
      content.resources.slice(0, 5).forEach((r: any) => {
        console.log(`     - ${r.code} | ${r.description} | ${r.unit} | S/ ${r.unitPrice}`);
      });
    }
  }

  // Check apus.json for resourceDescription
  const apusFile = zip.file("budgets/apus.json");
  if (apusFile) {
    const apusData = JSON.parse(await apusFile.async("string"));
    const apus = apusData.apus ?? [];
    let totalResources = 0;
    let resourcesWithDesc = 0;
    let resourcesWithoutDesc = 0;

    for (const apu of apus) {
      for (const res of apu.resources ?? []) {
        totalResources++;
        if (res.resourceDescription) {
          resourcesWithDesc++;
        } else {
          resourcesWithoutDesc++;
        }
      }
    }

    console.log(`\n📊 'budgets/apus.json':`);
    console.log(`   APUs: ${apus.length}`);
    console.log(`   Total resources: ${totalResources}`);
    console.log(`   Con resourceDescription: ${resourcesWithDesc}`);
    console.log(`   Sin resourceDescription: ${resourcesWithoutDesc}`);

    if (resourcesWithoutDesc > 0 && resourcesWithDesc === 0) {
      console.log("   ⚠️  NINGÚN recurso tiene resourceDescription");
      console.log("   → Los insumos en los APU aparecerán sin nombre/descripción.");
    }

    // Show sample of resources
    if (apus.length > 0 && apus[0].resources?.length > 0) {
      console.log("\n   Muestra del primer APU:");
      const firstApu = apus[0];
      console.log(`   APU: ${firstApu.name} (${firstApu.unit})`);
      firstApu.resources.slice(0, 3).forEach((r: any) => {
        console.log(`     - type: ${r.resourceType} | qty: ${r.quantity} | unitPrice: ${r.unitPrice} | desc: "${r.resourceDescription ?? '(vacío)'}"`);
      });
    }
  } else {
    console.log("\n⚠️  NO existe 'budgets/apus.json'");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
