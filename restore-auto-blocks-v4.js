const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const novitecFixed = '{/* NOVITEC */}\n' +
'            <motion.button\n' +
'              onClick={() => handleBrandClick(\'Novitec\')}\n' +
'              initial={{ opacity: 0, y: 60 }}\n' +
'              whileInView={{ opacity: 1, y: 0 }}\n' +
'              viewport={{ once: true }}\n' +
'              transition={{ duration: 0.7, delay: 0.4 }}\n' +
'              className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"\n' +
'            >';

const abtFixed = '{/* ABT */}\n' +
'            <motion.button\n' +
'              onClick={() => handleBrandClick(\'ABT\')}\n' +
'              initial={{ opacity: 0, y: 60 }}\n' +
'              whileInView={{ opacity: 1, y: 0 }}\n' +
'              viewport={{ once: true }}\n' +
'              transition={{ duration: 0.7, delay: 0.45 }}\n' +
'              className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"\n' +
'            >';

const regex = /\s+sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-\[2rem\] sm:rounded-\[2\.5rem\] text-left"\s*>/g;

let matchCount = 0;
content = content.replace(regex, (match) => {
    matchCount++;
    if (matchCount === 1) {
        return novitecFixed;
    } else if (matchCount === 2) {
        return abtFixed;
    }
    return match;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + matchCount + ' broken blocks.');
