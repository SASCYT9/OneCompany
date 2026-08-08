import { prisma } from "../src/lib/prisma";
import { resolveCanonicalShopAiExactSku } from "../src/lib/shopAiStrictRepository";

function parseArguments(argv: string[]) {
  const unknown = argv.filter(
    (argument) => argument !== "--expect-v2-excluded" && !argument.startsWith("--sku=")
  );
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
  const sku = argv
    .find((argument) => argument.startsWith("--sku="))
    ?.slice("--sku=".length)
    .trim();
  if (!sku) throw new Error("Exact-SKU canary requires --sku=<catalog SKU>");
  return { sku, expectV2Excluded: argv.includes("--expect-v2-excluded") };
}

async function main() {
  const { sku, expectV2Excluded } = parseArguments(process.argv.slice(2));
  const resolution = await resolveCanonicalShopAiExactSku(`SKU ${sku}`);
  if (!resolution.available || !resolution.requested || !resolution.matched) {
    throw new Error(`Exact-SKU identity lookup did not match ${sku}`);
  }
  if (resolution.matches.length !== 1) {
    throw new Error(
      `Exact-SKU identity lookup for ${sku} is ambiguous (${resolution.matches.length})`
    );
  }
  const knowledge = await prisma.shopProductKnowledge.findMany({
    where: { productId: { in: resolution.matches.map((match) => match.productId) } },
    select: { productId: true, schemaVersion: true, status: true },
  });
  if (expectV2Excluded && knowledge.some((record) => record.schemaVersion >= 2)) {
    throw new Error(`Exact-SKU canary expected ${sku} to be excluded from Knowledge V2`);
  }
  console.log(
    JSON.stringify(
      {
        passed: true,
        sku,
        identityContract: {
          matchStatus: "exact",
          matchBasis: "identity",
          fitmentClaim: false,
        },
        matches: resolution.matches,
        knowledge,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
