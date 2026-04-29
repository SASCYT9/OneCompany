#!/usr/bin/env node
/*
 * For each 'use client' page.tsx in the list:
 *   1. Move the file to ./<NameClient>.tsx (next to it).
 *   2. Create a new server page.tsx that:
 *      - exports `revalidate = 3600`
 *      - imports + re-renders the client component
 *
 * Idempotent: if a *Client.tsx already exists next to page.tsx, skip.
 *
 * Usage:
 *   node scripts/extract-client-page-wrapper.mjs            (dry-run)
 *   node scripts/extract-client-page-wrapper.mjs --commit
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const COMMIT = process.argv.includes('--commit');
const FILES = [
  { page: 'src/app/[locale]/about/page.tsx',      clientName: 'AboutPageContent' },
  { page: 'src/app/[locale]/contact/page.tsx',    clientName: 'ContactPageContent' },
  { page: 'src/app/[locale]/brands/page.tsx',     clientName: 'BrandsPageContent' },
  { page: 'src/app/[locale]/categories/page.tsx', clientName: 'CategoriesPageContent' },
  { page: 'src/app/[locale]/choice/page.tsx',     clientName: 'ChoicePageContent' },
];

let changed = 0, skipped = 0, failed = 0;

for (const { page, clientName } of FILES) {
  const pageAbs = path.resolve(process.cwd(), page);
  const dir = path.dirname(pageAbs);
  const clientAbs = path.join(dir, `${clientName}.tsx`);

  let exists = false;
  try { await fs.access(clientAbs); exists = true; } catch {}
  if (exists) {
    console.log(`= already   ${page}`);
    skipped++;
    continue;
  }

  let src;
  try { src = await fs.readFile(pageAbs, 'utf8'); }
  catch { console.warn(`! missing  ${page}`); failed++; continue; }

  if (!/^['"]use client['"]/m.test(src.split('\n').slice(0, 3).join('\n'))) {
    console.warn(`! not a 'use client' page  ${page}`);
    failed++;
    continue;
  }

  // Rewrite default export name to clientName so it can be imported.
  // Cases: `export default function Foo()`, `export default Foo;`, `export default () =>`.
  let clientSrc = src;
  if (/export\s+default\s+function\s+[A-Za-z0-9_]+/.test(clientSrc)) {
    clientSrc = clientSrc.replace(/export\s+default\s+function\s+[A-Za-z0-9_]+/, `export default function ${clientName}`);
  } else if (/export\s+default\s+[A-Za-z0-9_]+\s*;\s*$/m.test(clientSrc)) {
    clientSrc = clientSrc.replace(/export\s+default\s+([A-Za-z0-9_]+)\s*;\s*$/m, `export { $1 as default };`);
  } else {
    console.warn(`! cannot rewrite default export in  ${page}`);
    failed++;
    continue;
  }

  // New server wrapper.
  const wrapper = `import ${clientName} from './${clientName}';

// ISR: render the client component at build time / on revalidation, cache
// the SSR'd HTML for 1 hour. The page itself has no per-request data.
export const revalidate = 3600;

export default function Page() {
  return <${clientName} />;
}
`;

  if (COMMIT) {
    await fs.writeFile(clientAbs, clientSrc);
    await fs.writeFile(pageAbs, wrapper);
  }
  console.log(`+ extracted  ${page}  →  ${path.relative(process.cwd(), clientAbs).replace(/\\/g, '/')}`);
  changed++;
}

console.log(`\nchanged=${changed} skipped=${skipped} failed=${failed}`);
if (!COMMIT) console.log('(dry-run — pass --commit to write)');
