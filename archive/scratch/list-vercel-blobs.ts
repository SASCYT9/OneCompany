import { listAllBlobsByPrefix } from '../../src/lib/runtimeBlobStorage';

async function main() {
  console.log('Listing all blobs under media/library/urban/...');
  const blobs = await listAllBlobsByPrefix('media/library/urban/');
  console.log(`Found ${blobs.length} blobs:`);
  for (const b of blobs) {
    console.log(`- Pathname: ${b.pathname}\n  URL: ${b.url}\n  Size: ${b.size}`);
  }
}

main().catch(console.error);
