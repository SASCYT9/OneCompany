import { prisma } from "../src/lib/prisma";
import { collectShopAiV2DataReadiness } from "../src/lib/shopAiV2DataReadiness";

async function main() {
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--require-ready");
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  }

  const readiness = await collectShopAiV2DataReadiness(prisma);
  console.log(JSON.stringify(readiness, null, 2));
  if (process.argv.includes("--require-ready") && !readiness.passed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
