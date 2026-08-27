/**
 * 内容格式解析的唯一来源，供 SSG（lib/posts.ts）与搜索索引构建（scripts/generate-search-data.js）共用，
 * 避免两套解析逻辑随内容格式演进各自漂移。纯函数、无依赖。
 */

/** Normalize repo name: strip trailing decorators, normalize spaces around / */
export function normalizeRepoName(raw: string): string {
  return raw
    .replace(/[（(].*$/, '')             // strip old heading metadata
    .replace(/\s*[⭐\|].*$/, '')      // strip trailing ⭐ or | content
    .replace(/\s*\/\s*/g, "/")        // normalize "a / b" → "a/b"
    .trim();
}

/** Extract "owner/repo" from a repo heading line, or '' if the line isn't a heading. */
export function repoNameFromHeading(line: string): string {
  let m = line.match(/^## \d+\. (.+)/);              // ## 1. repo/name
  if (!m) m = line.match(/^\*\*\d+\. (.+?)\*\*/);    // **1. repo/name**
  if (!m) m = line.match(/^\*\*#\d+\s+(.+?)\*\*/);   // **#1 repo/name**
  if (!m) return "";
  const name = normalizeRepoName(m[1]);
  return name.length > 2 && name.includes("/") ? name : "";
}

/** 一篇笔记中的所有仓库名，去重、按出现顺序。 */
export function extractRepoNames(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const line of content.split("\n")) {
    const name = repoNameFromHeading(line);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** 标题行主语言（当前格式 "**#1 owner/repo** | Lang ·"，旧格式行尾 "· Lang"）。 */
export function extractLanguageFromHeading(line: string): string {
  const current = line.match(/\*\*\s*\|\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*·/);
  if (current) return current[1].trim();
  const old = line.match(/·\s*([A-Za-z][\w+#.-]*(?:\s+[A-Za-z][\w+#.-]*)?)\s*$/);
  return old ? old[1].trim() : "";
}
