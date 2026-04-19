import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { writeVersionedJsonFile } from '../../../src/lib/adminJsonStorage';

test('writeVersionedJsonFile creates snapshots and prunes to retention', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-json-storage-'));
  const filePath = path.join(tempRoot, 'site-content.json');

  await writeVersionedJsonFile({
    filePath,
    historyKey: 'site-content',
    value: { version: 1 },
    retention: 2,
  });
  await writeVersionedJsonFile({
    filePath,
    historyKey: 'site-content',
    value: { version: 2 },
    retention: 2,
  });
  await writeVersionedJsonFile({
    filePath,
    historyKey: 'site-content',
    value: { version: 3 },
    retention: 2,
  });

  const raw = await fs.readFile(filePath, 'utf8');
  assert.deepEqual(JSON.parse(raw), { version: 3 });

  const historyDir = path.join(tempRoot, 'history', 'site-content');
  const snapshots = await fs.readdir(historyDir);
  assert.equal(snapshots.length, 2);
});
