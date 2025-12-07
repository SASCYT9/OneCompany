const fs = require('fs');
let moto = fs.readFileSync('src/app/[locale]/moto/MotoPageClient.tsx', 'utf8');
moto = moto.replace(/className="group relative\s\s/g, 'className="group relative ');
fs.writeFileSync('src/app/[locale]/moto/MotoPageClient.tsx', moto, 'utf8');
console.log(' Fixed double spaces in moto className attributes');
