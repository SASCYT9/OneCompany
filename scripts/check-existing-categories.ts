import { PrismaClient } from '@prisma/client';
const p=new PrismaClient();
const skus=['FB01075','T9302','T9351','T9354','T9359','T9430','T9654','T9659','LF-190-CF','LF-190-PP','LF-190-Filter','ICM-380-S','CP-120-1','898199-5001W','898200-5001W','917056-5002S','WC-320'];
(async()=>{
  for(const sku of skus){
    const r=await p.shopProduct.findFirst({
      where:{ OR:[{sku:{equals:sku,mode:'insensitive'}},{sku:`do88-${sku}`}] },
      select:{slug:true,sku:true,titleEn:true,categoryEn:true,collectionEn:true,priceEur:true}
    });
    if(r) console.log(`  ${r.sku.padEnd(20)} €${String(r.priceEur).padStart(8)} | cat: ${(r.categoryEn||'(none)').slice(0,75)}`);
    else console.log(`  ${sku.padEnd(20)} (NOT FOUND)`);
  }
  await p.$disconnect();
})();
