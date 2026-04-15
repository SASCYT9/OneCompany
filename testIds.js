const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const testIds = ['cm23p5n7l0001lq0cqj8kpsb3', 'cm23p5n4y0000lq0cwgmybmsf'];
    for(const id of testIds) {
      try { 
          await prisma.shopProduct.delete({where: {id}}); 
          console.log('deleted', id);
      } 
      catch (e) { console.log('cant delete', id, e.message); }
    }
}
main().finally(() => prisma.$disconnect());
