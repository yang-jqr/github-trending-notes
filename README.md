# 🔥 GitHub Trending 学习笔记

每日自动抓取 GitHub Trending 热榜，AI 分析技术趋势与学习价值。

[👉 访问博客](https://github-trending-notes.vercel.app/)

## 内容生成

每日内容由仓库外部的流水线生成并提交，本仓库负责展示与搜索索引，不包含上游抓取实现。

- **调度**：Windows 任务计划程序 `GitHubTrending-omp`，每天 18:00 自动运行（错过可补跑），由 omp（AI coding agent）按项目内技能规范执行；也支持手动补跑。
- **数据源（固定三源，分源保留排名口径）**：GitHub Trending（总榜 + Python / TypeScript 子榜）、ossinsight 飙升榜、GitHub Search 新锐（90 天内创建的新项目，按 starVelocity 排序）。单源不可用时在笔记中单独标注状态，不与其他来源混用排名口径。
- **发布链路**：写入 Obsidian vault（笔记 + MOC）→ 格式校验通过后才推送本仓库 → Vercel 自动部署 → 自动校验线上页面。笔记每日更新。

## 技术栈

- **Next.js 15 + React 19 + TypeScript** — App Router 与 SSG 静态生成
- **Tailwind CSS** — 响应式动漫风格界面
- **Markdown + Obsidian** — 本地笔记与内容来源
- **Vercel** — 静态部署

## 功能

- **🏠 首页** — 动漫风格主视觉、趋势统计、最新 12 期笔记、热门语言和反复上榜仓库
- **🔍 搜索** — `/search` 页面 + 导航栏快捷搜索（`/` 或 `Ctrl/Cmd+K` 聚焦）
  - 支持按仓库名、简介、语言、日期和学习笔记内容搜索
  - 支持 `语言:Python`、`日期:2026-08`、`仓库:openai` 等组合输入
  - 每个结果显示仓库简介、语言、Star、日期和上榜次数
  - 构建时规范化仓库名并全局去重，同一仓库只出现一次
  - 快捷搜索按相关度、全部结果按 Star 从高到低排列
  - 仓库名可打开 GitHub 原仓库，并保留本站对应日期的学习笔记入口
- **📚 归档** — `/archive` 按月分组浏览全部笔记，按语言 / 月份筛选，反复上榜仓库表
- **📝 文章页** — repo 名自动链接到 GitHub，支持上一篇 / 下一篇导航
- **📱 基础体验** — 响应式导航、键盘操作、空状态、SEO 元数据、Sitemap、PWA Manifest 和 404 页面

## 搜索实现

构建时 `scripts/generate-search-data.js` 扫描 `content/`，生成带仓库简介、出现日期和检索文本的
`public/search-data.json`。导航栏和 `/search` 共用 `lib/search.ts`，索引只在用户开始搜索时加载，
同一浏览器标签页共享请求。顶部搜索使用有界 Top-8 排序，避免仓库增长后对全部命中结果排序。

`npm test` 会检查仓库去重、字段完整性、单条文本上限和 Brotli 压缩体积。索引超过 2 MiB 时测试会失败，
提示将搜索迁移到 Web Worker 或服务端 API，避免大索引直接拖慢浏览器。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。常用命令：

```bash
npm test       # 生成并校验搜索索引
npm run build  # 生产构建
```

将每日笔记放入 `content/trending-YYYY-MM-DD.md`。部署到自定义域名时可设置：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
TRENDING_CONTENT_DIR=/absolute/path/to/hermes/output
```

`NEXT_PUBLIC_SITE_URL` 用于 canonical、robots.txt 和 sitemap.xml；`TRENDING_CONTENT_DIR` 可让构建直接读取 Hermes 的输出目录，未设置时读取仓库内的 `content/`。
