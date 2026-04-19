import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { addMediaFromBuffer, getManifest } from '../../../src/lib/mediaStore';

test('addMediaFromBuffer deduplicates identical uploads by checksum', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-store-'));
  const previousRoot = process.env.MEDIA_STORE_ROOT;
  process.env.MEDIA_STORE_ROOT = tempRoot;

  try {
    const buffer = Buffer.from('same file contents');
    const first = await addMediaFromBuffer(buffer, 'hero-image.webp', 'image/webp');
    const second = await addMediaFromBuffer(buffer, 'hero-image.webp', 'image/webp');

    assert.equal(first.id, second.id);
    const manifest = await getManifest();
    assert.equal(manifest.items.length, 1);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MEDIA_STORE_ROOT;
    } else {
      process.env.MEDIA_STORE_ROOT = previousRoot;
    }
  }
});
