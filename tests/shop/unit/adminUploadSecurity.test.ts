import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUploadedFilename,
  validateAdminUpload,
} from '../../../src/lib/adminUploadSecurity';

test('sanitizeUploadedFilename strips traversal tokens and path separators', () => {
  const sanitized = sanitizeUploadedFilename('..\\..//evil<script>.mp4', 'upload');

  assert.equal(sanitized.includes('..'), false);
  assert.equal(sanitized.includes('/'), false);
  assert.equal(sanitized.includes('\\'), false);
  assert.match(sanitized, /\.mp4$/);
});

test('validateAdminUpload rejects unsupported MIME types', () => {
  assert.throws(
    () =>
      validateAdminUpload({
        originalName: 'payload.html',
        mimeType: 'text/html',
        sizeBytes: 512,
        allowedMimeTypes: ['image/jpeg'],
        maxBytes: 1024,
      }),
    /Unsupported file type/i
  );
});

test('validateAdminUpload rejects files above the configured size limit', () => {
  assert.throws(
    () =>
      validateAdminUpload({
        originalName: 'large.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 6 * 1024 * 1024,
        allowedMimeTypes: ['video/mp4'],
        maxBytes: 5 * 1024 * 1024,
      }),
    /File is too large/i
  );
});
