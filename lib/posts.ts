import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { extractLanguageFromHeading, extractRepoNames, normalizeRepoName } from "./parsing";

export { extractRepoNames, normalizeRepoName };

const VAULT_PATH = process.env.TRENDING_CONTENT_DIR
  ? path.resolve(process.env.TRENDING_CONTENT_DIR)
  : path.join(process.cwd(), "content");
const PUBLIC_SLUG = /^trending-\d{4}-\d{2}-\d{2}$/;
let allPostsCache: Post[] | null = null;

export interface PostMeta { slug: string; title: string; date: string; }
export interface Post { meta: PostMeta; content: string; }
export interface RepoStats { name: string; count: number; dates: string[]; }
export interface BlogStats {
  totalDays: number;
  totalRepos: number;
  uniqueRepos: number;
  topLanguages: { lang: string; count: number }[];
  recurringRepos: RepoStats[];
}

function getAllSlugs(): string[] {
  if (!fs.existsSync(VAULT_PATH)) return [];
  return fs.readdirSync(VAULT_PATH)
    .filter(f => f.endsWith(".md"))
    .map(f => f.replace(/\.md$/, ""))
    .filter(slug => PUBLIC_SLUG.test(slug));
}

export function getAllPosts(): Post[] {
  if (process.env.NODE_ENV === "production" && allPostsCache) return allPostsCache;
  const posts: Post[] = [];
  for (const slug of getAllSlugs()) {
    const fp = path.join(VAULT_PATH, `${slug}.md`);
    if (!fs.existsSync(fp)) continue;
    const { data, content } = matter(fs.readFileSync(fp, "utf-8"));
    const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
    posts.push({ meta: { slug, title: data.title || slug, date: m ? m[1] : data.date || "" }, content });
  }
  const result = posts.sort((a, b) => b.meta.date.localeCompare(a.meta.date));
  if (process.env.NODE_ENV === "production") allPostsCache = result;
  return result;
}

export function getPost(slug: string): Post | null {
  if (!PUBLIC_SLUG.test(slug)) return null;
  const fp = path.join(VAULT_PATH, `${slug}.md`);
  if (!fs.existsSync(fp)) return null;
  const { data, content } = matter(fs.readFileSync(fp, "utf-8"));
  const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
  return { meta: { slug, title: data.title || slug, date: m ? m[1] : data.date || "" }, content };
}

/** 去掉 Obsidian 上一篇/下一篇面包屑（<< [[a]] | [[b]] >>），博客自带底部导航。 */
export function stripObsidianBreadcrumbs(content: string): string {
  return content.replace(/^<<[^\n]*?>>[ \t]*\n?/gm, "");
}

