import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { profileWorkScheduleSectionLoad } from "@/lib/data/work-schedule";

async function main() {
  const args = process.argv.slice(2);
  const includeFullView = args.includes("--full");
  const positionalArgs = args.filter((arg) => arg !== "--full");
  const [budgetId, userId] = positionalArgs;

  if (!budgetId || !userId) {
    throw new Error("Uso: node ./node_modules/tsx/dist/cli.mjs scripts/profile-work-schedule.ts <budgetId> <userId> [--full]");
  }

  console.log(`Modo: ${includeFullView ? "full" : "overview"}`);

  const profile = await profileWorkScheduleSectionLoad(budgetId, userId, {
    includeFullView,
  });

  console.log(`Perfil cronograma: ${profile.projectName}`);
  console.log(`Budget: ${profile.budgetId}`);
  console.log("");
  console.log("Timings (ms)");
  console.log(JSON.stringify(profile.timingsMs, null, 2));
  console.log("");
  console.log("Dataset");
  console.log(JSON.stringify(profile.dataset, null, 2));
  console.log("");
  console.log("Payload bytes");
  console.log(JSON.stringify(profile.payloadBytes, null, 2));
  console.log("");
  console.log("Memory (MB)");
  console.log(JSON.stringify(profile.memoryMb, null, 2));
  console.log("");
  console.log("JSON");
  console.log(JSON.stringify(profile, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
