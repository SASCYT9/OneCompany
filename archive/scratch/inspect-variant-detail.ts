import fs from 'fs';
import path from 'path';

function main() {
  const gpVariantsPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
  if (!fs.existsSync(gpVariantsPath)) {
    console.error('gp-portal-variants.json not found!');
    return;
  }

  const gpVariants = JSON.parse(fs.readFileSync(gpVariantsPath, 'utf8'));
  console.log(`Total variants: ${gpVariants.length}`);
  
  // Let's print the first product variant in full JSON
  const first = gpVariants.find((v: any) => v.sku === 'URB-SID-26006229-V1');
  if (first) {
    console.log('URB-SID-26006229-V1 in full:');
    console.log(JSON.stringify(first, null, 2));
  } else {
    console.log('URB-SID-26006229-V1 not found in variants!');
    console.log('First variant in full:');
    console.log(JSON.stringify(gpVariants[0], null, 2));
  }
}

main();
