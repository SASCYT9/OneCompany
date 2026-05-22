import * as crypto from "crypto";

const target = "2be9cc8f59be134cd4b2a17e0787035416e526b3d988bf670a616c45dbc467ca";

const candidates = [
  `-- AlterTable\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";`,
  `-- AlterTable\r\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";`,
  `-- AlterTable\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";\n`,
  `-- AlterTable\r\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";\r\n`,
  `/*\n  Warnings:\n\n  - You are about to drop the column \`hutkoPaymentId\` on the \`ShopOrder\` table. All the data in the column will be lost.\n\n*/\n-- AlterTable\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";`,
  `/*\r\n  Warnings:\r\n\r\n  - You are about to drop the column \`hutkoPaymentId\` on the \`ShopOrder\` table. All the data in the column will be lost.\r\n\r\n*/\r\n-- AlterTable\r\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";`,
  `/*\n  Warnings:\n\n  - You are about to drop the column \`hutkoPaymentId\` on the \`ShopOrder\` table. All the data in the column will be lost.\n\n*/\n-- AlterTable\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";\n`,
  `/*\r\n  Warnings:\r\n\r\n  - You are about to drop the column \`hutkoPaymentId\` on the \`ShopOrder\` table. All the data in the column will be lost.\r\n\r\n*/\r\n-- AlterTable\r\nALTER TABLE "ShopOrder" DROP COLUMN "hutkoPaymentId";\r\n`,
];

for (const c of candidates) {
  const hash = crypto.createHash("sha256").update(c).digest("hex");
  if (hash === target) {
    console.log("MATCH FOUND!");
    console.log(JSON.stringify(c));
    process.exit(0);
  }
}
console.log("No match found among basic candidates");
