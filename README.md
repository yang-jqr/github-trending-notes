# 🔥 GitHub Trending 学习笔记

每日自动抓取 GitHub Trending 热榜，AI 分析技术趋势与学习价值。

[👉 访问博客](https://github-trending-notes.vercel.app/)

## 技术栈
- **Next.js 15** — SSG 静态博客
- **Obsidian** — 本地 Markdown 笔记库
- **Hermes Agent + Cron** — 每日自动抓取+分析
- **Vercel** — 一键部署

## 功能
- **🏠 首页** — 动漫风格主视觉、趋势统计、最新 12 期笔记、热门语言和反复上榜仓库
- **🔍 搜索** — `/search` 页面 + 导航栏快捷搜索（`/` 或 `Ctrl/Cmd+K` 聚焦）
  - 支持按仓库名、简介、语言、日期和学习笔记内容搜索
  - 支持 `语言:Python`、`日期:2026-08`、`仓库:openai` 等组合输入
  - 每个结果显示仓库简介、语言、日期和上榜次数
  - 构建时忽略大小写全局去重，同一仓库只出现一次
  - 精确匹配和前缀匹配优先，点击进入本站对应学习笔记并定位关键词
- **📚 归档** — `/archive` 按月分组浏览全部笔记，按语言 / 月份筛选，反复上榜仓库表
- **📝 文章页** — repo 名自动链接到 GitHub，支持上一篇 / 下一篇导航
- **📱 基础体验** — 响应式导航、键盘操作、页脚、空状态、SEO 元数据和 404 页面

## 搜索实现
构建时 `scripts/generate-search-data.js` 扫描 `content/` 生成 `public/search-data.json`
（带简介、站内文章链接和检索文本的全局唯一仓库目录），前端 `lib/search.ts` 统一过滤和排序，导航栏与 `/search`
页面共用同一套逻辑。纯静态、无后端、一次 fetch 全量索引。
