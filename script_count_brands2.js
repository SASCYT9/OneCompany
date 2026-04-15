const fs = require('fs'); const content = fs.readFileSync('src/lib/brands.ts', 'utf8'); console.log(content.slice(0, 1000));
