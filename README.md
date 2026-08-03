# 🔥 GitHub Trending 学习笔记

每日自动抓取 GitHub Trending 热榜，AI 分析技术趋势与学习价值。

[👉 访问博客](https://github-trending-notes.vercel.app/)

## 技术栈
- **Next.js 15** — SSG 静态博客
- **Obsidian** — 本地 Markdown 笔记库
- **Hermes Agent + Cron** — 每日自动抓取+分析
- **Vercel** — 一键部署

## 功能
- **🏠 首页** — 统计卡片、语言标签、按日期浏览笔记卡片、反复上榜仓库
- **🔍 搜索** — `/search` 页面 + 导航栏快捷搜索（`/` 或 `Ctrl/Cmd+K` 聚焦）
  - 字段加权评分：repo 名精确匹配优先，其次语言、日期、正文 TF-IDF
  - 支持中文分词（bigram）、冷门仓库名、日期前缀（如 `2026-08`）
  - 可按语言 / 日期范围过滤，按相关度或日期排序，URL 可分享可回退
  - 结果关键词高亮，进入文章后自动滚动到首个匹配处
- **📚 归档** — `/archive` 按月分组浏览全部笔记，按语言 / 月份筛选，反复上榜仓库表
- **📝 文章页** — repo 名自动链接到 GitHub，搜索进入时正文高亮关键词

## 搜索实现
构建时 `scripts/generate-search-data.js` 扫描 `content/` 生成 `public/search-data.json`
（TF-IDF 索引 + 中文 bigram + 结构化字段），前端 `lib/search.ts` 统一评分，
导航栏与 `/search` 页面共用同一套逻辑。纯静态、无后端、一次 fetch 全量索引。
