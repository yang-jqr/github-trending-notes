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

function repoNameFromHeading(line) {
  let match = line.match(/^## \d+\. (.+)/);
  if (!match) match = line.match(/^\*\*\d+\. (.+?)\*\*/);
  if (!match) match = line.match(/^\*\*#\d+\s+(.+?)\*\*/);
  if (!match) return '';
  const name = normalizeRepoName(match[1]);
  return name.length > 2 && name.includes('/') ? name : '';
}

function plainText(value) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/[<>]{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLanguage(heading, block) {
  const current = heading.match(/\*\*\s*\|\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*·/);
  if (current) return current[1].trim();
  const old = heading.match(/·\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*$/);
  if (old) return old[1].trim();
  const statsLine = block.match(/⭐[^\n]*\|\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*(?:\n|$)/);
  return statsLine ? statsLine[1].trim() : '';
}

function extractRepositories(content, slug, date) {
  const lines = content.split('\n');
  const repositories = [];

  for (let start = 0; start < lines.length; start++) {
    const name = repoNameFromHeading(lines[start]);
    if (!name) continue;

    let end = start + 1;
    while (end < lines.length && !repoNameFromHeading(lines[end])) end++;
    const block = lines.slice(start, end).join('\n');
    const intro = block.match(/(?:^|\n)\s*-?\s*\*\*(?:是什么|一句话)\*\*[：:]\s*(.+)/);
    const description = plainText(intro?.[1] || '') || `收录于 ${date} 的 GitHub Trending 学习笔记。`;
    const language = extractLanguage(lines[start], block);

    repositories.push({
      name,
      description: description.slice(0, 220),
      slug,
      date,
      language,
      dates: [date],
      languages: language ? [language] : [],
      appearances: 1,
      searchText: plainText(`${name} ${language} ${date} ${block}`).slice(0, 4000),
    });
  }

  return repositories;
}

const repositoryMap = new Map();
if (fs.existsSync(contentDir)) {
  const files = fs.readdirSync(contentDir)
    .filter(file => /^trending-\d{4}-\d{2}-\d{2}\.md$/.test(file))
    .sort()
    .reverse();

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const date = slug.replace('trending-', '');
    const content = fs.readFileSync(path.join(contentDir, file), 'utf8');

    for (const repository of extractRepositories(content, slug, date)) {
      const key = repository.name.toLowerCase();
      const existing = repositoryMap.get(key);
      if (!existing) {
        repositoryMap.set(key, repository);
        continue;
      }
      existing.appearances += 1;
      if (!existing.dates.includes(repository.date)) existing.dates.push(repository.date);
      if (repository.language && !existing.languages.includes(repository.language)) existing.languages.push(repository.language);
      existing.searchText = `${existing.searchText} ${repository.searchText}`.slice(0, 4000);
    }
  }
}

const output = {
  repositories: [...repositoryMap.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Generated repository index: ${output.repositories.length} unique repositories`);
