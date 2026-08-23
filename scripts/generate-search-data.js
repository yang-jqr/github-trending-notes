const fs = require('fs');
const path = require('path');

const contentDir = path.resolve(__dirname, '..', 'content');
const outputPath = path.resolve(__dirname, '..', 'public', 'search-data.json');

function normalizeRepoName(raw) {
  return raw
    .replace(/\s*[⭐|].*$/, '')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

function extractRepos(content) {
  const repos = [];
  for (const line of content.split('\n')) {
    let match = line.match(/^## \d+\. (.+)/);
    if (!match) match = line.match(/^\*\*\d+\. (.+?)\*\*/);
    if (!match) match = line.match(/^\*\*#\d+\s+(.+?)\*\*/);
    if (!match) continue;
    const name = normalizeRepoName(match[1]);
    if (name.length > 2 && name.includes('/')) repos.push(name);
  }
  return repos;
}

const repositories = new Map();
if (fs.existsSync(contentDir)) {
  for (const file of fs.readdirSync(contentDir).filter(file => file.endsWith('.md') && !file.includes('MOC'))) {
    const content = fs.readFileSync(path.join(contentDir, file), 'utf8');
    for (const name of extractRepos(content)) {
      const key = name.toLowerCase();
      if (!repositories.has(key)) repositories.set(key, name);
    }
  }
}

const output = {
  repositories: [...repositories.values()].sort((a, b) => a.localeCompare(b)),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Generated repository index: ${output.repositories.length} unique repositories`);
