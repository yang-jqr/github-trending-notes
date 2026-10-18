/**
 * 搜索质量评测：中文需求 → 期望仓库（人工标注）。
 *
 * 用法：
 *   node scripts/eval-search.js                 # 打印指标表
 *   node scripts/eval-search.js --json out.json # 同时把明细写成 JSON
 *
 * 指标：recall@5 = top5 命中期望仓库的比例；MRR = 第一个命中排名的倒数和；
 *       0 命中率 = 返回空结果的问题占比。
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const ROOT = path.resolve(__dirname, '..');
const searchModule = require(path.join(ROOT, 'lib', 'search.ts'));
const conceptModule = require(path.join(ROOT, 'lib', 'search-concepts.ts'));
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'search-data.json'), 'utf8'));

// 词表自检：同一 surface 出现在两个概念里会让映射静默覆盖，这里直接报出来
const surfaceOwners = new Map();
const duplicateSurfaces = [];
for (const [label, forms] of Object.entries(conceptModule.CONCEPTS)) {
  for (const form of forms) {
    const key = form.toLowerCase();
    const owner = surfaceOwners.get(key);
    if (owner && owner !== label) duplicateSurfaces.push(`${key} → ${owner} / ${label}`);
    surfaceOwners.set(key, label);
  }
}
if (duplicateSurfaces.length > 0) {
  console.error(`[warn] 词表 surface 重复（后者覆盖前者）：\n  ${duplicateSurfaces.join('\n  ')}`);
}

/**
 * 人工标注集。kind：
 *   literal  —— 短词/技术词，旧实现本来就能搜到（回归护栏）
 *   concept  —— 中文概念/近义表达（考察分词与同义词）
 *   natural  —— 完整中文需求句（考察查询理解，旧实现基本 0 命中）
 *   field    —— 高级语法 + 中文词组合
 * expected 只放「语义上确实该排前面」的仓库，允许 top5 命中其中任意一个拿分。
 */
const CASES = [
  { kind: 'literal', query: 'python 爬虫', expected: ['unclecode/crawl4ai', 'D4Vinci/Scrapling', 'cv-cat/DouYin_Spider'] },
  { kind: 'literal', query: 'rust 语言', expected: ['rust-lang/rust'] },
  { kind: 'literal', query: '数据可视化', expected: ['grafana/grafana', 'IAmTomShaw/f1-race-replay'] },
  { kind: 'literal', query: '语音克隆', expected: ['debpalash/VoiceStudio', 'jamiepine/voicebox', 'OpenBMB/VoxCPM'] },
  { kind: 'literal', query: '低代码', expected: ['langgenius/dify', 'ToolJet/ToolJet', 'langflow-ai/langflow'] },
  { kind: 'literal', query: 'k8s 部署', expected: ['argoproj/argo-cd', 'meshery/meshery'] },
  { kind: 'literal', query: '渗透测试', expected: ['vxcontrol/pentagi', 'usestrix/strix'] },
  { kind: 'literal', query: '逆向工程', expected: ['NationalSecurityAgency/ghidra', 'morluto/rea'] },
  { kind: 'literal', query: '自托管', expected: ['oblien/openship', 'Dokploy/dokploy', 'awesome-selfhosted/awesome-selfhosted'] },

  { kind: 'concept', query: '抓取网页数据', expected: ['unclecode/crawl4ai', 'apify/crawlee', 'D4Vinci/Scrapling', 'firecrawl/firecrawl'] },
  { kind: 'concept', query: '笔记软件', expected: ['lfnovo/open-notebook', 'nashsu/llm_wiki', 'siyuan-note/siyuan'] },
  { kind: 'concept', query: '知识库建设', expected: ['1Panel-dev/MaxKB', 'nashsu/llm_wiki', 'Crosstalk-Solutions/project-nomad'] },
  { kind: 'concept', query: '网站变更监控', expected: ['dgtlmoon/changedetection.io'] },
  { kind: 'concept', query: '容器安全扫描', expected: ['aquasecurity/trivy'] },
  { kind: 'concept', query: '打字练习', expected: ['zyronon/TypeWords'] },
  { kind: 'concept', query: '截图生成代码', expected: ['abi/screenshot-to-code'] },
  { kind: 'concept', query: '股票量化', expected: ['shy3130/tick-stock-panel', 'TNT-Likely/PanWatch', 'ZhuLinsen/daily_stock_analysis'] },
  { kind: 'concept', query: '菜谱管理', expected: ['mealie-recipes/mealie'] },
  { kind: 'concept', query: 'OCR 文字识别', expected: ['baidu/Unlimited-OCR'] },
  { kind: 'concept', query: '数学动画', expected: ['3b1b/manim'] },
  { kind: 'concept', query: '音乐生成', expected: ['multimodal-art-projection/YuE'] },
  { kind: 'concept', query: '浏览器自动化', expected: ['apify/crawlee', 'puppeteer/puppeteer', 'tester-army/e2e', 'google/artemis'] },

  { kind: 'natural', query: '找一个能自动整理笔记的工具', expected: ['lfnovo/open-notebook', 'nashsu/llm_wiki', 'siyuan-note/siyuan', 'jordan-gibbs/hyperresearch'] },
  { kind: 'natural', query: '类似 notion 的开源笔记软件', expected: ['lfnovo/open-notebook', 'siyuan-note/siyuan'] },
  { kind: 'natural', query: '我想找能在本地跑语音克隆的工具', expected: ['debpalash/VoiceStudio', 'jamiepine/voicebox'] },
  { kind: 'natural', query: '有没有能把网页变成视频的框架', expected: ['heygen-com/hyperframes', 'remotion-dev/remotion'] },
  { kind: 'natural', query: '帮我找一个低代码搭建内部工具的平台', expected: ['ToolJet/ToolJet', 'langgenius/dify', 'langflow-ai/langflow'] },
  { kind: 'natural', query: '给 coding agent 加长期记忆', expected: ['akitaonrails/ai-memory', 'TencentCloud/TencentDB-Agent-Memory', 'ranxianglei/billion-context'] },
  { kind: 'natural', query: '把截图变成网页代码', expected: ['abi/screenshot-to-code'] },
  { kind: 'natural', query: '用自然语言生成界面组件', expected: ['thesysdev/openui', 'CopilotKit/OpenIntelligentUI'] },
  { kind: 'natural', query: '我想学 rust 语言', expected: ['rust-lang/rust'] },

  { kind: 'field', query: '语言:Python 爬虫', expected: ['cv-cat/DouYin_Spider', 'unclecode/crawl4ai', 'D4Vinci/Scrapling'] },
  { kind: 'field', query: '语言:TypeScript 动画', expected: ['remotion-dev/remotion', 'chthollyphile/folia-major'] },
];

