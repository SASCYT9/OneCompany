const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Get latest commit info
  const commitHash = execSync('git log -1 --format="%h"').toString().trim();
  const commitMessage = execSync('git log -1 --format="%B"').toString().trim();
  const authorName = execSync('git log -1 --format="%an"').toString().trim();
  const commitDate = execSync('git log -1 --format="%cd" --date=format:"%Y-%m-%d %H:%M"').toString().trim();
  
  // Get list of changed files
  const filesChanged = execSync('git diff-tree --no-commit-id --name-status -r HEAD')
    .toString()
    .trim()
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split('\t');
      return `- **${parts[0]}**: \`${parts[1]}\``;
    })
    .join('\n');

  // Format the changelog entry
  const entry = `
### 🟢 [${commitDate}] Commit \`${commitHash}\`
**Автор**: 👤 ${authorName}

> ${commitMessage.split('\n').join('\n> ')}

#### 📂 Змінені файли:
${filesChanged}

---
`;

  // Read the changelog file
  // Using fs.readdir to find the exact filename in case of encoding issues with the emoji
  const wikiDir = path.join(__dirname, '..', '..', 'wiki');
  const files = fs.readdirSync(wikiDir);
  const targetFile = files.find(f => f.includes('Git Changelog'));
  
  if (!targetFile) {
    console.error('Git Changelog file not found in wiki!');
    process.exit(0);
  }

  const changelogPath = path.join(wikiDir, targetFile);
  let content = fs.readFileSync(changelogPath, 'utf8');

  // Inject the new entry below the marker
  const marker = '<!-- HOOK_INJECT_MARKER -->';
  if (content.includes(marker)) {
    content = content.replace(marker, `${marker}\n${entry}`);
    fs.writeFileSync(changelogPath, content, 'utf8');
    console.log(`✅ Obsidian Git Changelog updated for commit ${commitHash}`);
  } else {
    console.log('⚠️ HOOK_INJECT_MARKER not found in the changelog file.');
  }

} catch (e) {
  console.error('Error updating Obsidian Changelog:', e.message);
}
