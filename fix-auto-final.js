const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Layout for Novitec and ABT
// Find Novitec button and add col-span classes
content = content.replace(
    /(\{\/\* NOVITEC \*\/[\s\S]*?className="group relative) cursor-pointer/s,
    ' sm:col-span-2 lg:col-span-3 cursor-pointer'
);

// Find ABT button and add col-span classes
content = content.replace(
    /(\{\/\* ABT \*\/[\s\S]*?className="group relative) cursor-pointer/s,
    ' sm:col-span-2 lg:col-span-3 cursor-pointer'
);

// 2. Fix Text Encoding
const replacements = [
    { from: 'РўРёСРРЅРѕРІС РІРёСРРѕРїРЅС СЃРёСЃСРµРјРё РїСЂРµРјССѓРј РєРРСЃСѓ', to: 'Титанові вихлопні системи преміум класу' },
    { from: 'РџСЂРµРјССѓРј ССЋРЅСРЅРі', to: 'Преміум тюнінг' },
    { from: 'РљРѕРІРРЅС РґРёСЃРєРё РїСЂРµРјССѓРј РєРРСЃСѓ', to: 'Ковані диски преміум класу' },
    { from: 'РџСЂРµРјССѓРј РѕРРІССЃРё', to: 'Преміум обвіси' },
    { from: 'РРїСѓСЃРєРЅС СЃРёСЃСРµРјРё', to: 'Впускні системи' },
    { from: 'РџСРґРІССЃРєР', to: 'Підвіска' },
    { from: 'РЎСѓРїРµСЂРєРСЂ ССЋРЅСРЅРі', to: 'Суперкар тюнінг' },
    { from: 'Audi СР VW ССЋРЅСРЅРі', to: 'Audi та VW тюнінг' },
    { from: 'РСЂРµРЅРґСРІ', to: 'брендів' },
    { from: 'РџРѕРІРЅРёР№ РєРСРРРѕРі РїСЂРµРјССѓРј РРІСРѕРРРїСРСЃСРёРЅ СР РРєСЃРµСЃСѓРСЂСРІ', to: 'Повний каталог преміум автозапчастин та аксесуарів' },
    { from: 'РљРСРРРѕРі', to: 'Каталог' },
    { from: 'РСЂРµРЅРґРё, СРѕ СРѕСЂРјСѓСЋССЊ СРЅРґСѓСЃССЂССЋ', to: 'Бренди, що формують індустрію' },
    { from: 'РРµРіРµРЅРґРё', to: 'Легенди' }
];

replacements.forEach(rep => {
    // Use global replace to catch all occurrences
    content = content.split(rep.from).join(rep.to);
});

fs.writeFileSync(path, content, 'utf8');
console.log(' Fixed Novitec & ABT layout (full width)');
console.log(' Fixed Ukrainian text encoding');
