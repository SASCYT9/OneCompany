/**
 * Normalize manually downloaded logo filenames to match expected slugs.
 *
 * This is intentionally conservative: it only renames a known set of
 * misnamed files (mostly with spaces/case) that correspond to the brands
 * currently reported as missing.
 *
 * Run:
 *   node scripts/normalize-missing-logo-filenames.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');
const LOGOS_DIR = path.join(PROJECT_DIR, 'public', 'logos');

/** @type {Array<[string,string]>} */
const RENAMES = [
  ['ABT.png', 'abt.png'],
  ['ams_performance_logo.svg', 'ams-alpha-performance.svg'],
  ['Avantgarde Wheels.png', 'avantgarde-wheels.png'],
  ['BigBoost.avif', 'big-boost.avif'],
  ['Black Boost.avif', 'black-boost.avif'],
  ['Brixton wheels.png', 'brixton-wheels.png'],
  ['Deikin.png', 'deikin.png'],
  ['Eventuri.jpg', 'eventuri.jpg'],
  ['Fall-Line Motorsports.avif', 'fall-line-motorsports.avif'],
  ['Fragola Performance Systems.png', 'fragola-performance-systems.png'],
  ['GTHaus.jpg', 'gthaus.jpg'],
  ['Kotouc.svg', 'kotouc.svg'],
  ['Paragon brakes.webp', 'paragon-brakes.webp'],
  ['Pulsar turbo.avif', 'pulsar-turbo.avif'],
  ['Pure Drivetrain Solutions.webp', 'pure-drivetrain-solutions.webp'],
  ['Raliw Forged.png', 'raliw-forged.png'],
  ['Red Star Exhaust.webp', 'red-star-exhaust.webp'],
  ['Ronin Design.svg', 'ronin-design.svg'],
  ['SCL Concept.png', 'scl-concept.png'],
  ['Seibon Carbon.webp', 'seibon-carbon.webp'],
  ['SooQoo.png', 'sooqoo.png'],
  ['Urban Automotive.svg', 'urban-automotive.svg'],
  ['Xshift.jpg', 'xshift.jpg'],
];

function statIfExists(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function main() {
  let renamed = 0;
  let skipped = 0;

  for (const [from, to] of RENAMES) {
    const src = path.join(LOGOS_DIR, from);
    const dst = path.join(LOGOS_DIR, to);

    // On Windows/macOS, the filesystem can be case-insensitive. If `from` and
    // `to` differ only by case, `src` and `dst` may refer to the same file.
    // Never treat that as a duplicate-delete situation.
    const samePathIgnoringCase = src.toLowerCase() === dst.toLowerCase();

    const srcStat = statIfExists(src);
    if (!srcStat || !srcStat.isFile()) {
      skipped++;
      continue;
    }

    const dstStat = statIfExists(dst);
    if (!samePathIgnoringCase && dstStat && dstStat.isFile()) {
      // If destination exists, keep the larger file.
      if (dstStat.size >= srcStat.size) {
        // keep dst; remove src to avoid duplicates
        fs.unlinkSync(src);
        console.log(`removed duplicate (kept larger): ${from} -> ${to}`);
        renamed++;
        continue;
      }
      fs.unlinkSync(dst);
    }

    if (samePathIgnoringCase) {
      const ext = path.extname(to);
      const tmp = path.join(LOGOS_DIR, `__tmp__${Date.now()}${ext}`);
      fs.renameSync(src, tmp);
      fs.renameSync(tmp, dst);
      console.log(`renamed (case-safe): ${from} -> ${to}`);
    } else {
      fs.renameSync(src, dst);
      console.log(`renamed: ${from} -> ${to}`);
    }
    renamed++;
  }

  console.log('='.repeat(60));
  console.log(`Renamed/cleaned: ${renamed}`);
  console.log(`Skipped (not present): ${skipped}`);
}

main();
