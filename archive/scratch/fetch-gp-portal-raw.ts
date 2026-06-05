import fs from 'fs';
import path from 'path';

async function main() {
  const url = 'https://gp-portal.eu/search?q=L461&options%5Bprefix%5D=last&filter.p.tag=Car-Part';
  console.log(`Fetching raw HTML from ${url}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  const html = await response.text();
  console.log(`Fetched ${html.length} bytes of raw HTML.`);

  // Let's write the raw HTML to a temp file first for debugging
  const rawHtmlPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-raw.html');
  fs.writeFileSync(rawHtmlPath, html);
  console.log(`Saved raw HTML to ${rawHtmlPath}`);

  // Let's search for the productVariants JSON in the raw HTML
  // In raw HTML, the JSON won't be truncated!
  const regex = /"productVariants":\s*(\[[\s\S]*?\])\s*\}\s*\}\s*\]\]/;
  const match = html.match(/"productVariants":\s*(\[[\s\S]*?\])\s*\}\s*\}\s*\]/);
  
  if (match) {
    console.log('Found productVariants match!');
    try {
      const jsonStr = match[1].replace(/\\"/g, '"').replace(/\\\//g, '/');
      const variants = JSON.parse(jsonStr);
      console.log(`Successfully parsed ${variants.length} variants from JSON!`);
      const destPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
      fs.writeFileSync(destPath, JSON.stringify(variants, null, 2));
      console.log(`Saved products to ${destPath}`);
      return;
    } catch (err: any) {
      console.error('Failed to parse matched JSON directly:', err.message);
    }
  }

  // Let's search using a broader match for "productVariants"
  let pos = 0;
  while ((pos = html.indexOf('"productVariants"', pos)) !== -1) {
    console.log(`Found '"productVariants"' at index ${pos}`);
    const openBracket = html.indexOf('[', pos);
    if (openBracket !== -1) {
      let bracketCount = 1;
      let closeBracket = -1;
      for (let i = openBracket + 1; i < html.length; i++) {
        if (html[i] === '[') bracketCount++;
        else if (html[i] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            closeBracket = i;
            break;
          }
        }
      }
      if (closeBracket !== -1) {
        const jsonStr = html.substring(openBracket, closeBracket + 1);
        try {
          // Unescape backslashes and double quotes
          const unescaped = jsonStr.replace(/\\"/g, '"').replace(/\\\//g, '/');
          const parsed = JSON.parse(unescaped);
          console.log(`Index ${pos} parsed array of length ${parsed.length}`);
          if (parsed.length > 0) {
            const destPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'gp-portal-variants.json');
            fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2));
            console.log(`Saved ${parsed.length} products to ${destPath}`);
            break;
          }
        } catch (e: any) {
          console.log(`Failed to parse index ${pos}:`, e.message);
        }
      }
    }
    pos += 17;
  }
}

main().catch(console.error);
