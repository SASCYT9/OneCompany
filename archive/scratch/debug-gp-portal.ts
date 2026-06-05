import fs from 'fs';

const contentPath = 'C:\\Users\\sascy\\.gemini\\antigravity\\brain\\7c70febe-7c18-4d9f-8124-827af947b370\\.system_generated\\steps\\16\\content.md';

function main() {
  const html = fs.readFileSync(contentPath, 'utf8');
  console.log('File size:', html.length);
  
  // Let's print a small chunk of HTML where products might start
  const index = html.indexOf('productVariants');
  if (index !== -1) {
    console.log('Found productVariants at index:', index);
    console.log(html.substring(index - 100, index + 1000));
  } else {
    console.log('Could not find productVariants in file');
  }

  // Let's find any occurrences of '/products/'
  const productsIndex = html.indexOf('/products/');
  if (productsIndex !== -1) {
    console.log('Found /products/ at index:', productsIndex);
    console.log(html.substring(productsIndex - 50, productsIndex + 200));
  } else {
    console.log('Could not find /products/ in file');
  }
}

main();
