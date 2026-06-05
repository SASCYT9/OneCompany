import fs from 'fs';
import path from 'path';

function main() {
  const compPath = path.join('d:', 'One Company', 'OneCompany', 'archive', 'scratch', 'image-comparison.json');
  if (!fs.existsSync(compPath)) {
    console.error('image-comparison.json not found!');
    return;
  }

  const comparison = JSON.parse(fs.readFileSync(compPath, 'utf8'));

  let md = '# Image Update Proposal for Range Rover L460/L461 Urban Products\n\n';
  md += 'Below is the comparison of products found on GP Portal search page and their counterpart in our database. We will ignore placeholders (null or empty images).\n\n';
  
  md += '## 📸 Proposed Updates (New Images Found)\n\n';
  md += '| SKU | Product Title | Current DB Image | New GP Portal Image | Action |\n';
  md += '| --- | --- | --- | --- | --- |\n';

  let proposeCount = 0;
  let ignoreCount = 0;
  const ignores: any[] = [];

  for (const item of comparison) {
    if (item.gpImage) {
      proposeCount++;
      const currentImg = item.dbImage ? `\`${item.dbImage}\`` : '*None*';
      const action = 'Update Image & Gallery';
      md += `| **${item.dbSku || item.gpSku}** | ${item.dbTitle || item.gpTitle} | ${currentImg} | [\`Link\`](${item.gpImage}) | **${action}** |\n`;
    } else {
      ignoreCount++;
      ignores.push(item);
    }
  }

  md += '\n## 🚫 Ignored Products (Placeholders / No Images on GP Portal)\n\n';
  md += '| SKU | Product Title | Current DB Image | GP Portal Status | Action |\n';
  md += '| --- | --- | --- | --- | --- |\n';

  for (const item of ignores) {
    const currentImg = item.dbImage ? `\`${item.dbImage}\`` : '*None*';
    md += `| **${item.dbSku || item.gpSku}** | ${item.dbTitle || item.gpTitle} | ${currentImg} | *No image/Placeholder* | **Ignore** |\n`;
  }

  const artifactPath = path.join('C:', 'Users', 'sascy', '.gemini', 'antigravity', 'brain', '7c70febe-7c18-4d9f-8124-827af947b370', 'image_update_proposal.md');
  fs.writeFileSync(artifactPath, md, 'utf8');
  console.log(`Saved markdown proposal to ${artifactPath}`);
}

main();
