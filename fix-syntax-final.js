const fs = require('fs');
const path = 'src/app/[locale]/auto/AutoPageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const brokenPart = '{ lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"';

let index = content.indexOf(brokenPart);
let count = 0;

// We will do replacements one by one.
// Since we want to replace the first one with Akrapovic and second with Brabus,
// and indexOf finds the first one, we can just do it in order.

while (index !== -1) {
    count++;
    console.log('Found occurrence ' + count + ' at index ' + index);
    
    const closingIndex = content.indexOf('>', index);
    if (closingIndex !== -1) {
        // Verify it's close enough (e.g. within 50 chars) to be the closing tag we expect
        if (closingIndex - index < 200) {
             let replacement = '';
            if (count === 1) {
                replacement = '{/* AKRAPOVIC - Hero Card */}\n' +
'            <motion.button\n' +
'              onClick={() => handleBrandClick(\'Akrapovic\')}\n' +
'              initial={{ opacity: 0, y: 60 }}\n' +
'              whileInView={{ opacity: 1, y: 0 }}\n' +
'              viewport={{ once: true }}\n' +
'              transition={{ duration: 0.8 }}\n' +
'              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"\n' +
'            >';
            } else if (count === 2) {
                replacement = '{/* BRABUS - Tall Card */}\n' +
'            <motion.button\n' +
'              onClick={() => handleBrandClick(\'Brabus\')}\n' +
'              initial={{ opacity: 0, y: 60 }}\n' +
'              whileInView={{ opacity: 1, y: 0 }}\n' +
'              viewport={{ once: true }}\n' +
'              transition={{ duration: 0.8, delay: 0.1 }}\n' +
'              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"\n' +
'            >';
            }
            
            if (replacement) {
                content = content.substring(0, index) + replacement + content.substring(closingIndex + 1);
                console.log('Replaced occurrence ' + count);
            }
        }
    }
    
    // Find next
    index = content.indexOf(brokenPart);
}

if (count > 0) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Saved file.');
} else {
    console.log('No broken syntax found.');
}
