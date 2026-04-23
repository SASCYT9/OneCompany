import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMediaLibraryBlobPathname,
  buildStoredFilename,
  buildUploadedVideoBlobPathname,
  decodeBlobBackedAssetId,
  encodeBlobBackedAssetId,
  getRuntimeStorageProvider,
} from '../../../src/lib/runtimeBlobStorage';

test('runtime storage provider switches to Vercel Blob when token is configured', () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(getRuntimeStorageProvider(), 'local');

    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    assert.equal(getRuntimeStorageProvider(), 'vercel-blob');
  } finally {
    if (previousToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    }
  }
});

test('blob-backed asset ids round-trip and preserve generated filenames', () => {
  const filename = buildStoredFilename('Hero Poster.JPG', 'image/jpeg');

  assert.match(filename, /^hero-poster-[A-Za-z0-9_-]{10}\.jpg$/);

  const mediaPathname = buildMediaLibraryBlobPathname(filename);
  const videoPathname = buildUploadedVideoBlobPathname(filename);

  assert.equal(mediaPathname, `media/library/${filename}`);
  assert.equal(videoPathname, `videos/uploads/${filename}`);
  assert.equal(decodeBlobBackedAssetId(encodeBlobBackedAssetId(mediaPathname)), mediaPathname);
});
