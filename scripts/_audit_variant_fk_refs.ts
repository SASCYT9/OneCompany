import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  // Count cart/order items referencing iPE variants
  const ipeVariantIds = await p.shopProductVariant.findMany({
    where: { product: { brand: { contains: "iPE", mode: "insensitive" } } },
    select: { id: true },
  });
  const ids = ipeVariantIds.map((v) => v.id);
  const cartRefs = await p.shopCartItem.count({ where: { variantId: { in: ids } } });
  const orderRefs = await p.shopOrderItem.count({ where: { variantId: { in: ids } } });
  console.log("iPE variants total:", ids.length);
  console.log("  referenced by ShopCartItem: ", cartRefs);
  console.log("  referenced by ShopOrderItem:", orderRefs);
  await p.$disconnect();
})();
