const fs = require('fs');

// Fix AUTO page
let auto = fs.readFileSync('src/app/[locale]/auto/AutoPageClient.tsx', 'utf8');

// Replace the grid container to equal-width columns
auto = auto.replace(
  /\{\/\* Legendary Grid \*\/\}\s*<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">/,
  '{/* Legendary Grid - Equal Width Masonry */}\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 auto-rows-max">'
);

// Remove all col-span and row-span classes - make all cards equal width
auto = auto.replace(/className="group relative sm:col-span-2 lg:row-span-2 cursor-pointer/g, 'className="group relative cursor-pointer');
auto = auto.replace(/className="group relative lg:row-span-2 cursor-pointer/g, 'className="group relative cursor-pointer');
auto = auto.replace(/className="group relative col-span-6 sm:cursor-pointer/g, 'className="group relative cursor-pointer');

// Adjust hero cards to be taller with row-span-2
auto = auto.replace(
  /(\/\* AKRAPOVIC - Hero Card \*\/.*?className="group relative) cursor-pointer/s,
  '\ lg:row-span-2 cursor-pointer'
);
auto = auto.replace(
  /(\/\* BRABUS - Tall Card \*\/.*?className="group relative) cursor-pointer/s,
  '\ lg:row-span-2 cursor-pointer'
);

fs.writeFileSync('src/app/[locale]/auto/AutoPageClient.tsx', auto, 'utf8');
console.log(' Auto page grid fixed');

// Fix MOTO page
let moto = fs.readFileSync('src/app/[locale]/moto/MotoPageClient.tsx', 'utf8');

// Replace bento grid with equal-width masonry
moto = moto.replace(
  /\{\/\* Legendary Grid - Bento Layout \*\/\}\s*<div className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 auto-rows-\[minmax\(180px,auto\)\]">/,
  '{/* Legendary Grid - Equal Width Masonry */}\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 auto-rows-max">'
);

// Remove all col-span classes from moto cards
moto = moto.replace(/col-span-12 lg:col-span-6 row-span-2/g, 'lg:row-span-2');
moto = moto.replace(/col-span-6 lg:col-span-6 row-span-2/g, 'lg:row-span-2');
moto = moto.replace(/col-span-6 lg:col-span-4/g, '');
moto = moto.replace(/col-span-1/g, '');

fs.writeFileSync('src/app/[locale]/moto/MotoPageClient.tsx', moto, 'utf8');
console.log(' Moto page grid fixed');

console.log('\n Масонрі сітка готова!');
console.log('- Всі блоки мають однакову ширину (1/3 на desktop)');
console.log('- Деякі блоки вищі (row-span-2)');
console.log('- CTA блок внизу розтягнеться на всю ширину автоматично');
