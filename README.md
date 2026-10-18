# 🔥 GitHub Trending 学习笔记

每日自动抓取 GitHub Trending 热榜，AI 分析技术趋势与学习价值。

[👉 访问博客](https://github-trending-notes.vercel.app/)

> 维护与未来规划见 [docs/MAINTENANCE.md](docs/MAINTENANCE.md)；内容与抓取设计的审计记录见 [docs/CONTENT-AUDIT.md](docs/CONTENT-AUDIT.md)。

## 内容生成

每日内容由仓库外部的流水线生成并提交，本仓库负责展示与搜索索引，不包含上游抓取实现。

- **调度**：Windows 任务计划程序 `GitHubTrending-omp`，每天 18:00 自动运行（错过可补跑），由 omp（AI coding agent）按项目内技能规范执行；另有 20:30 / 22:30 两个健康检查任务（缺失自动补跑、仍失败则告警）。
- **数据源（主源 + 两个 best-effort 源，分源保留排名口径）**：
  - 主源：GitHub Trending（总榜 + Python / TypeScript 子榜）；
  - best-effort：ossinsight 飙升榜（官方事件流覆盖自 2026-03 起跌至 0.3%，**通常返回空 rows**，笔记中标注为已知常态）、GitHub Search 新锐（90 天内创建、stars>200，按 starVelocity 排序，仅在可用时收录）。
  单源不可用时在笔记中单独标注状态，不与其他来源混用排名口径。
- **发布链路**：写入 Obsidian vault（笔记 + MOC）→ 格式校验通过后才推送本仓库 → Vercel 自动部署 → 自动校验线上页面（含数值级新鲜度比对）。

## 技术栈

- **Next.js 15 + React 19 + TypeScript** — App Router 与 SSG 静态生成
- **Tailwind CSS** — 响应式动漫风格界面
- **Markdown + Obsidian** — 本地笔记与内容来源
- **Vercel** — 静态部署

## 功能

- **🏠 首页** — 动漫风格主视觉、趋势统计、最新 12 期笔记、热门语言和反复上榜仓库
- **🔍 搜索** — `/search` 页面 + 导航栏快捷搜索（`/` 或 `Ctrl/Cmd+K` 聚焦）
  - 支持中文需求描述搜索：「能自动整理笔记的工具」「本地跑语音克隆」这类自然语言会先分词、再按概念同义词扩展匹配（爬虫 ↔ crawler/scraper、笔记 ↔ notebook/notion…）
  - 支持按仓库名、简介、语言、日期和学习笔记内容搜索
  - 支持 `语言:Python`、`日期:2026-08`、`仓库:openai` 等组合输入
  - 每个结果显示仓库简介、语言、Star、日期、上榜次数，以及**来源/榜位（主榜 / py 子榜 / ts 子榜 #N）、当日增量、价值分级**
  - 构建时规范化仓库名并全局去重，同一仓库只出现一次
  - 快捷搜索按相关度（BM25）排序；`/search` 支持「相关度 / 日增 / 星数」三种排序，无关键词时按 Star 展示最近收录
  - 仓库名可打开 GitHub 原仓库，并保留本站对应日期的学习笔记入口
- **📚 归档** — `/archive` 按月分组浏览全部笔记，按语言 / 月份筛选，反复上榜仓库表
- **📝 文章页** — 顶部「本期速览」自动摘出 3 条（优先取价值=高），repo 名自动链接到 GitHub，支持上一篇 / 下一篇导航
- **📱 基础体验** — 响应式导航、键盘操作、空状态、SEO 元数据、Sitemap、PWA Manifest 和 404 页面

## 搜索实现

构建时 `scripts/generate-search-data.js` 扫描 `content/`，生成带仓库简介、出现日期、来源/榜位、当日增量、价值分级和检索文本的
`public/search-data.json`。同一仓库多次上榜时，检索文本按「最新一期在前」拼接并截断到 600 字符，
使索引规模随榜单积累缓慢增长（当前约 1.24 KB/条）。导航栏和 `/search` 共用 `lib/search.ts`，索引只在用户开始搜索时加载，
同一浏览器标签页共享请求。顶部搜索使用有界 Top-8 排序，避免仓库增长后对全部命中结果排序。

检索本身分三步，全部在浏览器里跑、不依赖后端：

1. **查询理解**（`lib/search.ts` + `lib/search-concepts.ts`）：`Intl.Segmenter` 切中文词（浏览器/Node 内置，无第三方依赖），
   把被切碎的固定搭配拼回来（开源 → 开/源），剔除「帮我/有没有/怎么」这类意图词，再把词映射到「爬虫采集 / 笔记 / 部署」
   等概念并扩展中英文同义词。
2. **召回**：不再要求所有词都出现在正文里（旧实现正是中文长句 0 命中的原因），只要命中最有判别力（文档频率 ≤ 20%）的
   任意一个概念即可进入排序，噪声由排序压制。
3. **排序**：BM25（k1=1.2、b=0.75，仓库名 2.2×、简介 1.4× 加权），并按概念覆盖率加成；同义词扩展只在具体
   （文档频率 ≤ 20%）时生效，且同一概念只展开一次，避免「交易」这类高频词重复计分。

`npm run eval:search` 跑人工标注的中文需求评测集（`scripts/eval-search.js`，33 条，分 literal / concept / natural /
field 四类），输出 recall@5、MRR 和空结果率，用于改动前后对比与防回归。

`npm test` 会检查仓库去重、字段完整性、单条文本上限、Brotli 压缩体积，以及 `rank/source/sourceRank/todayDelta/valueTier`
元数据的类型与取值。索引超过 2 MiB 时测试会失败，提示将搜索迁移到 Web Worker 或服务端 API，避免大索引直接拖慢浏览器。

## 规模与维护

按当前收录速度（约 5.5 个新仓库/天，约 2000/年）推算，几个关键阈值：

| 规模 | 索引 Brotli | 浏览器全量扫描 |
|---|---|---|
| 2000 条 | ≈ 520 KB | ≈ 6 ms |
| 4000 条 | ≈ 1.04 MB | ≈ 13 ms |
| 8000 条 | ≈ 2.08 MB（触达 2 MiB 护栏，约 7900 条） | ≈ 26 ms |

到达 2 MiB 护栏（约 7900 条、按现速约 4 年）时，需要把检索迁移到 Web Worker 或服务端接口；
在那之前，改动集中在词表（`lib/search-concepts.ts`）与评测集（`scripts/eval-search.js`）的持续扩充。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。常用命令：

```bash
npm test            # 生成并校验搜索索引
npm run eval:search # 中文需求搜索评测（recall@5 / MRR / 空结果率）
npm run build       # 生产构建
```

将每日笔记放入 `content/trending-YYYY-MM-DD.md`。部署到自定义域名时可设置：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
TRENDING_CONTENT_DIR=/absolute/path/to/hermes/output
```

`NEXT_PUBLIC_SITE_URL` 用于 canonical、robots.txt 和 sitemap.xml；`TRENDING_CONTENT_DIR` 可让构建直接读取 Hermes 的输出目录，未设置时读取仓库内的 `content/`。
