const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cs = await p.shopCustomer.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Кост', mode: 'insensitive' } },
        { companyName: { contains: 'Казах', mode: 'insensitive' } },
        { region: { contains: 'KZ', mode: 'insensitive' } },
        { region: { contains: 'Казах', mode: 'insensitive' } },
        { email: { contains: 'kost', mode: 'insensitive' } },
        { companyName: { contains: 'Kost', mode: 'insensitive' } },
      ]
    },
    select: { id: true, email: true, firstName: true, lastName: true, companyName: true, region: true, group: true }
  });
  console.log('Found Kostya/KZ:', JSON.stringify(cs, null, 2));
  console.log('Total customers:', await p.shopCustomer.count());

  try {
    const crm = await p.crmCustomer.findMany({
      where: { OR: [{ name: { contains: 'Кост', mode: 'insensitive' } }, { name: { contains: 'Казах', mode: 'insensitive' } }] },
      select: { id: true, airtableId: true, name: true, email: true, country: true }
    });
    console.log('CRM matches:', JSON.stringify(crm, null, 2));
  } catch(e) { console.log('CRM error:', e.message); }

  process.exit(0);
}
main();