export function extractLanguages(content: string): string[] {
  const langs = new Set<string>();
  for (const line of content.split("\n")) {
    // 共享主解析覆盖当前格式与旧格式；其余为历史遗留格式与自由文本兜底
    let lang = extractLanguageFromHeading(line);
    if (!lang) {
      let m: RegExpMatchArray | null = line.match(/^\*\*\d+\. .+?\*\*[（(]\s*([A-Za-z][\w\s+#.-]*?)\s*·/);
      if (!m) m = line.match(/⭐[^|]+\|[^|]*\|\s*(\w[\w\s+#.-]*)/);
      if (!m) m = line.match(/today\s*\|\s*(\w[\w+#.-]+)/);
      if (m) lang = m[1].trim();
    }
    if (lang && /^[A-Z]/.test(lang) && lang.length < 20) {
      langs.add(lang);
    } else {
      // Fallback: split by · and check last segment
      const parts = line.split("·");
      const last = parts[parts.length - 1]?.trim();
      if (last && /^[A-Z]/.test(last) && last.length < 20) langs.add(last);
    }
  }
  return Array.from(langs).slice(0, 10);
}

export function getStats(): BlogStats {
  const posts = getAllPosts().filter(p => p.meta.date);
  const repoMap = new Map<string, string[]>();
  const langMap = new Map<string, number>();
  let totalRepos = 0;
  for (const post of posts) {
    const names = extractRepoNames(post.content);
    const langs = extractLanguages(post.content);
    totalRepos += names.length;
    for (const name of names) {
      const dates = repoMap.get(name) || [];
      if (!dates.includes(post.meta.date)) dates.push(post.meta.date);
      repoMap.set(name, dates);
    }
    for (const lang of langs) {
      langMap.set(lang, (langMap.get(lang) || 0) + 1);
    }
  }
  const recurring = Array.from(repoMap.entries())
    .map(([name, dates]) => ({ name, count: dates.length, dates: dates.sort().reverse() }))
    .filter(r => r.count >= 2).sort((a, b) => b.count - a.count);
  const topLanguages = Array.from(langMap.entries())
    .map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  return { totalDays: posts.length, totalRepos, uniqueRepos: repoMap.size, topLanguages, recurringRepos: recurring };
}

/**
 * 把内容中的 owner/repo 转为可点击的 GitHub 链接。
 * 同时将 repo 简称（owner/repo 的 repo 部分）也链接到同一仓库。
 * 跳过代码块和内联代码，跳过已经在 [text](url) 里的链接。
 */
export function linkifyRepoNames(content: string): string {
  const names = extractRepoNames(content);
  if (names.length === 0) return content;

  // 构建匹配模式：全名 + 简称（repo 名部分，最少 4 字符避免过度匹配）
  const patterns: { pattern: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      patterns.push({ pattern: name, url: `https://github.com/${name}` });
    }
    // 提取 repo 简称（/ 后面的部分），作为额外匹配
    const slashIdx = name.indexOf('/');
    if (slashIdx > 0 && slashIdx < name.length - 4) {
      const partial = name.slice(slashIdx + 1);
      const key = 'partial:' + partial;
      if (!seen.has(key)) {
        seen.add(key);
        patterns.push({ pattern: partial, url: `https://github.com/${name}` });
      }
    }
  }

  // 按长度降序排列（长名优先匹配，避免短名误伤）
  patterns.sort((a, b) => b.pattern.length - a.pattern.length);

  const segments = splitCodeSegments(content);

  return segments.map(seg => {
    if (seg.isCode) return seg.text;
    return linkifyText(seg.text, patterns);
  }).join('');
}

/** 对非代码文本做仓库名/简称链接化 */
function linkifyText(text: string, patterns: { pattern: string; url: string }[]): string {
  for (const { pattern, url } of patterns) {
    let result = '';
    let remaining = text;
    while (remaining.length > 0) {
      const idx = remaining.indexOf(pattern);
      if (idx === -1) { result += remaining; break; }

      // 简称需要检查词边界（不在更长单词内部匹配，不在连字符复合词中）
      const isPartial = !pattern.includes('/');
      if (isPartial) {
        const charBefore = idx > 0 ? remaining[idx - 1] : ' ';
        const charAfter = idx + pattern.length < remaining.length ? remaining[idx + pattern.length] : ' ';
        // 前/后有字母数字 → 在更长单词内；前一个字符是 - 且再前一个是字母数字 → 复合词
        const prevIsAlphaNum = /[a-zA-Z0-9]/.test(charBefore);
        const nextIsAlphaNum = /[a-zA-Z0-9]/.test(charAfter);
        const isCompoundWord = charBefore === '-' && idx > 1 && /[a-zA-Z0-9]/.test(remaining[idx - 2]);
        if (prevIsAlphaNum || nextIsAlphaNum || isCompoundWord) {
          result += remaining.slice(0, idx + pattern.length);
          remaining = remaining.slice(idx + pattern.length);
          continue;
        }
      }

      result += remaining.slice(0, idx);
      const preceding = result;

      // 检查是否在 markdown 链接内
      // 情况1: 链接文本 [text](url) — [ 之后、]( 之前
      // 情况2: 链接 URL — ]( 之后、) 之前
      // 情况3: wiki 链接 [[text]] — [[ 不算 markdown 链接
      const lastClose = preceding.lastIndexOf('](');
      const lastOpen = preceding.lastIndexOf('[');
      const isWikiLink = lastOpen > 0 && preceding[lastOpen - 1] === '[';

      let insideLink = false;
      if (!isWikiLink && lastOpen > lastClose) {
        // 在链接文本内
        insideLink = true;
      } else if (lastClose !== -1) {
        // 检查是否在链接 URL 内（]( 之后尚未遇到 ) 闭合）
        const afterLinkStart = preceding.slice(lastClose + 2);
        if (!afterLinkStart.includes(')')) {
          insideLink = true;
        }
      }

      if (insideLink) {
        // 在链接文本内，不转换
        result += pattern;
      } else {
        result += '[' + pattern + '](' + url + ')';
      }
      remaining = remaining.slice(idx + pattern.length);
    }
    text = result;
  }
  return text;
}

/** 拆分为代码段（内联代码 + 围栏代码块）和非代码段 */
function splitCodeSegments(content: string): { text: string; isCode: boolean }[] {
  const regex = /(`[^`]+`|```[\s\S]*?```)/g;
  const segments: { text: string; isCode: boolean }[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ text: content.slice(lastIdx, m.index), isCode: false });
    }
    segments.push({ text: m[0], isCode: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < content.length) {
    segments.push({ text: content.slice(lastIdx), isCode: false });
  }
  return segments;
}

export function resolveWikiLinks(content: string, allSlugs: Set<string>): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, slug: string) => {
    const [target, alias] = slug.split("|");
    const t = (target || "").trim();
    const d = (alias || t).trim();
    if (allSlugs.has(t)) return `[${d}](/posts/${encodeURIComponent(t)})`;
    return `~~${d}~~`;
  });
}
