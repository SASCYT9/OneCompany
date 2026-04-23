#!/usr/bin/env node
/**
 * Pre-deploy safety checks.
 * 1. Ensure clean git working tree.
 * 2. Warn if not on 'stable' branch.
 * 3. Run prisma generate (fast) & a dry build check (optional flag).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {return execSync(cmd,{stdio:'pipe'}).toString().trim();}

function countFilesRecursive(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return total + countFilesRecursive(target);
    }
    return total + 1;
  }, 0);
}

function countTrackedFiles(targetPath) {
  const output = run(`git ls-files -- ${targetPath}`);
  if (!output) {
    return 0;
  }
  return output.split(/\r?\n/).filter(Boolean).length;
}

function dirSizeBytes(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((total, entry) => {
    const resolved = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      return total + dirSizeBytes(resolved);
    }
    return total + fs.statSync(resolved).size;
  }, 0);
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function countMeaningfulFiles(targetPath, ignoreNames = []) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((total, entry) => {
    const resolved = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      return total + countMeaningfulFiles(resolved, ignoreNames);
    }
    if (ignoreNames.includes(entry.name)) {
      return total;
    }
    return total + 1;
  }, 0);
}

function ensureDirectoryWithinBudget(targetPath, limitBytes, label) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const size = dirSizeBytes(targetPath);
  if (size <= limitBytes) {
    return;
  }

  console.error(`\n[FAIL] ${label} exceeds the allowed deployment budget.`);
  console.error(`[DETAIL] ${targetPath} = ${formatMb(size)} (limit ${formatMb(limitBytes)}).`);
  console.error('[DETAIL] Move these assets to external object storage before deploying.');
  process.exit(1);
}

function ensureDirectoryEmpty(targetPath, label, ignoreNames = []) {
  const fileCount = countMeaningfulFiles(targetPath, ignoreNames);
  if (fileCount === 0) {
    return;
  }

  console.error(`\n[FAIL] ${label} still contains runtime-managed files.`);
  console.error(`[DETAIL] ${targetPath} has ${fileCount} file(s) that should have been migrated to Blob storage.`);
  console.error('[DETAIL] Run the Blob migration, remove tracked legacy files from git, and redeploy.');
  process.exit(1);
}

try {
  const status = run('git status --porcelain');
  if (status) {
    console.error('\n[FAIL] Working directory not clean. Commit or stash changes first.');
    console.error(status); process.exit(1);
  }
  const branch = run('git branch --show-current');
  if (branch !== 'stable') {
    console.warn(`[WARN] Current branch is '${branch}', expected 'stable'. Continue only if intentional.`);
  }
  console.log('[OK] Git clean. Branch:', branch);

  const brabusImagesDir = path.join(process.cwd(), 'public', 'brabus-images');
  if (fs.existsSync(brabusImagesDir)) {
    const localFiles = countFilesRecursive(brabusImagesDir);
    const trackedFiles = countTrackedFiles('public/brabus-images');
    if (localFiles > 0 && trackedFiles < localFiles) {
      console.error('\n[FAIL] public/brabus-images contains local assets that are not fully tracked by git.');
      console.error(`[DETAIL] Local files: ${localFiles}. Tracked files: ${trackedFiles}.`);
      console.error('[DETAIL] Preview deploys will miss these images unless you migrate them to tracked storage or Git LFS.');
      process.exit(1);
    }
  }

  const blobStorageEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const publicMediaDir = path.join(process.cwd(), 'public', 'media');
  const publicVideoUploadsDir = path.join(process.cwd(), 'public', 'videos', 'uploads');

  if (blobStorageEnabled) {
    ensureDirectoryEmpty(publicMediaDir, 'File-backed media library', ['media.json', '.gitkeep']);
    ensureDirectoryEmpty(publicVideoUploadsDir, 'Uploaded video library', ['.gitkeep']);
  } else {
    ensureDirectoryWithinBudget(publicMediaDir, 50 * 1024 * 1024, 'File-backed media library');
    ensureDirectoryWithinBudget(publicVideoUploadsDir, 50 * 1024 * 1024, 'Uploaded video library');
  }

  console.log('[STEP] Generating Prisma client...');
  execSync('npm run prisma:generate', { stdio: 'inherit' });

  // Lightweight build sanity without emitting .next (Next has no official dry mode, so we run build).
  console.log('[STEP] Running Next.js production build sanity...');
  execSync('npx next build', { stdio: 'inherit' });

  console.log('\n[READY] All pre-deploy checks passed.');
} catch (e) {
  console.error('\n[ABORT] Pre-deploy check failed.');
  if (e.stdout) console.error(e.stdout.toString());
  process.exit(1);
}
