import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { addMediaFromBuffer, getManifest } from '../../../src/lib/mediaStore';

test('addMediaFromBuffer uses the current workspace public/media even when MEDIA_STORE_ROOT is set', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-store-'));
  const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-store-external-'));
  const previousCwd = process.cwd();
  const previousRoot = process.env.MEDIA_STORE_ROOT;

  process.chdir(tempRoot);
  process.env.MEDIA_STORE_ROOT = externalRoot;

  try {
    await addMediaFromBuffer(Buffer.from('workspace asset'), 'hero-image.webp', 'image/webp');

    const workspaceManifestPath = path.join(tempRoot, 'public', 'media', 'media.json');
    const externalManifestPath = path.join(externalRoot, 'public', 'media', 'media.json');

    await fs.access(workspaceManifestPath);
    await assert.rejects(() => fs.access(externalManifestPath));
  } finally {
    process.chdir(previousCwd);
    if (previousRoot === undefined) {
      delete process.env.MEDIA_STORE_ROOT;
    } else {
      process.env.MEDIA_STORE_ROOT = previousRoot;
    }
  }
});

test('addMediaFromBuffer deduplicates identical uploads by checksum', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-store-'));
  const previousCwd = process.cwd();

  process.chdir(tempRoot);

  try {
    const buffer = Buffer.from('same file contents');
    const first = await addMediaFromBuffer(buffer, 'hero-image.webp', 'image/webp');
    const second = await addMediaFromBuffer(buffer, 'hero-image.webp', 'image/webp');

    assert.equal(first.id, second.id);
    const manifest = await getManifest();
    assert.equal(manifest.items.length, 1);
    assert.equal(manifest.items[0]?.provider, 'local');
    assert.equal(manifest.items[0]?.pathname, `media/library/${manifest.items[0]?.filename}`);
  } finally {
    process.chdir(previousCwd);
  }
});
