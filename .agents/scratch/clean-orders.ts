import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanOrders() {
  try {
    const deletedItems = await prisma.shopOrderItem.deleteMany({});
    const deletedOrders = await prisma.shopOrder.deleteMany({});
    
    console.log('--- CLEANUP SUCCESSFUL ---');
    console.log(`Deleted order items: ${deletedItems.count}`);
    console.log(`Deleted orders: ${deletedOrders.count}`);
  } catch (error) {
    console.error('Error deleting orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanOrders();