const known = new Set(index.repositories.map(repository => repository.name));
const missing = [...new Set(CASES.flatMap(item => item.expected))].filter(name => !known.has(name));
if (missing.length > 0) {
  console.error(`[warn] 评测集里这些仓库不在索引中，请先修正标注：${missing.join(', ')}`);
}

const TOP = 5;
const rows = [];
for (const item of CASES) {
  const top = searchModule.searchRepositories(index, item.query, TOP).map(repository => repository.name);
  const expected = item.expected.filter(name => known.has(name));
  const hits = top.filter(name => expected.includes(name));
  const recall = expected.length ? hits.length / Math.min(expected.length, TOP) : 0;
  const rank = hits.length ? top.indexOf(hits[0]) + 1 : 0;
  rows.push({
    kind: item.kind,
    query: item.query,
    expected: expected.length,
    recall: Math.min(1, recall),
    mrr: rank ? 1 / rank : 0,
    zero: top.length === 0,
    top: top.slice(0, 3),
  });
}

const kinds = ['literal', 'concept', 'natural', 'field'];
const summarize = subset => {
  const n = subset.length || 1;
  return {
    n: subset.length,
    recall: subset.reduce((sum, row) => sum + row.recall, 0) / n,
    mrr: subset.reduce((sum, row) => sum + row.mrr, 0) / n,
    zeroRate: subset.filter(row => row.zero).length / n,
  };
};

const pad = (value, width) => String(value).padEnd(width);
console.log(`${pad('kind', 8)}${pad('recall@5', 10)}${pad('MRR', 8)}${pad('空结果率', 10)}n`);
for (const kind of [...kinds, 'ALL']) {
  const subset = kind === 'ALL' ? rows : rows.filter(row => row.kind === kind);
  const stats = summarize(subset);
  console.log(`${pad(kind, 8)}${pad(stats.recall.toFixed(3), 10)}${pad(stats.mrr.toFixed(3), 8)}${pad((stats.zeroRate * 100).toFixed(0) + '%', 10)}${stats.n}`);
}

console.log('\n--- 逐条 ---');
for (const row of rows) {
  const flag = row.zero ? 'ZERO' : row.recall > 0 ? 'ok  ' : 'miss';
  console.log(`${flag} [${row.kind}] "${row.query}"  recall=${row.recall.toFixed(2)} mrr=${row.mrr.toFixed(2)}  top: ${row.top.join(' / ') || '—'}`);
}

const jsonFlag = process.argv.indexOf('--json');
if (jsonFlag > -1) {
  const outPath = process.argv[jsonFlag + 1];
  if (!outPath) throw new Error('--json 需要一个输出路径');
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows, summary: summarize(rows) }, null, 2));
  console.log(`\nJSON 已写入 ${outPath}`);
}
