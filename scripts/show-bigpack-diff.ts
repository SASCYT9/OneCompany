import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const skus=['BIG-310-T','BIG-360','BIG-M3-DCT','BIG-M3-Man','BIG-850-B-63r','BIG-200SV-Gen1-r','BIG-205SV-Gen1-r'];
  for (const sku of skus){
    const p = await prisma.shopProduct.findFirst({
      where:{ OR:[{sku},{sku:`do88-${sku}`},{sku:sku.toLowerCase()}] },
      select:{sku:true,titleEn:true,priceEur:true,slug:true}
    });
    if(p) console.log(`  DB  ${p.sku.padEnd(22)} €${String(p.priceEur).padStart(9)}  | ${p.titleEn}`);
    else console.log(`  DB  ${sku.padEnd(22)} ❌ not found`);
  }
}
main().finally(()=>prisma.$disconnect());
