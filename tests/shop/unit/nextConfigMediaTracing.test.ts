import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../../../next.config';

test('next config narrows output tracing for media-heavy routes', () => {
  const config = nextConfig as {
    outputFileTracingExcludes?: Record<string, string[]>;
    outputFileTracingIncludes?: Record<string, string[]>;
  };

  assert.deepEqual(config.outputFileTracingIncludes?.['api/media'], ['public/media/**/*']);
  assert.deepEqual(config.outputFileTracingIncludes?.['api/media/[id]'], ['public/media/**/*']);
  assert.deepEqual(config.outputFileTracingIncludes?.['api/admin/shop/media'], ['public/media/**/*']);
  assert.deepEqual(config.outputFileTracingIncludes?.['api/admin/shop/media/[id]'], ['public/media/**/*']);
  assert.deepEqual(config.outputFileTracingIncludes?.['api/admin/upload-video'], ['public/videos/uploads/**/*']);

  assert.ok(config.outputFileTracingExcludes?.['api/media']?.includes('public/images/**/*'));
  assert.ok(config.outputFileTracingExcludes?.['api/media/[id]']?.includes('public/images/**/*'));
  assert.ok(config.outputFileTracingExcludes?.['api/admin/shop/media']?.includes('public/images/**/*'));
  assert.ok(config.outputFileTracingExcludes?.['api/admin/shop/media/[id]']?.includes('public/images/**/*'));
  assert.ok(config.outputFileTracingExcludes?.['api/admin/upload-video']?.includes('public/videos/shop/**/*'));
});
