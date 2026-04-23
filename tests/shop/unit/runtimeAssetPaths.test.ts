import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBlobPathname,
  inferMediaKind,
  inferVideoMimeType,
  isLibraryBackedAssetReference,
  resolveImageAssetReference,
  resolveVideoAssetReference,
} from '../../../src/lib/runtimeAssetPaths';

test('resolveAssetReference keeps absolute URLs and expands legacy relative refs', () => {
  const blobVideoUrl = 'https://abc123.public.blob.vercel-storage.com/videos/uploads/hero-video.mp4';

  assert.equal(resolveVideoAssetReference('hero-video.mp4'), '/videos/hero-video.mp4');
  assert.equal(resolveVideoAssetReference('videos/uploads/hero-video.mp4'), '/videos/uploads/hero-video.mp4');
  assert.equal(resolveVideoAssetReference('/videos/uploads/hero-video.mp4'), '/videos/uploads/hero-video.mp4');
  assert.equal(resolveVideoAssetReference(blobVideoUrl), blobVideoUrl);
  assert.equal(resolveImageAssetReference('hero-poster.webp'), '/images/hero-poster.webp');
});

test('library-backed asset detection supports local and Vercel Blob URLs', () => {
  const blobImageUrl = 'https://abc123.public.blob.vercel-storage.com/media/library/shop/hero-image.webp';

  assert.equal(isLibraryBackedAssetReference('/media/shop/hero-image.webp'), true);
  assert.equal(isLibraryBackedAssetReference(blobImageUrl), true);
  assert.equal(extractBlobPathname(blobImageUrl), 'media/library/shop/hero-image.webp');
  assert.equal(isLibraryBackedAssetReference('https://example.com/hero-image.webp'), false);
});

test('media kind and mime inference handle common legacy and blob-backed refs', () => {
  assert.equal(inferMediaKind('video/webm'), 'video');
  assert.equal(inferMediaKind('https://abc123.public.blob.vercel-storage.com/media/library/item.webp'), 'image');
  assert.equal(inferVideoMimeType('https://abc123.public.blob.vercel-storage.com/videos/uploads/item.webm?download=1'), 'video/webm');
  assert.equal(inferVideoMimeType('/videos/uploads/item.mov'), 'video/quicktime');
});
