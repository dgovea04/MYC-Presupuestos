import "dotenv/config";
import {
  getDeploymentReadiness,
  resolveDeploymentTarget,
  type DeploymentTarget,
} from "@/lib/config/deployment-readiness";

function getTargetArgument(argv: readonly string[]): DeploymentTarget {
  const explicitTarget = argv.find((argument) => argument.startsWith("--target="))?.slice("--target=".length);
  const detectedTarget = explicitTarget ?? process.env.DEPLOYMENT_TARGET ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return resolveDeploymentTarget(detectedTarget);
}

function main() {
  if (process.argv.includes("--help")) {
    console.info("Uso: npm run check:deployment -- --target=staging|production");
    return;
  }

  const target = getTargetArgument(process.argv.slice(2));
  const result = getDeploymentReadiness(process.env, target);
  const status = result.ready ? "READY" : "NOT READY";

  console.info(`Deployment readiness: ${status}`);
  console.info(`Target: ${result.target}`);

  for (const check of result.checks) {
    const marker = check.status === "ok" ? "OK" : check.status === "warning" ? "WARN" : "ERROR";
    console.info(`[${marker}] ${check.key}: ${check.message}`);
  }

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
