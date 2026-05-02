import { PrismaClient } from '@prisma/client';
const p=new PrismaClient();
(async()=>{
  const r=await p.shopProduct.findFirst({
    where:{ OR:[{slug:'do88-big-310-cr'},{sku:{equals:'BIG-310-CR',mode:'insensitive'}}] },
    select:{slug:true,sku:true,titleEn:true,titleUa:true,priceEur:true,variants:{select:{sku:true,priceEur:true}}}
  });
  console.log(r);
  await p.$disconnect();
})();
