#!/usr/bin/env node
/**
 * Pre-deploy safety checks.
 * 1. Ensure clean git working tree.
 * 2. Warn if not on 'stable' branch.
 * 3. Run prisma generate (fast) & a dry build check (optional flag).
 */
const { execSync } = require('child_process');

function run(cmd) {return execSync(cmd,{stdio:'pipe'}).toString().trim();}

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

  console.log('[STEP] Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Lightweight build sanity without emitting .next (Next has no official dry mode, so we run build).
  console.log('[STEP] Running Next.js production build sanity...');
  execSync('npx next build', { stdio: 'inherit' });

  console.log('\n[READY] All pre-deploy checks passed.');
} catch (e) {
  console.error('\n[ABORT] Pre-deploy check failed.');
  if (e.stdout) console.error(e.stdout.toString());
  process.exit(1);
}
