import fs from 'fs';
import path from 'path';

const contentPath = 'C:\\Users\\sascy\\.gemini\\antigravity\\brain\\7c70febe-7c18-4d9f-8124-827af947b370\\.system_generated\\steps\\16\\content.md';

function main() {
  const html = fs.readFileSync(contentPath, 'utf8');

  // Let's find all indices of "productVariants"
  let pos = 0;
  const indices: number[] = [];
  while ((pos = html.indexOf('"productVariants"', pos)) !== -1) {
    indices.push(pos);
    pos += 17; // length of "productVariants"
  }

  console.log(`Found "productVariants" at indices:`, indices);

  for (const startIndex of indices) {
    // Find the opening bracket [ of the array
    const openBracketIndex = html.indexOf('[', startIndex);
    if (openBracketIndex === -1) continue;

    // Find the matching closing bracket ]
    let bracketCount = 1;
    let endBracketIndex = -1;
    for (let i = openBracketIndex + 1; i < html.length; i++) {
      if (html[i] === '[') {
        bracketCount++;
      } else if (html[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          endBracketIndex = i;
          break;
        }
      }
    }

    if (endBracketIndex === -1) continue;

    const jsonString = html.substring(openBracketIndex, endBracketIndex + 1);
    try {
      // Unescape the string
      let cleaned = jsonString;
      // If it's double escaped, we might need to handle it. Let's do simple unescapes:
      // JSON in JS strings can be escaped with \" or \\"
      if (cleaned.includes('\\"')) {
        // Replace \" with " and \\/ with /
        cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\//g, '/');
      }
      
      // Let's print length of JSON string
      console.log(`Processing JSON of length ${cleaned.length}`);
      
      const variants = JSON.parse(cleaned);
      console.log(`Successfully parsed variant array! Length: ${variants.length}`);
      
      if (variants.length > 0) {
        const destPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
        fs.writeFileSync(destPath, JSON.stringify(variants, null, 2));
        console.log(`Saved ${variants.length} products to ${destPath}`);
        
        // Print sample product
        console.log('Sample product:', JSON.stringify(variants[0], null, 2));
        break; // Stop at the first non-empty list
      }
    } catch (err: any) {
      console.error(`Failed to parse JSON at index ${startIndex}:`, err.message);
      // Log some chars
      console.log(jsonString.substring(0, 300));
    }
  }
}

main();
