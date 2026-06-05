import fs from 'fs';
import path from 'path';

function main() {
  const htmlPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-raw.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Find all indices of "productVariants" case insensitively
  const regex = /productvariants/gi;
  let match;
  const indices: number[] = [];
  while ((match = regex.exec(html)) !== null) {
    indices.push(match.index);
  }

  console.log('Found productVariants indices:', indices);

  for (const idx of indices) {
    // Find the first '[' after this index
    const openBracket = html.indexOf('[', idx);
    if (openBracket === -1) continue;

    // Find matching ']'
    let bracketCount = 1;
    let closeBracket = -1;
    for (let i = openBracket + 1; i < html.length; i++) {
      if (html[i] === '[') {
        bracketCount++;
      } else if (html[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          closeBracket = i;
          break;
        }
      }
    }

    if (closeBracket === -1) continue;

    const rawArray = html.substring(openBracket, closeBracket + 1);
    console.log(`Processing array at index ${idx}, length: ${rawArray.length}`);

    try {
      // Unescape double quotes and backslashes
      let cleaned = rawArray;
      // If it is escaped with \", unescape it
      if (cleaned.includes('\\"')) {
        // We replace \" with " and \\/ with /
        cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      }

      const parsed = JSON.parse(cleaned);
      console.log(`Successfully parsed array of length ${parsed.length}`);
      
      if (parsed.length > 0) {
        const destPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
        fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2));
        console.log(`Saved ${parsed.length} products to ${destPath}`);
        
        // Print all titles and SKUs and Images to check
        for (const item of parsed) {
          console.log(`- Title: ${item.product.title}\n  SKU: ${item.sku}\n  Image: ${item.image?.src}`);
        }
        break;
      }
    } catch (e: any) {
      console.error(`Failed to parse array at index ${idx}:`, e.message);
      // print first 200 chars of cleaned
      console.log(rawArray.substring(0, 200));
    }
  }
}

main();
