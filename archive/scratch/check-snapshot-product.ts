import fs from 'fs';
import path from 'path';

function main() {
  const snapshotPath = path.join('d:', 'One Company', 'OneCompany', 'data', 'shop-products.snapshot.json');
  const products = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const target = products.find((p: any) => p.slug === 'urb-sid-26006229-v1');
  if (target) {
    console.log('Product in snapshot:');
    console.log(JSON.stringify(target, null, 2));
  } else {
    console.log('Product urb-sid-26006229-v1 not found in snapshot!');
  }
}

main();
