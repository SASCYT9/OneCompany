import 'dotenv/config';
import { searchTurn14Items, fetchTurn14ItemDetail } from '../src/lib/turn14';

async function main() {
  console.log('Searching for "exhaust"...');
  const res = await searchTurn14Items('exhaust', 1, {});
  const firstItem = res.data[0];
  console.log('--- First Search Result ---');
  console.log(`ID: ${firstItem.id}`);
  console.log(`Name: ${firstItem.attributes.part_description}`);
  console.log(`Brand: ${firstItem.attributes.brand_name}`);
  
  console.log('\nFetching details for it...');
  const detail = await fetchTurn14ItemDetail(firstItem.id);
  const attr = detail.data.attributes;
  console.log('--- Detail Data Available ---');
  console.log(`Dimensions: ${JSON.stringify(attr.dimensions)}`);
  console.log(`Marketing Desc: ${attr.marketing_description ? 'YES' : 'NO'}`);
  console.log(`Files count: ${attr.files?.length || 0}`);
}
main().catch(console.error);
