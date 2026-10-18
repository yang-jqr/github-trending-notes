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

/**
 * 单条 searchText 的字符上限。searchText 把一个仓库历次上榜的检索正文首尾相接，长度随上榜次数线性
 * 增长，因此必须封顶——否则 check-search-data.js 的「每条 1800 字节」预算会随榜单积累必然失效
 * （1600 字符上限时可到 3400 字节/条，实测 2026-10 每条已 1560 字节、约 2 个月后触线）。
 * 600 字符 ≈ 1526 字节/条（正文约 40% 是中文，平均 1.94 字节/字符），留 15% 余量，
 * 同时保留「最近一期完整 + 最近数期部分」的可检索正文。
 */
const SEARCH_TEXT_LIMIT = 600;

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

/**
 * 「上手」行专用。实测 2110 行里 1941 行（92%）只是 `git clone <仓库地址>`——
 * 仓库名与地址本来就在 searchText 里，重复收录只会挤掉长条目尾部的「对你的价值」正文
 * （searchText 每条 600 字符上限，越靠后越先被截掉）。因此只保留带真实信息的行：
 * 安装命令、官网、特别说明；纯 clone / 纯「只读浏览 <地址>」一律丢弃。
 */
function extractActionable(block) {
  // 标签有历史变体：`上手` 2110 行 / `快速上手` 20 行 / `怎么使用` 10 行
  const raw = extractLabeledText(block, ['上手', '快速上手', '怎么使用']);
  if (!raw) return '';
  const cleaned = raw
    .replace(/git clone\s+https?:\/\/[^\s）)，,；;]+/gi, ' ')
    .replace(/https?:\/\/[^\s）)，,；;]+/gi, ' ')
    .replace(/\bgit clone\b/gi, ' ')
    .replace(/[（(]\s*[)）]/g, ' ')
    .replace(/^(?:只读浏览|直接浏览|浏览仓库|浏览|访问仓库|访问|查看仓库|查看)\s*/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // 判空用副本：去掉标点与空白后再看还剩多少实义字符（纯 clone / 纯「只读浏览 <地址>」→ 丢弃）
  const probe = cleaned.replace(/[，,、；;：:。.（）()《》【】「」\s]+/g, '');
  return probe.length >= 4 ? cleaned : '';
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

/** 标题行里的当日排名（## 1. / **#1 owner/repo** / 旧格式 **1. name**）。 */
function extractRank(line) {
  let match = line.match(/^## (\d+)\./);
  if (!match) match = line.match(/^\*\*#(\d+)\s/);
  if (!match) match = line.match(/^\*\*(\d+)\./);
  return match ? Number(match[1]) : 0;
}

/** 标题行里的「+1,397今日」。 */
function extractTodayDelta(line) {
  const match = line.match(/\+([\d,]+)\s*今日/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}

/** 描述里的来源标注：「（py 子榜 #6）」/「（ts 子榜 #5）」；没有则视为主榜。 */
function extractSource(block, rank) {
  const match = block.match(/[（(]\s*(py|ts)\s*子榜\s*#\s*(\d+)\s*[）)]/i);
  if (match) return { source: match[1].toLowerCase(), sourceRank: Number(match[2]) };
  return { source: 'main', sourceRank: rank };
}

/** 「对你的价值」分级：高 / 中高 / 中 / 低。 */
function extractValueTier(block) {
  const match = block.match(/\*\*对你的价值\*\*[：:]\s*\*\*(高|中高|中|低)\*\*/)
    || block.match(/\*\*对你有什么用\*\*[：:]\s*\*\*(高|中高|中|低)\*\*/);
  return match ? match[1] : '';
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
    const actionable = extractActionable(block);
    const language = extractLanguage(lines[start], block);
    const stars = extractStars(lines[start], block);
    const rank = extractRank(lines[start]);
    const todayDelta = extractTodayDelta(lines[start]);
    const { source, sourceRank } = extractSource(block, rank);
    const valueTier = extractValueTier(block);

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
      rank,
      todayDelta,
      source,
      sourceRank,
      valueTier,
      // actionable 放在 description 之后：searchText 按 SEARCH_TEXT_LIMIT 截断，靠前才不会被长条目切掉
      searchText: plainText(`${name} ${language} ${date} ${description} ${actionable} ${reason} ${value}`).toLocaleLowerCase().slice(0, SEARCH_TEXT_LIMIT),
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
      if (!existing.valueTier && repository.valueTier) existing.valueTier = repository.valueTier;
      if (!existing.todayDelta && repository.todayDelta) existing.todayDelta = repository.todayDelta;
      if (repository.language && !existing.languages.includes(repository.language)) existing.languages.push(repository.language);
      existing.searchText = `${existing.searchText} ${repository.searchText}`.slice(0, SEARCH_TEXT_LIMIT);
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
