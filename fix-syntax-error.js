const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix Akrapovic
const akrapovicFix = {/* AKRAPOVIC - Hero Card */}
            <motion.button
              onClick={() => handleBrandClick('Akrapovic')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;

// Fix Brabus
const brabusFix = {/* BRABUS - Tall Card */}
            <motion.button
              onClick={() => handleBrandClick('Brabus')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >;

// We need to be careful to replace the first occurrence with Akrapovic and the second with Brabus.
// The broken string is:
// { lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
//             >

const brokenStringRegex = /\{\s*lg:row-span-2 cursor-pointer overflow-hidden rounded-\[2rem\] sm:rounded-\[2\.5rem\] text-left"\s*>/g;

let matchCount = 0;
content = content.replace(brokenStringRegex, (match) => {
    matchCount++;
    if (matchCount === 1) {
        return akrapovicFix;
    } else if (matchCount === 2) {
        return brabusFix;
    }
    return match;
});

if (matchCount > 0) {
    fs.writeFileSync(path, content, 'utf8');
    console.log(Fixed  occurrences of broken syntax.);
} else {
    console.log('No broken syntax found to fix.');
}
