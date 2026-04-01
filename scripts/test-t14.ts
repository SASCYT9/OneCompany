import { fetchTurn14Brands } from '../src/lib/turn14.ts';

async function run() {
  try {
    const brandsRes = await fetchTurn14Brands();
    const items = brandsRes.data || (Array.isArray(brandsRes) ? brandsRes : []);
    
    console.log(`Total brands: ${items.length}`);
    
    // Dump first 5
    items.slice(0, 5).forEach((b: any) => {
      console.log(`- ${b.attributes?.name || b.name} (ID: ${b.id})`);
    });
    
    // Find Eventuri or Burger
    const ev = items.find((b: any) => (b.attributes?.name || b.name || '').toLowerCase().includes('eventuri'));
    console.log('Eventuri lookup:', ev?.attributes?.name, ev?.id);

    const bg = items.find((b: any) => (b.attributes?.name || b.name || '').toLowerCase().includes('burger'));
    console.log('Burger lookup:', bg?.attributes?.name, bg?.id);
    
    const kw = items.find((b: any) => (b.attributes?.name || b.name || '').toLowerCase().includes('kw'));
    console.log('KW lookup:', kw?.attributes?.name, kw?.id);

    if (kw?.id) {
       console.log('Testing KW items...');
       const { searchTurn14Items } = await import('../src/lib/turn14.ts');
       const res = await searchTurn14Items('', 1, { brandId: kw.id });
       if (res.data?.length > 0) {
          console.log(JSON.stringify(res.data[0], null, 2));
       }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
