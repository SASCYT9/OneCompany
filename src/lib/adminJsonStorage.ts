import { promises as fs } from 'fs';
import path from 'path';

type EnsureVersionedJsonFileInput<T> = {
  filePath: string;
  defaultValue: T;
  legacyPath?: string;
};

type WriteVersionedJsonFileInput<T> = {
  filePath: string;
  historyKey: string;
  value: T;
  retention?: number;
  legacyPath?: string;
};

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function atomicWriteTextFile(filePath: string, content: string) {
  await ensureParentDir(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function ensureVersionedJsonFile<T>(input: EnsureVersionedJsonFileInput<T>) {
  try {
    await fs.access(input.filePath);
    return;
  } catch {}

  await ensureParentDir(input.filePath);

  if (input.legacyPath) {
    try {
      const legacyRaw = await fs.readFile(input.legacyPath, 'utf8');
      await atomicWriteTextFile(input.filePath, legacyRaw);
      return;
    } catch {}
  }

  await atomicWriteTextFile(input.filePath, JSON.stringify(input.defaultValue, null, 2));
}

export async function readJsonFileWithFallback<T>(input: EnsureVersionedJsonFileInput<T>) {
  try {
    return JSON.parse(await fs.readFile(input.filePath, 'utf8')) as T;
  } catch {
    if (input.legacyPath) {
      try {
        return JSON.parse(await fs.readFile(input.legacyPath, 'utf8')) as T;
      } catch {}
    }
    return input.defaultValue;
  }
}

export async function writeVersionedJsonFile<T>(input: WriteVersionedJsonFileInput<T>) {
  const retention = Math.max(1, Math.trunc(input.retention ?? 10));
  const nextRaw = JSON.stringify(input.value, null, 2);
  const historyDir = path.join(path.dirname(input.filePath), 'history', input.historyKey);

  await ensureParentDir(input.filePath);
  await fs.mkdir(historyDir, { recursive: true });

  let previousRaw: string | null = null;
  try {
    previousRaw = await fs.readFile(input.filePath, 'utf8');
  } catch {
    if (input.legacyPath) {
      try {
        previousRaw = await fs.readFile(input.legacyPath, 'utf8');
      } catch {}
    }
  }

  if (previousRaw && previousRaw !== nextRaw) {
    const snapshotName = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await atomicWriteTextFile(path.join(historyDir, snapshotName), previousRaw);
  }

  await atomicWriteTextFile(input.filePath, nextRaw);

  const snapshots = (await fs.readdir(historyDir)).sort((left, right) => right.localeCompare(left));
  for (const snapshot of snapshots.slice(retention)) {
    await fs.unlink(path.join(historyDir, snapshot));
  }

  if (input.legacyPath) {
    try {
      await fs.unlink(input.legacyPath);
    } catch {}
  }
}
