const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const brokenString = '             sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"\n            >';

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

let matchCount = 0;
let index = content.indexOf(brokenString);

while (index !== -1) {
    matchCount++;
    let replacement = '';
    if (matchCount === 1) {
        replacement = novitecFixed;
    } else if (matchCount === 2) {
        replacement = abtFixed;
    }
    
    if (replacement) {
        content = content.substring(0, index) + replacement + content.substring(index + brokenString.length);
        // Adjust index to continue searching after replacement
        index = content.indexOf(brokenString, index + replacement.length);
    } else {
        index = content.indexOf(brokenString, index + 1);
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + matchCount + ' broken blocks.');
