const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VIDEO_DIR = path.join(__dirname, '../public/videos');
const ORIGINAL_DIR = path.join(VIDEO_DIR, 'originals');

if (!fs.existsSync(ORIGINAL_DIR)) {
  fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
}

const TASKS = [
  {
    file: 'fi-exhaust.mp4',
    // High compression, remove audio (-an), 1080p is fine but bitrate needs massive drop
    args: '-c:v libx264 -crf 28 -fpsmax 30 -an -movflags +faststart',
    description: 'Compressing heavy background video (167MB -> ~15MB)'
  },
  {
    file: 'rollsbg-v3.mp4',
    output: 'rollsbg-mobile.mp4',
    // Resize for mobile (720p), optimized for size
    args: '-vf "scale=-2:720" -c:v libx264 -crf 28 -fpsmax 30 -an -movflags +faststart',
    description: 'Creating mobile version of hero video (720p)'
  }
];

// Available large files to check: 'hero-hq.mp4' (21MB), 'MotoBG-web.mp4' (25MB)
// Let's add MotoBG-web.mp4 optimization if it exists
if (fs.existsSync(path.join(VIDEO_DIR, 'MotoBG-web.mp4'))) {
    TASKS.push({
        file: 'MotoBG-web.mp4',
        args: '-c:v libx264 -crf 26 -an -movflags +faststart',
        description: 'Optimizing MotoBG video'
    });
}

TASKS.forEach(task => {
  const inputFile = path.join(VIDEO_DIR, task.file);
  const outputFile = task.output 
    ? path.join(VIDEO_DIR, task.output) 
    : path.join(VIDEO_DIR, `temp-${task.file}`);
  
  const finalFile = path.join(VIDEO_DIR, task.file);
  const backupFile = path.join(ORIGINAL_DIR, task.file);

  if (!fs.existsSync(inputFile)) {
    console.log(`Skipping ${task.file}: not found`);
    return;
  }

  console.log(`\n🎬 ${task.description}`);
  console.log(`   Input: ${task.file}`);
  
  // If we are modifying in-place (no specific output name), back up first
  if (!task.output) {
      if (!fs.existsSync(backupFile)) {
          console.log(`   Backing up original to ${backupFile}`);
          fs.copyFileSync(inputFile, backupFile);
      }
  }

  try {
    const cmd = `ffmpeg -y -i "${inputFile}" ${task.args} "${outputFile}"`;
    console.log(`   Run: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });

    if (!task.output) {
        // Replace original with optimized
        fs.renameSync(outputFile, finalFile);
        console.log(`   ✅ Replaced ${task.file} with optimized version`);
    } else {
        console.log(`   ✅ Created ${task.output}`);
    }

  } catch (error) {
    console.error(`   ❌ Error processing ${task.file}:`, error.message);
  }
});

console.log('\n✨ Video optimization complete!');
