import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildUploadedVideoAssetPath, resolveVideoUploadsDir } from '../../../src/lib/videoUploadStorage';

test('video uploads resolve into the uploads subtree only', () => {
  const root = path.join('D:', 'workspace', 'OneCompany');

  assert.equal(resolveVideoUploadsDir(root), path.join(root, 'public', 'videos', 'uploads'));
  assert.equal(buildUploadedVideoAssetPath('hero.mp4'), 'uploads/hero.mp4');
});
