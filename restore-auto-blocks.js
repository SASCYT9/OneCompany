const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix Novitec
const novitecBroken =              sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;
const novitecFixed = {/* NOVITEC */}
            <motion.button
              onClick={() => handleBrandClick('Novitec')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;

// Fix ABT
const abtBroken =              sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;
const abtFixed = {/* ABT */}
            <motion.button
              onClick={() => handleBrandClick('ABT')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;

// We have two identical broken strings. We need to replace the first one with Novitec and the second with ABT.
let matchCount = 0;
// Escape regex special characters manually to avoid PowerShell issues with complex regex in string
const escapedBroken = novitecBroken.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'); 

content = content.replace(new RegExp(escapedBroken, 'g'), (match) => {
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
