const fs = require('fs');
const path = require('path');

const files = [
  'src/app/[locale]/auto/AutoPageClient.tsx',
  'src/app/[locale]/moto/MotoPageClient.tsx'
];

const oldString = 'border border-white/20 bg-white/10 backdrop-blur-3xl';
const newString = 'border border-white/30 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-3xl transition-colors duration-500 group-hover:border-white/50';

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(oldString, 'g');
    
    if (content.match(regex)) {
      const count = content.match(regex).length;
      content = content.replace(regex, newString);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}: Replaced ${count} occurrences.`);
    } else {
      console.log(`No matches found in ${file}`);
    }
  } else {
    console.error(`File not found: ${file}`);
  }
});
