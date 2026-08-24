# 🔥 GitHub Trending 学习笔记

每日自动抓取 GitHub Trending 热榜，AI 分析技术趋势与学习价值。

[👉 访问博客](https://github-trending-notes.vercel.app/)

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
  - 每个结果显示仓库简介、语言、日期和上榜次数
  - 构建时规范化仓库名并全局去重，同一仓库只出现一次
  - 精确匹配和前缀匹配优先，点击进入本站对应日期的学习笔记并定位仓库
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
```

该地址会用于 canonical、robots.txt 和 sitemap.xml；未设置时使用线上博客地址。
