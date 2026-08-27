const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// 允许直接 require TypeScript 共享解析模块，避免与 lib/posts.ts 重复实现内容格式解析
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { repoNameFromHeading, extractLanguageFromHeading } = require('../lib/parsing.ts');

const contentDir = process.env.TRENDING_CONTENT_DIR
  ? path.resolve(process.env.TRENDING_CONTENT_DIR)
  : path.resolve(__dirname, '..', 'content');
const outputPath = path.resolve(__dirname, '..', 'public', 'search-data.json');

function plainText(value) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/[<>]{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLabeledText(block, labels) {
  for (const label of labels) {
    const patterns = [
      new RegExp(`(?:^|\\n)\\s*-?\\s*\\*\\*${label}\\*\\*[：:]\\s*(.+)`),
      new RegExp(`(?:^|\\n)\\s*-?\\s*\\*\\*${label}[：:]\\*\\*\\s*(.+)`),
    ];
    for (const pattern of patterns) {
      const match = block.match(pattern);
      if (match) return plainText(match[1]);
    }
  }
  return '';
}

function extractLanguage(heading, block) {
  const primary = extractLanguageFromHeading(heading);
  if (primary) return primary;
  const statsLine = block.match(/⭐[^\n]*\|\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*(?:\n|$)/);
  return statsLine ? statsLine[1].trim() : '';
}

function extractStars(heading, block) {
  const match = heading.match(/⭐\s*([\d,.]+(?:[kKmM])?)/)
    || heading.match(/·\s*([\d,.]+(?:[kKmM])?)\s*⭐/)
    || block.match(/^⭐\s*([\d,.]+(?:[kKmM])?)/m);
  if (!match) return 0;
  const value = match[1].replace(/,/g, '');
  const suffix = value.slice(-1).toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1;
  return Math.round(Number.parseFloat(multiplier === 1 ? value : value.slice(0, -1)) * multiplier);
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
    const description = extractLabeledText(block, ['是什么', '一句话', '简单介绍', '介绍']) || `收录于 ${date} 的 GitHub Trending 学习笔记。`;
    const reason = extractLabeledText(block, ['为什么热']);
    const value = extractLabeledText(block, ['对你有什么用', '对你的价值']);
    const language = extractLanguage(lines[start], block);
    const stars = extractStars(lines[start], block);

    repositories.push({
      name,
      description: description.slice(0, 220),
      slug,
      date,
      language,
      stars,
      dates: [date],
      languages: language ? [language] : [],
      appearances: 1,
      searchText: plainText(`${name} ${language} ${date} ${description} ${reason} ${value}`).toLocaleLowerCase().slice(0, 1600),
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
      if (!existing.language && repository.language) existing.language = repository.language;
      if (!existing.stars && repository.stars) existing.stars = repository.stars;
      if (repository.language && !existing.languages.includes(repository.language)) existing.languages.push(repository.language);
      existing.searchText = `${existing.searchText} ${repository.searchText}`.slice(0, 1600);
    }
  }
}

const output = {
  version: 1,
  repositories: [...repositoryMap.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Generated repository index: ${output.repositories.length} unique repositories`);
